const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { getPlaybackSources } = require('./services/playbackService');
const { resolveContentId } = require('./services/canonicalResolver');
const { isPublicRecord, publicOnly } = require('./services/contentValidationService');
const { handleDetails, handlePlayback, handleSearch, handleUniversalApi } = require('./services/apiCore');

const PORT = process.env.PORT || 4173;
const ROOT = path.resolve(__dirname);
const DATA_DIR = path.join(ROOT, 'data');
const DETAILS_DIR = path.join(DATA_DIR, 'details');

// Global safety shield against uncaught runtime rejections
process.on('uncaughtException', (err) => {
  console.error('[Server Shield] Caught unhandled exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Server Shield] Caught unhandled rejection:', reason);
});

// ==========================================
// 🔐 SERVER-SIDE SECRETS (NEVER SENT TO CLIENT)
// ==========================================
const SECRETS = {
  TMDB_API_KEY: process.env.TMDB_API_KEY || '445f2b5a8941c1d4bd5a869761a916e3'
};

// ==========================================
// 🛡️ ANTI-SCRAPING & RATE LIMITER SHIELD
// ==========================================
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 600; // Generous for normal browsing, blocks rapid scrapers
const ipRequestCounts = new Map();

// Periodic cleanup of rate limiter map
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipRequestCounts.entries()) {
    if (now - record.startTime > RATE_LIMIT_WINDOW_MS) {
      ipRequestCounts.delete(ip);
    }
  }
}, 30 * 1000);

function checkRateLimit(ip) {
  // Always allow localhost/loopback without rate limiting
  if (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip === 'localhost' ||
    ip.includes('127.0.0.1')
  ) {
    return true;
  }

  const now = Date.now();
  const record = ipRequestCounts.get(ip) || { count: 0, startTime: now };

  if (now - record.startTime > RATE_LIMIT_WINDOW_MS) {
    record.count = 1;
    record.startTime = now;
    ipRequestCounts.set(ip, record);
    return true;
  }

  record.count++;
  ipRequestCounts.set(ip, record);

  return record.count <= MAX_REQUESTS_PER_WINDOW;
}

