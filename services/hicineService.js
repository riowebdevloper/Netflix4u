/**
 * Netflix4U HiCine Provider Service
 * Direct Integration with HiCine API & High-Speed Cloudflare R2 Worker Engine
 */
const https = require('https');

const HICINE_API_BASE = 'https://api.hicine.biz';
const HICINE_API_KEY = 'hicine_website_secret_2025_exi9epdmrns';
const DEFAULT_WORKER_HOST = 'white-bush-34ba.grekot.workers.dev';

// In-memory caches to minimize external roundtrips
const hicineSearchCache = new Map();
const hicineR2Cache = new Map();

function cleanTitle(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/\b(19\d{2}|20\d{2})\b/g, '')
    .replace(/[\[\(].*?[\]\)]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[:\-–—.,!?_]/g, ' ')
    .replace(/\b(and|the|a|an)\b/gi, ' ')
    .replace(/\b(hindi|english|tamil|telugu|malayalam|kannada|dual|audio|web-?dl|bluray|hdrip|hevc|x264|x265)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Perform HTTPS GET request with JSON response
 */
function getJson(url, headers = {}, timeoutMs = 7000) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...headers
      },
      timeout: timeoutMs
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * Search HiCine database for content
 */
async function searchHicine(query) {
  if (!query || query.trim().length < 2) return [];
  const cacheKey = query.trim().toLowerCase();
  if (hicineSearchCache.has(cacheKey)) {
    const hit = hicineSearchCache.get(cacheKey);
    if (Date.now() - hit.timestamp < 1800 * 1000) return hit.data;
  }

  // Use the cleanest core keyword search (first 1-3 alphanumeric words) for highest RPC recall
  const cleanKeywords = query.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const searchTerms = [cleanKeywords];
  const firstWord = cleanKeywords.split(' ')[0];
  if (firstWord && firstWord.length >= 3 && firstWord !== cleanKeywords) {
    searchTerms.push(firstWord);
  }

  let results = [];
  for (const term of searchTerms) {
    const url = `${HICINE_API_BASE}/rpc/search/${encodeURIComponent(term)}`;
    const res = await getJson(url, {
      'x-api-key': HICINE_API_KEY,
      'Accept': 'application/json'
    });
    if (Array.isArray(res) && res.length > 0) {
      results = res;
      break;
    }
  }

  hicineSearchCache.set(cacheKey, { timestamp: Date.now(), data: results });
  return results;
}

/**
 * Fetch full item details including links if search result only has summary
 */
async function getHicineFullRecord(sourceTable, recordId) {
  if (!sourceTable || !recordId) return null;
  const url = `${HICINE_API_BASE}/api/${encodeURIComponent(sourceTable)}/${encodeURIComponent(recordId)}`;
  return await getJson(url, {
    'x-api-key': HICINE_API_KEY,
    'Accept': 'application/json'
  });
}

/**
 * Parse HiCine raw links string into structured streaming & download items
 */
function parseHicineRawLinks(rawLinks, defaultTitle = 'Media') {
  if (!rawLinks) return [];
  const lines = String(rawLinks).split('\n').map(l => l.trim()).filter(Boolean);
  const parsed = [];

  for (const line of lines) {
    const parts = line.split(',').map(p => p.trim());
    const rawUrl = parts[0];
    if (!rawUrl || !rawUrl.startsWith('http')) continue;

    // Last part is typically size, second to last is label
    const size = parts[parts.length - 1] || '';
    const label = parts[parts.length - 2] || defaultTitle;

    let quality = 'HD';
    const textToCheck = `${label} ${rawUrl} ${size}`.toLowerCase();
    if (/4k|2160p/i.test(textToCheck)) quality = '4K';
    else if (/1080p/i.test(textToCheck)) quality = '1080p';
    else if (/720p/i.test(textToCheck)) quality = '720p';
    else if (/480p/i.test(textToCheck)) quality = '480p';

    parsed.push({
      url: rawUrl,
      quality,
      size: size.replace(/^[,\s]+|[,\s]+$/g, ''),
      label: label.replace(/^[,\s]+|[,\s]+$/g, ''),
      isCloud: true,
      source: 'Fast Cloud (HiCine)',
      provider: 'hicine'
    });
  }

  return parsed;
}

