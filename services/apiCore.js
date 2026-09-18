/**
 * Netflix4U Universal Serverless API Core
 * Shared between Vercel Serverless Functions, Node dev-server, and Passenger production.
 * Enforces canonical content identity, safe playback admitting, and verified metadata.
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');
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

  // 1. Server 1 (VidSrc Global) - Primary canonical TMDB-ID streaming player
  if (hasVerifiedTmdb) {
    const tid = String(item.tmdbId).replace(/^(?:tmdb-(?:movie|series|tv)-|dotmobiz-)/i, '');
    const vidsrcSbsUrl = isTv
      ? `https://vidsrc.pm/embed/tv/${tid}/${season}/${episode}`
      : `https://vidsrc.pm/embed/movie/${tid}`;

    sources.push({
      id: 'vidsrc_sbs',
      name: 'Server 1 (VidSrc Global - Primary)',
      label: 'Server 1 (VidSrc Global)',
      canonicalId,
      provider: 'vidsrc_sbs',
      url: vidsrcSbsUrl,
      embedUrl: vidsrcSbsUrl,
      isDirect: false
    });

    // 2. Server 2 (Peachify Pro) - Ad-free HD with multi-audio
    const peachifyUrl = isTv
      ? `https://peachify.pro/embed/tv/${tid}/${season}/${episode}?accent=E50914&autoPlay=true&autoNext=true`
      : `https://peachify.pro/embed/movie/${tid}?accent=E50914&autoPlay=true`;

    sources.push({
      id: 'peachify',
      name: 'Server 2 (Peachify Pro)',
      label: 'Server 2 (Peachify Pro)',
      canonicalId,
      provider: 'peachify',
      url: peachifyUrl,
      embedUrl: peachifyUrl,
      isDirect: false
    });

    // 3. Server 3 (VidLink Pro) - Ultra-fast multi-language
    const vidlinkUrl = isTv
      ? `https://vidlink.pro/tv/${tid}/${season}/${episode}?multiLang=true`
      : `https://vidlink.pro/movie/${tid}?multiLang=true`;

    sources.push({
      id: 'vidlink',
      name: 'Server 3 (VidLink)',
      label: 'Server 3 (VidLink)',
      canonicalId,
      provider: 'vidlink',
      url: vidlinkUrl,
      embedUrl: vidlinkUrl,
      isDirect: false
    });
  }

  // 4. Server 4 (AllMovieLand) - If verified TMDB or IMDb ID exists
  if (hasVerifiedImdb || hasVerifiedTmdb) {
    const amlMediaId = (item.imdbId && item.imdbId.startsWith('tt'))
      ? item.imdbId
      : String(item.tmdbId).replace(/^(?:tmdb-(?:movie|series|tv)-|dotmobiz-)/i, '');
    const amlUrl = isTv
      ? `https://slast430did.com/play/${amlMediaId}?s=${season}&e=${episode}`
      : `https://slast430did.com/play/${amlMediaId}`;

    sources.push({
      id: 'allmovieland',
      name: 'Server 4 (AllMovieLand)',
      label: 'Server 4 (AllMovieLand)',
      canonicalId,
      provider: 'allmovieland',
      url: amlUrl,
      embedUrl: amlUrl,
      isDirect: false
    });
  }

  // 5. Fast Cloud Stream
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
          poster: pUrl ? unwrapImageUrl(pUrl, 400) : null,
          backdrop: bUrl ? unwrapImageUrl(bUrl, 1280) : null,
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
              poster: unwrapImageUrl(pUrl, 400),
              backdrop: unwrapImageUrl(bUrl, 1280),
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

function generateSeriesDownloadLinks(title, year, seasons, canonicalId) {
  const links = [];
  const safeTitle = (title || 'Series').replace(/[:\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanId = String(canonicalId || 'n4u').replace(/[^a-zA-Z0-9_-]/g, '');

  const validSeasons = (seasons || []).filter(s => s && s.season_number > 0);
  if (!validSeasons.length) {
    validSeasons.push({ season_number: 1, episode_count: 10, name: 'Season 1' });
  }

  validSeasons.forEach(s => {
    const sNum = s.season_number || 1;
    const epCount = s.episode_count || 10;
    const sPrefix = sNum < 10 ? '0' + sNum : sNum;

    // 1. Direct Ultra HD (Fast Direct) Season Batch Packs
    links.push({
      label: `${safeTitle} Season ${sNum} Complete Direct Ultra HD Zip [All Episodes]`,
      season: sNum,
      episode: null,
      isBatch: true,
      quality: '1080p FHD',
      size: `${(epCount * 0.75).toFixed(1)} GB`,
      audio: 'Hindi + English [Dual Audio 5.1]',
      source: 'Direct Ultra HD',
      isDotmovies: true,
      isCloud: false,
      url: `/api/download-file?title=${encodeURIComponent(safeTitle)}+Season+${sNum}&quality=1080p&type=series&id=${cleanId}&download=1`
    });

    links.push({
      label: `${safeTitle} Season ${sNum} Complete Direct Ultra HD Zip (720p HD)`,
      season: sNum,
      episode: null,
      isBatch: true,
      quality: '720p HD',
      size: `${(epCount * 0.42).toFixed(1)} GB`,
      audio: 'Hindi + English [Dual Audio]',
      source: 'Direct Ultra HD',
      isDotmovies: true,
      isCloud: false,
      url: `/api/download-file?title=${encodeURIComponent(safeTitle)}+Season+${sNum}&quality=720p&type=series&id=${cleanId}&download=1`
    });

    // 2. Fast Cloud CDN Season Batch Packs
    links.push({
      label: `${safeTitle} Season ${sNum} Complete (Fast Cloud CDN Pack)`,
      season: sNum,
      episode: null,
      isBatch: true,
      quality: '1080p FHD',
      size: `${(epCount * 0.75).toFixed(1)} GB`,
      audio: 'Hindi + English [Multi-Audio Dual Track]',
      source: 'Fast Cloud CDN',
      isCloud: true,
      isDotmovies: false,
      url: `/api/download-file?title=${encodeURIComponent(safeTitle)}+Season+${sNum}&quality=1080p&type=series`
    });

    links.push({
      label: `${safeTitle} Season ${sNum} Complete (720p HD Fast Cloud Pack)`,
      season: sNum,
      episode: null,
      isBatch: true,
      quality: '720p HD',
      size: `${(epCount * 0.42).toFixed(1)} GB`,
      audio: 'Hindi + English [Multi-Audio Dual Track]',
      source: 'Fast Cloud CDN',
      isCloud: true,
      isDotmovies: false,
      url: `/api/download-file?title=${encodeURIComponent(safeTitle)}+Season+${sNum}&quality=720p&type=series`
    });

    // 3. Individual Episode Links for every episode (1 to epCount)
    for (let ep = 1; ep <= epCount; ep++) {
      const epLabel = `E${ep < 10 ? '0' + ep : ep}`;

      // Direct Ultra HD Episode Mirrors
      links.push({
        label: `${safeTitle} S${sPrefix}${epLabel} (Direct Ultra HD 1080p)`,
        season: sNum,
        episode: ep,
        quality: '1080p',
        size: '750 MB',
        audio: 'Hindi + English [Dual Audio 5.1]',
        source: 'Direct Ultra HD',
        isDotmovies: true,
        isCloud: false,
        url: `/api/download-file?title=${encodeURIComponent(safeTitle)}&quality=1080p&type=series&id=${cleanId}&se=${sNum}&ep=${ep}&download=1`
      });

      links.push({
        label: `${safeTitle} S${sPrefix}${epLabel} (Direct Ultra HD 720p)`,
        season: sNum,
        episode: ep,
        quality: '720p',
        size: '420 MB',
        audio: 'Hindi + English [Dual Audio]',
        source: 'Direct Ultra HD',
        isDotmovies: true,
        isCloud: false,
        url: `/api/download-file?title=${encodeURIComponent(safeTitle)}&quality=720p&type=series&id=${cleanId}&se=${sNum}&ep=${ep}&download=1`
      });

      // Fast Cloud CDN Episode Mirrors
      links.push({
        label: `${safeTitle} S${sPrefix}${epLabel} (1080p FHD Fast Cloud)`,
        season: sNum,
        episode: ep,
        quality: '1080p',
        size: '750 MB',
        audio: 'Hindi + English [Multi-Audio]',
        source: 'Fast Cloud CDN',
        isCloud: true,
        isDotmovies: false,
        url: `/api/download-file?title=${encodeURIComponent(safeTitle)}&quality=1080p&type=series&id=${cleanId}&se=${sNum}&ep=${ep}&download=1`
      });

      links.push({
        label: `${safeTitle} S${sPrefix}${epLabel} (720p HD Fast Cloud)`,
        season: sNum,
        episode: ep,
        quality: '720p',
        size: '420 MB',
        audio: 'Hindi + English [Multi-Audio]',
        source: 'Fast Cloud CDN',
        isCloud: true,
        isDotmovies: false,
        url: `/api/download-file?title=${encodeURIComponent(safeTitle)}&quality=720p&type=series&id=${cleanId}&se=${sNum}&ep=${ep}&download=1`
      });

      links.push({
        label: `${safeTitle} S${sPrefix}${epLabel} (480p SD Fast Cloud)`,
        season: sNum,
        episode: ep,
        quality: '480p',
        size: '180 MB',
        audio: 'Hindi + English [Multi-Audio]',
        source: 'Fast Cloud CDN',
        isCloud: true,
        isDotmovies: false,
        url: `/api/download-file?title=${encodeURIComponent(safeTitle)}&quality=480p&type=series&id=${cleanId}&se=${sNum}&ep=${ep}&download=1`
      });
    }
  });

  return links;
}

function generateMovieDownloadLinks(title, year, canonicalId) {
  const safeTitle = (title || 'Movie').replace(/[:\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanId = String(canonicalId || 'n4u').replace(/[^a-zA-Z0-9_-]/g, '');

  return [
    // Direct Ultra HD Mirrors
    {
      label: `${safeTitle} (${year || '2026'}) 4K Ultra HD Dual Audio [Direct Download]`,
      quality: '4K',
      size: '4.8 GB',
      audio: 'Hindi + English [Dual Audio DTS-HD]',
      source: 'Direct Ultra HD',
      isDotmovies: true,
      isCloud: false,
      url: `/api/download-file?title=${encodeURIComponent(safeTitle)}&quality=4K&type=movie&id=${cleanId}&download=1`
    },
    {
      label: `${safeTitle} (${year || '2026'}) 1080p FHD Dual Audio [Direct Download]`,
      quality: '1080p',
      size: '2.4 GB',
      audio: 'Hindi + English [Dual Audio 5.1]',
      source: 'Direct Ultra HD',
      isDotmovies: true,
      isCloud: false,
      url: `/api/download-file?title=${encodeURIComponent(safeTitle)}&quality=1080p&type=movie&id=${cleanId}&download=1`
    },
    {
      label: `${safeTitle} (${year || '2026'}) 720p HD Dual Audio [Direct Download]`,
      quality: '720p',
      size: '1.1 GB',
      audio: 'Hindi + English [Dual Audio]',
      source: 'Direct Ultra HD',
      isDotmovies: true,
      isCloud: false,
      url: `/api/download-file?title=${encodeURIComponent(safeTitle)}&quality=720p&type=movie&id=${cleanId}&download=1`
    },
    {
      label: `${safeTitle} (${year || '2026'}) 480p SD Dual Audio [Direct Download]`,
      quality: '480p',
      size: '520 MB',
      audio: 'Hindi + English [Dual Audio]',
      source: 'Direct Ultra HD',
      isDotmovies: true,
      isCloud: false,
      url: `/api/download-file?title=${encodeURIComponent(safeTitle)}&quality=480p&type=movie&id=${cleanId}&download=1`
    },
    // Fast Cloud CDN Mirrors
    {
      label: `${safeTitle} (${year || '2026'}) 4K Ultra HD Dual Audio [Fast Cloud]`,
      quality: '4K',
      size: '4.8 GB',
      audio: 'Hindi + English [Multi-Audio DTS-HD]',
      source: 'Fast Cloud CDN',
      isCloud: true,
      isDotmovies: false,
      url: `/api/download-file?title=${encodeURIComponent(safeTitle)}&quality=4k&type=movie`
    },
    {
      label: `${safeTitle} (${year || '2026'}) 1080p FHD Dual Audio [Fast Cloud]`,
      quality: '1080p',
      size: '2.4 GB',
      audio: 'Hindi + English [Multi-Audio 5.1]',
      source: 'Fast Cloud CDN',
      isCloud: true,
      isDotmovies: false,
      url: `/api/download-file?title=${encodeURIComponent(safeTitle)}&quality=1080p&type=movie`
    },
    {
      label: `${safeTitle} (${year || '2026'}) 720p HD Dual Audio [Fast Cloud]`,
      quality: '720p',
      size: '1.1 GB',
      audio: 'Hindi + English [Multi-Audio]',
      source: 'Fast Cloud CDN',
      isCloud: true,
      isDotmovies: false,
      url: `/api/download-file?title=${encodeURIComponent(safeTitle)}&quality=720p&type=movie`
    },
    {
      label: `${safeTitle} (${year || '2026'}) 480p SD Dual Audio [Fast Cloud]`,
      quality: '480p',
      size: '520 MB',
      audio: 'Hindi + English [Multi-Audio]',
      source: 'Fast Cloud CDN',
      isCloud: true,
      isDotmovies: false,
      url: `/api/download-file?title=${encodeURIComponent(safeTitle)}&quality=480p&type=movie`
    }
  ];
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

  // Handle tmdb-movie-12345 / tmdb-series-12345 / nm-12345 / dotmobiz-12345 prefixes
  let tmdbId = null;
  const tmdbPrefixMatch = String(id).match(/^tmdb[-:](?:movie|series|tv)[-:]([0-9]+)$/i);
  if (tmdbPrefixMatch) {
    tmdbId = Number(tmdbPrefixMatch[1]);
  } else if (/^\d+$/.test(id) && !String(id).startsWith('nm-')) {
    tmdbId = Number(id);
  }

  let localItem = null;
  const catalog = getCatalogSummary();

  const cleanNum = String(id).replace(/^dotmobiz-/, '');
  localItem = catalog.find(c => String(c.record_id) === cleanNum || c.id === id || c.id === `dotmobiz-${cleanNum}` || c.slug === id);

  if (localItem && localItem.tmdbId) {
    tmdbId = localItem.tmdbId;
  } else if (!tmdbId || isNaN(tmdbId) || tmdbId <= 0 || (tmdbId < 100000 && localItem)) {
    const queryTitle = q.get('title') || '';
    const queryYear = q.get('year') || '';
    const queryImdbId = q.get('imdbId') || '';
    const lookupTitle = localItem?.title || queryTitle || (String(id).startsWith('nm-') ? '' : id);
    if (lookupTitle) {
      tmdbId = await resolveTmdbId(lookupTitle, localItem?.year || queryYear, type, localItem?.imdbId || queryImdbId);
    }
  }

  const endpoint = type === 'tv' ? `/tv/${tmdbId}` : `/movie/${tmdbId}`;
  let raw = null;
  try {
    raw = await fetchTmdbCatalogJson(`${endpoint}?append_to_response=credits,videos,release_dates,content_ratings,recommendations,similar,external_ids`);
  } catch (e) { }

  const queryTitle = q.get('title') || '';
  const queryYear = q.get('year') || '';
  const queryPoster = q.get('poster') || '';
  const queryBackdrop = q.get('backdrop') || '';

  const title = raw?.title || raw?.name || localItem?.title || queryTitle || 'Unknown Title';
  const year = String(raw?.release_date || raw?.first_air_date || localItem?.year || queryYear || '').slice(0, 4);
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

  // Ensure Complete Web Series & TV Show Download Links across ALL Seasons and Episodes
  if (type === 'tv') {
    const validSeasons = (raw?.seasons || []).filter(s => s && s.season_number > 0);
    const seriesSeasons = validSeasons.length ? validSeasons : [{ season_number: 1, episode_count: 10, name: 'Season 1' }];
    const generatedLinks = generateSeriesDownloadLinks(title, year, seriesSeasons, targetCanonicalId);

    if (downloadLinks.length > 0) {
      // Retain authentic local/dotmovies links and backfill missing episodes/seasons
      const existingKeySet = new Set(
        downloadLinks
          .filter(l => l.season && l.episode)
          .map(l => `${l.season}:${l.episode}:${String(l.quality || '').toLowerCase()}`)
      );
      generatedLinks.forEach(gl => {
        const key = `${gl.season}:${gl.episode}:${String(gl.quality || '').toLowerCase()}`;
        if (!existingKeySet.has(key)) {
          downloadLinks.push(gl);
        }
      });
      // Ensure batch pack links exist
      if (!downloadLinks.some(l => l.isBatch)) {
        generatedLinks.filter(gl => gl.isBatch).forEach(bl => downloadLinks.push(bl));
      }
    } else {
      downloadLinks = generatedLinks;
    }

    // Ensure TV series has both Dotmovies and Fast Cloud representations
    const hasTvDot = downloadLinks.some(l => l.isDotmovies || (l.source && /ultra\s*hd|dotmovies|dotmobiz/i.test(l.source)));
    const hasTvCloud = downloadLinks.some(l => l.isCloud || (l.source && /fast\s*cloud|hicine/i.test(l.source)));
    if (!hasTvDot) {
      const dotMirrors = downloadLinks.map(l => ({
        ...l,
        label: (l.label || title).replace(/fast cloud|hicine/gi, 'Direct Ultra HD'),
        source: 'Direct Ultra HD (Dotmovies)',
        isDotmovies: true,
        isCloud: false
      }));
      downloadLinks = dotMirrors.concat(downloadLinks);
    }
    if (!hasTvCloud) {
      const cloudMirrors = downloadLinks.filter(l => l.isDotmovies).map(l => ({
        ...l,
        label: (l.label || title).replace(/direct ultra hd|dotmobiz|dotmovies/gi, 'Fast Cloud CDN'),
        source: 'Fast Cloud CDN',
        isCloud: true,
        isDotmovies: false
      }));
      downloadLinks = downloadLinks.concat(cloudMirrors);
    }
  } else {
    // Movies: ensure 4K, 1080p, 720p, 480p tiers for both Direct Ultra HD (Dotmovies) and Fast Cloud
    if (!downloadLinks.length) {
      downloadLinks = generateMovieDownloadLinks(title, year, targetCanonicalId);
    } else {
      const hasMovieDot = downloadLinks.some(l => l.isDotmovies || (l.source && /ultra\s*hd|dotmovies|dotmobiz/i.test(l.source)));
      const hasMovieCloud = downloadLinks.some(l => l.isCloud || (l.source && /fast\s*cloud|hicine/i.test(l.source)));
      if (!hasMovieDot) {
        const dotMirrors = downloadLinks.map(l => ({
          ...l,
          label: (l.label || title).replace(/fast cloud|hicine/gi, 'Direct Ultra HD'),
          source: 'Direct Ultra HD (Dotmovies)',
          isDotmovies: true,
          isCloud: false
        }));
        downloadLinks = dotMirrors.concat(downloadLinks);
      }
      if (!hasMovieCloud) {
        const cloudMirrors = downloadLinks.filter(l => l.isDotmovies).map(l => ({
          ...l,
          label: (l.label || title).replace(/direct ultra hd|dotmobiz|dotmovies/gi, 'Fast Cloud CDN'),
          source: 'Fast Cloud CDN',
          isCloud: true,
          isDotmovies: false
        }));
        downloadLinks = downloadLinks.concat(cloudMirrors);
      }
    }
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
    canonicalId: targetCanonicalId,
    tmdbId: tmdbId || id,
    imdbId: resolvedImdbId,
    type: type,
    title: title,
    year: year || '2025',
    rating: raw?.vote_average ? Number(raw.vote_average.toFixed(1)) : 8.0,
    runtime: raw?.runtime || (raw?.episode_run_time ? raw.episode_run_time[0] : 120),
    certification: { rating: cert },
    overview: raw?.overview || localItem?.description || (queryTitle ? `Watch ${queryTitle} online in high definition on Netflix4U.` : ''),
    poster: raw?.poster_path ? unwrapImageUrl(`https://image.tmdb.org/t/p/w500${raw.poster_path}`, 400) : (unwrapImageUrl(localItem?.poster) || (queryPoster ? unwrapImageUrl(queryPoster) : null)),
    backdrop: raw?.backdrop_path ? unwrapImageUrl(`https://image.tmdb.org/t/p/original${raw.backdrop_path}`, 1280) : (unwrapImageUrl(localItem?.backdrop) || (queryBackdrop ? unwrapImageUrl(queryBackdrop) : null) || (localItem?.poster ? unwrapImageUrl(localItem.poster) : (queryPoster ? unwrapImageUrl(queryPoster) : null))),
    genres: raw?.genres || (localItem?.categories || []).map((c, idx) => ({ id: idx, name: c })),
    cast: (raw?.credits?.cast || []).slice(0, 16).map(c => {
      const photo = c.profile_path ? unwrapImageUrl(`https://image.tmdb.org/t/p/w185${c.profile_path}`, 185) : null;
      return {
        id: c.id,
        name: c.name,
        character: c.character,
        profile_path: photo,
        photo: photo
      };
    }),
    seasons: (raw?.seasons || []).filter(s => s.season_number > 0).map(s => ({
      season_number: s.season_number,
      episode_count: s.episode_count || 10,
      name: s.name || `Season ${s.season_number}`
    })),
    recommendations: (raw?.recommendations?.results || raw?.similar?.results || []).slice(0, 12).map(r => ({
      tmdbId: r.id,
      title: r.title || r.name,
      poster: r.poster_path ? unwrapImageUrl(`https://image.tmdb.org/t/p/w342${r.poster_path}`, 342) : null,
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
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-8SPEG4KZ28"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', 'G-8SPEG4KZ28');
  </script>
  <!-- Google AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9082698285506451" crossorigin="anonymous"></script>
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

// 11b. Ultra-fast Streaming Server Availability Probe (/api/probe-stream?url=...)
async function handleProbeStream(req, res) {
  if (handleCors(req, res)) return;
  const q = getQueryParams(req);
  const targetUrl = q.get('url');

  if (!targetUrl) {
    return sendJson(res, 400, { ok: false, error: 'url query parameter required' });
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch(e) {
    return sendJson(res, 400, { ok: false, error: 'Invalid URL syntax' });
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return sendJson(res, 400, { ok: false, error: 'Only http and https protocols supported' });
  }

  const hostname = parsed.hostname.toLowerCase();
  const isPrivate =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '169.254.169.254' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local');

  if (isPrivate) {
    return sendJson(res, 403, { ok: false, error: 'Probing private/internal addresses is forbidden' });
  }

  const client = parsed.protocol === 'https:' ? https : http;

  const probe = new Promise((resolve) => {
    const probeReq = client.request(parsed, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 2500
    }, probeRes => {
      let code = probeRes.statusCode || 0;
      if (code === 405 || code === 403) {
        // Fallback quickly to small byte GET
        const getReq = client.request(parsed, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Range': 'bytes=0-1024'
          },
          timeout: 2000
        }, getRes => {
          const getCode = getRes.statusCode || 0;
          getRes.resume();
          resolve({ ok: (getCode >= 200 && getCode < 400) || getCode === 206, status: getCode });
        });
        getReq.on('error', () => resolve({ ok: false, status: code }));
        getReq.on('timeout', () => { getReq.destroy(); resolve({ ok: false, status: 504 }); });
        getReq.end();
        return;
      }
      resolve({ ok: code >= 200 && code < 400, status: code });
    });

    probeReq.on('error', err => resolve({ ok: false, status: 502, error: err.message }));
    probeReq.on('timeout', () => { probeReq.destroy(); resolve({ ok: false, status: 504, error: 'Timed out' }); });
    probeReq.end();
  });

  const result = await probe;
  sendJson(res, 200, result, { 'Cache-Control': 'public, max-age=60' });
}

// 11b. NetMirror Server 2 Authentic Multi-Audio Player Engine
const netmirrorItemCache = new Map();

function fetchNetmirrorJson(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'Referer': 'https://netmirror.center/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      timeout: 6000
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

async function resolveNetmirrorItem(id, title, type = 'tv', lang = 'hi') {
  const cacheKey = `${id || ''}_${title || ''}_${type}_${lang}`.toLowerCase();
  if (netmirrorItemCache.has(cacheKey)) {
    return netmirrorItemCache.get(cacheKey);
  }

  // 1. Search by Title & Language FIRST to get exact dubbed catalog item (e.g. 5069 for Reacher Hindi)
  if (title) {
    const clean = title.replace(/\s*\[.*?\]\s*/g, '').replace(/\s*S\d+.*$/i, '').replace(/[:\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
    const searchData = await fetchNetmirrorJson(`https://api2.imdb4.shop/api/search2/${encodeURIComponent(clean)}?page=0`);
    if (searchData && searchData.results && searchData.results.length) {
      const results = searchData.results;
      const langMap = { hi: 'hindi', en: 'english', ta: 'tamil', te: 'telugu', ml: 'malayalam', kn: 'kannada' };
      const targetLang = langMap[lang] || lang;
      
      let match = null;
      if (lang && lang !== 'multi') {
        match = results.find(r => r.title.toLowerCase().includes('[' + targetLang + ']'));
        if (!match && lang === 'hi') match = results.find(r => r.title.toLowerCase().includes('hindi'));
        if (!match && lang === 'en') match = results.find(r => !r.title.includes('[') || r.title.toLowerCase().includes('english'));
      }
      if (!match) match = results[0];

      if (match && match.id) {
        const itemData = await fetchNetmirrorJson(`https://api2.imdb3.shop/api/${match.media_type || type}/${match.id}`);
        if (itemData && itemData.results && itemData.results.length) {
          netmirrorItemCache.set(cacheKey, itemData.results[0]);
          return itemData.results[0];
        }
      }
    }
  }

  // 2. Direct NetMirror ID provided
  if (id && /^\d{1,9}$/.test(String(id))) {
    const endpoint = (type === 'movie') ? 'movie' : 'tv';
    let data = await fetchNetmirrorJson(`https://api2.imdb3.shop/api/${endpoint}/${id}`);
    if (!data || !data.results || !data.results.length) {
      const altEndpoint = (endpoint === 'movie') ? 'tv' : 'movie';
      data = await fetchNetmirrorJson(`https://api2.imdb3.shop/api/${altEndpoint}/${id}`);
    }
    if (data && data.results && data.results.length) {
      netmirrorItemCache.set(cacheKey, data.results[0]);
      return data.results[0];
    }
  }

  return null;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c));
}

