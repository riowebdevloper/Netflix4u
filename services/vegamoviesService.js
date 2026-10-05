/**
 * Netflix4U Vegamovies Provider Service
 * Integration with Vegamovies Search, AllMovieLand Streaming & Direct NexDrive/V-Cloud Downloads
 */
const https = require('https');

const VEGAMOVIES_BASE = 'https://vegamoviess.io';
const vegamoviesSearchCache = new Map();
const vegamoviesPostCache = new Map();

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
 * Fetch HTML via HTTPS GET / POST
 */
function fetchHtml(url, postData = null, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return resolve(null);
    }

    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: postData ? 'POST' : 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...(postData ? {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        } : {})
      },
      timeout: timeoutMs
    };

    const req = https.request(options, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchHtml(res.headers.location, null, timeoutMs).then(resolve);
      }
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    if (postData) req.write(postData);
    req.end();
  });
}

/**
 * Search Vegamovies via POST request to index.php?do=search
 */
async function searchVegamovies(query) {
  if (!query || query.trim().length < 2) return [];
  const cacheKey = query.trim().toLowerCase();
  if (vegamoviesSearchCache.has(cacheKey)) {
    const hit = vegamoviesSearchCache.get(cacheKey);
    if (Date.now() - hit.timestamp < 1800 * 1000) return hit.data;
  }

  // Single or two clean words work best with DLE search
  const cleanKeywords = query.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const searchTerms = [cleanKeywords];
  const words = cleanKeywords.split(' ');
  if (words.length > 2) {
    searchTerms.push(words.slice(0, 2).join(' '));
  } else if (words[0] && words[0].length >= 3 && words[0] !== cleanKeywords) {
    searchTerms.push(words[0]);
  }

  let results = [];
  for (const term of searchTerms) {
    const postData = `do=search&subaction=search&story=${encodeURIComponent(term)}`;
    const html = await fetchHtml(`${VEGAMOVIES_BASE}/index.php?do=search`, postData);
    if (!html) continue;

    const matches = [...html.matchAll(/<a[^>]*href="(https:\/\/vegamoviess\.io\/\d+-[^"]+\.html)"[^>]*title="([^"]+)"/g)];
    if (matches.length > 0) {
      results = matches.map(m => ({
        url: m[1],
        title: m[2].replace(/&amp;/g, '&').replace(/&#038;/g, '&')
      }));
      break;
    }
  }

  vegamoviesSearchCache.set(cacheKey, { timestamp: Date.now(), data: results });
  return results;
}

/**
 * Extract streaming player & download links from a Vegamovies post HTML
 */
function extractVegamoviesPostData(postHtml, postUrl) {
  if (!postHtml) return null;

  // 1. Extract IMDb ID / Stream source
  let imdbId = null;
  const indMatch = postHtml.match(/IndStreamPlayerConfigs\s*=\s*{[\s\S]*?src:\s*['"]([^'"]+)['"]/i);
  if (indMatch && indMatch[1] && indMatch[1].startsWith('tt')) {
    imdbId = indMatch[1];
  }
  if (!imdbId) {
    const altImdb = postHtml.match(/(?:imdb\.com\/title\/|(?:IMDb|imdb)\/)(tt\d+)/i) || postHtml.match(/\b(tt\d{7,10})\b/);
    if (altImdb) imdbId = altImdb[1];
  }

  // 2. Extract Streaming URL (Server 3: AllMovieLand / slast430did.com)
  const streamUrl = imdbId ? `https://slast430did.com/play/${encodeURIComponent(imdbId)}` : null;

  // 3. Extract Download Links from download-links-div / post content
  const downloads = [];
  const btnRegex = /<a class="btn"[^>]*href="([^"]+)"[\s\S]*?<button class="dwd-button">([\s\S]*?)<\/button>/gi;
  let bm;
  while ((bm = btnRegex.exec(postHtml)) !== null) {
    const href = bm[1].trim();
    const rawBtn = bm[2].replace(/<[^>]+>/g, '').trim();
    const sizeMatch = rawBtn.match(/\[(.*?)\]/);
    const size = sizeMatch ? sizeMatch[1].trim() : '';

    let quality = 'HD';
    const preText = postHtml.substring(Math.max(0, bm.index - 250), bm.index);
    const qText = `${preText} ${rawBtn} ${href}`.toLowerCase();
    if (/4k|2160p/i.test(qText)) quality = '4K';
    else if (/1080p/i.test(qText)) quality = '1080p';
    else if (/720p/i.test(qText)) quality = '720p';
    else if (/480p/i.test(qText)) quality = '480p';

    if (size) {
      const numMatch = size.match(/([\d\.]+)\s*(gb|mb)/i);
      if (numMatch) {
        const val = parseFloat(numMatch[1]);
        const unit = numMatch[2].toLowerCase();
        if (unit === 'mb' && val < 750) quality = '480p';
        else if (unit === 'gb' && val >= 2.8) quality = '1080p';
        else if (unit === 'gb' && val >= 0.9 && val < 2.8 && quality === 'HD') quality = '720p';
      }
    }

    downloads.push({
      url: href,
      quality,
      size,
      label: rawBtn || `Download [${quality}]`,
      isCloud: false,
      source: 'vegamovies',
      provider: 'vegamovies'
    });
  }

  return {
    url: postUrl,
    imdbId,
    streamUrl,
    downloads
  };
}