// Protected internal database files that must NEVER be downloaded directly in bulk
const PROTECTED_DATA_FILES = new Set([
  'details_map.json',
  'dotmobiz_complete_catalog.json'
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

// In-Memory Fast Caches
let catalogSummary = null;
const trailerCache = new Map();

function getCatalogSummary() {
  if (!catalogSummary) {
    const summaryPath = path.join(DATA_DIR, 'catalog_summary.json');
    if (fs.existsSync(summaryPath)) {
      catalogSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    } else {
      catalogSummary = [];
    }
  }
  return publicOnly(catalogSummary);
}

// Fast on-demand detail lookup without keeping 38MB in RAM
function getTitleDetails(id) {
  const safeId = id.replace(/[/\\?%*:|"<>]/g, '_');
  const filePath = path.join(DETAILS_DIR, safeId + '.json');
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {}
  }
  return null;
}

// Load harvested Dotmobiz metadata for instant link & poster reconciliation
const HARVESTED_PATH = fs.existsSync(path.join(ROOT, 'data', 'dotmobiz_harvested.json'))
  ? path.join(ROOT, 'data', 'dotmobiz_harvested.json')
  : path.join(ROOT, 'scratch', 'dotmobiz_harvested.json');
let harvestedCache = null;
function getHarvestedMap() {
  if (harvestedCache) return harvestedCache;
  harvestedCache = new Map();
  if (fs.existsSync(HARVESTED_PATH)) {
    try {
      const list = JSON.parse(fs.readFileSync(HARVESTED_PATH, 'utf8'));
      for (const h of list) {
        let cover = h.image;
        if (cover && !cover.startsWith('/') && !cover.startsWith('http')) cover = '/' + cover;
        const entry = { ...h, cover };
        harvestedCache.set(String(h.postId), entry);
        harvestedCache.set('dotmobiz-' + h.postId, entry);
        const pure = (h.title || '').replace(/\(\d{4}\)/g, '').replace(/^(NetFlix|Prime|Disney\+|Hotstar|SonyLIV|ZEE5)\s+/i, '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (pure) harvestedCache.set(pure, entry);
      }
    } catch(e) {}
  }
  return harvestedCache;
}

function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (m, dec) => String.fromCharCode(dec));
}

function enrichItemMetadataAndLinks(item) {
  if (!item) return item;

  if (item.title) item.title = decodeHtmlEntities(item.title);
  if (item.overview) item.overview = decodeHtmlEntities(item.overview);
  if (item.description) item.description = decodeHtmlEntities(item.description);

  const hMap = getHarvestedMap();
  const idStr = String(item.id || item.record_id || '');
  const cleanTitle = (item.title || '').replace(/\(\d{4}\)/g, '').replace(/^(NetFlix|Prime|Disney\+|Hotstar|SonyLIV|ZEE5)\s+/i, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeSlug = (item.slug || cleanTitle || idStr).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  // 1. Authentic poster reconciliation
  let authenticCover = null;
  let harvestEntry = hMap.get(idStr) || hMap.get(cleanTitle);
  if (harvestEntry) {
    const hClean = (harvestEntry.title || '').replace(/\(\d{4}\)/g, '').replace(/^(NetFlix|Prime|Disney\+|Hotstar|SonyLIV|ZEE5)\s+/i, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (hClean && cleanTitle && (hClean.includes(cleanTitle.slice(0, 5)) || cleanTitle.includes(hClean.slice(0, 5)))) {
      authenticCover = harvestEntry.cover;
      if (harvestEntry.imdbId && !item.imdbId) {
        item.imdbId = harvestEntry.imdbId;
      }
    }
  }

  if (authenticCover) {
    item.poster = authenticCover;
    item.backdrop = authenticCover;
  }

  // 2. Tag existing links
  item.links = (item.links || []).map(l => {
    const isVcloud = l.url && (l.url.includes('vcloud') || l.url.includes('workers.dev') || l.url.includes('hicine'));
    const isNexdrive = l.url && (l.url.includes('nexdrive') || l.url.includes('dotmobiz') || l.url.includes('dotmovies'));
    const quality = l.quality || 'HD';
    let finalUrl = l.url;
    if (isVcloud && !l.url.startsWith('/api/download/hicine')) {
      finalUrl = `/api/download/hicine?vcloud=${encodeURIComponent(l.url)}&slug=${encodeURIComponent(safeSlug)}&quality=${encodeURIComponent(quality)}`;
    }
    return {
      ...l,
      url: finalUrl,
      source: isVcloud ? 'hicine' : (isNexdrive ? 'dotmobiz' : (l.source || (item.provider === 'dotmobiz' ? 'dotmobiz' : 'hicine'))),
      isCloud: isVcloud
    };
  });

  // 3. If harvested match has downloads, add Dotmovies downloads if not present
  if (harvestEntry && harvestEntry.downloads && Array.isArray(harvestEntry.downloads)) {
    for (const dl of harvestEntry.downloads) {
      if (dl.url && !item.links.some(l => l.url === dl.url)) {
        item.links.push({
          url: dl.url,
          quality: dl.quality || 'HD',
          size: dl.size || '',
          label: dl.label || `Dotmovies Download [${dl.quality}]`,
          source: 'dotmobiz',
          isCloud: false
        });
      }
    }
  }

  // 4. If dotmobiz title, check if matching Hicine detail exists to add Fast Cloud links
  if (item.provider === 'dotmobiz' || idStr.startsWith('dotmobiz-')) {
    const candidateFiles = [
      `${cleanTitle}-${item.year}.json`,
      `${cleanTitle}.json`,
      item.slug ? `${item.slug}.json` : null
    ].filter(Boolean);

    for (const cFile of candidateFiles) {
      const cPath = path.join(DETAILS_DIR, cFile);
      if (fs.existsSync(cPath)) {
        try {
          const hic = JSON.parse(fs.readFileSync(cPath, 'utf8'));
          if (hic.links && Array.isArray(hic.links)) {
            for (const hl of hic.links) {
              if (hl.url && !item.links.some(l => l.url === hl.url)) {
                item.links.unshift({
                  ...hl,
                  url: `/api/download/hicine?vcloud=${encodeURIComponent(hl.url)}&slug=${encodeURIComponent(safeSlug)}&quality=${encodeURIComponent(hl.quality || 'HD')}`,
                  source: 'hicine',
                  isCloud: true
                });
              }
            }
          }
          break;
        } catch(e) {}
      }
    }
  }

  // 5. If title has matching Hicine file or Dotmobiz file, merge authentic links
  if (!item.links.some(l => l.source === 'hicine')) {
    const candidateFiles = [
      `${safeSlug}.json`,
      `${cleanTitle}-${item.year}.json`,
      `${cleanTitle}.json`,
      idStr.startsWith('dotmobiz-') ? `${idStr.replace('dotmobiz-', '')}.json` : null
    ].filter(Boolean);

    for (const cFile of candidateFiles) {
      const cPath = path.join(DETAILS_DIR, cFile);
      if (fs.existsSync(cPath)) {
        try {
          const hic = JSON.parse(fs.readFileSync(cPath, 'utf8'));
          if (hic.links && Array.isArray(hic.links)) {
            const hLinks = hic.links.filter(l => l && l.url && (l.url.includes('vcloud') || l.url.includes('workers.dev')));
            if (hLinks.length > 0) {
              const existingUrls = new Set(item.links.map(l => l.url));
              for (const hl of hLinks) {
                if (!existingUrls.has(hl.url)) {
                  item.links.unshift({
                    ...hl,
                    source: 'hicine',
                    isCloud: true
                  });
                }
              }
              break;
            }
          }
        } catch(e) {}
      }
    }
  }

  return item;
}

// Fast Hicine / Fast Cloud Direct Link Resolver (Multi-Worker Resilient)
function resolveHicineFastLink(vcloudUrl) {
  return new Promise((resolve) => {
    let cleanVcloud = vcloudUrl;
    if (vcloudUrl.includes('vcloud=')) {
      const match = vcloudUrl.match(/vcloud=([^&]+)/);
      if (match) cleanVcloud = decodeURIComponent(match[1]);
    }
    
    // Choose primary worker host based on URL or prefer wild-sun / crimson-sea
    const host = vcloudUrl.includes('wild-sun-9376')
      ? 'https://wild-sun-9376.oriue.workers.dev'
      : 'https://crimson-sea-a1e5.hekoy.workers.dev';
      
    const directFallback = host + '/?vcloud=' + encodeURIComponent(cleanVcloud);
    const apiUrl = host + '/api/links?vcloud=' + encodeURIComponent(cleanVcloud);

    const req = https.get(apiUrl, { timeout: 4500, headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(d);
          // If tokens is empty or title is null, upstream file was deleted
          if (!json.tokens || Object.keys(json.tokens).length === 0 || json.title === null) {
            return resolve(directFallback);
          }
          // Prioritize FAST DIRECT CLOUD STREAMS (fsl, fsl2, server1, ten, gofile)
          // NEVER pick 'pixel' (pixeldrain) because pixeldrain links 404
          const preferred = ['fsl', 'fsl2', 'server1', 'ten', 'gofile'];
          let type = preferred.find(t => json.tokens[t]);
          if (!type) {
            const nonPixel = Object.keys(json.tokens).filter(t => t !== 'pixel');
            type = nonPixel[0];
          }
          if (!type) return resolve(directFallback);

          const tok = json.tokens[type];
          const goUrl = host + '/go?type=' + type + '&vcloud=' + encodeURIComponent(cleanVcloud) + '&ts=' + tok.ts + '&sig=' + tok.sig;
          
          https.get(goUrl, { timeout: 4500, headers: { 'User-Agent': 'Mozilla/5.0' } }, goRes => {
            const dest = goRes.headers.location;
            if (dest) {
              // If HubCloud redirect (gpdl2.hubcloud.cx), follow 1 hop to get direct stream worker
              if (dest.includes('hubcloud.cx') || dest.includes('gpdl2')) {
                https.get(dest, { timeout: 3500, headers: { 'User-Agent': 'Mozilla/5.0' } }, hubRes => {
                  const hubLoc = hubRes.headers.location;
                  resolve(hubLoc || dest);
                }).on('error', () => resolve(dest));
              } else {
                resolve(dest);
              }
            } else {
              resolve(directFallback);
            }
          }).on('error', () => resolve(directFallback));
        } catch(e) { resolve(directFallback); }
      });
    });

    req.on('error', () => resolve(directFallback));
    req.on('timeout', () => {
      req.destroy();
      resolve(directFallback);
    });
  });
}

// YouTube Scraper Fallback (Extracts real 11-char videoId when TMDB has no trailer)
function fetchYouTubeVideoId(query) {
  return new Promise(resolve => {
    const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 5000
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const match = d.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
        if (match && match[1]) {
          resolve('https://www.youtube.com/embed/' + match[1]);
        } else {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

const tmdbIdCache = new Map();

function isTitleMatch(query, resultTitle, queryYear, resultDate, isTv = false) {
  const q = query.toLowerCase().replace(/[^a-z0-9]/g, '');
  const r = resultTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!q || !r) return false;

  // Exact match
  if (q === r) return true;

  // Year check
  if (queryYear && resultDate) {
    const rYear = parseInt(resultDate.slice(0, 4), 10);
    if (!isNaN(rYear)) {
      if (isTv) {
        // TV shows can have seasons years later than first_air_date (e.g. 2026 vs 2024)
        if (rYear > queryYear + 1) return false;
      } else {
        if (Math.abs(rYear - queryYear) > 1) {
          return false;
        }
      }
    }
  }

  // Prefix / containment match if length is reasonable
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

  const isTv = type === 'series' || type === 'kdrama' || type === 'anime';

  // 1. If authentic IMDb ID is available, use TMDB /find endpoint (100% precision)
  if (imdbId && typeof imdbId === 'string' && imdbId.startsWith('tt')) {
    return new Promise(resolve => {
      const findUrl = `https://api.tmdb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${SECRETS.TMDB_API_KEY}&external_source=imdb_id`;
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
  const clean = rawTitle.replace(/\(\d{4}\)/g, '').replace(/^(NetFlix|Prime|Disney\+|Hotstar|SonyLIV|ZEE5)\s+/i, '').trim();
  if (!clean) return Promise.resolve(null);

  // Extract year from title if not explicitly passed
  let qYear = year ? parseInt(year, 10) : null;
  if (!qYear) {
    const yMatch = rawTitle.match(/\b(19\d{2}|20\d{2})\b/);
    if (yMatch) qYear = parseInt(yMatch[1], 10);
  }

  const endpoint = isTv ? 'tv' : 'movie';
  let url = `https://api.tmdb.org/3/search/${endpoint}?api_key=${SECRETS.TMDB_API_KEY}&query=${encodeURIComponent(clean)}`;
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
            // Find verified title match - DO NOT BLINDLY PICK FIRST RESULT
            const matched = json.results.find(r => {
              const rTitle = r.title || r.name || '';
              const rDate = r.release_date || r.first_air_date || '';
              return isTitleMatch(clean, rTitle, qYear, rDate, isTv);
            });
            if (matched && matched.id) {
              tmdbIdCache.set(cacheKey, matched.id);
              return resolve(matched.id);
            }
          }
          resolve(null);
        } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

const castCache = new Map();

async function resolveTitleCast(title, tmdbId, year, type = 'movie', imdbId = '') {
  const cacheKey = `${imdbId || ''}_${tmdbId || ''}_${title || ''}_${year || ''}_${type}`.toLowerCase();
  if (castCache.has(cacheKey)) return castCache.get(cacheKey);

  const endpoint = (type === 'series' || type === 'kdrama' || type === 'anime') ? 'tv' : 'movie';
  let targetId = tmdbId;

  // 1. If authentic IMDb ID is available and no targetId, use TMDB /find (100% precision)
  if (!targetId && imdbId && typeof imdbId === 'string' && imdbId.startsWith('tt')) {
    targetId = await resolveTmdbId('', '', type, imdbId);
  }

  // 2. Otherwise search by title + year
  if (!targetId && title) {
    targetId = await resolveTmdbId(title, year, type);
  }

  // 3. If still no targetId and title has extra subtitle/season/brackets, clean and search
  if (!targetId && title) {
    const stripped = title.replace(/\bSeason\s*\d+\b/gi, '').replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, '').trim();
    if (stripped && stripped !== title) {
      targetId = await resolveTmdbId(stripped, year, type);
    }
  }

  if (!targetId) {
    castCache.set(cacheKey, []);
    return [];
  }

  const url = `https://api.tmdb.org/3/${endpoint}/${targetId}/credits?api_key=${SECRETS.TMDB_API_KEY}`;
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'application/json' }, timeout: 4000 }, res => {
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

// Trailer URLs are accepted only when an ingestion job persisted an exact,
// canonical relationship. Title-search fallbacks are intentionally forbidden.
function getVerifiedTrailer(item) {
  const trailer = item && item.trailerVerification;
  if (!trailer || trailer.status !== 'VERIFIED' || trailer.canonicalId !== item.canonicalId) return null;
  if (trailer.provider !== 'youtube' || !/^[A-Za-z0-9_-]{11}$/.test(trailer.videoId || '')) return null;
  return `https://www.youtube-nocookie.com/embed/${trailer.videoId}`;
}

const server = http.createServer(async (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  // 1. Enterprise Security Headers & Hardened CORS
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' https:; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' https://image.tmdb.org https://m.media-amazon.com https://storage.hicine.sbs https://*.hicine.sbs https://wsrv.nl https://*.wsrv.nl https://images.weserv.nl https://*.workers.dev data: blob:; connect-src 'self' https://api.tmdb.org https://storage.hicine.sbs https://wsrv.nl https://*.wsrv.nl https://*.workers.dev https:; frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://youtube.com https://*.youtube.com https://slast430did.com https://*.vidlink.pro https://vidlink.pro https://*.vidsrc.me https://vidsrc.me https://*.vidsrc.xyz https://vidsrc.xyz https://*.workers.dev https://*.vcloud.fit https://storage.hicine.sbs https://*.storage.hicine.sbs; media-src 'self' blob: https:;");

  const reqOrigin = req.headers['origin'];
  if (reqOrigin && (/^https:\/\/netflix4u\.in$/i.test(reqOrigin) || /^https:\/\/netflix4u\.fun$/i.test(reqOrigin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(reqOrigin))) {
    res.setHeader('Access-Control-Allow-Origin', reqOrigin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 2. Anti-Scraping Rate Limiting Check (Localhost is exempt)
  if (!checkRateLimit(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Automated scraping and mass data harvesting are strictly blocked.',
      retryAfterSeconds: 60
    }));
    return;
  }

  const [rawPath, queryString] = req.url.split('?');
  const reqPath = decodeURI(rawPath);
  const queryParams = new URLSearchParams(queryString || '');

  // 2b. Server Health Endpoints (/health & /api/health)
  if (reqPath === '/health' || reqPath === '/api/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache, no-store'
    });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      service: 'Netflix4U Streaming Platform'
    }));
    return;
  }

  // 3. 🚨 ANTI-DATA THEFT SHIELD: Strictly block direct raw database dumps
  if (reqPath.startsWith('/data/')) {
    const filename = path.basename(reqPath);
    if (PROTECTED_DATA_FILES.has(filename)) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        error: 'Forbidden',
        message: 'Direct bulk database download is restricted. Individual records must be accessed via authorized API endpoints.'
      }));
      return;
    }
  }

  // 4. API: YouTube Trailer Proxy & Resolver (100% Reliable Playback)
  if (reqPath === '/api/trailer') {
    const id = queryParams.get('id') || '';
    const title = queryParams.get('title') || '';
    const year = queryParams.get('year') || '';
    const type = queryParams.get('type') || 'movie';
    const imdbId = queryParams.get('imdbId') || '';
    let tmdbId = queryParams.get('tmdbId') || '';

    let cleanTitle = title || '';
    if (id && !cleanTitle) {
      const item = await resolveContentId(id);
      if (item) {
        cleanTitle = item.title || '';
        if (item.tmdbId) tmdbId = item.tmdbId;
      }
    }

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
      const endpoint = (type === 'series' || type === 'anime' || type === 'kdrama' || type === 'tv') ? 'tv' : 'movie';
      const endpointsToTry = [endpoint, endpoint === 'tv' ? 'movie' : 'tv'];

      for (const ep of endpointsToTry) {
        if (trailerUrl) break;
        const videoApiUrl = `https://api.tmdb.org/3/${ep}/${tmdbId}/videos?api_key=${SECRETS.TMDB_API_KEY}`;
        try {
          const vData = await new Promise(resolve => {
            https.get(videoApiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000 }, r => {
              let d = ''; r.on('data', c => d += c); r.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
            }).on('error', () => resolve(null));
          });
          if (vData && Array.isArray(vData.results) && vData.results.length > 0) {
            const ytVideos = vData.results.filter(v => v.site === 'YouTube' && v.key);
            const official = ytVideos.find(v => v.type === 'Trailer' && v.official) || ytVideos.find(v => v.type === 'Trailer') || ytVideos.find(v => v.type === 'Teaser') || ytVideos[0];
            if (official && official.key) {
              videoKey = official.key;
              videoName = official.name || '';
              trailerUrl = `https://www.youtube-nocookie.com/embed/${official.key}?rel=0&modestbranding=1`;
            }
          }
        } catch(e) {}
      }
    }

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400'
    });
    res.end(JSON.stringify({
      success: Boolean(trailerUrl),
      trailerUrl,
      key: videoKey,
      name: videoName,
      state: trailerUrl ? 'ready' : 'unavailable',
      searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanTitle + ' official trailer')}`
    }));
    return;
  }

  // 4a. API: TMDB Lookup Proxy (Protects TMDB key from client-side exposure)
  if (reqPath === '/api/tmdb-lookup') {
    const query = queryParams.get('query') || queryParams.get('q') || '';
    const type = queryParams.get('type') || 'movie';
    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Query parameter required' }));
      return;
    }
    const clean = query.replace(/\(\d{4}\)/g, '').replace(/^(NetFlix|Prime|Disney\+|Hotstar|SonyLIV|ZEE5)\s+/i, '').trim();
    const tmdbId = await resolveTmdbId(clean, '', type);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=86400' });
    res.end(JSON.stringify({ success: true, tmdbId, query: clean }));
    return;
  }

  // 4a-1. API: Cast Endpoint (/api/cast?title=...&tmdbId=...&imdbId=...)
  if (reqPath === '/api/cast') {
    const title = queryParams.get('title') || '';
    const tmdbId = queryParams.get('tmdbId') || '';
    const year = queryParams.get('year') || '';
    const type = queryParams.get('type') || 'movie';
    const imdbId = queryParams.get('imdbId') || '';
    const cast = await resolveTitleCast(title, tmdbId, year, type, imdbId);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400'
    });
    res.end(JSON.stringify({ success: true, cast }));
    return;
  }

  // 4a-2. API: Recommendations Endpoint (/api/recommendations?id=...)
  if (reqPath === '/api/recommendations') {
    const id = queryParams.get('id') || '';
    const catalog = getCatalogSummary();
    let currentItem = id ? catalog.find(x => x.id === id || x.slug === id) : null;
    let recs = [];
    if (currentItem && currentItem.categories && currentItem.categories.length > 0) {
      const primaryCat = currentItem.categories[0];
      recs = catalog.filter(x => x.id !== currentItem.id && x.categories && x.categories.includes(primaryCat)).slice(0, 12);
    }
    if (recs.length === 0) {
      recs = catalog.slice(0, 12);
    }
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    });
    res.end(JSON.stringify({ success: true, results: recs }));
    return;
  }

  // 4a-2b. Catalog Engine & Watch TMDB
  if (reqPath.startsWith('/api/catalog/') || reqPath.startsWith('/watch-tmdb')) {
    return handleUniversalApi(req, res);
  }

  // 4a-3. API: Summary / Catalog Endpoint (/api/summary or /api/catalog)
  if (reqPath === '/api/summary' || reqPath === '/api/catalog') {
    const catalog = getCatalogSummary();
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    });
    res.end(JSON.stringify({ success: true, count: catalog.length, results: catalog.slice(0, 100) }));
    return;
  }

  // 4a-4. API: Generic TMDB Proxy (/api/tmdb/*) - Eliminates client-side TMDB API key exposure
  if (reqPath.startsWith('/api/tmdb/')) {
    let tmdbSubPath = reqPath.replace('/api/tmdb', '');

    // Map local catalog IDs to TMDB IDs for /tv/:id and /movie/:id
    const mediaMatch = tmdbSubPath.match(/^\/(tv|movie)\/(\d+)(.*)$/);
    if (mediaMatch) {
      const [, mediaType, idStr, rest] = mediaMatch;
      const localItem = await resolveContentId(idStr);
      if (localItem) {
        const resolvedId = localItem.tmdbId || await resolveTmdbId(localItem.title, localItem.year, localItem.type, localItem.imdbId);
        if (resolvedId && String(resolvedId) !== idStr) {
          tmdbSubPath = `/${mediaType}/${resolvedId}${rest}`;
        }
      }
    }

    const clientQuery = new URLSearchParams(queryParams);
    clientQuery.delete('api_key'); // Never trust client key
    clientQuery.set('api_key', SECRETS.TMDB_API_KEY);

    const targetUrl = `https://api.tmdb.org/3${tmdbSubPath}?${clientQuery.toString()}`;
    const cacheKey = `tmdb_${tmdbSubPath}_${clientQuery.toString()}`;

    if (trailerCache.has(cacheKey)) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
      res.end(trailerCache.get(cacheKey));
      return;
    }

    https.get(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json'
      },
      timeout: 6000
    }, tmdbRes => {
      let d = '';
      tmdbRes.on('data', c => d += c);
      tmdbRes.on('end', () => {
        if (tmdbRes.statusCode >= 200 && tmdbRes.statusCode < 300) {
          try {
            const parsed = JSON.parse(d);
            // Ensure sequential episode numbers if episodes are present
            if (Array.isArray(parsed.episodes)) {
              parsed.episodes = parsed.episodes.map((ep, idx) => {
                if (!ep.episode_number || typeof ep.episode_number !== 'number') {
                  ep.episode_number = idx + 1;
                }
                return ep;
              });
              d = JSON.stringify(parsed);
            }
          } catch(e) {}

          trailerCache.set(cacheKey, d);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
          res.end(d);
        } else {
          res.writeHead(tmdbRes.statusCode || 500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(d || JSON.stringify({ error: 'TMDB upstream error' }));
        }
      });
    }).on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Failed to contact TMDB upstream' }));
    });
    return;
  }

  // 4b. API: Poster Resolver Proxy (Protects TMDB key from client-side exposure)
  if (reqPath === '/api/poster-resolver') {
    const title = queryParams.get('title') || '';
    const imdbId = queryParams.get('imdbId') || '';
    const type = queryParams.get('type') || 'movie';
    if (!title && !imdbId) {
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Title or imdbId parameter required' }));
      return;
    }

    let poster = null;
    let backdrop = null;
    let tmdbId = null;

    // Tier 1: If authentic IMDb ID is passed (starts with tt), use TMDB /find (100% precision)
    if (imdbId && imdbId.startsWith('tt')) {
      const findUrl = `https://api.tmdb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${SECRETS.TMDB_API_KEY}&external_source=imdb_id`;
      const findData = await new Promise(resolve => {
        https.get(findUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, timeout: 4000 }, r => {
          let d = ''; r.on('data', c => d += c); r.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
        }).on('error', () => resolve(null));
      });
      if (findData) {
        const item = (findData.movie_results && findData.movie_results[0]) || (findData.tv_results && findData.tv_results[0]);
        if (item) {
          tmdbId = item.id;
          if (item.poster_path) poster = `https://image.tmdb.org/t/p/w500${item.poster_path}`;
          if (item.backdrop_path) backdrop = `https://image.tmdb.org/t/p/original${item.backdrop_path}`;
        }
      }
    }

    // Tier 2: Check local authentic catalog summary
    if (!poster && title) {
      const clean = title.replace(/\(\d{4}\)/g, '').replace(/^(NetFlix|Prime|Disney\+|Hotstar|SonyLIV|ZEE5)\s+/i, '').trim();
      const localItem = getCatalogSummary().find(x => x.title && x.title.toLowerCase() === clean.toLowerCase());
      if (localItem && localItem.poster && !localItem.poster.includes('no-poster') && !localItem.poster.includes('placehold')) {
        poster = localItem.poster;
        backdrop = localItem.backdrop || localItem.poster;
      }
    }

    // Tier 3: Search TMDB with verified title & year matching (never returns an unrelated movie)
    if (!poster && title) {
      const clean = title.replace(/\(\d{4}\)/g, '').replace(/^(NetFlix|Prime|Disney\+|Hotstar|SonyLIV|ZEE5)\s+/i, '').trim();
      tmdbId = await resolveTmdbId(clean, '', type, imdbId);
      if (tmdbId) {
        const endpoint = (type === 'series' || type === 'anime' || type === 'kdrama') ? 'tv' : 'movie';
        const url = `https://api.tmdb.org/3/${endpoint}/${tmdbId}?api_key=${SECRETS.TMDB_API_KEY}`;
        const data = await new Promise(resolve => {
          https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, timeout: 4000 }, res => {
            let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve(null); } });
          }).on('error', () => resolve(null));
        });
        if (data) {
          if (data.poster_path) poster = `https://image.tmdb.org/t/p/w500${data.poster_path}`;
          if (data.backdrop_path) backdrop = `https://image.tmdb.org/t/p/original${data.backdrop_path}`;
        }
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=86400' });
    res.end(JSON.stringify({ success: true, poster, backdrop, tmdbId }));
    return;
  }

  // 4c. API: Secure Image Proxy (/api/image-proxy?url=...) with Strict SSRF Defense
  if (reqPath === '/api/image-proxy') {
    const rawUrl = queryParams.get('url');
    if (!rawUrl) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing image URL parameter');
      return;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl);
    } catch(e) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Invalid URL syntax');
      return;
    }

    // Protocol check
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Invalid protocol: only http and https allowed');
      return;
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // Reject localhost, private IP ranges, and cloud metadata (SSRF defense)
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
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Access to private/internal network addresses is forbidden');
      return;
    }

    // Approved domain allowlist for image proxying
    const isApprovedDomain =
      hostname.endsWith('tmdb.org') ||
      hostname.endsWith('themoviedb.org') ||
      hostname.endsWith('ytimg.com') ||
      hostname.endsWith('media-amazon.com') ||
      hostname === 'netflix4u.in' ||
      hostname === 'wsrv.nl' ||
      hostname.endsWith('.wsrv.nl');

    if (!isApprovedDomain) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Domain not authorized for image proxying');
      return;
    }

    const cacheDir = path.join(DATA_DIR, 'image_cache');
    if (!fs.existsSync(cacheDir)) {
      try { fs.mkdirSync(cacheDir, { recursive: true }); } catch(e) {}
    }

    const safeHash = Buffer.from(rawUrl).toString('base64url').slice(0, 100);
    const cachedFile = path.join(cacheDir, safeHash + '.img');

    if (fs.existsSync(cachedFile)) {
      try {
        const stats = fs.statSync(cachedFile);
        if (stats.size > 500) {
          res.writeHead(200, {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=2592000, immutable'
          });
          fs.createReadStream(cachedFile).pipe(res);
          return;
        }
      } catch(e) {}
    }

    const client = rawUrl.startsWith('https') ? https : http;
    const proxyReq = client.get(rawUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': 'https://www.themoviedb.org/'
      },
      timeout: 6000
    }, proxyRes => {
      if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
        const ct = proxyRes.headers['content-type'] || 'image/jpeg';
        res.writeHead(200, {
          'Content-Type': ct,
          'Cache-Control': 'public, max-age=2592000, immutable'
        });
        const out = fs.createWriteStream(cachedFile);
        proxyRes.pipe(out);
        proxyRes.pipe(res);
      } else {
        res.writeHead(proxyRes.statusCode || 502, { 'Content-Type': 'text/plain' });
        res.end('Failed to proxy image');
      }
    });

    proxyReq.on('error', () => {
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end('Image proxy error');
      }
    });
    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!res.headersSent) {
        res.writeHead(504, { 'Content-Type': 'text/plain' });
        res.end('Image proxy timeout');
      }
    });
    return;
  }

  // 5. API: Details Endpoint (/api/details/:id or /api/title?id=...) - Fast Canonical Lookup
  if (reqPath.startsWith('/api/details') || reqPath.startsWith('/api/title') || reqPath.startsWith('/api/item')) {
    return handleDetails(req, res);
  }

  // 5b. API: Playback Sources (/api/playback/:id or /api/playback?id=...)
  if (reqPath.startsWith('/api/playback')) {
    return handlePlayback(req, res);
  }

  // Download resolving is disabled until a licensed distribution integration is configured.
  if (reqPath === '/api/download/hicine' || reqPath === '/api/download') {
    res.writeHead(410, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: false, error: 'Downloads are unavailable until licensed sources are configured.' }));
    return;
  }

  // 6. API: Search Endpoint (/api/search?q=...)
  if (reqPath === '/api/search') {
    return handleSearch(req, res);
  }

  // 7. Static sitemap.xml & robots.txt
  if (reqPath === '/sitemap.xml' || reqPath === '/robots.txt') {
    const filePath = path.join(ROOT, reqPath);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400'
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // Path traversal security guard
  function isSafePath(baseDir, targetRel) {
    const resolvedBase = path.resolve(baseDir);
    const resolvedTarget = path.resolve(baseDir, String(targetRel).replace(/^[/\\]+/, ''));
    return resolvedTarget.startsWith(resolvedBase);
  }

  if (!isSafePath(ROOT, reqPath)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Access denied');
    return;
  }

  // 8. Public Data Files (/data/home_feed.json, /data/trending.json, /data/recent.json, etc.)
  if (reqPath.startsWith('/data/')) {
    const requestedFile = path.basename(reqPath).toLowerCase();
    if (requestedFile === 'dotmobiz_complete_catalog.json' || requestedFile.startsWith('dotmobiz_') || requestedFile.endsWith('.bak')) {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Access forbidden', message: 'Direct access to raw internal database is restricted.' }));
      return;
    }

    if (reqPath.startsWith('/data/details/')) {
      const match = reqPath.match(/\/data\/details\/([^/]+)\.json$/i);
      if (match) {
        const id = match[1];
        const item = await resolveContentId(id);
        if (item && isPublicRecord(item)) {
          const enriched = enrichItemMetadataAndLinks(item);
          if (!enriched.tmdbId && (enriched.title || enriched.imdbId)) {
            enriched.tmdbId = await resolveTmdbId(enriched.title, enriched.year, enriched.type, enriched.imdbId);
          }
          const hasRichCast = Array.isArray(enriched.cast) && enriched.cast.length > 0 && typeof enriched.cast[0] === 'object' && enriched.cast[0] !== null && Boolean(enriched.cast[0].photo);
          if (!hasRichCast && (enriched.title || enriched.imdbId)) {
            const resolvedCast = await resolveTitleCast(enriched.title, enriched.tmdbId, enriched.year, enriched.type, enriched.imdbId);
            if (resolvedCast && resolvedCast.length > 0) {
              enriched.cast = resolvedCast;
            } else if (Array.isArray(enriched.cast)) {
              enriched.cast = enriched.cast.map((c, idx) => typeof c === 'string' ? { id: 'c_' + idx, name: c, character: '', photo: null } : c);
            }
          }
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=1800'
          });
          res.end(JSON.stringify(enriched));
          return;
        }
      }
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Title not found' }));
      return;
    }

    let dataFilePath = path.join(ROOT, reqPath);
    if (isSafePath(DATA_DIR, reqPath.replace(/^\/data\//, '')) && fs.existsSync(dataFilePath) && fs.statSync(dataFilePath).isFile()) {
      // Never serve raw feeds: all public data must pass the same admission gate.
      if (/\.(json)$/i.test(dataFilePath)) {
        try {
          const raw = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
          const filtered = Array.isArray(raw) ? publicOnly(raw) : Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, publicOnly(value)]));
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
          res.end(JSON.stringify(filtered));
          return;
        } catch (_) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Invalid catalog data' }));
          return;
        }
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=3600'
      });
      fs.createReadStream(dataFilePath).pipe(res);
      return;
    }
    // Any unhandled /data/ request must strictly 404 and never fall through to root check
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Data resource not found' }));
    return;
  }

  // 8b. Uploads / Media Files (/uploads/posts/covers/...)
  if (reqPath.startsWith('/uploads/')) {
    const uploadFilePath = path.join(ROOT, reqPath);
    if (isSafePath(path.join(ROOT, 'uploads'), reqPath.replace(/^\/uploads\//, '')) && fs.existsSync(uploadFilePath) && fs.statSync(uploadFilePath).isFile()) {
      const ext = path.extname(uploadFilePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'image/webp',
        'Cache-Control': 'public, max-age=604800, immutable'
      });
      fs.createReadStream(uploadFilePath).pipe(res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Upload resource not found');
    return;
  }

  // 8c. Images Directory (/images/favicon.svg, /images/no-poster.svg, etc.)
  if (reqPath.startsWith('/images/')) {
    const imgFilePath = path.join(ROOT, reqPath);
    if (isSafePath(path.join(ROOT, 'images'), reqPath.replace(/^\/images\//, '')) && fs.existsSync(imgFilePath) && fs.statSync(imgFilePath).isFile()) {
      const ext = path.extname(imgFilePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'image/svg+xml',
        'Cache-Control': 'public, max-age=604800, immutable'
      });
      fs.createReadStream(imgFilePath).pipe(res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Image not found');
    return;
  }

  // 8d. Fonts Directory (/fonts/...)
  if (reqPath.startsWith('/fonts/')) {
    const fontFilePath = path.join(ROOT, reqPath);
    if (isSafePath(path.join(ROOT, 'fonts'), reqPath.replace(/^\/fonts\//, '')) && fs.existsSync(fontFilePath) && fs.statSync(fontFilePath).isFile()) {
      const ext = path.extname(fontFilePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'font/woff2',
        'Cache-Control': 'public, max-age=31536000, immutable'
      });
      fs.createReadStream(fontFilePath).pipe(res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Font not found');
    return;
  }

  // 8e. CSS Directory (/css/...)
  if (reqPath.startsWith('/css/')) {
    const cssFilePath = path.join(ROOT, reqPath);
    if (isSafePath(path.join(ROOT, 'css'), reqPath.replace(/^\/css\//, '')) && fs.existsSync(cssFilePath) && fs.statSync(cssFilePath).isFile()) {
      res.writeHead(200, {
        'Content-Type': 'text/css; charset=utf-8',
        'Cache-Control': 'public, max-age=604800, immutable'
      });
      fs.createReadStream(cssFilePath).pipe(res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('CSS not found');
    return;
  }

  // 8f. JS Directory (/js/...)
  if (reqPath.startsWith('/js/')) {
    const jsFilePath = path.join(ROOT, reqPath);
    if (isSafePath(path.join(ROOT, 'js'), reqPath.replace(/^\/js\//, '')) && fs.existsSync(jsFilePath) && fs.statSync(jsFilePath).isFile()) {
      const ext = path.extname(jsFilePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'text/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=604800, immutable'
      });
      fs.createReadStream(jsFilePath).pipe(res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('JS file not found');
    return;
  }

  // 8g. Assets Directory (/assets/...)
  if (reqPath.startsWith('/assets/')) {
    const assetFilePath = path.join(ROOT, reqPath);
    if (isSafePath(path.join(ROOT, 'assets'), reqPath.replace(/^\/assets\//, '')) && fs.existsSync(assetFilePath) && fs.statSync(assetFilePath).isFile()) {
      const ext = path.extname(assetFilePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=604800, immutable'
      });
      fs.createReadStream(assetFilePath).pipe(res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Asset not found');
    return;
  }

  // Block server internal directories & files from static serving
  const BLOCKED_EXTENSIONS = new Set(['.env', '.log', '.bak']);
  const BLOCKED_FILES = new Set(['dev-server.js', 'server.js', 'package.json', 'package-lock.json']);
  const requestedBase = path.basename(reqPath).toLowerCase();
  const requestedExt = path.extname(reqPath).toLowerCase();

  if (
    BLOCKED_FILES.has(requestedBase) ||
    BLOCKED_EXTENSIONS.has(requestedExt) ||
    reqPath.startsWith('/services/') ||
    reqPath.startsWith('/scripts/') ||
    reqPath.startsWith('/scratch/')
  ) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }

  // 9. Root file check (Strictly within ROOT, not in subdirectories)
  let filePath = path.join(ROOT, reqPath === '/' ? '/index.html' : reqPath);
  if (isSafePath(ROOT, reqPath) && path.dirname(filePath) === ROOT && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // 9b. CSS / Fonts / Images subdirectory serving
  const ALLOWED_SUBDIRS = ['css', 'fonts', 'images', 'public', 'icons', 'cf-fonts', '_astro', 'js'];
  const reqSegments = reqPath.replace(/^\//, '').split('/');
  if (reqSegments.length >= 2 && ALLOWED_SUBDIRS.includes(reqSegments[0])) {
    const subFilePath = path.join(ROOT, ...reqSegments);
    if (isSafePath(ROOT, reqPath) && fs.existsSync(subFilePath) && fs.statSync(subFilePath).isFile()) {
      const ext = path.extname(subFilePath).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      const cacheControl = ['.css', '.js', '.woff', '.woff2'].includes(ext)
        ? 'public, max-age=86400'
        : 'public, max-age=3600';
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': cacheControl });
      fs.createReadStream(subFilePath).pipe(res);
      return;
    }
  }

  // 10. Assets / JS resolution
  const baseName = path.basename(reqPath);
  const inJs = path.join(ROOT, 'js', baseName);
  const inAssets = path.join(ROOT, 'assets', baseName);

  if (fs.existsSync(inJs) && fs.statSync(inJs).isFile()) {
    const ext = path.extname(inJs).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(inJs).pipe(res);
    return;
  }

  if (fs.existsSync(inAssets) && fs.statSync(inAssets).isFile()) {
    const ext = path.extname(inAssets).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(inAssets).pipe(res);
    return;
  }

  // 11. Missing Static Asset handling (strictly return 404, never 200 HTML)
  const ext = path.extname(reqPath);
  if (ext && ext !== '.html') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`Asset not found: ${reqPath}`);
    return;
  }

  // 12. SPA Fallback with Dynamic OpenGraph Pre-Rendering for Social Media Bots
  const indexPath = path.join(ROOT, 'index.html');
  if (fs.existsSync(indexPath)) {
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const isBot = /facebookexternalhit|twitterbot|whatsapp|telegrambot|linkedinbot|discordbot|slackbot|pinterest|googlebot|bingbot/i.test(userAgent);
    const movieRouteMatch = reqPath.match(/^\/(movie|series|anime|kdrama)\/([^/]+)/i);

    if (isBot && movieRouteMatch) {
      const [, rType, rId] = movieRouteMatch;
      const item = getTitleDetails(rId);
      if (item && isPublicRecord(item)) {
        let indexHtml = fs.readFileSync(indexPath, 'utf8');
        const title = `${item.title || 'Title'} (${item.year || ''}) | Netflix4U`;
        const desc = (item.description || 'Discover verified entertainment catalog information.').slice(0, 160);
        const image = item.backdrop || item.poster || 'https://netflix4u.in/og-image.jpg';
        const type = (rType === 'series' || rType === 'anime' || rType === 'kdrama') ? 'video.tv_show' : 'video.movie';
        const canonicalUrl = `https://netflix4u.in/${rType}/${rId}`;

        const escapeOg = str => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        const dynamicOgTags = `
    <!-- 🚀 Dynamic Server-Injected OpenGraph Tags for Crawlers -->
    <title>${escapeOg(title)}</title>
    <meta name="description" content="${escapeOg(desc)}" />
    <link rel="canonical" href="${canonicalUrl}" />
    <meta property="og:type" content="${type}" />
    <meta property="og:title" content="${escapeOg(title)}" />
    <meta property="og:description" content="${escapeOg(desc)}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:width" content="1280" />
    <meta property="og:image:height" content="720" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:site_name" content="Netflix4U" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeOg(title)}" />
    <meta name="twitter:description" content="${escapeOg(desc)}" />
    <meta name="twitter:image" content="${image}" />
        `;

        indexHtml = indexHtml
          .replace(/<title>.*?<\/title>/i, '')
          .replace(/<meta\s+name=["']description["'].*?>/i, '')
          .replace('</head>', `${dynamicOgTags}\n</head>`);

        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=3600'
        });
        res.end(indexHtml);
        return;
      }
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(indexPath).pipe(res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`⚡ Netflix4U Ultra-Fast Secure Server running at http://localhost:${PORT}`);
});