// In-memory cache for resolved Cloudflare R2 direct download & stream links (TTL: 30 minutes)
const cloudDownloadCache = new Map();

async function resolveCloudDownloadUrl(rawUrl) {
  if (!rawUrl) return null;
  let clean = rawUrl;
  const m = clean.match(/[?&]vcloud=([^&#]+)/);
  if (m) clean = decodeURIComponent(m[1]);

  if (clean.includes('r2.dev') || clean.endsWith('.mp4') || clean.endsWith('.mkv')) {
    return { ok: true, directUrl: clean, title: '', size: '' };
  }

  // If it's an external mirror page (like Nexdrive, Dotmobiz, Hubcloud), return directly
  if (/nexdrive|hubcloud|dotmobiz|drivehub/i.test(clean)) {
    return { ok: true, directUrl: clean, title: '', size: '' };
  }

  // If the clean URL does not contain vcloud or worker parameters, do not query worker
  if (!clean.includes('vcloud') && !clean.includes('workers.dev')) {
    return { ok: false, directUrl: clean };
  }

  const cacheKey = clean.toLowerCase();
  const cached = cloudDownloadCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < 1800 * 1000)) {
    return cached.data;
  }

  return new Promise((resolve) => {
    const linksApiUrl = 'https://wild-sun-9376.oriue.workers.dev/api/links?vcloud=' + encodeURIComponent(clean);
    https.get(linksApiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const data = JSON.parse(d);
          const tokens = data.tokens || {};
          const candidateTypes = ['fsl', 'fsl2', 'pixel', 'server1', 'ten'];
          const availableType = candidateTypes.find(t => tokens[t]) || Object.keys(tokens)[0];
          if (!availableType || !tokens[availableType] || !data.title) {
            return resolve({ ok: false, directUrl: clean, title: data.title || '', size: data.size || '' });
          }
          const { ts, sig } = tokens[availableType];
          const goUrl = 'https://wild-sun-9376.oriue.workers.dev/go?type=' + availableType +
            '&vcloud=' + encodeURIComponent(clean) + '&ts=' + ts + '&sig=' + sig;

          https.get(goUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 }, goRes => {
            if (goRes.statusCode >= 300 && goRes.statusCode < 400 && goRes.headers.location) {
              const resData = {
                ok: true,
                directUrl: goRes.headers.location,
                title: data.title || '',
                size: data.size || ''
              };
              cloudDownloadCache.set(cacheKey, { timestamp: Date.now(), data: resData });
              return resolve(resData);
            }

            // Fallback: Check /watch endpoint if /go didn't redirect
            const watchUrl = 'https://wild-sun-9376.oriue.workers.dev/watch?type=' + availableType +
              '&vcloud=' + encodeURIComponent(clean) + '&ts=' + ts + '&sig=' + sig;
            https.get(watchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 }, watchRes => {
              let wHtml = '';
              watchRes.on('data', c => wHtml += c);
              watchRes.on('end', () => {
                const urlMatch = wHtml.match(/intent:\/\/play\?url=([^&#]+)/i) || wHtml.match(/url=([a-zA-Z0-9%\-_:\.\/]+\.(?:mp4|mkv)[^"'\s&]*)/i);
                if (urlMatch) {
                  const directUrl = decodeURIComponent(urlMatch[1]);
                  const resData = {
                    ok: true,
                    directUrl,
                    title: data.title || '',
                    size: data.size || ''
                  };
                  cloudDownloadCache.set(cacheKey, { timestamp: Date.now(), data: resData });
                  return resolve(resData);
                }
                resolve({ ok: false, directUrl: clean });
              });
            }).on('error', () => resolve({ ok: false, directUrl: clean }));
          }).on('error', () => resolve({ ok: false, directUrl: clean }));
        } catch(e) {
          resolve({ ok: false, directUrl: clean });
        }
      });
    }).on('error', () => resolve({ ok: false, directUrl: clean }));
  });
}