/**
 * Fetch and extract details for a specific Vegamovies post URL
 */
async function fetchVegamoviesPostDetails(postUrl) {
  if (!postUrl) return null;
  if (vegamoviesPostCache.has(postUrl)) {
    const hit = vegamoviesPostCache.get(postUrl);
    if (Date.now() - hit.timestamp < 3600 * 1000) return hit.data;
  }

  const html = await fetchHtml(postUrl);
  if (!html) return null;

  const data = extractVegamoviesPostData(html, postUrl);
  if (data) {
    vegamoviesPostCache.set(postUrl, { timestamp: Date.now(), data });
  }
  return data;
}

/**
 * Match and resolve Vegamovies streaming and download links for a title
 */
async function resolveVegamoviesForTitle(title, year = null, knownImdbId = null) {
  if (!title && !knownImdbId) return null;

  // Search by title or known IMDb ID
  const query = title || knownImdbId;
  const results = await searchVegamovies(query);
  if (!results || !results.length) {
    // If no search results found by full title, try known IMDb ID if present
    if (knownImdbId && knownImdbId.startsWith('tt')) {
      return {
        source: 'vegamovies',
        imdbId: knownImdbId,
        streamUrl: `https://slast430did.com/play/${encodeURIComponent(knownImdbId)}`,
        downloads: []
      };
    }
    return null;
  }

  const cleanTarget = cleanTitle(title);
  let bestPost = null;

  for (const item of results) {
    const itemTitle = cleanTitle(item.title);
    if (!itemTitle) continue;

    const targetWords = cleanTarget.split(' ').filter(Boolean);
    const matchesName = itemTitle.includes(cleanTarget) || cleanTarget.includes(itemTitle) ||
      (targetWords.length > 1 && targetWords.every(w => itemTitle.includes(w)));
    if (!matchesName) continue;

    if (year && item.title) {
      const yearMatch = item.title.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch && Math.abs(parseInt(yearMatch[1], 10) - parseInt(year, 10)) <= 1) {
        bestPost = item;
        break;
      }
    }

    if (!bestPost) bestPost = item;
  }

  if (!bestPost) bestPost = results[0];

  const postDetails = await fetchVegamoviesPostDetails(bestPost.url);
  if (!postDetails) return null;

  const effectiveImdbId = postDetails.imdbId || knownImdbId || null;
  const effectiveStreamUrl = postDetails.streamUrl || (effectiveImdbId ? `https://slast430did.com/play/${encodeURIComponent(effectiveImdbId)}` : null);

  return {
    source: 'vegamovies',
    postTitle: bestPost.title,
    postUrl: bestPost.url,
    imdbId: effectiveImdbId,
    streamUrl: effectiveStreamUrl,
    downloads: postDetails.downloads || []
  };
}

module.exports = {
  VEGAMOVIES_BASE,
  searchVegamovies,
  fetchVegamoviesPostDetails,
  extractVegamoviesPostData,
  resolveVegamoviesForTitle
};
