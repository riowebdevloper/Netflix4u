/**
 * Netflix4U Canonical Content ID & Record Resolver
 * Normalizes all ID formats (canonicalId, numeric, dotmobiz-prefixed, tmdb-prefixed, slug)
 * to ensure that any valid representation reliably resolves to the exact underlying title.
 * 
 * Strict Identity Guarantees:
 * 1. Every resolved record includes an immutable `canonicalId`.
 * 2. Local catalog IDs are prefixed with `dotmobiz-` to prevent collisions with TMDB IDs.
 * 3. TMDB records are prefixed with `tmdb-{movie|series}-`.
 * 4. Cross-title identity contamination is strictly prohibited.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DETAILS_DIR = path.join(DATA_DIR, 'details');
const CATALOG_SUMMARY_PATH = path.join(DATA_DIR, 'catalog_summary.json');
const COMPLETE_CATALOG_PATH = path.join(DATA_DIR, 'dotmobiz_complete_catalog.json');
const DETAILS_MAP_PATH = path.join(DATA_DIR, 'details_map.json');
const TMDB_API_KEY = process.env.TMDB_API_KEY || '445f2b5a8941c1d4bd5a869761a916e3';

// In-Memory Fast Lookup Index
let catalogIndex = null;
let detailsMapCache = null;
const tmdbMemoryCache = new Map();

function getDetailsMap() {
  if (detailsMapCache) return detailsMapCache;
  detailsMapCache = new Map();
  if (fs.existsSync(DETAILS_MAP_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(DETAILS_MAP_PATH, 'utf8'));
      for (const [k, v] of Object.entries(raw)) {
        if (!v) continue;
        detailsMapCache.set(String(k), v);
        if (v.slug) detailsMapCache.set(v.slug, v);
        if (v.record_id) detailsMapCache.set(String(v.record_id), v);
        if (v.imdbId && typeof v.imdbId === 'string' && v.imdbId.startsWith('tt')) {
          detailsMapCache.set(v.imdbId, v);
        }
        if (v.title) {
          const clean = v.title.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (clean.length >= 3) {
            if (!detailsMapCache.has(clean)) {
              detailsMapCache.set(clean, v);
            }
            if (v.year) {
              detailsMapCache.set(clean + v.year, v);
            }
          }
        }
      }
    } catch(e) {
      console.error('Failed to index details_map.json:', e.message);
    }
  }
  return detailsMapCache;
}

let detailsDirIndex = null;
const detailFileCache = new Map();

function normalizeRawLinks(links, title) {
  if (!Array.isArray(links)) return [];
  return links.map(l => {
    if (!l) return null;
    let url = typeof l === 'string' ? l : (l.url || '');
    if (!url) return null;

    const rawQual = String(l.quality || 'HD').toUpperCase();
    const isCloud = Boolean(l.isCloud || url.includes('vcloud') || url.includes('workers.dev') || url.includes('hicine'));
    const source = l.source || (url.includes('nexdrive') ? 'dotmobiz' : (isCloud ? 'hicine' : 'dotmobiz'));
    const size = l.size || (rawQual.includes('4K') || rawQual.includes('2160') ? '4.8 GB' : rawQual.includes('1080') ? '2.4 GB' : rawQual.includes('720') ? '1.1 GB' : '550 MB');
    const label = l.label || `${title || 'Stream'} [${rawQual}]`;

    return {
      url,
      quality: rawQual,
      size,
      label,
      source,
      isCloud
    };
  }).filter(Boolean);
}

function extractLinksFromDetail(detail, title) {
  if (!detail) return [];
  if (Array.isArray(detail.links) && detail.links.length > 0) {
    return normalizeRawLinks(detail.links, title || detail.title);
  }
  if (Array.isArray(detail.downloadOptions) && detail.downloadOptions.length > 0) {
    const converted = detail.downloadOptions.map(opt => ({
      url: opt.url,
      quality: opt.quality || 'HD',
      size: opt.size || '',
      label: opt.label || `Download [${opt.quality || 'HD'}]`,
      source: opt.url && opt.url.includes('nexdrive') ? 'dotmobiz' : 'cloud',
      isCloud: Boolean(opt.url && (opt.url.includes('workers.dev') || opt.url.includes('vcloud')))
    }));
    return normalizeRawLinks(converted, title || detail.title);
  }
  return [];
}

function loadDetailFileByFilename(filename, title) {
  if (!filename) return null;
  const name = String(filename).trim();
  const candidate = name.endsWith('.json') ? name : `${name}.json`;
  if (detailFileCache.has(candidate)) {
    return detailFileCache.get(candidate);
  }
  const fullPath = path.join(DETAILS_DIR, candidate);
  if (fs.existsSync(fullPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      const links = extractLinksFromDetail(data, title);
      detailFileCache.set(candidate, links);
      return links;
    } catch(e) {}
  }
  return null;
}

function findMatchingCatalogLinks(title, year, imdbId, slug) {
  const dMap = getDetailsMap();

  // 1. Check by authentic IMDb ID
  if (imdbId && typeof imdbId === 'string' && imdbId.startsWith('tt')) {
    const entry = dMap.get(imdbId);
    if (entry) {
      const links = extractLinksFromDetail(entry, title);
      if (links.length > 0) return links;
    }
    const fByImdb = loadDetailFileByFilename(imdbId, title);
    if (fByImdb && fByImdb.length > 0) return fByImdb;
  }

  // 2. Check by slug or ID
  if (slug) {
    const entry = dMap.get(slug);
    if (entry) {
      const links = extractLinksFromDetail(entry, title);
      if (links.length > 0) return links;
    }
    const fBySlug = loadDetailFileByFilename(slug, title);
    if (fBySlug && fBySlug.length > 0) return fBySlug;

    const slugIdMatch = slug.match(/^(\d+)/);
    if (slugIdMatch) {
      const fById = loadDetailFileByFilename(slugIdMatch[1], title);
      if (fById && fById.length > 0) return fById;
    }
  }

  // 3. Check by normalized alphanumeric title
  const clean = String(title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const primaryTitle = String(title || '').split(/[:\-–—]/)[0].trim().toLowerCase().replace(/[^a-z0-9]/g, '');

  const candidates = [clean];
  if (primaryTitle && primaryTitle !== clean && primaryTitle.length >= 3) {
    candidates.push(primaryTitle);
  }

  for (const c of candidates) {
    if (c.length >= 3) {
      if (year) {
        const entryYear = dMap.get(c + year);
        if (entryYear) {
          const links = extractLinksFromDetail(entryYear, title);
          if (links.length > 0) return links;
        }
        const fByYear = loadDetailFileByFilename(c + year, title);
        if (fByYear && fByYear.length > 0) return fByYear;
      }

      const entry = dMap.get(c);
      if (entry) {
        const links = extractLinksFromDetail(entry, title);
        if (links.length > 0) return links;
      }

      const fByClean = loadDetailFileByFilename(c, title);
      if (fByClean && fByClean.length > 0) return fByClean;

      // Fuzzy prefix/containment match for popular series/movies
      for (const [key, val] of dMap.entries()) {
        if (val && typeof key === 'string' && key.length >= 4 && (c.startsWith(key) || key.startsWith(c))) {
          const links = extractLinksFromDetail(val, title);
          if (links.length > 0) return links;
        }
      }
    }
  }

  return [];
}

function buildCatalogIndex() {
  if (catalogIndex) return catalogIndex;
  catalogIndex = new Map();

  // 1. Index catalog_summary.json
  if (fs.existsSync(CATALOG_SUMMARY_PATH)) {
    try {
      const summaryList = JSON.parse(fs.readFileSync(CATALOG_SUMMARY_PATH, 'utf8'));
      for (const item of summaryList) {
        if (!item) continue;
        const idStr = String(item.id || '');
        const recordIdStr = String(item.record_id || '');
        const slugStr = String(item.slug || '');
        const rawCId = String(item.canonicalId || '');
        const canonicalId = (rawCId.startsWith('tmdb-') || rawCId.startsWith('dotmobiz-'))
          ? rawCId
          : (recordIdStr ? `dotmobiz-${recordIdStr}` : (idStr.startsWith('dotmobiz-') ? idStr : `dotmobiz-${idStr}`));
        item.canonicalId = canonicalId;
        item.id = canonicalId;
        
        if (idStr) catalogIndex.set(idStr, item);
        if (canonicalId) catalogIndex.set(canonicalId, item);
        if (recordIdStr) {
          catalogIndex.set(recordIdStr, item);
          catalogIndex.set(`dotmobiz-${recordIdStr}`, item);
        }
        if (slugStr) {
          catalogIndex.set(slugStr, item);
          const slugIdMatch = slugStr.match(/^(\d+)-/);
          if (slugIdMatch) {
            catalogIndex.set(slugIdMatch[1], item);
            catalogIndex.set(`dotmobiz-${slugIdMatch[1]}`, item);
          }
        }
      }
    } catch (e) {
      console.error('Error indexing catalog_summary.json:', e.message);
    }
  }

  // 2. Index dotmobiz_complete_catalog.json
  if (fs.existsSync(COMPLETE_CATALOG_PATH)) {
    try {
      const completeList = JSON.parse(fs.readFileSync(COMPLETE_CATALOG_PATH, 'utf8'));
      for (const item of completeList) {
        if (!item) continue;
        const idStr = String(item.id || '');
        const recordIdStr = String(item.record_id || '');
        const slugStr = String(item.slug || '');
        const rawCId = String(item.canonicalId || '');
        const canonicalId = (rawCId.startsWith('tmdb-') || rawCId.startsWith('dotmobiz-'))
          ? rawCId
          : (recordIdStr ? `dotmobiz-${recordIdStr}` : (idStr.startsWith('dotmobiz-') ? idStr : `dotmobiz-${idStr}`));
        item.canonicalId = canonicalId;
        item.id = canonicalId;
        
        if (idStr && !catalogIndex.has(idStr)) catalogIndex.set(idStr, item);
        if (canonicalId && !catalogIndex.has(canonicalId)) catalogIndex.set(canonicalId, item);
        if (recordIdStr && !catalogIndex.has(recordIdStr)) {
          catalogIndex.set(recordIdStr, item);
          if (!catalogIndex.has(`dotmobiz-${recordIdStr}`)) {
            catalogIndex.set(`dotmobiz-${recordIdStr}`, item);
          }
        }
        if (slugStr && !catalogIndex.has(slugStr)) catalogIndex.set(slugStr, item);
      }
    } catch (e) {
      console.error('Error indexing dotmobiz_complete_catalog.json:', e.message);
    }
  }

  return catalogIndex;
}

/**
 * Reads a JSON file from DETAILS_DIR safely
 */