/**
 * Resolve direct high-speed Cloudflare R2 MP4/MKV stream and download URL from worker
 */
async function resolveHicineR2Url(vcloudWorkerUrl, preferredType = 'fsl') {
  if (!vcloudWorkerUrl) return null;
  const cacheKey = vcloudWorkerUrl.toLowerCase();
  if (hicineR2Cache.has(cacheKey)) {
    const hit = hicineR2Cache.get(cacheKey);
    if (Date.now() - hit.timestamp < 3600 * 1000) return hit.data;
  }

  let cleanVcloud = vcloudWorkerUrl;
  const vMatch = cleanVcloud.match(/[?&]vcloud=([^&#]+)/);
  if (vMatch) cleanVcloud = decodeURIComponent(vMatch[1]);

  const workerHost = (vcloudWorkerUrl.match(/https:\/\/([a-z0-9\-]+\.workers\.dev)/i) || [])[1] || DEFAULT_WORKER_HOST;
  const linksUrl = `https://${workerHost}/api/links?vcloud=${encodeURIComponent(cleanVcloud)}`;

  const linksData = await getJson(linksUrl, { 'User-Agent': 'Mozilla/5.0' }, 6000);
  if (!linksData || !linksData.tokens) return null;

  const tokens = linksData.tokens;
  const candidateTypes = [preferredType, 'fsl', 'fsl2', 'pixel', 'server1', 'ten'];
  const activeType = candidateTypes.find(t => tokens[t]) || Object.keys(tokens)[0];
  if (!activeType || !tokens[activeType]) return null;

  const { ts, sig } = tokens[activeType];
  const goUrl = `https://${workerHost}/go?type=${activeType}&vcloud=${encodeURIComponent(cleanVcloud)}&ts=${ts}&sig=${sig}`;

  return new Promise((resolve) => {
    https.get(goUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 6000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const directResult = {
          ok: true,
          directUrl: res.headers.location,
          title: linksData.title || '',
          size: linksData.size || '',
          provider: 'hicine'
        };
        hicineR2Cache.set(cacheKey, { timestamp: Date.now(), data: directResult });
        return resolve(directResult);
      }
      resolve(null);
    }).on('error', () => resolve(null));
  });
}

/**
 * Match and resolve HiCine content for a given title and year
 */
async function resolveHicineForTitle(title, year = null) {
  if (!title) return null;
  const results = await searchHicine(title);
  if (!results || !results.length) return null;

  const cleanTarget = cleanTitle(title);
  let bestMatch = null;
  let sourceTable = null;

  for (const item of results) {
    const data = item.data || item;
    const itemTitle = cleanTitle(data.title || '');
    if (!itemTitle) continue;

    const targetWords = cleanTarget.split(' ').filter(Boolean);
    const matchesName = itemTitle.includes(cleanTarget) || cleanTarget.includes(itemTitle) ||
      (targetWords.length > 1 && targetWords.every(w => itemTitle.includes(w)));
    if (!matchesName) continue;

    if (year && data.title) {
      const yearMatch = data.title.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch && Math.abs(parseInt(yearMatch[1], 10) - parseInt(year, 10)) <= 1) {
        bestMatch = data;
        sourceTable = item.source_table;
        break;
      }
    }

    if (!bestMatch) {
      bestMatch = data;
      sourceTable = item.source_table;
    }
  }

  if (!bestMatch) return null;

  // If search only returned summary fields without raw links, fetch full record
  if (!bestMatch.links && sourceTable && bestMatch.record_id) {
    const full = await getHicineFullRecord(sourceTable, bestMatch.record_id);
    if (full && full.links) {
      bestMatch = { ...bestMatch, ...full };
    }
  }

  const parsedLinks = parseHicineRawLinks(bestMatch.links, bestMatch.title);
  return {
    source: 'hicine',
    title: bestMatch.title,
    featuredImage: bestMatch.featured_image,
    links: parsedLinks,
    recordId: bestMatch.record_id || bestMatch._id
  };
}

module.exports = {
  HICINE_API_BASE,
  HICINE_API_KEY,
  searchHicine,
  getHicineFullRecord,
  parseHicineRawLinks,
  resolveHicineR2Url,
  resolveHicineForTitle
};
