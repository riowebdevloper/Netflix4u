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
    .replace(/\b(season\s*\d+|episode\s*\d+|ep\s*\d+|s\d+|e\d+|part\s*\d+|vol\s*\d+)\b/gi, '')
    .replace(/\b(hindi|english|tamil|telugu|malayalam|kannada|dual|audio|web\s*dl|bluray|hdrip|hevc|x264|x265|dvdrip|webrip)\b/gi, '')
    .replace(/\b(\d{3,4}p|4k|2k|hd|sd|fhd|uhd)\b/gi, '')
    .replace(/[:\-–—.,!?_]/g, ' ')
    .replace(/\b(and|the|a|an)\b/gi, ' ')
    .replace(/\b(hindi|english|tamil|telugu|malayalam|kannada|dual|audio|web\s*dl|bluray|hdrip|hevc|x264|x265|dvdrip|webrip|web|dl)\b/gi, '')
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
 * Parse HiCine TV series records containing season_1..season_15 and season_zip
 */
function parseHicineSeriesRecord(series, defaultTitle = 'Series') {
  const parsed = [];
  if (!series) return parsed;

  // 1. Parse individual episodes from season_1 through season_15
  for (let s = 1; s <= 15; s++) {
    const sField = `season_${s}`;
    if (!series[sField] || typeof series[sField] !== 'string') continue;
    const lines = series[sField].split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const epMatch = line.match(/^Episode\s*(\d+)\s*:/i);
      if (!epMatch) continue;
      const epNum = parseInt(epMatch[1], 10);
      const rest = line.slice(epMatch[0].length);
      const segments = rest.split(/\s*:\s*(?=https:\/\/)/i);
      for (const seg of segments) {
        const urlMatch = seg.match(/https:\/\/[^\s,]+/);
        if (!urlMatch) continue;
        const url = urlMatch[0];
        let q = 'HD';
        if (/2160|4k/i.test(seg)) q = '4K';
        else if (/1080p/i.test(seg)) q = '1080p';
        else if (/720p/i.test(seg)) q = '720p';
        else if (/480p/i.test(seg)) q = '480p';
        const sizeMatch = seg.match(/([\d\.]+\s*(?:mb|gb))/i);
        parsed.push({
          url,
          season: s,
          episode: epNum,
          quality: q,
          size: sizeMatch ? sizeMatch[1] : '',
          label: `${defaultTitle} S${s} E${epNum} [${q}]`,
          isCloud: true,
          source: 'Fast Cloud (HiCine)',
          provider: 'hicine'
        });
      }
    }
  }

  // 2. Parse batch / full season zip links from season_zip
  if (series.season_zip && typeof series.season_zip === 'string') {
    const lines = series.season_zip.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const sMatch = line.match(/^Season\s*(\d+)\s*:/i);
      if (!sMatch) continue;
      const sNum = parseInt(sMatch[1], 10);
      const rest = line.slice(sMatch[0].length);
      const segments = rest.split(/\s*:\s*(?=https:\/\/)/i);
      for (const seg of segments) {
        const urlMatch = seg.match(/https:\/\/[^\s,]+/);
        if (!urlMatch) continue;
        const url = urlMatch[0];
        let q = 'Batch Pack';
        if (/2160|4k/i.test(seg)) q = '4K Full Zip';
        else if (/1080p/i.test(seg)) q = '1080p Full Zip';
        else if (/720p/i.test(seg)) q = '720p Full Zip';
        else if (/480p/i.test(seg)) q = '480p Full Zip';
        const sizeMatch = seg.match(/([\d\.]+\s*(?:mb|gb))/i);
        parsed.push({
          url,
          season: sNum,
          episode: null,
          isBatch: true,
          isPack: true,
          quality: q,
          size: sizeMatch ? sizeMatch[1] : '',
          label: `${defaultTitle} Season ${sNum} Complete Pack [${q}]`,
          isCloud: true,
          source: 'Fast Cloud (HiCine)',
          provider: 'hicine'
        });
      }
    }
  }

  return parsed;
}

/**
 * Match and resolve HiCine content for a given title, year, and media type
 */
async function resolveHicineForTitle(title, year = null, isTv = false) {
  if (!title) return null;
  const results = await searchHicine(title);
  if (!results || !results.length) return null;

  const cleanTarget = cleanTitle(title);
  let bestMatch = null;
  let sourceTable = null;

  const targetWords = cleanTarget.split(' ').filter(w => w.length > 1);

  for (const item of results) {
    const data = item.data || item;
    const itemTitle = cleanTitle(data.title || '');
    if (!itemTitle) continue;
    const table = String(item.source_table || '').toLowerCase();

    // Respect media type preference: series vs movies
    if (isTv && table && !table.includes('series') && !table.includes('anime')) {
      continue;
    }
    if (!isTv && table && table.includes('series')) {
      continue;
    }

    // Exact clean title match
    const isExact = (itemTitle === cleanTarget);

    // Word boundary check
    const allWordsMatch = targetWords.length > 0 && targetWords.every(tw => {
      const rx = new RegExp(`\\b${tw}\\b`, 'i');
      return rx.test(itemTitle);
    });

    if (!isExact && !allWordsMatch) continue;

    // Disallow single-word titles matching complex unrelated titles
    const itemWords = itemTitle.split(' ').filter(Boolean);
    if (!isExact && targetWords.length === 1 && itemWords.length > 2) {
      continue;
    }

    // Release year verification (within 1 year)
    if (year && data.title) {
      const yearMatch = data.title.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch) {
        const itemY = parseInt(yearMatch[1], 10);
        const targetY = parseInt(year, 10);
        if (Math.abs(itemY - targetY) > 1) {
          continue;
        }
      }
    }

    bestMatch = data;
    sourceTable = item.source_table;
    if (isExact) break;
  }

  if (!bestMatch) return null;

  // If search only returned summary fields without raw links or season data, fetch full record
  if (!bestMatch.links && !bestMatch.season_1 && sourceTable && bestMatch.record_id) {
    const full = await getHicineFullRecord(sourceTable, bestMatch.record_id);
    if (full) {
      bestMatch = { ...bestMatch, ...full };
    }
  }

  let parsedLinks = [];
  const isSeriesRecord = Boolean(
    isTv || (sourceTable && sourceTable.includes('series')) || bestMatch.season_1 || bestMatch.season_zip
  );

  if (isSeriesRecord) {
    parsedLinks = parseHicineSeriesRecord(bestMatch, bestMatch.title || title);
  }
  if (!parsedLinks.length && bestMatch.links) {
    parsedLinks = parseHicineRawLinks(bestMatch.links, bestMatch.title || title);
  }

  return {
    source: 'hicine',
    title: bestMatch.title,
    featuredImage: bestMatch.featured_image,
    links: parsedLinks,
    recordId: bestMatch.record_id || bestMatch._id,
    isSeries: isSeriesRecord
  };
}

module.exports = {
  HICINE_API_BASE,
  HICINE_API_KEY,
  searchHicine,
  getHicineFullRecord,
  parseHicineRawLinks,
  parseHicineSeriesRecord,
  resolveHicineR2Url,
  resolveHicineForTitle
};
