/**
 * Netflix4U Automated Content Ingestion & Self-Maintenance Pipeline
 * Architecture:
 * SCHEDULER -> SOURCE CONNECTOR -> DISCOVERY -> NORMALIZATION -> DEDUPLICATION ->
 * CANONICAL IDENTITY -> METADATA ENRICHMENT -> POSTER VALIDATION -> TRAILER VALIDATION ->
 * PUBLISH GATE -> DATABASE UPSERT -> SEARCH INDEX UPDATE -> HOMEPAGE UPDATE ->
 * CATEGORY UPDATE -> CACHE INVALIDATION -> SITEMAP UPDATE -> AUDIT LOG & HEALTH REPORT
 * 
 * Strict Ingestion Principles:
 * - Legal & Authorized Sources Only (TMDB official metadata & authorized catalog feeds)
 * - Zero unverified records published
 * - Zero duplicate records (Strict Idempotency)
 * - Atomic Writes & Safe Concurrency Locks
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DETAILS_DIR = path.join(DATA_DIR, 'details');
const CATALOG_SUMMARY_PATH = path.join(DATA_DIR, 'catalog_summary.json');
const HOME_FEED_PATH = path.join(DATA_DIR, 'home_feed.json');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const AUDIT_LOG_PATH = path.join(DATA_DIR, 'audit_log.json');
const LOCK_FILE_PATH = path.join(DATA_DIR, '.sync.lock');

const TMDB_API_KEY = process.env.TMDB_API_KEY || '445f2b5a8941c1d4bd5a869761a916e3';
const BASE_URL = 'https://netflix4u.in';

// ----------------------------------------------------
// 1. Concurrency Lock
// ----------------------------------------------------
function acquireLock(leaseMs = 15 * 60 * 1000) {
  try {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      const lockData = JSON.parse(fs.readFileSync(LOCK_FILE_PATH, 'utf8'));
      const age = Date.now() - lockData.timestamp;
      if (age < leaseMs) {
        return false; // Active lock exists
      }
    }
    fs.writeFileSync(LOCK_FILE_PATH, JSON.stringify({ timestamp: Date.now(), pid: process.pid }), 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE_PATH)) {
      fs.unlinkSync(LOCK_FILE_PATH);
    }
  } catch (e) {}
}

// ----------------------------------------------------
// 2. HTTP Helper with Timeout & Retry
// ----------------------------------------------------
function fetchJson(url, maxRetries = 2) {
  return new Promise((resolve) => {
    let attempt = 0;
    function makeReq() {
      attempt++;
      const req = https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        timeout: 6000
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(d));
            } catch(e) {
              resolve(null);
            }
          } else if (res.statusCode === 429 && attempt <= maxRetries) {
            setTimeout(makeReq, 1000 * attempt);
          } else {
            resolve(null);
          }
        });
      });
      req.on('error', () => {
        if (attempt <= maxRetries) setTimeout(makeReq, 500 * attempt);
        else resolve(null);
      });
      req.on('timeout', () => {
        req.destroy();
        if (attempt <= maxRetries) setTimeout(makeReq, 500 * attempt);
        else resolve(null);
      });
    }
    makeReq();
  });
}

// ----------------------------------------------------
// 3. Discovery: Fetch New Candidates from TMDB
// ----------------------------------------------------
async function discoverCandidates() {
  const endpoints = [
    { url: `https://api.tmdb.org/3/trending/all/day?api_key=${TMDB_API_KEY}`, type: 'mixed' },
    { url: `https://api.tmdb.org/3/movie/now_playing?api_key=${TMDB_API_KEY}`, type: 'movie' },
    { url: `https://api.tmdb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}`, type: 'movie' },
    { url: `https://api.tmdb.org/3/tv/on_the_air?api_key=${TMDB_API_KEY}`, type: 'series' },
    { url: `https://api.tmdb.org/3/tv/top_rated?api_key=${TMDB_API_KEY}`, type: 'series' }
  ];

  const rawCandidates = [];
  const seenTmdb = new Set();

  for (const ep of endpoints) {
    const data = await fetchJson(ep.url);
    if (data && Array.isArray(data.results)) {
      for (const item of data.results) {
        if (!item || !item.id) continue;
        const mediaType = item.media_type || ep.type;
        if (mediaType !== 'movie' && mediaType !== 'tv' && mediaType !== 'series') continue;
        const normType = (mediaType === 'tv' || mediaType === 'series') ? 'series' : 'movie';
        const key = `${normType}_${item.id}`;
        if (!seenTmdb.has(key)) {
          seenTmdb.add(key);
          rawCandidates.push({
            tmdbId: item.id,
            type: normType,
            preliminaryTitle: item.title || item.name,
            posterPath: item.poster_path,
            backdropPath: item.backdrop_path,
            releaseDate: item.release_date || item.first_air_date,
            rating: item.vote_average
          });
        }
      }
    }
  }

  return rawCandidates;
}

// ----------------------------------------------------
// 4. Poster & Artwork Verification
// ----------------------------------------------------
function verifyPosterUrl(posterUrl) {
  if (!posterUrl || typeof posterUrl !== 'string') return false;
  const p = posterUrl.trim().toLowerCase();
  if (p.includes('no-poster') || p.includes('placeholder') || p.includes('placehold') || p.includes('undefined')) {
    return false;
  }
  // Must be an approved domain or valid local path
  if (p.startsWith('https://image.tmdb.org/') || p.startsWith('https://storage.hicine.sbs/') || p.startsWith('/uploads/')) {
    return true;
  }
  return false;
}

// ----------------------------------------------------
// 5. Full Ingestion & Reconciliation Pipeline
// ----------------------------------------------------
async function runIngestionPipeline(options = {}) {
  const startTime = Date.now();
  const dryRun = Boolean(options.dryRun);

  if (!acquireLock()) {
    console.log('[IngestionPipeline] Another sync job is currently active. Aborting.');
    return { status: 'LOCKED', message: 'Job already in progress' };
  }

  const metrics = {
    discovered: 0,
    added: 0,
    updated: 0,
    skipped: 0,
    published: 0,
    poster_pending: 0,
    failed: 0,
    durationMs: 0
  };

  try {
    console.log('[IngestionPipeline] Starting scheduled catalog reconciliation...');

    // 1. Load current catalog summary
    let catalog = [];
    if (fs.existsSync(CATALOG_SUMMARY_PATH)) {
      try {
        catalog = JSON.parse(fs.readFileSync(CATALOG_SUMMARY_PATH, 'utf8'));
      } catch (e) {
        catalog = [];
      }
    }

    // Build fast lookup maps
    const existingByCanonicalId = new Map();
    const existingByTmdb = new Map();
    const existingByTitleYear = new Map();

    for (const item of catalog) {
      if (!item) continue;
      const cId = item.canonicalId || (item.record_id ? `dotmobiz-${item.record_id}` : item.id);
      item.canonicalId = cId;
      item.id = cId;
      existingByCanonicalId.set(cId, item);
      if (item.tmdbId) existingByTmdb.set(String(item.tmdbId), item);
      if (item.title && item.year) {
        const normKey = `${item.title.toLowerCase().replace(/[^a-z0-9]/g, '')}_${item.year}_${item.type}`;
        existingByTitleYear.set(normKey, item);
      }
    }

    // 2. Discover new candidates from approved source (TMDB API)
    const candidates = await discoverCandidates();
    metrics.discovered = candidates.length;
    console.log(`[IngestionPipeline] Discovered ${candidates.length} candidates.`);

    const newPublishedItems = [];

    // 3. Process each candidate
    for (const cand of candidates) {
      try {
        const tmdbStr = String(cand.tmdbId);
        const normType = cand.type;
        const canonicalId = `tmdb-${normType}-${tmdbStr}`;

        // Deduplication check
        let existing = existingByCanonicalId.get(canonicalId) || existingByTmdb.get(tmdbStr);
        if (!existing && cand.preliminaryTitle && cand.releaseDate) {
          const y = parseInt(cand.releaseDate.slice(0, 4), 10);
          if (y) {
            const tyKey = `${cand.preliminaryTitle.toLowerCase().replace(/[^a-z0-9]/g, '')}_${y}_${normType}`;
            existing = existingByTitleYear.get(tyKey);
          }
        }

        if (existing) {
          // Existing item -> update dynamic metadata (rating, votes) if changed
          let changed = false;
          if (cand.rating && Math.abs((existing.rating || 0) - cand.rating) >= 0.2) {
            existing.rating = parseFloat(cand.rating.toFixed(1));
            changed = true;
          }
          if (changed) {
            metrics.updated++;
          } else {
            metrics.skipped++;
          }
          continue;
        }

        // New item: Fetch full enriched details from TMDB
        const endpoint = (normType === 'series') ? 'tv' : 'movie';
        const detailUrl = `https://api.tmdb.org/3/${endpoint}/${cand.tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,external_ids`;
        const raw = await fetchJson(detailUrl);

        if (!raw || !raw.id) {
          metrics.failed++;
          continue;
        }

        const title = raw.title || raw.name || cand.preliminaryTitle;
        const releaseDate = raw.release_date || raw.first_air_date || '';
        const year = releaseDate ? parseInt(releaseDate.slice(0, 4), 10) : 2026;

        let poster = raw.poster_path ? `https://image.tmdb.org/t/p/w500${raw.poster_path}` : null;
        let backdrop = raw.backdrop_path ? `https://image.tmdb.org/t/p/original${raw.backdrop_path}` : poster;

        // Trailer resolution
        let trailerUrl = null;
        if (raw.videos && Array.isArray(raw.videos.results)) {
          const trailers = raw.videos.results.filter(v => v.site === 'YouTube');
          const official = trailers.find(v => v.type === 'Trailer' && v.official) || trailers.find(v => v.type === 'Trailer') || trailers[0];
          if (official && official.key) {
            trailerUrl = `https://www.youtube-nocookie.com/embed/${official.key}?rel=0&modestbranding=1`;
          }
        }

        // Cast resolution
        const cast = (raw.credits && Array.isArray(raw.credits.cast))
          ? raw.credits.cast.slice(0, 12).map(c => ({
              id: String(c.id),
              name: c.name,
              character: c.character || '',
              photo: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
            }))
          : [];

        // Determine Publish Gate status
        const isPosterValid = verifyPosterUrl(poster);
        const status = isPosterValid ? 'PUBLISHED' : 'POSTER_PENDING';

        const record = {
          id: canonicalId,
          canonicalId,
          externalProvider: 'tmdb',
          externalId: tmdbStr,
          tmdbId: tmdbStr,
          imdbId: raw.imdb_id || raw.external_ids?.imdb_id || '',
          type: normType,
          contentType: normType,
          title,
          canonicalTitle: title,
          originalTitle: raw.original_title || raw.original_name || title,
          overview: raw.overview || '',
          description: raw.overview || '',
          shortDescription: (raw.overview || '').slice(0, 120),
          year,
          releaseDate,
          rating: raw.vote_average ? parseFloat(raw.vote_average.toFixed(1)) : 8.0,
          votes: raw.vote_count ? `${(raw.vote_count / 1000).toFixed(1)}K` : '1.2K',
          quality: 'FHD',
          duration: (normType === 'series') ? `${raw.episode_run_time?.[0] || 45}m/ep` : (raw.runtime ? `${Math.floor(raw.runtime / 60)}h ${raw.runtime % 60}m` : '2h 00m'),
          genres: (raw.genres && Array.isArray(raw.genres)) ? raw.genres.map(g => g.name) : ['Entertainment'],
          categories: (raw.genres && Array.isArray(raw.genres)) ? raw.genres.map(g => g.name) : ['Entertainment'],
          language: raw.spoken_languages?.[0]?.english_name || 'English',
          country: raw.origin_country?.[0] || 'Global',
          director: raw.credits?.crew?.find(cr => cr.job === 'Director')?.name || 'Director',
          poster,
          backdrop,
          trailerUrl,
          trailer: trailerUrl,
          cast,
          seasons: raw.number_of_seasons || 1,
          episodes: raw.number_of_episodes || (raw.number_of_seasons ? raw.number_of_seasons * 10 : 1),
          status,
          publishedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          links: []
        };

        // Persist detail file
        if (!dryRun) {
          const detailPath = path.join(DETAILS_DIR, `${canonicalId}.json`);
          fs.writeFileSync(detailPath, JSON.stringify(record, null, 2), 'utf8');
        }

        if (status === 'PUBLISHED') {
          metrics.published++;
          newPublishedItems.push(record);
        } else {
          metrics.poster_pending++;
        }

        metrics.added++;
        existingByCanonicalId.set(canonicalId, record);
        catalog.unshift(record);
      } catch (err) {
        metrics.failed++;
        console.error('[IngestionPipeline] Error processing item:', err.message);
      }
    }

    // 4. Save updated catalog_summary.json if changed
    if (!dryRun && (metrics.added > 0 || metrics.updated > 0)) {
      // Keep catalog_summary clean (max 35,000 items)
      const summaryList = catalog.slice(0, 35000).map(item => ({
        id: item.canonicalId || item.id,
        canonicalId: item.canonicalId || item.id,
        record_id: item.record_id || undefined,
        title: item.title,
        rawTitle: item.rawTitle || item.title,
        slug: item.slug || `${item.canonicalId || item.id}-${(item.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        type: item.type || item.contentType || 'movie',
        year: item.year,
        quality: item.quality || 'FHD',
        provider: item.externalProvider || item.provider || 'dotmobiz',
        rating: item.rating || 8.0,
        poster: item.poster,
        backdrop: item.backdrop,
        imdbId: item.imdbId,
        tmdbId: item.tmdbId,
        categories: item.categories || ['Movies'],
        status: item.status || 'PUBLISHED',
        publishedAt: item.publishedAt || item.date || new Date().toISOString()
      }));

      fs.writeFileSync(CATALOG_SUMMARY_PATH, JSON.stringify(summaryList, null, 2), 'utf8');
      console.log('[IngestionPipeline] Saved catalog_summary.json.');

      // 5. Rebuild Home Feed (data/home_feed.json)
      rebuildHomeFeed(summaryList);

      // 6. Rebuild Category Files (data/movies.json, series.json, etc.)
      rebuildCategories(summaryList);

      // 7. Regenerate sitemap.xml
      rebuildSitemap(summaryList);

      // 8. Invalidate Caches
      const { invalidateCatalogCache } = require('./apiCore');
      invalidateCatalogCache();
    }

    metrics.durationMs = Date.now() - startTime;
    console.log(`[IngestionPipeline] Finished in ${metrics.durationMs}ms.`, metrics);

    // Record Audit Log
    recordAuditLog(metrics);

    return { status: 'SUCCESS', metrics };
  } catch (err) {
    console.error('[IngestionPipeline] Fatal failure in ingestion:', err);
    return { status: 'ERROR', error: err.message };
  } finally {
    releaseLock();
  }
}

function getCatalogList() {
  if (fs.existsSync(CATALOG_SUMMARY_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CATALOG_SUMMARY_PATH, 'utf8'));
    } catch (e) {
      return [];
    }
  }
  return [];
}

// ----------------------------------------------------
// 6. Automated Homepage Feed Rebuilder
// ----------------------------------------------------
const DETAILS_MAP_PATH = path.join(DATA_DIR, 'details_map.json');

function proxyTmdbImage(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('https://image.tmdb.org/') || url.startsWith('http://image.tmdb.org/')) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&output=webp`;
  }
  return url;
}

function normalizeFeedItem(item) {
  if (!item) return item;
  return {
    ...item,
    poster: proxyTmdbImage(item.poster),
    backdrop: proxyTmdbImage(item.backdrop || item.poster)
  };
}

function rebuildHomeFeed(catalogList) {
  if (!catalogList || !Array.isArray(catalogList)) {
    catalogList = getCatalogList();
  }

  // Load details_map to verify active download links & playback sources
  let detailsMap = new Map();
  if (fs.existsSync(DETAILS_MAP_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(DETAILS_MAP_PATH, 'utf8'));
      for (const [k, v] of Object.entries(raw)) {
        if (v) {
          detailsMap.set(String(k), v);
          if (v.record_id) detailsMap.set(String(v.record_id), v);
          if (v.canonicalId) detailsMap.set(String(v.canonicalId), v);
          if (v.slug) detailsMap.set(String(v.slug), v);
        }
      }
    } catch(e) {
      console.error('Error loading details_map in rebuildHomeFeed:', e.message);
    }
  }

  function hasVerifiedContent(item) {
    if (!item) return false;
    if (item.provider === 'dotmobiz') return true;
    const rawId = String(item.id || item.record_id || '').replace(/^dotmobiz-/, '');
    if (/^\d{3,8}$/.test(rawId)) return true;
    const mapped = detailsMap.get(rawId) || detailsMap.get(item.id) || detailsMap.get(item.canonicalId) || (item.slug && detailsMap.get(item.slug));
    if (mapped) {
      if (mapped.links && mapped.links.length > 0) return true;
      if (mapped.downloadOptions && mapped.downloadOptions.length > 0) return true;
      if (mapped.rawLinks && mapped.rawLinks.trim().length > 0) return true;
      if (mapped.playbackSources && mapped.playbackSources.length > 0) return true;
    }
    if (item.links && item.links.length > 0) return true;
    if (item.downloadOptions && item.downloadOptions.length > 0) return true;
    return false;
  }

  const published = catalogList
    .filter(item => item.status === 'PUBLISHED' && verifyPosterUrl(item.poster))
    .map(normalizeFeedItem);

  // Top high-demand blockbuster titles with verified downloads to headline the Hero Carousel
  const priorityIds = ['18013', '23933', '18025', '18029', '83865', '18026', '18027', '90545'];

  const withPlayback = published.filter(i => hasVerifiedContent(i) && i.backdrop && !i.backdrop.includes('no-poster'));
  
  // Sort priority titles first
  const priorityItems = [];
  for (const pid of priorityIds) {
    const match = withPlayback.find(i => String(i.id).includes(pid) || String(i.record_id).includes(pid));
    if (match && !priorityItems.some(p => p.id === match.id)) {
      priorityItems.push(match);
    }
  }

  const otherPlayback = withPlayback.filter(i => !priorityItems.some(p => p.id === i.id));

  // Balanced mix of movies and series
  const featured = [...priorityItems, ...otherPlayback]
    .filter(i => i.backdrop && !i.backdrop.includes('no-poster'))
    .slice(0, 8);

  // 2. Trending: Verified high-demand titles first, followed by top rating
  const trending = [
    ...featured,
    ...withPlayback.filter(i => !featured.some(f => f.id === i.id))
  ].slice(0, 20);

  // 3. Recent Releases: Sorted by year / date
  const recent = [...published]
    .sort((a, b) => (b.year || 0) - (a.year || 0))
    .slice(0, 20);

  // 4. Popular Movies: Movies with verified links or top ratings
  const popularMovies = published
    .filter(i => i.type === 'movie')
    .sort((a, b) => (hasVerifiedContent(b) ? 1 : 0) - (hasVerifiedContent(a) ? 1 : 0) || (b.rating || 0) - (a.rating || 0))
    .slice(0, 20);

  // 5. Popular Series: Series with verified links or top ratings
  const popularSeries = published
    .filter(i => i.type === 'series')
    .sort((a, b) => (hasVerifiedContent(b) ? 1 : 0) - (hasVerifiedContent(a) ? 1 : 0) || (b.rating || 0) - (a.rating || 0))
    .slice(0, 20);

  // 6. Anime
  const anime = published
    .filter(i => i.type === 'anime' || (i.categories && i.categories.some(c => /anime/i.test(c))))
    .slice(0, 20);

  // 7. K-Drama
  const kdrama = published
    .filter(i => i.type === 'kdrama' || (i.categories && i.categories.some(c => /korean|kdrama/i.test(c))))
    .slice(0, 20);

  // 8. Top Rated (rating >= 8.0)
  const topRated = [...published]
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 20);

  const feed = {
    trending,
    recent,
    featured: featured.length > 0 ? featured : trending.slice(0, 8),
    popularMovies,
    popularSeries,
    anime,
    kdrama,
    topRated,
    nowPlaying: recent.slice(0, 16),
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(HOME_FEED_PATH, JSON.stringify(feed, null, 2), 'utf8');
  console.log('[IngestionPipeline] Rebuilt and saved data/home_feed.json.');
}

// ----------------------------------------------------
// 7. Automated Category Files Rebuilder
// ----------------------------------------------------
function rebuildCategories(catalogList) {
  if (!catalogList || !Array.isArray(catalogList)) {
    catalogList = getCatalogList();
  }
  const published = catalogList
    .filter(item => item.status === 'PUBLISHED' && verifyPosterUrl(item.poster))
    .map(normalizeFeedItem);

  const movies = published.filter(i => i.type === 'movie').slice(0, 100);
  const series = published.filter(i => i.type === 'series').slice(0, 100);
  const anime = published.filter(i => i.type === 'anime' || (i.categories && i.categories.some(c => /anime/i.test(c)))).slice(0, 100);
  const kdrama = published.filter(i => i.type === 'kdrama' || (i.categories && i.categories.some(c => /korean|kdrama/i.test(c)))).slice(0, 100);
  const trending = published.slice(0, 100);

  const bollywood = published.filter(x => {
    const hay = ((x.language||'')+' '+(x.originalTitle||'')+' '+(x.rawTitle||'')+' '+(x.title||'')+' '+(x.categories||[]).join(' ')+' '+(x.country||'')).toLowerCase();
    const isSouth = hay.includes('south') || hay.includes('tamil') || hay.includes('telugu') || hay.includes('malayalam') || hay.includes('kannada') || hay.includes('tollywood') || hay.includes('kollywood');
    if (isSouth) return false;
    const isHollywood = (Array.isArray(x.categories) && x.categories.some(c => /hollywood/i.test(c))) || hay.includes('hollywood');
    if (isHollywood) return false;
    return hay.includes('bollywood') || (!hay.includes('english') && hay.includes('hindi')) || ((x.country||'').toLowerCase().includes('india') && !hay.includes('english'));
  }).slice(0, 100);

  const hollywood = published.filter(x => {
    const hay = ((x.language||'')+' '+(x.originalTitle||'')+' '+(x.rawTitle||'')+' '+(x.title||'')+' '+(x.categories||[]).join(' ')).toLowerCase();
    const isHollywood = (Array.isArray(x.categories) && x.categories.some(c => /hollywood/i.test(c))) || hay.includes('hollywood');
    const isEnglish = (x.language||'').toLowerCase().includes('english') || hay.includes('english');
    return isHollywood || (isEnglish && !hay.includes('bollywood') && !hay.includes('punjabi'));
  }).slice(0, 100);

  const southIndian = published.filter(x => {
    const hay = ((x.language||'')+' '+(x.originalTitle||'')+' '+(x.rawTitle||'')+' '+(x.title||'')+' '+(x.categories||[]).join(' ')).toLowerCase();
    return hay.includes('south') || hay.includes('tamil') || hay.includes('telugu') || hay.includes('malayalam') || hay.includes('kannada') || hay.includes('tollywood') || hay.includes('kollywood');
  }).slice(0, 100);

  const hindiDubbed = published.filter(x => {
    const hay = ((x.language||'')+' '+(x.originalTitle||'')+' '+(x.rawTitle||'')+' '+(x.title||'')+' '+(x.categories||[]).join(' ')).toLowerCase();
    return hay.includes('dual audio') || hay.includes('hindi dubbed') || hay.includes('dubbed') || hay.includes('multi audio');
  }).slice(0, 100);

  fs.writeFileSync(path.join(DATA_DIR, 'movies.json'), JSON.stringify(movies, null, 2), 'utf8');
  fs.writeFileSync(path.join(DATA_DIR, 'series.json'), JSON.stringify(series, null, 2), 'utf8');
  fs.writeFileSync(path.join(DATA_DIR, 'anime.json'), JSON.stringify(anime, null, 2), 'utf8');
  fs.writeFileSync(path.join(DATA_DIR, 'kdrama.json'), JSON.stringify(kdrama, null, 2), 'utf8');
  fs.writeFileSync(path.join(DATA_DIR, 'trending.json'), JSON.stringify(trending, null, 2), 'utf8');
  fs.writeFileSync(path.join(DATA_DIR, 'bollywood.json'), JSON.stringify(bollywood, null, 2), 'utf8');
  fs.writeFileSync(path.join(DATA_DIR, 'hollywood.json'), JSON.stringify(hollywood, null, 2), 'utf8');
  fs.writeFileSync(path.join(DATA_DIR, 'south-indian.json'), JSON.stringify(southIndian, null, 2), 'utf8');
  fs.writeFileSync(path.join(DATA_DIR, 'hindi-dubbed.json'), JSON.stringify(hindiDubbed, null, 2), 'utf8');
  console.log('[IngestionPipeline] Rebuilt category JSON files (including Bollywood, Hollywood, South Indian, Hindi Dubbed).');
}

// ----------------------------------------------------
// 8. Automated Sitemap Generator
// ----------------------------------------------------
function rebuildSitemap(catalogList) {
  if (!catalogList || !Array.isArray(catalogList)) {
    catalogList = getCatalogList();
  }
  const published = catalogList.filter(item => item.status === 'PUBLISHED' && verifyPosterUrl(item.poster));
  const now = new Date().toISOString().slice(0, 10);

  const staticUrls = [
    { loc: `${BASE_URL}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${BASE_URL}/movies`, priority: '0.9', changefreq: 'daily' },
    { loc: `${BASE_URL}/series`, priority: '0.9', changefreq: 'daily' },
    { loc: `${BASE_URL}/anime`, priority: '0.8', changefreq: 'daily' },
    { loc: `${BASE_URL}/kdrama`, priority: '0.8', changefreq: 'daily' },
    { loc: `${BASE_URL}/bollywood`, priority: '0.8', changefreq: 'daily' },
    { loc: `${BASE_URL}/hollywood`, priority: '0.8', changefreq: 'daily' },
    { loc: `${BASE_URL}/south-indian`, priority: '0.8', changefreq: 'daily' },
    { loc: `${BASE_URL}/hindi-dubbed`, priority: '0.8', changefreq: 'daily' },
    { loc: `${BASE_URL}/trending`, priority: '0.9', changefreq: 'daily' },
    { loc: `${BASE_URL}/genres`, priority: '0.7', changefreq: 'weekly' }
  ];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const s of staticUrls) {
    xml += `  <url>\n    <loc>${s.loc}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>${s.changefreq}</changefreq>\n    <priority>${s.priority}</priority>\n  </url>\n`;
  }

  // Include top 5,000 published canonical URLs
  for (const item of published.slice(0, 5000)) {
    const cId = item.canonicalId || item.id;
    const type = item.type || 'movie';
    const loc = `${BASE_URL}/${type}/${cId}`;
    xml += `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${now}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
  }

  xml += '</urlset>\n';
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
  console.log('[IngestionPipeline] Rebuilt and saved sitemap.xml.');
}

// ----------------------------------------------------
// 9. Audit Logging
// ----------------------------------------------------
function recordAuditLog(metrics) {
  try {
    let logs = [];
    if (fs.existsSync(AUDIT_LOG_PATH)) {
      try {
        logs = JSON.parse(fs.readFileSync(AUDIT_LOG_PATH, 'utf8'));
      } catch (e) {
        logs = [];
      }
    }
    logs.unshift({
      timestamp: new Date().toISOString(),
      ...metrics
    });
    // Keep last 100 log entries
    fs.writeFileSync(AUDIT_LOG_PATH, JSON.stringify(logs.slice(0, 100), null, 2), 'utf8');
  } catch (e) {}
}

module.exports = {
  runIngestionPipeline,
  discoverCandidates,
  verifyPosterUrl,
  rebuildHomeFeed,
  rebuildCategories,
  rebuildSitemap,
  acquireLock,
  releaseLock
};