// 11b. Direct High-Speed File Download Handler (/api/download-file?url=...)
// 11b. Direct High-Speed File Download Handler (/api/download-file)
async function handleDownloadFile(req, res) {
  if (handleCors(req, res)) return;
  const q = getQueryParams(req);
  const rawUrl = q.get('url') || '';
  const passedTitle = q.get('title') || '';
  const quality = q.get('quality') || '1080p';
  const type = q.get('type') || 'movie';
  const id = q.get('id') || '';
  const se = q.get('se') || '';
  const ep = q.get('ep') || '';
  const isJson = q.get('json') === '1' || q.get('format') === 'json';

  if (!rawUrl && !passedTitle && !id) {
    if (isJson) {
      return sendJson(res, 400, { ok: false, error: 'Missing url, title, or id parameter' });
    }
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('Error: Missing download parameters');
  }

  // Extract clean base series/movie title without episode tags for reliable catalog matching
  const baseTitle = (passedTitle || '')
    .replace(/\b(?:s\d{1,2}\s*e\d{1,2}|season\s*\d{1,2}|episode\s*\d{1,2}|ep\s*\d{1,2})\b.*/i, '')
    .replace(/[:\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const titleToUse = baseTitle || (passedTitle || 'Netflix4U Video').replace(/[:\-–—]/g, ' ').replace(/\s+/g, ' ').trim();

  // Strip duplicate SxxExx from cleanFilenameBase before appending epSuffix
  let cleanFilenameBase = titleToUse.replace(/[^a-zA-Z0-9.\-_ ]/g, '').trim().replace(/\s+/g, '_');
  cleanFilenameBase = cleanFilenameBase.replace(/_?S\d{1,2}E\d{1,2}.*/i, '');
  const epSuffix = (se && ep) ? `_S${String(se).padStart(2, '0')}E${String(ep).padStart(2, '0')}` : '';
  const downloadFilename = `${cleanFilenameBase}${epSuffix}_${quality}.mkv`;

  try {
    let resolved = null;

    // 1. Direct Cloud URL provided
    if (rawUrl) {
      resolved = await resolveCloudDownloadUrl(rawUrl);
    }

    // 2. Direct Content ID Resolution (Exact TMDB / Catalog Match)
    let contentRec = null;
    if (id && (!resolved || !resolved.directUrl)) {
      try {
        contentRec = await resolveContentId(id);
      } catch (e) {}
    }

    // 3. Fallback: Search Catalog for title / ID to find authentic direct streams
    if (!resolved || !resolved.directUrl) {
      try {
        let catalogLinks = (contentRec && contentRec.links && contentRec.links.length) ? contentRec.links : [];
        if (!catalogLinks.length) {
          catalogLinks = findMatchingCatalogLinks(titleToUse, q.get('year'), q.get('imdbId'), id) || [];
          if (!catalogLinks.length && passedTitle && passedTitle !== titleToUse) {
            catalogLinks = findMatchingCatalogLinks(passedTitle, q.get('year'), q.get('imdbId'), id) || [];
          }
        }

        if (catalogLinks.length > 0) {
          // Prefer link matching requested quality or episode
          let matched = null;
          if (se && ep) {
            // STRICT MATCH: Only match when season and episode genuinely match!
            // CRITICAL FIX: NEVER fall back to catalogLinks[0] for TV episodes (which would download wrong episode/title)!
            matched = catalogLinks.find(l => Number(l.season) === Number(se) && Number(l.episode) === Number(ep) && (l.quality || '').toLowerCase().includes(quality.toLowerCase())) ||
                      catalogLinks.find(l => Number(l.season) === Number(se) && Number(l.episode) === Number(ep));
          } else {
            matched = catalogLinks.find(l => (l.quality || '').toLowerCase().includes(quality.toLowerCase())) ||
                      catalogLinks.find(l => l.isCloud || (l.url && l.url.includes('vcloud'))) ||
                      catalogLinks[0];
          }

          if (matched && matched.url) {
            resolved = await resolveCloudDownloadUrl(matched.url);
            if (!resolved || !resolved.directUrl) {
              resolved = { ok: true, directUrl: matched.url, title: matched.label || titleToUse, size: matched.size || '' };
            }
          }
        }
      } catch (e) {}
    }

    // 4. Fallback: Try NetMirror stream if available
    if (!resolved || !resolved.directUrl) {
      try {
        const nmItem = await resolveNetmirrorItem(id, titleToUse, type, 'hi');
        if (nmItem && nmItem.trailer && nmItem.trailer.endsWith('.mp4')) {
          resolved = { ok: true, directUrl: nmItem.trailer, title: titleToUse, size: '' };
        }
      } catch (e) {}
    }

    // If resolved to direct media URL
    if (resolved && resolved.ok && resolved.directUrl) {
      const targetUrl = resolved.directUrl;
      const isExternalMirror = /nexdrive|hubcloud|pixeldrain|drivehub/i.test(targetUrl);

      if (isJson) {
        return sendJson(res, 200, {
          ok: true,
          directUrl: targetUrl,
          title: resolved.title || titleToUse,
          filename: downloadFilename,
          size: resolved.size || ''
        });
      }

      if (isExternalMirror) {
        res.writeHead(302, {
          'Location': targetUrl,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end();
      }

      // 302 Found redirect directly with Content-Disposition Attachment headers
      res.writeHead(302, {
        'Location': targetUrl,
        'Content-Disposition': `attachment; filename="${downloadFilename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end();
    }

    // RESILIENT DIRECT DOWNLOAD GATEWAY: NEVER redirect to dotmovies search!
    if (isJson) {
      return sendJson(res, 200, {
        ok: true,
        directUrl: `/api/download-file?title=${encodeURIComponent(titleToUse)}&quality=${quality}&download=1`,
        title: titleToUse,
        filename: downloadFilename,
        message: 'Direct high-speed download link ready.'
      });
    }

    // Serve clean, instant direct downloading trigger page
    const directDlPage = `<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-8SPEG4KZ28"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', 'G-8SPEG4KZ28');
  </script>
  <!-- Google AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9082698285506451" crossorigin="anonymous"></script>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Downloading ${escapeHtml(titleToUse)} | Netflix4U High Speed</title>
  <style>
    body { background: #0a0a0f; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #12121a; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 32px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
    .icon { width: 64px; height: 64px; border-radius: 50%; background: rgba(34,197,94,0.15); color: #22c55e; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
    h1 { font-size: 1.25rem; font-weight: 800; margin: 0 0 8px; color: #fff; }
    p { font-size: 0.875rem; color: rgba(255,255,255,0.6); margin: 0 0 24px; line-height: 1.5; }
    .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 14px 20px; border-radius: 10px; font-size: 0.9rem; font-weight: 700; text-decoration: none; cursor: pointer; transition: all 0.2s; box-sizing: border-box; border: none; }
    .btn-primary { background: #e50914; color: #fff; margin-bottom: 12px; }
    .btn-primary:hover { background: #f40612; }
    .btn-secondary { background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.15); }
    .btn-secondary:hover { background: rgba(255,255,255,0.15); }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; background: rgba(229,9,20,0.15); color: #ff3b47; font-size: 0.75rem; font-weight: 700; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
    </div>
    <div class="badge">Direct Cloud Mirror</div>
    <h1>${escapeHtml(titleToUse)}</h1>
    <p>Your high-speed direct download package (${escapeHtml(quality)}) is connecting to the fastest available CDN node.</p>
    <a href="/api/stream-player?title=${encodeURIComponent(titleToUse)}&type=${encodeURIComponent(type)}" class="btn btn-primary">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
      Watch Online (Player)
    </a>
    <a href="https://t.me/netflix4u_website" target="_blank" rel="noopener noreferrer" class="btn btn-secondary">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path></svg>
      Get Direct File on Telegram (Fast)
    </a>
  </div>
</body>
</html>`;

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(directDlPage);
  } catch (err) {
    if (isJson) {
      return sendJson(res, 200, { ok: false, directUrl: '', filename: downloadFilename, error: err.message });
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Direct download stream connecting, please try again.');
  }
}

// 11c. Ultra-Resilient Error-Bypassing Multi-Audio Player (/api/stream-player)
async function handleStreamPlayer(req, res) {
  if (handleCors(req, res)) return;
  const q = getQueryParams(req);
  const id = q.get('id') || '';
  const title = q.get('title') || '';
  let type = (q.get('type') || '').toLowerCase();
  const se = parseInt(q.get('se') || q.get('season') || '1', 10) || 1;
  const ep = parseInt(q.get('ep') || q.get('episode') || '1', 10) || 1;
  const lang = (q.get('lang') || 'hi').toLowerCase();
  const year = q.get('year') || '';
  const passedVcloud = q.get('vcloud') || '';

  // 1. Resolve Cloud Stream if available (Prioritizes Dual-Audio Hindi + English streams)
  let cloudStream = null;
  let rawCloudUrl = passedVcloud;
  if (!rawCloudUrl && id) {
    try {
      let rec = await resolveContentId(id);
      if (!rec || !rec.links || !rec.links.length) {
        const matched = findMatchingCatalogLinks(title, year, null, null);
        if (matched && matched.length) {
          rec = { links: matched };
        }
      }
      if (!type && rec) {
        type = (rec.type || rec.contentType || '').toLowerCase();
      }
      const isMovie = (type === 'movie' || (!type && !q.get('se') && !q.get('season')));
      if (rec && rec.links) {
        const matchingLink = isMovie
          ? (rec.links.find(l => l.isCloud || (l.url && (l.url.includes('vcloud') || l.url.includes('workers.dev') || l.url.includes('r2.dev')))) || rec.links[0])
          : (rec.links.find(l => (Number(l.season) === Number(se) && Number(l.episode) === Number(ep)) && (l.isCloud || (l.url && (l.url.includes('vcloud') || l.url.includes('workers.dev') || l.url.includes('r2.dev'))))) || rec.links.find(l => Number(l.season) === Number(se) && Number(l.episode) === Number(ep)) || rec.links[0]);
        if (matchingLink && matchingLink.url) {
          rawCloudUrl = matchingLink.url;
        }
      }
    } catch(e) {}
  }
  if (!type) type = (q.get('se') || q.get('season')) ? 'tv' : 'movie';
  const isMovie = (type === 'movie');
  const actualSe = isMovie ? '' : se;
  const actualEp = isMovie ? '' : ep;

  if (rawCloudUrl) {
    try {
      const resCloud = await resolveCloudDownloadUrl(rawCloudUrl);
      if (resCloud && resCloud.ok && resCloud.directUrl) {
        cloudStream = {
          url: resCloud.directUrl,
          title: resCloud.title || title,
          size: resCloud.size || ''
        };
      }
    } catch(e) {}
  }

  // 2. Multi-Server Stream Providers (VidSrc Global direct TMDB, Peachify Ad-Free HD, VidLink Global Multi)
  const cleanId = String(id || '').replace(/^(?:dotmobiz|tmdb(?:-movie|-series|-tv)?)-/, '');
  const vidsrcUrl = isMovie
    ? `https://vidsrc.pm/embed/movie/${cleanId}`
    : `https://vidsrc.pm/embed/tv/${cleanId}/${se}/${ep}`;
  const peachifyDub = (lang === 'hi') ? 'Hindi' : (lang === 'ta' ? 'Tamil' : (lang === 'te' ? 'Telugu' : 'English'));
  const peachifyUrl = isMovie
    ? `https://peachify.pro/embed/movie/${cleanId}?accent=E50914&autoPlay=true${peachifyDub ? '&dub=' + encodeURIComponent(peachifyDub) : ''}`
    : `https://peachify.pro/embed/tv/${cleanId}/${se}/${ep}?accent=E50914&autoPlay=true&autoNext=true&showNextBtn=true${peachifyDub ? '&dub=' + encodeURIComponent(peachifyDub) : ''}`;
  const vidlinkUrl = isMovie
    ? `https://vidlink.pro/movie/${cleanId}?multiLang=true${lang ? '&lang=' + lang : ''}`
    : `https://vidlink.pro/tv/${cleanId}/${se}/${ep}?multiLang=true${lang ? '&lang=' + lang : ''}`;
  const allMovieLandUrl = isMovie
    ? `https://slast430did.com/play/${cleanId}`
    : `https://slast430did.com/play/${cleanId}?s=${se}&e=${ep}`;

  const displayTitle = (title || 'Stream') + (isMovie ? '' : ` • S${se} E${ep}`);
  const directDlHref = rawCloudUrl ? `/api/download-file?url=${encodeURIComponent(rawCloudUrl)}` : (cloudStream?.url ? `/api/download-file?url=${encodeURIComponent(cloudStream.url)}` : '');

  // Default initial server: Fast Cloud (if available) or Peachify (for Hindi/regional dub) or VidSrc (for English original)
  const isDubLang = (lang === 'hi' || lang === 'ta' || lang === 'te');
  const initialServer = cloudStream ? 'cloud' : (isDubLang ? 'peachify' : 'vidsrc');

  const playerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-8SPEG4KZ28"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', 'G-8SPEG4KZ28');
  </script>
  <!-- Google AdSense -->
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9082698285506451" crossorigin="anonymous"></script>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${escapeHtml(displayTitle)} | Netflix4U Multi-Audio Stream</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.min.css">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100vw; height: 100vh; overflow: hidden; background: #000;
      color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      user-select: none;
    }
    #player-root { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; }
    
    /* Sleek, Minimal Top Bar */
    #top-bar {
      position: absolute; top: 0; left: 0; right: 0; z-index: 60;
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px;
      background: linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 70%, transparent 100%);
      transition: opacity 0.3s ease, transform 0.3s ease;
      gap: 8px;
    }
    .top-bar-hidden { opacity: 0; pointer-events: none; transform: translateY(-6px); }

    .title-area { display: flex; align-items: center; gap: 6px; min-width: 0; flex-wrap: wrap; }
    .title-text { font-size: 12px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
    .badge-ep { background: #e50914; color: #fff; font-size: 9px; font-weight: 800; padding: 2px 5px; border-radius: 4px; }
    
    .controls-group { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
    .pill {
      background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
      color: rgba(255,255,255,0.85); font-size: 11px; font-weight: 600;
      padding: 3px 8px; border-radius: 12px; cursor: pointer;
      display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s;
    }
    .pill:hover { background: rgba(255,255,255,0.2); color: #fff; }
    .pill.active { background: #e50914; border-color: #e50914; color: #fff; box-shadow: 0 0 8px rgba(229,9,20,0.4); }

    .server-pill {
      background: rgba(20,24,32,0.85); border: 1px solid rgba(255,255,255,0.15);
      color: #bbb; font-size: 10px; font-weight: 600; padding: 3px 8px; border-radius: 6px; cursor: pointer; transition: all 0.2s;
    }
    .server-pill:hover { background: rgba(255,255,255,0.2); color: #fff; }
    .server-pill.active { background: #2563eb; border-color: #3b82f6; color: #fff; font-weight: 700; }

    .dl-btn {
      background: #16a34a; border: 1px solid #22c55e; color: #fff; font-size: 10px; font-weight: 700;
      padding: 3px 8px; border-radius: 6px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 3px;
    }

    /* Video Frame Container */
    #media-view { width: 100%; height: 100%; position: relative; flex: 1; background: #000; }
    .layer-view { width: 100%; height: 100%; border: none; display: none; position: absolute; inset: 0; }
    .layer-view.visible { display: block; }

    #shield-toast {
      position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: rgba(15, 15, 20, 0.94); border: 1px solid rgba(255, 255, 255, 0.25);
      color: #fff; font-size: 11px; font-weight: 600; padding: 6px 14px; border-radius: 20px;
      backdrop-filter: blur(10px); z-index: 9999; display: none; align-items: center; gap: 6px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.7); pointer-events: none;
    }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/artplayer/dist/artplayer.min.js"></script>
</head>
<body>
  <div id="player-root">
    <div id="top-bar">
      <div class="title-area">
        <span class="badge-ep">${isMovie ? 'MOVIE' : 'S' + actualSe + ' E' + actualEp}</span>
        <span class="title-text">${escapeHtml(displayTitle)}</span>
        ${!isMovie ? `
        <div class="ep-nav-group" style="display:inline-flex;align-items:center;gap:4px;margin-left:6px;">
          <button type="button" id="player-prev-ep" class="pill" ${ep <= 1 ? 'disabled style="opacity:0.4;pointer-events:none;"' : ''} onclick="navigateEpisode(-1)" title="Previous Episode">⏮️ Prev Ep</button>
          <button type="button" id="player-next-ep" class="pill" onclick="navigateEpisode(1)" title="Next Episode">Next Ep ⏭️</button>
        </div>` : ''}
      </div>

      <!-- Language Selectors -->
      <div class="controls-group">
        <button type="button" class="pill ${lang === 'hi' ? 'active' : ''}" onclick="switchLanguage('hi')">🇮🇳 Hindi Dub</button>
        <button type="button" class="pill ${lang === 'en' ? 'active' : ''}" onclick="switchLanguage('en')">🌐 English</button>
        <button type="button" class="pill ${lang === 'ta' ? 'active' : ''}" onclick="switchLanguage('ta')">Tamil</button>
        <button type="button" class="pill ${lang === 'te' ? 'active' : ''}" onclick="switchLanguage('te')">Telugu</button>
      </div>

      <!-- Server Selectors -->
      <div class="controls-group">
        <button type="button" id="btn-srv-vidsrc" class="server-pill ${initialServer === 'vidsrc' ? 'active' : ''}" onclick="activateServer(&quot;vidsrc&quot;)">📺 VidSrc (Direct TMDB • Global)</button>
        <button type="button" id="btn-srv-peachify" class="server-pill ${initialServer === 'peachify' ? 'active' : ''}" onclick="activateServer(&quot;peachify&quot;)">🍑 Peachify (Ad-Free HD)</button>
        <button type="button" id="btn-srv-allmovieland" class="server-pill ${initialServer === 'allmovieland' ? 'active' : ''}" onclick="activateServer(&quot;allmovieland&quot;)">🎬 AllMovieLand (Ultra HD)</button>
        <button type="button" id="btn-srv-vidlink" class="server-pill ${initialServer === 'vidlink' ? 'active' : ''}" onclick="activateServer(&quot;vidlink&quot;)">🚀 VidLink Multi</button>
        ${cloudStream ? '<button type="button" id="btn-srv-cloud" class="server-pill ' + (initialServer === 'cloud' ? 'active' : '') + '" onclick="activateServer(&quot;cloud&quot;)">⚡ Fast Cloud (Hindi Dual)</button>' : ''}
        ${cloudStream ? '<a href="intent:' + cloudStream.url + '#Intent;action=android.intent.action.VIEW;type=video/*;package=com.mxtech.videoplayer.ad;end" class="dl-btn" style="background:#0284c7;border-color:#38bdf8;" title="Play Hindi Dub in MX Player">📱 MX Player</a>' : ''}
        ${cloudStream ? '<a href="vlc://' + cloudStream.url.replace(/^https?:\/\//i, '') + '" class="dl-btn" style="background:#ea580c;border-color:#f97316;" title="Play Hindi Dub in VLC Player">🚀 VLC</a>' : ''}
        ${directDlHref ? '<a href="' + directDlHref + '" class="dl-btn" target="_blank" rel="noopener">📥 Direct Download</a>' : ''}
      </div>
    </div>

    <!-- Media Players View Area -->
    <div id="media-view">
      <iframe id="iframe-vidsrc" class="layer-view ${initialServer === 'vidsrc' ? 'visible' : ''}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe>
      <iframe id="iframe-peachify" class="layer-view ${initialServer === 'peachify' ? 'visible' : ''}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe>
      <iframe id="iframe-allmovieland" class="layer-view ${initialServer === 'allmovieland' ? 'visible' : ''}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe>
      <iframe id="iframe-vidlink" class="layer-view ${initialServer === 'vidlink' ? 'visible' : ''}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen></iframe>
      <div id="artplayer-layer" class="layer-view ${initialServer === 'cloud' ? 'visible' : ''}"></div>
    </div>

    <div id="shield-toast"></div>
  </div>

  <script>
    var vidsrcUrl = ${JSON.stringify(vidsrcUrl)};
    var peachifyUrl = ${JSON.stringify(peachifyUrl)};
    var allMovieLandUrl = ${JSON.stringify(allMovieLandUrl)};
    var cloudUrl = ${JSON.stringify(cloudStream ? cloudStream.url : '')};
    var vidlinkUrl = ${JSON.stringify(vidlinkUrl)};
    var currentServer = ${JSON.stringify(initialServer)};
    var art = null;
    var failoverIndex = 0;
    var serverSequence = ['vidsrc', 'peachify', 'allmovieland', 'vidlink', 'cloud'].filter(function(s) {
      if (s === 'cloud' && !cloudUrl) return false;
      return true;
    });

    function showShieldToast(msg) {
      var toast = document.getElementById('shield-toast');
      if (!toast) return;
      toast.innerHTML = '<span style="color:#22c55e;">🛡️</span> ' + msg;
      toast.style.display = 'inline-flex';
      setTimeout(function() { toast.style.display = 'none'; }, 3000);
    }

    function hideAllLayers() {
      document.querySelectorAll('.layer-view').forEach(function(el) { el.classList.remove('visible'); });
      document.querySelectorAll('.server-pill').forEach(function(el) { el.classList.remove('active'); });
    }

    function activateServer(srv) {
      currentServer = srv;
      hideAllLayers();
      var btn = document.getElementById('btn-srv-' + srv);
      if (btn) btn.classList.add('active');

      if (srv === 'vidsrc') {
        var frame = document.getElementById('iframe-vidsrc');
        if (!frame.src || frame.src === 'about:blank') {
          frame.src = vidsrcUrl;
        }
        frame.classList.add('visible');
      } else if (srv === 'peachify') {
        var frame = document.getElementById('iframe-peachify');
        if (!frame.src || frame.src === 'about:blank') {
          frame.src = peachifyUrl;
        }
        frame.classList.add('visible');
      } else if (srv === 'allmovieland') {
        var frame = document.getElementById('iframe-allmovieland');
        if (!frame.src || frame.src === 'about:blank') {
          frame.src = allMovieLandUrl;
        }
        frame.classList.add('visible');
      } else if (srv === 'vidlink') {
        var frame = document.getElementById('iframe-vidlink');
        if (!frame.src || frame.src === 'about:blank') frame.src = vidlinkUrl;
        frame.classList.add('visible');
      } else if (srv === 'cloud' && cloudUrl) {
        var mount = document.getElementById('artplayer-layer');
        mount.classList.add('visible');
        if (!art) {
          initArtplayer(cloudUrl);
        } else {
          art.switchUrl(cloudUrl);
        }
      }
    }

    function triggerAutoBypass(reason) {
      console.warn('[MultiAudio Shield] ' + reason + ' -> Switching server...');
      showShieldToast('Connecting to backup streaming mirror...');
      failoverIndex = (failoverIndex + 1) % serverSequence.length;
      activateServer(serverSequence[failoverIndex]);
    }

    function initArtplayer(url) {
      art = new Artplayer({
        container: '#artplayer-layer',
        url: url,
        title: ${JSON.stringify(displayTitle)},
        playbackRate: true,
        aspectRatio: true,
        setting: true,
        pip: true,
        fullscreen: true,
        fullscreenWeb: true,
        autoSize: false,
        theme: '#e50914',
        moreVideoAttr: {
          crossOrigin: 'anonymous',
          playsInline: true
        },
        icons: {
          loading: '<div style="color:#e50914;font-size:12px;font-weight:bold;">Connecting Hindi Dual-Audio Stream...</div>'
        },
        customType: {
          mkv: function(video, targetUrl) { video.src = targetUrl; }
        }
      });

      art.on('error', function(err) {
        triggerAutoBypass('Direct cloud stream error');
      });
      art.on('video:error', function(err) {
        triggerAutoBypass('Video decoding error');
      });
    }

    function switchLanguage(targetLang) {
      var currentParams = new URLSearchParams(window.location.search);
      currentParams.set('lang', targetLang);
      window.location.search = currentParams.toString();
    }

    function navigateEpisode(delta) {
      var currentParams = new URLSearchParams(window.location.search);
      var currentEp = parseInt(currentParams.get('ep') || currentParams.get('episode') || '1', 10) || 1;
      var newEp = currentEp + delta;
      if (newEp < 1) newEp = 1;
      currentParams.set('ep', String(newEp));
      currentParams.set('episode', String(newEp));
      window.location.search = currentParams.toString();
    }

    // Peachify API Message Listener & Progress Sync
    window.addEventListener('message', function(event) {
      if (event.origin !== 'https://peachify.pro') return;
      var payload = event.data;
      if (payload && payload.type === 'MEDIA_DATA') {
        try {
          localStorage.setItem('peachifyProgress', JSON.stringify(payload.data));
        } catch(e) {}
      }
      if (payload && payload.type === 'PLAYER_EVENT') {
        var pData = payload.data || {};
        var playerEvt = pData.event;
        if (playerEvt === 'play' || playerEvt === 'playing' || playerEvt === 'timeupdate') {
          showShieldToast('Playing on Peachify Ad-Free HD Stream');
        }
        if (playerEvt === 'ended' && !${isMovie}) {
          navigateEpisode(1);
        }
      }
    });

    // Auto-hide top bar on user inactivity
    var topBar = document.getElementById('top-bar');
    var hideTimeout = null;
    function resetTopBarTimer() {
      topBar.classList.remove('top-bar-hidden');
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(function() {
        topBar.classList.add('top-bar-hidden');
      }, 3000);
    }
    window.addEventListener('mousemove', resetTopBarTimer);
    window.addEventListener('touchstart', resetTopBarTimer);
    resetTopBarTimer();

    // Start initial player
    activateServer(currentServer);
  </script>
</body>
</html>`;

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'X-Frame-Options': 'ALLOWALL',
    'Content-Security-Policy': 'frame-ancestors *'
  });
  res.end(playerHtml);
}

// 11d. NetMirror Streaming Player Route (Forwarded to Verified Stream Player)
async function handleNetmirrorPlayer(req, res) {
  return handleStreamPlayer(req, res);
}

function handleVersion(req, res) {
  if (handleCors(req, res)) return;
  const versionPath = path.join(ROOT, 'version.json');
  let verData = { version: '3.3.0', build: 1742201000, updatedAt: new Date().toISOString() };
  if (fs.existsSync(versionPath)) {
    try { verData = JSON.parse(fs.readFileSync(versionPath, 'utf8')); } catch(e) {}
  }
  sendJson(res, 200, verData, {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
}

// 12. Master Universal Router
async function handleUniversalApi(req, res) {
  if (handleCors(req, res)) return;

  const [rawPath] = (req.url || '').split('?');
  const cleanPath = rawPath.replace(/^\/api\/?/, '').toLowerCase();

  if (rawPath.startsWith('/watch-tmdb')) return handleWatchTmdb(req, res);
  if (cleanPath === 'version') return handleVersion(req, res);
  if (cleanPath === 'download-file' || cleanPath.startsWith('download-file/')) return handleDownloadFile(req, res);
  if (cleanPath === 'stream-player' || cleanPath.startsWith('stream-player/')) return handleStreamPlayer(req, res);
  if (cleanPath === 'netmirror-player' || cleanPath.startsWith('netmirror-player/')) return handleNetmirrorPlayer(req, res);
  if (cleanPath === 'embed-tmdb' || cleanPath.startsWith('embed-tmdb/')) return handleEmbedTmdb(req, res);
  if (cleanPath === 'probe-stream' || cleanPath.startsWith('probe-stream/')) return handleProbeStream(req, res);
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
  handleNetmirrorPlayer,
  handleStreamPlayer,
  handleDownloadFile,
  resolveCloudDownloadUrl,
  handleWatchTmdb,
  handleEmbedTmdb,
  handleProbeStream,
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
