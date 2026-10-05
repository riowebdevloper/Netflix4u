/**
 * Netflix4U Universal External Sources Sync Engine
 * Syncs HiCine & Vegamovies streams and download mirrors across the entire catalog
 */
const fs = require('fs');
const path = require('path');
const { resolveHicineForTitle } = require('../services/hicineService');
const { resolveVegamoviesForTitle } = require('../services/vegamoviesService');
const { normalizeRawLinks } = require('../services/canonicalResolver');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DETAILS_DIR = path.join(DATA_DIR, 'details');
const HOME_FEED_PATH = path.join(DATA_DIR, 'home_feed.json');
const CATALOG_SUMMARY_PATH = path.join(DATA_DIR, 'catalog_summary.json');

async function syncItem(item) {
  if (!item || !item.title) return null;
  const title = item.title || item.canonicalTitle;
  const year = item.year || (item.releaseDate ? parseInt(item.releaseDate.substring(0, 4), 10) : null);
  const imdbId = item.imdbId || null;
  const canonicalId = item.canonicalId || item.id || `tmdb-movie-${item.tmdbId}`;
  const isTv = item.type === 'series' || item.type === 'tv' || item.contentType === 'series';

  const existingLinks = item.links || [];
  const newLinks = [...existingLinks];

  // 1. HiCine
  try {
    const hicineRes = await resolveHicineForTitle(title, year);
    if (hicineRes && hicineRes.links && hicineRes.links.length > 0) {
      const normalizedHicine = normalizeRawLinks(hicineRes.links, canonicalId, isTv);
      for (const link of normalizedHicine) {
        if (!newLinks.some(l => l.url === link.url)) {
          newLinks.unshift(link);
        }
      }
    }
  } catch (e) {}

  // 2. Vegamovies
  try {
    const vegaRes = await resolveVegamoviesForTitle(title, year, imdbId);
    if (vegaRes) {
      if (vegaRes.imdbId && !item.imdbId) {
        item.imdbId = vegaRes.imdbId;
      }
      if (vegaRes.downloads && vegaRes.downloads.length > 0) {
        const normalizedVega = normalizeRawLinks(vegaRes.downloads, canonicalId, isTv);
        for (const link of normalizedVega) {
          if (!newLinks.some(l => l.url === link.url)) {
            newLinks.push(link);
          }
        }
      }
    }
  } catch (e) {}

  item.links = newLinks;
  item.updatedAt = new Date().toISOString();

  // If detail file exists or can be saved
  const detailFile = path.join(DETAILS_DIR, `${canonicalId}.json`);
  try {
    fs.writeFileSync(detailFile, JSON.stringify(item, null, 2), 'utf8');
  } catch (e) {}

  return { title, linksCount: newLinks.length };
}

async function syncBatch(limit = 25) {
  console.log(`\n[SyncAllCatalog] Starting catalog sync for top ${limit} titles...`);
  const itemsToSync = [];

  // Load from home feed first
  if (fs.existsSync(HOME_FEED_PATH)) {
    try {
      const feed = JSON.parse(fs.readFileSync(HOME_FEED_PATH, 'utf8'));
      for (const rail of (feed.rails || [])) {
        for (const it of (rail.items || [])) {
          if (!itemsToSync.some(x => x.title === it.title)) {
            itemsToSync.push(it);
          }
        }
      }
    } catch (e) {}
  }

  // Also load from catalog summary
  if (fs.existsSync(CATALOG_SUMMARY_PATH) && itemsToSync.length < limit) {
    try {
      const summary = JSON.parse(fs.readFileSync(CATALOG_SUMMARY_PATH, 'utf8'));
      for (const it of summary) {
        if (!itemsToSync.some(x => x.title === it.title)) {
          itemsToSync.push(it);
        }
        if (itemsToSync.length >= limit * 2) break;
      }
    } catch (e) {}
  }

  const selected = itemsToSync.slice(0, limit);
  console.log(`[SyncAllCatalog] Selected ${selected.length} unique titles to sync.`);

  let syncedCount = 0;
  for (let i = 0; i < selected.length; i++) {
    const it = selected[i];
    process.stdout.write(`[${i + 1}/${selected.length}] Syncing "${it.title}"... `);
    const res = await syncItem(it);
    if (res) {
      console.log(`Done (${res.linksCount} links total)`);
      syncedCount++;
    } else {
      console.log(`Skipped`);
    }
  }

  console.log(`\n[SyncAllCatalog] Finished syncing ${syncedCount} titles with HiCine & Vegamovies.`);
}

const countArg = parseInt(process.argv[2] || '15', 10);
syncBatch(countArg)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal sync error:', err);
    process.exit(1);
  });
