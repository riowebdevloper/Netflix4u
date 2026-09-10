/**
 * Netflix4U Universal Serverless API Core
 * Shared between Vercel Serverless Functions, Node dev-server, and Passenger production.
 * Enforces canonical content identity, safe playback admitting, and verified metadata.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { resolveContentId } = require('./canonicalResolver');

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
      try { res.setHeader(k, v); } catch(e) {}
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
      } catch(e) {
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
          } catch(e) {}
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
        } catch(e) {}
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
              photo: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
            }));
            castCache.set(cacheKey, cast);
            return resolve(cast);
          }
        } catch(e) {}
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
  const sources = [];

  // 1. Direct verified cloud stream (Fast Cloud)
  if (item.links && Array.isArray(item.links) && item.links.length > 0) {
    const cloudLink = item.links.find(l => l.isCloud || /1080|720|HD/i.test(l.quality)) || item.links[0];
    if (cloudLink && cloudLink.url) {
      sources.push({
        id: 'hicine',
        name: 'Server 2 (Fast Cloud)',
        label: 'Fast Cloud',
        canonicalId,
        provider: 'direct',
        url: cloudLink.url,
        embedUrl: cloudLink.url,
        isDirect: true
      });
    }
  }

  // 2. Verified TMDB / IMDb external embeds
  // CRITICAL: Only allow external embeds if tmdbId or imdbId is verified for THIS item!
  const hasVerifiedTmdb = Boolean(item.externalProvider === 'tmdb' || (item.tmdbId && String(item.tmdbId).length >= 2));
  const hasVerifiedImdb = Boolean(item.imdbId && item.imdbId.startsWith('tt'));

  if (hasVerifiedImdb) {
    sources.push({
      id: 'allmovieland',
      name: 'Server 1 (AllMovieLand)',
      label: 'Server 1',
      canonicalId,
      provider: 'allmovieland',
      url: `https://slast430did.com/play/${item.imdbId}`,
      embedUrl: `https://slast430did.com/play/${item.imdbId}`,
      isDirect: false
    });
  }

  if (hasVerifiedTmdb) {
    const tid = item.tmdbId;
    const vidlinkUrl = isTv
      ? `https://vidlink.pro/tv/${tid}/${season}/${episode}?multiLang=true`
      : `https://vidlink.pro/movie/${tid}?multiLang=true`;

    sources.push({
      id: 'vidlink',
      name: 'Server 3 (VidLink)',
      label: 'Server 2',
      canonicalId,
      provider: 'vidlink',
      url: vidlinkUrl,
      embedUrl: vidlinkUrl,
      isDirect: false
    });

    const vidsrcUrl = isTv
      ? `https://vidsrc.me/embed/tv?tmdb=${tid}&season=${season}&episode=${episode}`
      : `https://vidsrc.me/embed/movie?tmdb=${tid}`;

    sources.push({
      id: 'vidsrcme',
      name: 'Server 4 (VidSrc)',
      label: 'Server 3',
      canonicalId,
      provider: 'vidsrcme',
      url: vidsrcUrl,
      embedUrl: vidsrcUrl,
      isDirect: false
    });
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
            let d = ''; r.on('data', c => d += c); r.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
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
      } catch(e) {}
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
        let d = ''; r.on('data', c => d += c); r.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
      }).on('error', () => resolve(null));
    });
    if (findData) {
      const item = (findData.movie_results && findData.movie_results[0]) || (findData.tv_results && findData.tv_results[0]);
        const pUrl = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null;
        const bUrl = item.backdrop_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path}` : null;
        return sendJson(res, 200, {
          success: true,
          poster: pUrl ? `https://wsrv.nl/?url=${encodeURIComponent(pUrl)}&output=webp` : null,
          backdrop: bUrl ? `https://wsrv.nl/?url=${encodeURIComponent(bUrl)}&output=webp` : null,
          tmdbId: item.id
        }, { 'Cache-Control': 'public, max-age=86400' });
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
        poster: localItem.poster,
        backdrop: localItem.backdrop || localItem.poster,
        canonicalId: localItem.canonicalId
      }, { 'Cache-Control': 'public, max-age=86400' });
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
          } catch(e) {
            return sendJson(res, 500, { error: 'Failed to parse TMDB response' });
          }
        } else {
          return sendJson(res, tmdbRes.statusCode || 500, { error: 'TMDB upstream error', code: tmdbRes.statusCode });
        }
      });
    });
    req.on('error', err => sendJson(res, 502, { error: 'Failed to contact TMDB upstream: ' + (err.message || '') }));
  } catch(err) {
    sendJson(res, 502, { error: 'Failed to contact TMDB upstream: ' + (err.message || '') });
  }
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

// 7. Search Catalog (/api/search)
async function handleSearch(req, res) {
  if (handleCors(req, res)) return;
  const q = getQueryParams(req);
  const query = (q.get('q') || '').trim().toLowerCase();

  if (!query) {
    return sendJson(res, 200, { success: true, results: [] });
  }

  const catalog = getCatalogSummary();
  const results = [];
  for (const item of catalog) {
    const matchTitle = item.title && item.title.toLowerCase().includes(query);
    const matchRaw = item.rawTitle && item.rawTitle.toLowerCase().includes(query);
    const matchSlug = item.slug && item.slug.toLowerCase().includes(query);
    const matchCat = item.categories && item.categories.some(c => c.toLowerCase().includes(query));

    if (matchTitle || matchRaw || matchSlug || matchCat) {
      const canonicalId = normalizeCanonicalId(item);
      const contentType = item.type || 'movie';
      results.push({
        ...item,
        id: canonicalId,
        canonicalId,
        type: contentType,
        contentType,
        url: `/${contentType}/${canonicalId}`
      });
      if (results.length >= 40) break;
    }
  }

  sendJson(res, 200, { success: true, results }, { 'Cache-Control': 'public, max-age=1800' });
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

// 12. Master Universal Router
async function handleUniversalApi(req, res) {
  if (handleCors(req, res)) return;

  const [rawPath] = (req.url || '').split('?');
  const cleanPath = rawPath.replace(/^\/api\/?/, '').toLowerCase();

  if (cleanPath === 'details' || cleanPath.startsWith('details/')) return handleDetails(req, res);
  if (cleanPath === 'playback' || cleanPath.startsWith('playback/')) return handlePlayback(req, res);
  if (cleanPath === 'trailer') return handleTrailer(req, res);
  if (cleanPath === 'poster-resolver') return handlePosterResolver(req, res);
  if (cleanPath.startsWith('tmdb/')) return handleTmdb(req, res);
  if (cleanPath === 'cast') return handleCast(req, res);
  if (cleanPath === 'search') return handleSearch(req, res);
  if (cleanPath === 'health') return handleHealth(req, res);
  if (cleanPath === 'summary' || cleanPath === 'catalog') return handleSummary(req, res);
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
  handleTrailer,
  handlePosterResolver,
  handleTmdb,
  handleCast,
  handleSearch,
  handleHealth,
  handleSummary,
  handleTmdbLookup,
  handleRecommendations,
  handleUniversalApi,
  invalidateCatalogCache,
  getQueryParams,
  sendJson,
  handleCors
};