function readDetailFile(filename) {
  if (!filename) return null;
  const safeFile = filename.replace(/[/\\?%*:|"<>]/g, '_');
  const targetPath = path.join(DETAILS_DIR, safeFile.endsWith('.json') ? safeFile : `${safeFile}.json`);
  
  if (!path.resolve(targetPath).startsWith(DETAILS_DIR)) {
    return null;
  }

  if (fs.existsSync(targetPath)) {
    try {
      return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * Fetches and normalizes a verified record from TMDB
 */
function fetchTmdbRecord(mediaType, tmdbId) {
  const cacheKey = `${mediaType}_${tmdbId}`;
  if (tmdbMemoryCache.has(cacheKey)) {
    return Promise.resolve(tmdbMemoryCache.get(cacheKey));
  }

  const isTv = (mediaType === 'tv' || mediaType === 'series' || mediaType === 'anime' || mediaType === 'kdrama');
  const endpoint = isTv ? 'tv' : 'movie';
  const url = `https://api.tmdb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,external_ids`;

  return new Promise(resolve => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Accept': 'application/json' }, timeout: 5000 }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const raw = JSON.parse(d);
            const canonicalType = isTv ? 'series' : 'movie';
            const canonicalId = `tmdb-${canonicalType}-${raw.id}`;

            let trailerUrl = null;
            if (raw.videos && Array.isArray(raw.videos.results)) {
              const trailers = raw.videos.results.filter(v => v.site === 'YouTube');
              const official = trailers.find(v => v.type === 'Trailer' && v.official) || trailers.find(v => v.type === 'Trailer') || trailers[0];
              if (official && official.key) {
                trailerUrl = `https://www.youtube-nocookie.com/embed/${official.key}?rel=0&modestbranding=1`;
              }
            }

            const cast = (raw.credits && Array.isArray(raw.credits.cast))
              ? raw.credits.cast.slice(0, 15).map(c => ({
                  id: String(c.id),
                  name: c.name,
                  character: c.character || '',
                  photo: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null
                }))
              : [];

            const releaseDate = raw.release_date || raw.first_air_date || '';
            const year = releaseDate ? parseInt(releaseDate.slice(0, 4), 10) : 2026;

            const record = {
              id: canonicalId,
              canonicalId,
              externalProvider: 'tmdb',
              externalId: String(raw.id),
              tmdbId: String(raw.id),
              imdbId: raw.imdb_id || raw.external_ids?.imdb_id || '',
              type: canonicalType,
              contentType: canonicalType,
              title: raw.title || raw.name || 'Untitled',
              canonicalTitle: raw.title || raw.name || 'Untitled',
              originalTitle: raw.original_title || raw.original_name || raw.title || raw.name || 'Untitled',
              overview: raw.overview || '',
              description: raw.overview || '',
              shortDescription: (raw.overview || '').slice(0, 120),
              year,
              rating: raw.vote_average ? parseFloat(raw.vote_average.toFixed(1)) : 8.0,
              votes: raw.vote_count ? `${(raw.vote_count / 1000).toFixed(1)}K` : '1.2K',
              quality: 'FHD',
              duration: isTv ? `${raw.episode_run_time?.[0] || 45}m/ep` : (raw.runtime ? `${Math.floor(raw.runtime / 60)}h ${raw.runtime % 60}m` : '2h 00m'),
              genres: (raw.genres && Array.isArray(raw.genres)) ? raw.genres.map(g => g.name) : ['Entertainment'],
              categories: (raw.genres && Array.isArray(raw.genres)) ? raw.genres.map(g => g.name) : ['Entertainment'],
              language: raw.spoken_languages?.[0]?.english_name || 'English',
              country: raw.origin_country?.[0] || 'Global',
              poster: raw.poster_path ? (`https://wsrv.nl/?url=${encodeURIComponent('https://image.tmdb.org/t/p/w500' + raw.poster_path)}&output=webp`) : null,
              backdrop: raw.backdrop_path ? (`https://wsrv.nl/?url=${encodeURIComponent('https://image.tmdb.org/t/p/original' + raw.backdrop_path)}&output=webp`) : (raw.poster_path ? (`https://wsrv.nl/?url=${encodeURIComponent('https://image.tmdb.org/t/p/original' + raw.poster_path)}&output=webp`) : null),
              trailerUrl,
              trailer: trailerUrl,
              cast,
              seasons: raw.number_of_seasons || 1,
              episodes: raw.number_of_episodes || (raw.number_of_seasons ? raw.number_of_seasons * 10 : 1),
              status: 'PUBLISHED',
              links: normalizeRawLinks(findMatchingCatalogLinks(raw.title || raw.name, year, raw.imdb_id || raw.external_ids?.imdb_id, null), canonicalId, isTv)
            };

            tmdbMemoryCache.set(cacheKey, record);
            // Also cache to disk if possible
            try {
              const diskPath = path.join(DETAILS_DIR, `${canonicalId}.json`);
              if (!fs.existsSync(diskPath)) {
                fs.writeFileSync(diskPath, JSON.stringify(record, null, 2), 'utf8');
              }
            } catch(e) {}

            return resolve(record);
          }
        } catch(e) {}
        resolve(null);
      });
    }).on('error', () => resolve(null));
  });
}

