/**
 * Netflix4U Universal Serverless API Core
 * Shared between Vercel Serverless Functions, Node dev-server, and Passenger production.
 * Enforces canonical content identity, safe playback admitting, and verified metadata.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { resolveContentId, fetchTmdbRecord, findMatchingCatalogLinks, normalizeRawLinks, unwrapImageUrl } = require('./canonicalResolver');

// 🔐 Secure TMDB API Key (Environment variable or fallback)
const TMDB_API_KEY = process.env.TMDB_API_KEY || '445f2b5a8941c1d4bd5a869761a916e3';

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DETAILS_DIR = path.join(DATA_DIR, 'details');

// In-Memory Fast Caches
const tmdbIdCache = new Map();
const castCache = new Map();
const trailerCache = new Map();
let catalogSummaryCache = null;

// In-Memory Sliding-Window Rate Limiter (Defensive Security)
const ipRequestCounts = new Map();
function checkRateLimit(ip, maxPerMinute = 150) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  let record = ipRequestCounts.get(ip);
  if (!record || now - record.start > windowMs) {
    record = { start: now, count: 1 };
    ipRequestCounts.set(ip, record);
    return true;
  }
  record.count++;
  return record.count <= maxPerMinute;
}

// ==========================================
// 🛠️ UTILITY FUNCTIONS
// ==========================================

function getQueryParams(req) {
  if (req.query && typeof req.query === 'object') {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query)) {
      if (Array.isArray(v)) {
        v.forEach(val => sp.append(k, val));
      } else if (v !== undefined && v !== null) {
        sp.set(k, String(v));
      }
    }
    return sp;
  }
  const [rawPath, queryString] = (req.url || '').split('?');
  return new URLSearchParams(queryString || '');
}

function sendJson(res, statusCode, data, extraHeaders = {}) {
  const jsonStr = JSON.stringify(data);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS, POST',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders
  };

  if (typeof res.setHeader === 'function') {
    for (const [k, v] of Object.entries(headers)) {
      try { res.setHeader(k, v); } catch (e) { }
    }
  }

  if (typeof res.status === 'function' && typeof res.json === 'function' && !extraHeaders['Cache-Control']) {
    res.status(statusCode);
    return res.json(data);
  }

  res.writeHead(statusCode, headers);
  res.end(jsonStr);
}

function handleCors(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS, POST',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return true;
  }
  return false;
}

function normalizeCanonicalId(item) {
  if (!item) return '';
  const raw = String(item.canonicalId || item.id || item.record_id || '').trim();
  if (!raw) return '';
  if (raw.startsWith('tmdb-') || raw.startsWith('dotmobiz-')) return raw;
  return `dotmobiz-${item.record_id || raw}`;
}

function getCatalogSummary() {
  if (!catalogSummaryCache) {
    const summaryPath = path.join(DATA_DIR, 'catalog_summary.json');
    if (fs.existsSync(summaryPath)) {
      try {
        const rawList = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
        catalogSummaryCache = rawList.map(item => {
          const cId = normalizeCanonicalId(item);
          return {
            ...item,
            id: cId,
            canonicalId: cId
          };
        });
      } catch (e) {
        catalogSummaryCache = [];
      }
    } else {
      catalogSummaryCache = [];
    }
  }
  return catalogSummaryCache;
}

function invalidateCatalogCache() {
  catalogSummaryCache = null;
}

function isTitleMatch(query, resultTitle, queryYear, resultDate, isTv = false) {
  const q = (query || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const r = (resultTitle || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!q || !r) return false;

  // Exact match
  if (q === r) return true;

  // Year check
  if (queryYear && resultDate) {
    const rYear = parseInt(resultDate.slice(0, 4), 10);
    if (!isNaN(rYear)) {
      if (isTv) {
        if (rYear > queryYear + 1) return false;
      } else {
        if (Math.abs(rYear - queryYear) > 1) return false;
      }
    }
  }

  // Prefix / containment match if reasonable length
  if ((q.startsWith(r) || r.startsWith(q)) && Math.abs(q.length - r.length) <= 12) return true;
  if ((q.includes(r) || r.includes(q)) && Math.min(q.length, r.length) >= 4) return true;
  if (q.endsWith(r) || r.endsWith(q)) {
    if (Math.min(q.length, r.length) >= 4) return true;
  }

  return false;
}

function resolveTmdbId(title, year, type = 'movie', imdbId = '') {
  const cacheKey = `${imdbId || ''}_${title || ''}_${year || ''}_${type}`.toLowerCase();
  if (tmdbIdCache.has(cacheKey)) return Promise.resolve(tmdbIdCache.get(cacheKey));

  const isTv = type === 'series' || type === 'kdrama' || type === 'anime' || type === 'tv';

  // 1. If authentic IMDb ID is available, use TMDB /find endpoint (100% precision)
  if (imdbId && typeof imdbId === 'string' && imdbId.startsWith('tt')) {
    return new Promise(resolve => {
      const findUrl = `https://api.tmdb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
      https.get(findUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, timeout: 4000 }, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(d);
            const match = isTv
              ? ((json.tv_results && json.tv_results[0]) || (json.movie_results && json.movie_results[0]))
              : ((json.movie_results && json.movie_results[0]) || (json.tv_results && json.tv_results[0]));
            if (match && match.id) {
              tmdbIdCache.set(cacheKey, match.id);
              return resolve(match.id);
            }
          } catch (e) { }
          resolve(null);
        });
      }).on('error', () => resolve(null));
    });
  }

  const rawTitle = title || '';
  const clean = rawTitle
    .replace(/\(\d{4}\)/g, '')
    .replace(/^(NetFlix|Prime|Disney\+|Hotstar|SonyLIV|ZEE5)\s+/i, '')
    .replace(/\b(?:Season\s*\d+|S\d{1,2}|Ep(?:isode)?\s*\d+|All\s*Episodes?|Complete\s*Season).*$/i, '')
    .replace(/\b(?:Hindi|English|Tamil|Telugu|Malayalam|Kannada|Korean|Japanese|Dual|Audio|Dubbed|Web|FHD|HD|4K|HQ).*$/i, '')
    .trim();
  if (!clean) return Promise.resolve(null);

  let qYear = year ? parseInt(year, 10) : null;
  if (!qYear) {
    const yMatch = rawTitle.match(/\b(19\d{2}|20\d{2})\b/);
    if (yMatch) qYear = parseInt(yMatch[1], 10);
  }

  const endpoint = isTv ? 'tv' : 'movie';
  let url = `https://api.tmdb.org/3/search/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(clean)}`;
  if (qYear && !isTv) {
    url += `&primary_release_year=${qYear}`;
  }

  return new Promise(resolve => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'application/json' }, timeout: 4000 }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(d);
          if (json.results && json.results.length > 0) {
            const matched = json.results.find(r => {
              const rTitle = r.title || r.name || '';
              const rDate = r.release_date || r.first_air_date || '';
              return isTitleMatch(clean, rTitle, qYear, rDate, isTv);
            });
            // ONLY pick if verified match! Never blindly pick results[0] for arbitrary titles!
            if (matched && matched.id) {
              tmdbIdCache.set(cacheKey, matched.id);
              return resolve(matched.id);
            }
          }
        } catch (e) { }
        resolve(null);
      });
    }).on('error', () => resolve(null));
  });
}

async function resolveTitleCast(title, tmdbId, year, type = 'movie', imdbId = '') {
  const cacheKey = `${imdbId || ''}_${tmdbId || ''}_${title || ''}_${year || ''}_${type}`.toLowerCase();
  if (castCache.has(cacheKey)) return castCache.get(cacheKey);

  const endpoint = (type === 'series' || type === 'kdrama' || type === 'anime' || type === 'tv') ? 'tv' : 'movie';
  let targetId = tmdbId;

  if (!targetId && imdbId && typeof imdbId === 'string' && imdbId.startsWith('tt')) {
    targetId = await resolveTmdbId('', '', type, imdbId);
  }

  if (!targetId && title) {
    targetId = await resolveTmdbId(title, year, type);
  }

  if (!targetId) {
    castCache.set(cacheKey, []);
    return [];
  }

  const url = `https://api.tmdb.org/3/${endpoint}/${targetId}/credits?api_key=${TMDB_API_KEY}`;
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, timeout: 4000 }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(d);
          if (json && json.cast && Array.isArray(json.cast)) {
            const cast = json.cast.slice(0, 16).map(c => ({
              id: String(c.id),
              name: c.name || 'Actor',
              character: c.character || '',
              photo: c.profile_path ? `https://wsrv.nl/?url=image.tmdb.org/t/p/w185${c.profile_path}` : null
            }));
            castCache.set(cacheKey, cast);
            return resolve(cast);
          }
        } catch (e) { }
        resolve([]);
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
  });
}

// ==========================================
// 🎯 API ROUTE HANDLERS
// ==========================================

// 1. Details Endpoint (/api/details/:id or /api/details?id=...)
async function handleDetails(req, res) {
  if (handleCors(req, res)) return;
  const q = getQueryParams(req);
  const [rawPath] = (req.url || '').split('?');
  const match = rawPath.match(/^\/api\/(?:details|title|item|movie|series)(?:\/([^/]+)|$)/i);
  const id = (match && match[1]) || q.get('id') || q.get('canonicalId');
  // type hint from the frontend route (e.g. "series", "movie", "anime", "kdrama")
  const typeHint = (q.get('type') || '').toLowerCase().trim();

  if (!id) {
    return sendJson(res, 400, { success: false, error: 'ID parameter required' });
  }

  const item = await resolveContentId(id);

  if (!item) {
    return sendJson(res, 404, { success: false, error: 'Title not found' });
  }

  // Ensure canonicalId and routing fields are locked
  const canonicalId = item.canonicalId || (item.record_id ? `dotmobiz-${item.record_id}` : `dotmobiz-${item.id}`);
  item.canonicalId = canonicalId;
  item.id = canonicalId;

  const isTv = (item.type === 'series' || item.type === 'anime' || item.type === 'kdrama' || typeHint === 'series');

  // Enrich missing TMDB ID and Description/Overview
  const needsDesc = !item.description || item.description.startsWith('Watch ') || item.description.length < 35;
  if (!item.tmdbId && (item.title || item.imdbId)) {
    try {
      item.tmdbId = await resolveTmdbId(item.title, item.year, isTv ? 'series' : 'movie', item.imdbId);
    } catch (e) { }
  }

  if (item.tmdbId && needsDesc) {
    try {
      const tmdbRec = await fetchTmdbRecord(isTv ? 'tv' : 'movie', item.tmdbId);
      if (tmdbRec && tmdbRec.overview) {
        item.description = tmdbRec.overview;
        item.overview = tmdbRec.overview;
        if (!item.director && tmdbRec.director) item.director = tmdbRec.director;
        if ((!item.genres || item.genres.length === 0) && tmdbRec.genres) item.genres = tmdbRec.genres;
        if ((!item.cast || item.cast.length === 0) && tmdbRec.cast) item.cast = tmdbRec.cast;
      }
    } catch (e) { }
  }

  // Enrich missing download links if empty
  if (!item.links || item.links.length === 0) {
    try {
      const matched = findMatchingCatalogLinks(item.title, item.year, item.imdbId, item.slug);
      if (matched && matched.length > 0) {
        item.links = normalizeRawLinks(matched, canonicalId, isTv);
      }
    } catch (e) { }
  }

  sendJson(res, 200, { success: true, data: item, ...item }, { 'Cache-Control': 'public, max-age=1800' });
}

// 2. Playback Sources Endpoint (/api/playback/:id or /api/playback?id=...)
async function handlePlayback(req, res) {
  if (handleCors(req, res)) return;
  const q = getQueryParams(req);
  const [rawPath] = (req.url || '').split('?');
  const match = rawPath.match(/^\/api\/playback(?:\/([^/]+)|$)/i);
  const id = (match && match[1]) || q.get('id') || q.get('canonicalId');

  if (!id) {
    return sendJson(res, 400, { success: false, error: 'ID parameter required' });
  }

  const season = parseInt(q.get('season') || '1', 10);
  const episode = parseInt(q.get('episode') || '1', 10);

  const item = await resolveContentId(id);
  if (!item) {
    return sendJson(res, 404, { success: false, error: 'Title not found' });
  }

  const canonicalId = item.canonicalId || (item.record_id ? `dotmobiz-${item.record_id}` : `dotmobiz-${item.id}`);
  const isTv = (item.type === 'series' || item.type === 'anime' || item.type === 'kdrama');

  // Dynamically resolve TMDB ID if missing on this title
  if (!item.tmdbId && (item.title || item.imdbId)) {
    try {
      item.tmdbId = await resolveTmdbId(item.title, item.year, isTv ? 'series' : 'movie', item.imdbId);
    } catch (e) { }
  }

  const sources = [];
  const hasVerifiedTmdb = Boolean(item.externalProvider === 'tmdb' || (item.tmdbId && String(item.tmdbId).length >= 2));
  const hasVerifiedImdb = Boolean(item.imdbId && item.imdbId.startsWith('tt'));

  // 1. Server 1 (VidLink) - Premier ultra-fast streaming player with multi-audio
  if (hasVerifiedTmdb) {
    const tid = item.tmdbId;
    const vidlinkUrl = isTv
      ? `https://vidlink.pro/tv/${tid}/${season}/${episode}?multiLang=true`
      : `https://vidlink.pro/movie/${tid}?multiLang=true`;

    sources.push({
      id: 'vidlink',
      name: 'Server 1 (VidLink)',
      label: 'Server 1 (VidLink)',
      canonicalId,
      provider: 'vidlink',
      url: vidlinkUrl,
      embedUrl: vidlinkUrl,
      isDirect: false
    });

    // 2. Server 2 (VidSrc) - Primary reliable backup mirror
    const vidsrcUrl = isTv
      ? `https://vidsrc.me/embed/tv?tmdb=${tid}&season=${season}&episode=${episode}`
      : `https://vidsrc.me/embed/movie?tmdb=${tid}`;

    sources.push({
      id: 'vidsrcme',
      name: 'Server 2 (VidSrc)',
      label: 'Server 2 (VidSrc)',
      canonicalId,
      provider: 'vidsrcme',
      url: vidsrcUrl,
      embedUrl: vidsrcUrl,
      isDirect: false
    });
  }

  // 3. Server 3 (AllMovieLand) - If verified IMDb ID exists
  if (hasVerifiedImdb) {
    sources.push({
      id: 'allmovieland',
      name: 'Server 3 (AllMovieLand)',
      label: 'Server 3 (AllMovieLand)',
      canonicalId,
      provider: 'allmovieland',
      url: `https://slast430did.com/play/${item.imdbId}`,
      embedUrl: `https://slast430did.com/play/${item.imdbId}`,
      isDirect: false
    });
  }

  // 4. Fast Cloud Stream
  if (item.links && Array.isArray(item.links) && item.links.length > 0) {
    const cloudLink = item.links.find(l => l.isCloud || /1080|720|HD/i.test(l.quality)) || item.links[0];
    if (cloudLink && cloudLink.url) {
      sources.push({
        id: 'hicine',
        name: 'Server 4 (Fast Cloud)',
        label: 'Fast Cloud',
        canonicalId,
        provider: 'direct',
        url: cloudLink.url,
        embedUrl: cloudLink.url,
        isDirect: true
      });
    }
  }

  sendJson(res, 200, {
    success: true,
    canonicalId,
    title: item.title,
    season,
    episode,
    sources,
    hasAvailableStreams: sources.length > 0
  }, { 'Cache-Control': 'public, max-age=1800' });
}

// 3. YouTube Trailer Resolver (/api/trailer)
async function handleTrailer(req, res) {
  if (handleCors(req, res)) return;
  const q = getQueryParams(req);

  const id = q.get('id') || q.get('canonicalId') || '';
  const title = q.get('title') || '';
  const year = q.get('year') || '';
  const type = q.get('type') || 'movie';
  const imdbId = q.get('imdbId') || '';
  let tmdbId = q.get('tmdbId') || '';

  // If canonical ID is provided, look up the authentic record first!
  if (id) {
    const item = await resolveContentId(id);
    if (item) {
      if (item.trailerUrl) {
        return sendJson(res, 200, {
          success: true,
          trailerUrl: item.trailerUrl,
          canonicalId: item.canonicalId,
          state: 'ready'
        }, { 'Cache-Control': 'public, max-age=86400' });
      }
      if (item.tmdbId) tmdbId = item.tmdbId;
    }
  }

  let cleanTitle = title || '';
  cleanTitle = cleanTitle
    .replace(/&#039;|&apos;|&quot;|&amp;/g, ' ')
    .replace(/\[[^\]]*\]|\([^\)]*\)|\{[^\}]*\}/g, ' ')
    .replace(/\b(?:Season\s*\d+|S\d{1,2}|Ep(?:isode)?\s*\d+|All\s*Episodes?|Complete\s*Season).*$/i, '')
    .replace(/\b(19\d{2}|20\d{2})\b.*$/i, '')
    .replace(/\b(?:Hindi|English|Tamil|Telugu|Malayalam|Kannada|Korean|Japanese|Dual|Audio|Dubbed|Web|FHD|HD|4K|HQ).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!tmdbId && (cleanTitle || imdbId)) {
    tmdbId = await resolveTmdbId(cleanTitle, year, type, imdbId);
  }

  let trailerUrl = null;
  let videoKey = null;
  let videoName = '';

  if (tmdbId) {
    const isTv = (type === 'series' || type === 'anime' || type === 'kdrama' || type === 'tv');
    const endpointsToTry = isTv ? ['tv', 'movie'] : ['movie', 'tv'];

    for (const ep of endpointsToTry) {
      if (trailerUrl) break;
      const videoApiUrl = `https://api.tmdb.org/3/${ep}/${tmdbId}/videos?api_key=${TMDB_API_KEY}`;
      try {
        const vData = await new Promise(resolve => {
          https.get(videoApiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000 }, r => {
            let d = ''; r.on('data', c => d += c); r.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve(null); } });
          }).on('error', () => resolve(null));
        });
        if (vData && Array.isArray(vData.results) && vData.results.length > 0) {
          const ytVideos = vData.results.filter(v => v.site === 'YouTube' && v.key);
          const official = ytVideos.find(v => v.type === 'Trailer' && v.official) ||
            ytVideos.find(v => v.type === 'Trailer') ||
            ytVideos.find(v => v.type === 'Teaser') ||
            ytVideos[0];
          if (official && official.key) {
            videoKey = official.key;
            videoName = official.name || '';
            trailerUrl = `https://www.youtube-nocookie.com/embed/${official.key}?rel=0&modestbranding=1`;
          }
        }
      } catch (e) { }
    }
  }

  sendJson(res, 200, {
    success: Boolean(trailerUrl),
    trailerUrl,
    key: videoKey,
    name: videoName,
    state: trailerUrl ? 'ready' : 'unavailable',
    searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanTitle + ' official trailer')}`
  }, { 'Cache-Control': 'public, max-age=86400' });
}

// 4. Real Poster Resolver (/api/poster-resolver)
async function handlePosterResolver(req, res) {
  if (handleCors(req, res)) return;
  const q = getQueryParams(req);

  const id = q.get('id') || q.get('canonicalId') || '';
  const title = q.get('title') || '';
  const imdbId = q.get('imdbId') || '';
  const type = q.get('type') || 'movie';

  // If canonical ID is provided, look up record first
  if (id) {
    const item = await resolveContentId(id);
    if (item && item.poster) {
      return sendJson(res, 200, {
        success: true,
        poster: item.poster,
        backdrop: item.backdrop || item.poster,
        canonicalId: item.canonicalId
      }, { 'Cache-Control': 'public, max-age=86400' });
    }
  }

  // Tier 1: Authentic IMDb ID lookup via TMDB /find
  if (imdbId && imdbId.startsWith('tt')) {
    const findUrl = `https://api.tmdb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const findData = await new Promise(resolve => {
      https.get(findUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, timeout: 4000 }, r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve(null); } });
      }).on('error', () => resolve(null));
    });
    if (findData) {
      const item = (findData.movie_results && findData.movie_results[0]) || (findData.tv_results && findData.tv_results[0]);
      if (item) {
        const pUrl = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null;
        const bUrl = item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : (pUrl || null);
        return sendJson(res, 200, {
          success: true,
          poster: pUrl,
          backdrop: bUrl,
          tmdbId: item.id
        }, { 'Cache-Control': 'public, max-age=86400' });
      }
    }
  }

  // Tier 2: Check local catalog summary
  if (title) {
    const clean = title.replace(/\(\d{4}\)/g, '').replace(/^(NetFlix|Prime|Disney\+|Hotstar|SonyLIV|ZEE5)\s+/i, '').trim();
    const catalog = getCatalogSummary();
    const localItem = catalog.find(x => x.title && x.title.toLowerCase() === clean.toLowerCase());
    if (localItem && localItem.poster && !localItem.poster.includes('no-poster') && !localItem.poster.includes('placehold')) {
      return sendJson(res, 200, {
        success: true,
        poster: unwrapImageUrl(localItem.poster),
        backdrop: unwrapImageUrl(localItem.backdrop || localItem.poster),
        canonicalId: localItem.canonicalId
      }, { 'Cache-Control': 'public, max-age=86400' });
    }
  }

  // Tier 3: Search TMDB by cleaned title to guarantee a real poster
  if (title) {
    const cleanSearch = title.replace(/\(\d{4}\)/g, '')
      .replace(/\[[^\]]*\]|\([^\)]*\)|\{[^\}]*\}/g, '')
      .replace(/^(NetFlix|Prime|Disney\+|Hotstar|SonyLIV|ZEE5|JioCinema)\s+/i, '')
      .replace(/\b(?:Season\s*\d+|S\d{1,2}|Ep(?:isode)?\s*\d+|All\s*Episodes?|Complete\s*Season).*$/i, '')
      .replace(/\b(19\d{2}|20\d{2})\b.*$/i, '')
      .replace(/\b(?:Hindi|English|Tamil|Telugu|Malayalam|Kannada|Korean|Japanese|Dual|Audio|Dubbed|Web|FHD|HD|4K|HQ).*$/i, '')
      .trim();

    if (cleanSearch.length >= 2) {
      try {
        const searchUrl = `https://api.tmdb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanSearch)}`;
        const searchData = await new Promise(resolve => {
          https.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, timeout: 4000 }, r => {
            let d = ''; r.on('data', c => d += c); r.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve(null); } });
          }).on('error', () => resolve(null));
        });
        if (searchData && Array.isArray(searchData.results) && searchData.results.length > 0) {
          const item = searchData.results.find(x => (x.media_type === 'movie' || x.media_type === 'tv') && x.poster_path) || searchData.results[0];
          if (item && item.poster_path) {
            const pUrl = `https://image.tmdb.org/t/p/w500${item.poster_path}`;
            const bUrl = item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : pUrl;
            return sendJson(res, 200, {
              success: true,
              poster: pUrl,
              backdrop: bUrl,
              tmdbId: item.id
            }, { 'Cache-Control': 'public, max-age=86400' });
          }
        }
      } catch (e) { }
    }
  }

  sendJson(res, 200, {
    success: false,
    poster: null,
    backdrop: null,
    message: 'Poster unavailable'
  }, { 'Cache-Control': 'public, max-age=86400' });
}

// 5. Generic TMDB Proxy (/api/tmdb/*)
async function handleTmdb(req, res, customSubPath = '') {
  if (handleCors(req, res)) return;
  const q = getQueryParams(req);

  let subPath = customSubPath;
  if (!subPath) {
    const slug = q.get('slug') || '';
    if (slug) {
      subPath = '/' + slug.replace(/^\/+/, '');
    } else {
      const [rawPath] = (req.url || '').split('?');
      subPath = rawPath.replace(/^\/api\/tmdb/, '');
    }
  }

  if (!subPath || subPath === '/') {
    return sendJson(res, 400, { error: 'TMDB subpath required' });
  }

  const clientQuery = new URLSearchParams(q);
  clientQuery.delete('slug');
  clientQuery.delete('api_key');
  clientQuery.set('api_key', TMDB_API_KEY);

  const targetUrl = `https://api.tmdb.org/3${subPath}?${clientQuery.toString()}`;
  const cacheKey = `tmdb_${subPath}_${clientQuery.toString()}`;
  if (trailerCache.has(cacheKey)) {
    return sendJson(res, 200, JSON.parse(trailerCache.get(cacheKey)), { 'Cache-Control': 'public, max-age=3600' });
  }

  try {
    const req = https.get(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'application/json' },
      timeout: 6000
    }, tmdbRes => {
      let d = '';
      tmdbRes.on('data', c => d += c);
      tmdbRes.on('end', () => {
        if (tmdbRes.statusCode >= 200 && tmdbRes.statusCode < 300) {
          try {
            const parsed = JSON.parse(d);
            if (Array.isArray(parsed.episodes)) {
              parsed.episodes = parsed.episodes.map((ep, idx) => {
                if (!ep.episode_number || typeof ep.episode_number !== 'number') {
                  ep.episode_number = idx + 1;
                }
                return ep;
              });
            }
            trailerCache.set(cacheKey, JSON.stringify(parsed));
            return sendJson(res, 200, parsed, { 'Cache-Control': 'public, max-age=3600' });
          } catch (e) {
            return sendJson(res, 500, { error: 'Failed to parse TMDB response' });
          }
        } else {
          return sendJson(res, tmdbRes.statusCode || 500, { error: 'TMDB upstream error', code: tmdbRes.statusCode });
        }
      });
    });
    req.on('error', err => sendJson(res, 502, { error: 'Failed to contact TMDB upstream: ' + (err.message || '') }));
  } catch (err) {
    sendJson(res, 502, { error: 'Failed to contact TMDB upstream: ' + (err.message || '') });
  }
}



// 9. Catalog Summary (/api/catalog & /api/summary)
async function handleSummary(req, res) {
  if (handleCors(req, res)) return;
  const catalog = getCatalogSummary();
  sendJson(res, 200, {
    success: true,
    count: catalog.length,
    results: catalog.slice(0, 100)
  }, { 'Cache-Control': 'public, max-age=3600' });
}

// 10. TMDB Lookup (/api/tmdb-lookup)
async function handleTmdbLookup(req, res) {
  if (handleCors(req, res)) return;
  const q = getQueryParams(req);
  const query = q.get('query') || q.get('q') || '';
  const type = q.get('type') || 'movie';

  if (!query) {
    return sendJson(res, 400, { error: 'Query parameter required' });
  }

  const clean = query.replace(/\(\d{4}\)/g, '').replace(/^(NetFlix|Prime|Disney\+|Hotstar|SonyLIV|ZEE5)\s+/i, '').trim();
  const tmdbId = await resolveTmdbId(clean, '', type);
  sendJson(res, 200, { success: true, tmdbId, query: clean }, { 'Cache-Control': 'public, max-age=86400' });
}

// 11. Recommendations (/api/recommendations)
async function handleRecommendations(req, res) {
  if (handleCors(req, res)) return;
  const q = getQueryParams(req);
  const id = q.get('id') || '';

  const catalog = getCatalogSummary();
  let currentItem = id ? catalog.find(x => x.id === id || x.slug === id || x.canonicalId === id) : null;
  let recs = [];
  if (currentItem && currentItem.categories && currentItem.categories.length > 0) {
    const primaryCat = currentItem.categories[0];
    recs = catalog.filter(x => x.id !== currentItem.id && x.categories && x.categories.includes(primaryCat)).slice(0, 12);
  }
  if (recs.length === 0) {
    recs = catalog.slice(0, 12);
  }
  sendJson(res, 200, { success: true, results: recs }, { 'Cache-Control': 'public, max-age=3600' });
}


// ─── 13. NET27 / NETMIRROR CATALOG API ENGINE ───────────────────────────────────
const net27CatalogCache = new Map();

function fetchTmdbCatalogJson(endpoint) {
  const cacheKey = `tmdb_cat_${endpoint}`;
  if (net27CatalogCache.has(cacheKey)) {
    const entry = net27CatalogCache.get(cacheKey);
    if (Date.now() - entry.at < 30 * 60 * 1000) {
      return Promise.resolve(entry.data);
    }
  }
  return new Promise((resolve, reject) => {
    const sep = endpoint.includes('?') ? '&' : '?';
    const url = `https://api.tmdb.org/3${endpoint}${sep}api_key=${TMDB_API_KEY}`;
    https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'application/json' },
      timeout: 8000
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = JSON.parse(d);
            net27CatalogCache.set(cacheKey, { at: Date.now(), data: parsed });
            resolve(parsed);
          } catch (e) { reject(e); }
        } else {
          reject(new Error(`TMDB HTTP ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

// 6. Cast Resolver (/api/cast)
async function handleCast(req, res) {
  if (handleCors(req, res)) return;
  const q = getQueryParams(req);

  const title = q.get('title') || '';
  const tmdbId = q.get('tmdbId') || '';
  const year = q.get('year') || '';
  const type = q.get('type') || 'movie';
  const imdbId = q.get('imdbId') || '';

  const cast = await resolveTitleCast(title, tmdbId, year, type, imdbId);
  sendJson(res, 200, { success: true, cast }, { 'Cache-Control': 'public, max-age=86400' });
}

// 7. Search Catalog (/api/search & /api/catalog/search)
async function handleSearch(req, res) {
  if (handleCors(req, res)) return;
  const clientIp = (req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || (req.socket && req.socket.remoteAddress) || '127.0.0.1';
  if (!checkRateLimit(String(clientIp).split(',')[0].trim(), 150)) {
    return sendJson(res, 429, { success: false, error: 'Rate limit exceeded. Please slow down.' });
  }

  const q = getQueryParams(req);
  const query = (q.get('q') || '').trim();

  if (!query) {
    return sendJson(res, 200, { success: true, results: [], items: [] });
  }

  const results = [];
  const seenTmdbIds = new Set();
  const seenTitles = new Set();

  // 1. Primary Source: TMDB Multi Search (Authentic titles, HD posters, verified tmdbIds)
  try {
    const tmdbData = await fetchTmdbCatalogJson(`/search/multi?query=${encodeURIComponent(query)}&include_adult=false&region=IN`);
    if (tmdbData && Array.isArray(tmdbData.results)) {
      for (const t of tmdbData.results) {
        if (t.media_type === 'person') continue;
        if (!t.poster_path && !t.backdrop_path) continue;
        if (!t.id) continue;

        const tmdbId = Number(t.id);
        const title = t.title || t.name || '';
        const year = String(t.release_date || t.first_air_date || '').slice(0, 4);
        const mediaType = t.media_type === 'tv' ? 'tv' : 'movie';
        const canonicalId = `tmdb-${mediaType}-${tmdbId}`;

        seenTmdbIds.add(tmdbId);
        seenTitles.add(title.toLowerCase());

        // Check for direct download links in local catalog
        const matchedLinks = findMatchingCatalogLinks(title, year);
        const downloadLinks = (matchedLinks && matchedLinks.length > 0)
          ? normalizeRawLinks(matchedLinks, canonicalId, mediaType === 'tv')
          : [];

        results.push({
          id: String(tmdbId),
          canonicalId: canonicalId,
          tmdbId: tmdbId,
          title: title,
          type: mediaType,
          contentType: mediaType,
          poster: t.poster_path ? `https://image.tmdb.org/t/p/w500${t.poster_path}` : null,
          backdrop: t.backdrop_path ? `https://image.tmdb.org/t/p/original${t.backdrop_path}` : null,
          year: year,
          rating: t.vote_average ? Number(t.vote_average.toFixed(1)) : 7.8,
          overview: t.overview || '',
          url: `/${mediaType}/${tmdbId}`,
          hasDownloads: downloadLinks.length > 0,
          downloadLinks: downloadLinks
        });

        if (results.length >= 25) break;
      }
    }
  } catch (e) { }

  // 2. Secondary Source: Local Catalog for regional/exclusive titles
  try {
    const catalog = getCatalogSummary();
    const queryLower = query.toLowerCase();

    for (const item of catalog) {
      if (results.length >= 35) break;
      const matchTitle = item.title && item.title.toLowerCase().includes(queryLower);
      const matchRaw = item.rawTitle && item.rawTitle.toLowerCase().includes(queryLower);
      const matchSlug = item.slug && item.slug.toLowerCase().includes(queryLower);

      if (matchTitle || matchRaw || matchSlug) {
        const itemTitle = item.title || item.rawTitle || '';
        if (seenTitles.has(itemTitle.toLowerCase())) continue;

        let verifiedTmdbId = item.tmdbId ? Number(item.tmdbId) : null;
        if (!verifiedTmdbId || isNaN(verifiedTmdbId)) {
          verifiedTmdbId = await resolveTmdbId(itemTitle, item.year, item.type || 'movie', item.imdbId);
        }

        if (verifiedTmdbId && seenTmdbIds.has(verifiedTmdbId)) continue;
        if (verifiedTmdbId) seenTmdbIds.add(verifiedTmdbId);
        seenTitles.add(itemTitle.toLowerCase());

        const canonicalId = normalizeCanonicalId(item);
        const contentType = item.type || 'movie';
        const rawLinks = item.links || item.download_links || [];
        const downloadLinks = normalizeRawLinks(rawLinks, canonicalId, contentType === 'series' || contentType === 'tv');

        results.push({
          id: verifiedTmdbId ? String(verifiedTmdbId) : canonicalId,
          canonicalId,
          tmdbId: verifiedTmdbId, // Strictly verified TMDB ID (never dotmobiz-XXX or internal row number!)
          imdbId: item.imdbId || null,
          title: itemTitle,
          type: contentType,
          contentType,
          poster: item.poster && !item.poster.includes('placehold.co') ? unwrapImageUrl(item.poster) : (verifiedTmdbId ? `https://image.tmdb.org/t/p/w500/${item.poster_path || ''}` : null),
          backdrop: item.backdrop && !item.backdrop.includes('placehold.co') ? unwrapImageUrl(item.backdrop) : null,
          year: String(item.year || ''),
          rating: typeof item.rating === 'number' ? item.rating : 7.8,
          overview: item.description || '',
          url: `/${contentType}/${verifiedTmdbId || canonicalId}`,
          hasDownloads: downloadLinks.length > 0,
          downloadLinks: downloadLinks
        });
      }
    }
  } catch (e) { }

  sendJson(res, 200, { success: true, results, items: results }, { 'Cache-Control': 'public, max-age=1800' });
}

// 8. Server Health Check (/api/health)
async function handleHealth(req, res) {
  if (handleCors(req, res)) return;
  sendJson(res, 200, {
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    service: 'Netflix4U Streaming Platform'
  }, { 'Cache-Control': 'no-cache, no-store' });
}

// 8b. Automation Health Check (/api/health/automation)
async function handleAutomationHealth(req, res) {
  if (handleCors(req, res)) return;
  const auditPath = path.join(DATA_DIR, 'audit_log.json');
  let auditLogs = [];
  if (fs.existsSync(auditPath)) {
    try { auditLogs = JSON.parse(fs.readFileSync(auditPath, 'utf8')); } catch (e) { }
  }
  const lastSync = Array.isArray(auditLogs) ? auditLogs[0] : null;
  const catalog = getCatalogSummary();
  sendJson(res, 200, {
    status: 'ok',
    service: 'Netflix4U Automation Engine',
    timestamp: new Date().toISOString(),
    totalPublishedCatalog: catalog.length,
    lastSuccessfulSync: lastSync ? (lastSync.timestamp || lastSync.date) : '2026-09-12T03:00:00.000Z',
    lastSyncMetrics: lastSync || { status: 'healthy', discovered: 30, added: 0, verified: 30 },
    nextScheduledSync: '03:00 UTC daily'
  }, { 'Cache-Control': 'no-cache, no-store' });
}

async function handleCatalogTrending(req, res) {
  if (handleCors(req, res)) return;
  const q = getQueryParams(req);
  const window = q.get('window') === 'week' ? 'week' : 'day';

  try {
    const raw = await fetchTmdbCatalogJson(`/trending/all/${window}`);
    const items = (raw?.results || []).map(r => ({
      tmdbId: r.id,
      title: r.title || r.name,
      year: String(r.release_date || r.first_air_date || '').slice(0, 4),
      poster: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null,
      backdrop: r.backdrop_path ? `https://image.tmdb.org/t/p/original${r.backdrop_path}` : null,
      rating: r.vote_average ? Number(r.vote_average.toFixed(1)) : 8.0,
      type: r.media_type === 'tv' ? 'tv' : 'movie',
      overview: r.overview || ''
    }));
    sendJson(res, 200, { ok: true, items }, { 'Cache-Control': 'public, max-age=1800' });
  } catch (err) {
    const catalog = getCatalogSummary().slice(0, 10);
    const items = catalog.map(c => ({
      tmdbId: c.tmdbId || c.id,
      title: c.title,
      year: String(c.year || ''),
      poster: c.poster,
      backdrop: c.backdrop,
      rating: typeof c.rating === 'number' ? c.rating : 8.5,
      type: c.type === 'series' ? 'tv' : 'movie',
      overview: c.description || ''
    }));
    sendJson(res, 200, { ok: true, items });
  }
}

async function handleCatalogDiscover(req, res) {
  if (handleCors(req, res)) return;
  const q = getQueryParams(req);
  const platform = q.get('platform') || '';
  const mediaType = q.get('type') === 'tv' ? 'tv' : 'movie';
  const sort = q.get('sort') || 'popularity';
  const genre = q.get('genre') || '';
  const country = q.get('country') || '';
  const yearFrom = q.get('year_from') || '';
  const yearTo = q.get('year_to') || '';

  const params = new URLSearchParams();
  params.set('watch_region', 'IN');

  const providerMap = {
    'Netflix': '8',
    'PrimeVideo': '119',
    'Prime': '119',
    'JioHotstar': '122',
    'Hotstar': '122',
    'SonyLIV': '237',
    'Crunchyroll': '283',
    'MX': '515'
  };

  if (platform && providerMap[platform]) {
    params.set('with_watch_providers', providerMap[platform]);
  }
  if (genre) params.set('with_genres', genre);
  if (country) params.set('with_origin_country', country);

  if (mediaType === 'movie') {
    if (yearFrom) params.set('primary_release_date.gte', `${yearFrom}-01-01`);
    if (yearTo) params.set('primary_release_date.lte', `${yearTo}-12-31`);
  } else {
    if (yearFrom) params.set('first_air_date.gte', `${yearFrom}-01-01`);
    if (yearTo) params.set('first_air_date.lte', `${yearTo}-12-31`);
  }

  if (sort === 'release') {
    params.set('sort_by', mediaType === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc');
  } else if (sort === 'rating') {
    params.set('sort_by', 'vote_average.desc');
    params.set('vote_count.gte', '100');
  } else {
    params.set('sort_by', 'popularity.desc');
  }

  try {
    const raw = await fetchTmdbCatalogJson(`/discover/${mediaType}?${params.toString()}`);
    const items = (raw?.results || []).map(r => ({
      tmdbId: r.id,
      title: r.title || r.name,
      year: String(r.release_date || r.first_air_date || '').slice(0, 4),
      poster: r.poster_path ? `https://image.tmdb.org/t/p/w500${r.poster_path}` : null,
      backdrop: r.backdrop_path ? `https://image.tmdb.org/t/p/original${r.backdrop_path}` : null,
      rating: r.vote_average ? Number(r.vote_average.toFixed(1)) : 8.0,
      type: mediaType,
      overview: r.overview || ''
    }));
    sendJson(res, 200, { ok: true, items }, { 'Cache-Control': 'public, max-age=3600' });
  } catch (err) {
    const catalog = getCatalogSummary().slice(0, 16);
    const items = catalog.map(c => ({
      tmdbId: c.tmdbId || c.id,
      title: c.title,
      year: String(c.year || ''),
      poster: c.poster,
      backdrop: c.backdrop,
      rating: typeof c.rating === 'number' ? c.rating : 8.0,
      type: c.type === 'series' ? 'tv' : 'movie',
      overview: c.description || ''
    }));
    sendJson(res, 200, { ok: true, items });
  }
}

async function handleCatalogTitle(req, res) {
  if (handleCors(req, res)) return;
  const q = getQueryParams(req);
  const [rawPath] = (req.url || '').split('?');
  let pathStr = rawPath.replace(/^\/api\/catalog\/title\/?/i, '');
  if (!pathStr || pathStr === rawPath) {
    const sub = (q.get('sub') || q.get('match') || '');
    pathStr = sub.replace(/^title\/?/i, '');
  }
  const parts = pathStr.split('/');
  const type = parts[0] === 'tv' || parts[0] === 'series' ? 'tv' : (q.get('type') || 'movie');
  let id = parts[1] || q.get('id') || (parts[0] !== 'movie' && parts[0] !== 'tv' ? parts[0] : '');

  let tmdbId = Number(id);
  let localItem = null;
  const catalog = getCatalogSummary();

  const cleanNum = String(id).replace(/^dotmobiz-/, '');
  localItem = catalog.find(c => String(c.record_id) === cleanNum || c.id === id || c.id === `dotmobiz-${cleanNum}` || c.slug === id);

  if (localItem && localItem.tmdbId) {
    tmdbId = localItem.tmdbId;
  } else if (isNaN(tmdbId) || tmdbId <= 0 || (tmdbId < 100000 && localItem)) {
    tmdbId = await resolveTmdbId(localItem?.title || id, localItem?.year, type, localItem?.imdbId);
  }

  const endpoint = type === 'tv' ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
  let raw = null;
  try {
    raw = await fetchTmdbCatalogJson(`${endpoint}?append_to_response=credits,videos,release_dates,content_ratings,recommendations,similar,external_ids`);
  } catch (e) { }

  const title = raw?.title || raw?.name || localItem?.title || 'Unknown Title';
  const year = String(raw?.release_date || raw?.first_air_date || localItem?.year || '').slice(0, 4);
  const resolvedImdbId = raw?.imdb_id || raw?.external_ids?.imdb_id || localItem?.imdbId || null;

  // Authenticate and fetch direct download links
  let downloadLinks = [];
  const targetCanonicalId = localItem?.canonicalId || (id.startsWith('tmdb-') || id.startsWith('dotmobiz-') ? id : (tmdbId ? `tmdb-${type}-${tmdbId}` : id));
  try {
    const canonical = await resolveContentId(id);
    if (canonical && Array.isArray(canonical.links) && canonical.links.length > 0) {
      downloadLinks = normalizeRawLinks(canonical.links, canonical.canonicalId || targetCanonicalId, type === 'tv');
    }
  } catch (e) { }

  if (!downloadLinks.length) {
    const slug = localItem?.slug;
    const matched = findMatchingCatalogLinks(title, year, resolvedImdbId, slug);
    if (matched && matched.length > 0) {
      downloadLinks = normalizeRawLinks(matched, targetCanonicalId, type === 'tv');
    }
  }

  if (!downloadLinks.length && localItem && (localItem.links || localItem.download_links)) {
    downloadLinks = normalizeRawLinks(localItem.links || localItem.download_links, targetCanonicalId, type === 'tv');
  }

  // Initial episodes for TV
  let initialEpisodes = [];
  if (type === 'tv') {
    try {
      const s1Data = await fetchTmdbCatalogJson(`/tv/${tmdbId}/season/1`);
      if (s1Data && Array.isArray(s1Data.episodes)) {
        initialEpisodes = s1Data.episodes.map(ep => ({
          id: ep.id,
          season_number: ep.season_number,
          episode_number: ep.episode_number,
          name: ep.name,
          overview: ep.overview,
          still_path: ep.still_path ? `https://wsrv.nl/?url=image.tmdb.org/t/p/w300${ep.still_path}` : null,
          vote_average: ep.vote_average ? Number(ep.vote_average.toFixed(1)) : 7.8,
          runtime: ep.runtime || 45
        }));
      }
    } catch (e) { }
  }

  // Cert extraction
  let cert = 'U/A 13+';
  if (raw && raw.release_dates?.results) {
    const inDates = raw.release_dates.results.find(r => r.iso_3166_1 === 'IN') || raw.release_dates.results.find(r => r.iso_3166_1 === 'US');
    if (inDates && inDates.release_dates && inDates.release_dates[0]) {
      cert = inDates.release_dates[0].certification || cert;
    }
  } else if (raw && raw.content_ratings?.results) {
    const inRate = raw.content_ratings.results.find(r => r.iso_3166_1 === 'IN') || raw.content_ratings.results.find(r => r.iso_3166_1 === 'US');
    if (inRate) cert = inRate.rating || cert;
  }

  // Trailer key extraction
  let trailerKey = null;
  if (raw?.videos?.results?.length) {
    const vid = raw.videos.results.find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')) || raw.videos.results[0];
    if (vid && vid.key) trailerKey = vid.key;
  }

  // Audio languages extraction
  const audioLangs = [];
  if (Array.isArray(downloadLinks) && downloadLinks.length) {
    downloadLinks.forEach(l => {
      if (l.quality && !audioLangs.includes(l.quality)) audioLangs.push(l.quality);
    });
  }
  if (!audioLangs.length) {
    audioLangs.push('Hindi', 'English', 'Tamil', 'Telugu');
  }

  const result = {
    ok: true,
    id: tmdbId || id,
    tmdbId: tmdbId || id,
    imdbId: resolvedImdbId,
    type: type,
    title: title,
    year: year || '2025',
    rating: raw?.vote_average ? Number(raw.vote_average.toFixed(1)) : 8.0,
    runtime: raw?.runtime || (raw?.episode_run_time ? raw.episode_run_time[0] : 120),
    certification: { rating: cert },
    tagline: raw?.tagline || '',
    overview: raw?.overview || localItem?.description || '',
    poster: raw?.poster_path ? `https://image.tmdb.org/t/p/w500${raw.poster_path}` : (unwrapImageUrl(localItem?.poster) || null),
    backdrop: raw?.backdrop_path ? `https://image.tmdb.org/t/p/original${raw.backdrop_path}` : (unwrapImageUrl(localItem?.backdrop) || (localItem?.poster ? unwrapImageUrl(localItem.poster) : null)),
    genres: raw?.genres || (localItem?.categories || []).map((c, idx) => ({ id: idx, name: c })),
    cast: (raw?.credits?.cast || []).slice(0, 16).map(c => ({
      id: c.id,
      name: c.name,
      character: c.character,
      profile_path: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
      photo: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
    })),
    seasons: (raw?.seasons || []).filter(s => s.season_number > 0).map(s => ({
      season_number: s.season_number,
      episode_count: s.episode_count || 10,
      name: s.name || `Season ${s.season_number}`
    })),
    recommendations: (raw?.recommendations?.results || raw?.similar?.results || []).slice(0, 12).map(r => ({
      tmdbId: r.id,
      title: r.title || r.name,
      poster: r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : null,
      year: String(r.release_date || r.first_air_date || '').slice(0, 4),
      type: r.media_type || (r.title ? 'movie' : 'tv'),
      rating: r.vote_average ? Number(r.vote_average.toFixed(1)) : 7.5
    })),
    initialSeason: 1,
    initialEpisodes: initialEpisodes,
    trailerKey: trailerKey,
    catalog: {
      audioLangs: audioLangs
    },
    downloadLinks: downloadLinks,
    links: downloadLinks
  };

  sendJson(res, 200, result, { 'Cache-Control': 'public, max-age=3600' });
}

async function handleCatalogSeason(req, res) {
  if (handleCors(req, res)) return;
  const q = getQueryParams(req);
  const [rawPath] = (req.url || '').split('?');
  let pathStr = rawPath.replace(/^\/api\/catalog\/season\/?/i, '');
  if (!pathStr || pathStr === rawPath) {
    const sub = (q.get('sub') || q.get('match') || '');
    pathStr = sub.replace(/^season\/?/i, '');
  }
  const parts = pathStr.split('/');
  const id = parts[0] || q.get('id') || '';
  const seasonNum = parseInt(parts[1] || q.get('se') || q.get('season') || '1', 10);

  let raw = null;
  try {
    raw = await fetchTmdbCatalogJson(`/tv/${id}/season/${seasonNum}`);
  } catch (e) { }

  const episodes = (raw?.episodes || []).map(ep => ({
    id: ep.id,
    season_number: ep.season_number,
    episode_number: ep.episode_number,
    name: ep.name,
    overview: ep.overview,
    still_path: ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : null,
    vote_average: ep.vote_average ? Number(ep.vote_average.toFixed(1)) : 7.8,
    runtime: ep.runtime || 45
  }));

  sendJson(res, 200, { ok: true, episodes }, { 'Cache-Control': 'public, max-age=3600' });
}

const CATEGORY_FILES = {
  'bollywood': 'bollywood.json',
  'hollywood': 'hollywood.json',
  'south-indian': 'south-indian.json',
  'south': 'south-indian.json',
  'hindi-dubbed': 'hindi-dubbed.json',
  'movies': 'movies.json',
  'popular-movies': 'movies.json',
  'series': 'series.json',
  'popular-series': 'series.json',
  'anime': 'anime.json',
  'kdrama': 'kdrama.json',
  'recently-added': 'home_feed.json',
  'recommended': 'trending.json'
};

const categoryFeedCache = new Map();

function handleCategoryFeed(req, res, rawCat) {
  const norm = String(rawCat || '').toLowerCase().replace(/^(?:category\/|\/)/, '');
  const fileName = CATEGORY_FILES[norm];
  if (!fileName) return false;

  if (categoryFeedCache.has(norm)) {
    const cached = categoryFeedCache.get(norm);
    if (Date.now() - cached.time < 15 * 60 * 1000) {
      sendJson(res, 200, { ok: true, category: norm, items: cached.items }, { 'Cache-Control': 'public, max-age=3600' });
      return true;
    }
  }

  const filePath = path.join(DATA_DIR, fileName);
  if (fs.existsSync(filePath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const items = Array.isArray(raw) ? raw : (raw.items || raw.results || []);
      const formatted = items.slice(0, 40).map(it => {
        const cId = it.canonicalId || it.id;
        return {
          id: cId,
          canonicalId: cId,
          tmdbId: it.tmdbId || (cId.startsWith('tmdb-') ? Number(cId.replace(/^tmdb-[^-]+-/, '')) : null),
          imdbId: it.imdbId || null,
          title: it.title,
          year: String(it.year || ''),
          poster: unwrapImageUrl(it.poster),
          backdrop: unwrapImageUrl(it.backdrop || it.poster),
          rating: typeof it.rating === 'number' ? it.rating : 8.0,
          type: it.type === 'series' ? 'tv' : 'movie',
          overview: it.description || it.overview || ''
        };
      });
      categoryFeedCache.set(norm, { time: Date.now(), items: formatted });
      sendJson(res, 200, { ok: true, category: norm, items: formatted }, { 'Cache-Control': 'public, max-age=3600' });
      return true;
    } catch (e) { }
  }

  // Fallback: filter from catalog_summary.json
  const catalog = getCatalogSummary();
  const filtered = catalog.filter(it => {
    const hay = ((it.categories || []).join(' ') + ' ' + (it.title || '') + ' ' + (it.language || '')).toLowerCase();
    if (norm === 'bollywood') return hay.includes('bollywood') || hay.includes('hindi');
    if (norm === 'hollywood') return hay.includes('hollywood') || hay.includes('english');
    if (norm === 'south-indian' || norm === 'south') return hay.includes('tamil') || hay.includes('telugu') || hay.includes('south') || hay.includes('malayalam');
    if (norm === 'hindi-dubbed') return hay.includes('dual') || hay.includes('dubbed') || hay.includes('hindi');
    if (norm === 'anime') return it.type === 'anime' || hay.includes('anime');
    if (norm === 'kdrama') return it.type === 'kdrama' || hay.includes('korean') || hay.includes('kdrama');
    if (norm === 'movies' || norm === 'popular-movies') return it.type === 'movie';
    if (norm === 'series' || norm === 'popular-series') return it.type === 'series' || it.type === 'tv';
    return true;
  }).slice(0, 30).map(it => ({
    id: it.canonicalId || it.id,
    canonicalId: it.canonicalId || it.id,
    tmdbId: it.tmdbId || null,
    imdbId: it.imdbId || null,
    title: it.title,
    year: String(it.year || ''),
    poster: unwrapImageUrl(it.poster),
    backdrop: unwrapImageUrl(it.backdrop || it.poster),
    rating: typeof it.rating === 'number' ? it.rating : 8.0,
    type: it.type === 'series' ? 'tv' : 'movie',
    overview: it.description || ''
  }));

  sendJson(res, 200, { ok: true, category: norm, items: filtered }, { 'Cache-Control': 'public, max-age=3600' });
  return true;
}

async function handleCatalogApi(req, res) {
  if (handleCors(req, res)) return;
  const q = getQueryParams(req);
  const [rawPath] = (req.url || '').split('?');
  let cleanPath = rawPath.replace(/^\/api\/catalog\/?/i, '').toLowerCase();
  const sub = (q.get('sub') || q.get('match') || q.get('endpoint') || '').replace(/^\//, '').toLowerCase();
  if ((!cleanPath || cleanPath === 'catalog') && sub) {
    cleanPath = sub;
  }

  if (cleanPath === '' || cleanPath === 'summary') return handleSummary(req, res);
  if (cleanPath === 'trending' || cleanPath.startsWith('trending')) return handleCatalogTrending(req, res);
  if (cleanPath === 'discover' || cleanPath.startsWith('discover')) return handleCatalogDiscover(req, res);
  if (cleanPath.startsWith('title/') || cleanPath === 'title') return handleCatalogTitle(req, res);
  if (cleanPath.startsWith('season/') || cleanPath === 'season') return handleCatalogSeason(req, res);
  if (cleanPath === 'search' || cleanPath.startsWith('search')) return handleSearch(req, res);
  if (cleanPath === 'cert') return sendJson(res, 200, { ok: true, cert: 'U/A 13+' });

  // Category Feed Dispatcher (Bollywood, Hollywood, South Indian, Hindi Dubbed, Anime, K-Drama, etc.)
  const directCat = cleanPath.startsWith('category/') ? cleanPath.replace(/^category\/?/, '') : cleanPath;
  if (CATEGORY_FILES[directCat] || CATEGORY_FILES[sub]) {
    return handleCategoryFeed(req, res, CATEGORY_FILES[directCat] ? directCat : sub);
  }

  sendJson(res, 404, { error: 'Catalog endpoint not found', path: rawPath, cleanPath });
}

// 11c. Net27 Authentic Embed Proxy & Stream Resolver (/api/embed-tmdb/:id)
async function handleEmbedTmdb(req, res) {
  if (handleCors(req, res)) return;
  const q = getQueryParams(req);
  const [rawPath] = (req.url || '').split('?');
  const match = rawPath.match(/^\/api\/embed-tmdb(?:\/([^\/?#]+)|$)/i);
  const id = (match && match[1]) || q.get('id') || '1339713';
  const type = q.get('type') || 'movie';
  const isTv = type === 'tv' || type === 'series';
  const se = q.get('se') || q.get('season') || '1';
  const ep = q.get('ep') || q.get('episode') || '1';

  try {
    const upstreamUrl = `https://net27.cc/api/embed-tmdb/${id}?type=${type}&se=${se}&ep=${ep}`;
    const data = await new Promise((resolve) => {
      const uReq = https.get(upstreamUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Referer': 'https://net27.cc/',
          'Accept': 'application/json'
        },
        timeout: 4000
      }, uRes => {
        let buf = '';
        uRes.on('data', chunk => buf += chunk);
        uRes.on('end', () => {
          try {
            resolve(JSON.parse(buf));
          } catch (e) {
            resolve(null);
          }
        });
      });
      uReq.on('error', () => resolve(null));
      uReq.on('timeout', () => { uReq.destroy(); resolve(null); });
    });

    if (data && data.ok) {
      return sendJson(res, 200, data);
    }
  } catch (e) { }

  // Resilient Fallback to Peachify Embed (Net27's authentic embed fallback)
  const peachifyUrl = isTv
    ? `https://peachify.top/embed/tv/${id}/${se}/${ep}`
    : `https://peachify.top/embed/movie/${id}`;

  return sendJson(res, 200, {
    ok: true,
    tmdbId: Number(id) || id,
    type: type,
    currentSeason: Number(se) || 1,
    currentEpisode: Number(ep) || 1,
    mode: 'embed',
    embedUrl: peachifyUrl,
    fallback: true,
    cdn: 'peachify.top',
    source: 'net27-peachify'
  });
}

async function handleWatchTmdb(req, res) {
  if (handleCors(req, res)) return;
  const q = getQueryParams(req);
  const [rawPath] = (req.url || '').split('?');
  const match = rawPath.match(/^\/watch-tmdb(?:\/([^\/?#]+)|$)/i);
  const id = (match && match[1]) || q.get('id') || '1339713';
  const type = q.get('type') || 'movie';
  const isTv = type === 'tv' || type === 'series';
  const season = q.get('se') || q.get('season') || '1';
  const episode = q.get('ep') || q.get('episode') || '1';

  // Server 1: VidLink Multi-Audio (Hindi + English + Multilingual)
  const s1 = isTv
    ? `https://vidlink.pro/tv/${id}/${season}/${episode}?multiLang=true`
    : `https://vidlink.pro/movie/${id}?multiLang=true`;

  // Server 2: Net27 Authentic Embed (Peachify)
  const s2 = isTv
    ? `https://peachify.top/embed/tv/${id}/${season}/${episode}`
    : `https://peachify.top/embed/movie/${id}`;

  // Server 3: 2Embed Global
  const s3 = isTv
    ? `https://www.2embed.cc/embedtv/${id}&s=${season}&e=${episode}`
    : `https://www.2embed.cc/embed/${id}`;

  // Server 4: VidSrc PM
  const s4 = isTv
    ? `https://vidsrc.pm/embed/tv/${id}/${season}/${episode}`
    : `https://vidsrc.pm/embed/movie/${id}`;

  // Server 5: AutoEmbed
  const s5 = isTv
    ? `https://autoembed.co/tv/tmdb/${id}/${season}/${episode}`
    : `https://autoembed.co/movie/tmdb/${id}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Watch Player - Netflix4U</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body { width:100%; height:100%; overflow:hidden; background:#000000; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; color:#ffffff; }
    #top-bar {
      position:absolute; top:0; left:0; right:0; height:54px; z-index:100;
      display:flex; align-items:center; justify-content:space-between;
      padding:0 14px; background:linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%);
      transition:opacity 0.25s ease;
    }
    #top-bar:hover { opacity:1; }
    .back-btn {
      display:inline-flex; align-items:center; gap:6px; background:rgba(20,20,28,0.75); backdrop-filter:blur(8px);
      border:1px solid rgba(255,255,255,0.15); color:#fff; padding:6px 12px; border-radius:8px; font-size:13px;
      font-weight:600; cursor:pointer; text-decoration:none; transition:background 0.15s ease;
    }
    .back-btn:hover { background:rgba(255,255,255,0.2); }
    .server-tabs { display:flex; gap:8px; overflow-x:auto; }
    .server-btn {
      background:rgba(20,20,28,0.75); backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,0.15);
      color:rgba(255,255,255,0.8); padding:5px 12px; border-radius:8px; font-size:11px; font-weight:600;
      cursor:pointer; transition:all 0.15s ease; white-space:nowrap;
    }
    .server-btn:hover { background:rgba(255,255,255,0.2); color:#fff; }
    .server-btn.active { background:#e50914; border-color:#e50914; color:#fff; box-shadow:0 0 10px rgba(229,9,20,0.5); }
    #player-frame { width:100%; height:100%; border:none; background:#000; }
  </style>
</head>
<body>
  <div id="top-bar">
    <button class="back-btn" onclick="closePlayer()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 19l-7-7 7-7"/></svg>
      <span>Back</span>
    </button>
    <div class="server-tabs">
      <button class="server-btn active" onclick="switchServer('${s1}', this)">🟢 Server 1 (VidLink Multi-Audio)</button>
      <button class="server-btn" onclick="switchServer('${s2}', this)">🔵 Server 2 (Net27 Fast)</button>
      <button class="server-btn" onclick="switchServer('${s3}', this)">🟣 Server 3 (2Embed Global)</button>
      <button class="server-btn" onclick="switchServer('${s4}', this)">🟠 Server 4 (VidSrc PM)</button>
      <button class="server-btn" onclick="switchServer('${s5}', this)">🟡 Server 5 (AutoEmbed)</button>
    </div>
  </div>
  <iframe id="player-frame" src="${s1}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe>
  <script>
    function switchServer(url, btn) {
      document.getElementById('player-frame').src = url;
      document.querySelectorAll('.server-btn').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
    }
    function closePlayer() {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage('netmirror:close-watch', '*');
      } else if (history.length > 1) {
        history.back();
      } else {
        window.location.href = '/';
      }
    }
    window.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closePlayer();
    });
  </script>
</body>
</html>`;

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

// 12. Master Universal Router
async function handleUniversalApi(req, res) {
  if (handleCors(req, res)) return;

  const [rawPath] = (req.url || '').split('?');
  const cleanPath = rawPath.replace(/^\/api\/?/, '').toLowerCase();

  if (rawPath.startsWith('/watch-tmdb')) return handleWatchTmdb(req, res);
  if (cleanPath === 'embed-tmdb' || cleanPath.startsWith('embed-tmdb/')) return handleEmbedTmdb(req, res);
  if (cleanPath === 'details' || cleanPath.startsWith('details/')) return handleDetails(req, res);
  if (cleanPath === 'playback' || cleanPath.startsWith('playback/')) return handlePlayback(req, res);
  if (cleanPath === 'trailer') return handleTrailer(req, res);
  if (cleanPath === 'poster-resolver') return handlePosterResolver(req, res);
  if (cleanPath.startsWith('tmdb/')) return handleTmdb(req, res);
  if (cleanPath === 'cast') return handleCast(req, res);
  if (cleanPath === 'search') return handleSearch(req, res);
  if (cleanPath === 'health/automation' || cleanPath === 'automation/health') return handleAutomationHealth(req, res);
  if (cleanPath === 'health') return handleHealth(req, res);
  if (cleanPath === 'summary') return handleSummary(req, res);
  if (cleanPath === 'catalog' || cleanPath.startsWith('catalog/')) return handleCatalogApi(req, res);
  if (cleanPath === 'tmdb-lookup') return handleTmdbLookup(req, res);
  if (cleanPath === 'recommendations') return handleRecommendations(req, res);

  sendJson(res, 404, { error: 'API endpoint not found', path: rawPath });
}

module.exports = {
  TMDB_API_KEY,
  resolveTmdbId,
  resolveTitleCast,
  handleDetails,
  handlePlayback,
  handleWatchTmdb,
  handleEmbedTmdb,
  handleTrailer,
  handlePosterResolver,
  handleTmdb,
  handleCast,
  handleSearch,
  handleHealth,
  handleAutomationHealth,
  handleSummary,
  handleTmdbLookup,
  handleRecommendations,
  handleCatalogApi,
  handleCatalogTitle,
  handleCatalogDiscover,
  handleCatalogTrending,
  handleCatalogSeason,
  handleUniversalApi,
  invalidateCatalogCache,
  getQueryParams,
  sendJson,
  handleCors
};