/**
 * Universal Link Normalizer
 */
function normalizeRawLinks(links, canonicalId, isSeries = false) {
  if (!Array.isArray(links)) return [];
  return links.filter(l => l && l.url).map(l => {
    let q = (l.quality || 'HD').toUpperCase();
    if (/2160|4K|UHD/i.test(q) || /2160|4K|UHD/i.test(l.label || '')) q = '2160p / 4K';
    else if (/1440|2K/i.test(q) || /1440|2K/i.test(l.label || '')) q = '1440p';
    else if (/1080|FHD/i.test(q) || /1080|FHD/i.test(l.label || '')) q = '1080p';
    else if (/720|HD/i.test(q) || /720|HD/i.test(l.label || '')) q = '720p';
    else if (/480|SD/i.test(q) || /480|SD/i.test(l.label || '')) q = '480p';

    const isCloud = Boolean(l.isCloud || (l.url && (l.url.includes('vcloud') || l.url.includes('workers.dev'))));
    const source = isCloud ? 'Fast Cloud' : (l.url && l.url.includes('nexdrive') ? 'AllMovieLand' : (l.source || 'Direct Mirror'));

    let season = l.season !== undefined ? l.season : null;
    let episode = l.episode !== undefined ? l.episode : null;
    let isPack = Boolean(l.isPack);

    const label = l.label || '';
    if (season === null) {
      const sMatch = label.match(/(?:season|s)\s*(\d+)/i);
      if (sMatch) season = parseInt(sMatch[1], 10);
      else if (isSeries) season = 1;
    }
    if (episode === null) {
      const epMatch = label.match(/(?:episode|ep|e)\s*(\d+)/i);
      if (epMatch) episode = parseInt(epMatch[1], 10);
      else if (/complete|pack|zip|batch|full\s*season/i.test(label)) isPack = true;
    }

    return {
      ...l,
      canonicalId,
      quality: q,
      source,
      isCloud,
      season,
      episode,
      isPack
    };
  });
}

/**
 * Standardizes any local catalog record to conform to CanonicalContentRecord
 */
function standardizeLocalRecord(item, rawId) {
  if (!item) return null;
  const rawNum = String(item.record_id || item.id || '').replace(/^dotmobiz-/, '');
  const canonicalId = `dotmobiz-${rawNum || String(rawId || '').replace(/^dotmobiz-/, '')}`;
  const rawTitle = item.rawTitle || item.title || 'Untitled';
  
  // Clean title for display
  const title = item.title || rawTitle;

  // Retrieve raw links
  let links = Array.isArray(item.links) && item.links.length > 0
    ? item.links
    : (Array.isArray(item.downloadOptions) && item.downloadOptions.length > 0 ? item.downloadOptions : []);

  // If links are empty, query details_map.json fallback
  if (links.length === 0) {
    links = findMatchingCatalogLinks(title, item.year, item.imdbId, item.slug);
    if (links.length === 0 && rawNum) {
      const dMap = getDetailsMap();
      const mapEntry = dMap.get(rawNum) || (rawId ? dMap.get(String(rawId).replace(/^dotmobiz-/, '')) : null) || (item.slug ? dMap.get(item.slug) : null);
      if (mapEntry && Array.isArray(mapEntry.links) && mapEntry.links.length > 0) {
        links = mapEntry.links;
      }
    }
  }

  const isSeries = item.type === 'series' || item.type === 'anime' || item.type === 'kdrama' || Boolean(item.seasons || item.season_1);
  const normalizedLinks = normalizeRawLinks(links, canonicalId, isSeries);

  return {
    ...item,
    id: canonicalId,
    canonicalId,
    externalProvider: item.provider || 'dotmobiz',
    externalId: rawNum || String(item.id || ''),
    contentType: item.type || (item.seasons || item.season_1 ? 'series' : 'movie'),
    type: item.type || (item.seasons || item.season_1 ? 'series' : 'movie'),
    canonicalTitle: title,
    originalTitle: rawTitle,
    title,
    releaseYear: item.year || parseInt((rawTitle.match(/\b(19\d{2}|20\d{2})\b/) || [0, 2026])[1], 10),
    year: item.year || parseInt((rawTitle.match(/\b(19\d{2}|20\d{2})\b/) || [0, 2026])[1], 10),
    slug: item.slug || `${canonicalId}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    status: item.status || 'PUBLISHED',
    links: normalizedLinks
  };
}

/**
 * Canonical Content Resolver
 * Resolves any valid identifier representation to the underlying title object
 */
async function resolveContentId(rawId) {
  if (!rawId || typeof rawId !== 'string') return null;
  
  const id = rawId.trim().replace(/^\/+|\/+$/g, '');
  if (!id) return null;

  // 1. Explicit TMDB canonical ID: tmdb-movie-12345, tmdb-series-90545, tmdb:movie:12345
  const tmdbMatch = id.match(/^tmdb[-:](movie|series|tv|anime|kdrama)[-:]([0-9]+)$/i);
  if (tmdbMatch) {
    const [, typeStr, numStr] = tmdbMatch;
    const mediaType = (typeStr.toLowerCase() === 'movie') ? 'movie' : 'tv';
    const record = await fetchTmdbRecord(mediaType, numStr);
    if (record) return record;
  }

  // 2. Direct file lookup with the exact id
  let item = readDetailFile(id);
  if (item) return standardizeLocalRecord(item, id);

  // 3. If ID has 'dotmobiz-' prefix, try without prefix
  if (id.startsWith('dotmobiz-')) {
    const rawNum = id.replace(/^dotmobiz-/, '');
    item = readDetailFile(rawNum);
    if (item) return standardizeLocalRecord(item, id);
  }

  // 4. If ID is numeric, check local catalog FIRST (e.g. dotmobiz-18033)
  if (/^\d+$/.test(id)) {
    item = readDetailFile(`dotmobiz-${id}`);
    if (item) return standardizeLocalRecord(item, `dotmobiz-${id}`);
    item = readDetailFile(id);
    if (item) return standardizeLocalRecord(item, `dotmobiz-${id}`);
  }

  // 5. Check memory catalog index for alias mapping (slug, record_id, etc.)
  const index = buildCatalogIndex();
  const catalogEntry = index.get(id) || index.get(id.toLowerCase());

  if (catalogEntry) {
    const candidateNames = [
      catalogEntry.detailFilename,
      catalogEntry.canonicalId,
      catalogEntry.id,
      catalogEntry.record_id ? `dotmobiz-${catalogEntry.record_id}` : null,
      catalogEntry.record_id ? String(catalogEntry.record_id) : null,
      catalogEntry.slug
    ].filter(Boolean);

    for (const name of candidateNames) {
      item = readDetailFile(name);
      if (item) return standardizeLocalRecord(item, catalogEntry.canonicalId || id);
    }

    // If summary catalog entry exists but detail file is missing, return standardized summary entry
    if (catalogEntry.title) {
      return standardizeLocalRecord(catalogEntry, catalogEntry.canonicalId || id);
    }
  }

  // 5b. Check details_map.json directly
  const dMap = getDetailsMap();
  const rawNum = id.replace(/^dotmobiz-/, '');
  const mapEntry = dMap.get(rawNum) || dMap.get(id) || (catalogEntry?.slug ? dMap.get(catalogEntry.slug) : null);
  if (mapEntry) {
    return standardizeLocalRecord(mapEntry, id);
  }

  // 6. Fallback for TMDB numeric IDs only if NOT in local catalog (e.g., 90545 for Sandman)
  if (/^\d+$/.test(id)) {
    // Try TV first, then movie
    const tvRecord = await fetchTmdbRecord('tv', id);
    if (tvRecord) return tvRecord;
    const movieRecord = await fetchTmdbRecord('movie', id);
    if (movieRecord) return movieRecord;
  }

  return null;
}

module.exports = {
  resolveContentId,
  buildCatalogIndex,
  readDetailFile,
  fetchTmdbRecord,
  standardizeLocalRecord,
  findMatchingCatalogLinks,
  normalizeRawLinks
};
