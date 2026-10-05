/**
 * Netflix4U External Sources Synchronization Utility
 * Enriches catalog titles with HiCine & Vegamovies streams and download mirrors
 */
const fs = require('fs');
const path = require('path');
const { resolveHicineForTitle } = require('../services/hicineService');
const { resolveVegamoviesForTitle } = require('../services/vegamoviesService');
const { normalizeRawLinks } = require('../services/canonicalResolver');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DETAILS_DIR = path.join(DATA_DIR, 'details');

async function syncTitle(detailFilename) {
  const filePath = path.join(DETAILS_DIR, detailFilename);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return null;
  }

  let item;
  try {
    item = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`Failed to parse ${detailFilename}:`, e.message);
    return null;
  }

  const title = item.title || item.canonicalTitle || '';
  const year = item.year || (item.releaseDate ? parseInt(item.releaseDate.substring(0, 4), 10) : null);
  const imdbId = item.imdbId || null;
  const canonicalId = item.canonicalId || item.id;
  const isTv = item.type === 'series' || item.type === 'tv';

  console.log(`\n--- Syncing: "${title}" (${year || 'N/A'}) [${canonicalId}] ---`);

  const existingLinks = item.links || [];
  const newLinks = [...existingLinks];

  // 1. HiCine Resolution
  try {
    console.log(`[HiCine] Querying for "${title}"...`);
    const hicineRes = await resolveHicineForTitle(title, year);
    if (hicineRes && hicineRes.links && hicineRes.links.length > 0) {
      console.log(`[HiCine] Found ${hicineRes.links.length} links for "${hicineRes.title}"`);
      const normalizedHicine = normalizeRawLinks(hicineRes.links, canonicalId, isTv);
      for (const link of normalizedHicine) {
        if (!newLinks.some(l => l.url === link.url)) {
          newLinks.unshift(link); // prioritize cloud fast links at top
        }
      }
    } else {
      console.log(`[HiCine] No matches found.`);
    }
  } catch (e) {
    console.warn(`[HiCine] Sync warning:`, e.message);
  }

  // 2. Vegamovies Resolution
  try {
    console.log(`[Vegamovies] Querying for "${title}"...`);
    const vegaRes = await resolveVegamoviesForTitle(title, year, imdbId);
    if (vegaRes) {
      if (vegaRes.imdbId && !item.imdbId) {
        item.imdbId = vegaRes.imdbId;
        console.log(`[Vegamovies] Enriched IMDb ID: ${vegaRes.imdbId}`);
      }
      if (vegaRes.downloads && vegaRes.downloads.length > 0) {
        console.log(`[Vegamovies] Found ${vegaRes.downloads.length} download tiers`);
        const normalizedVega = normalizeRawLinks(vegaRes.downloads, canonicalId, isTv);
        for (const link of normalizedVega) {
          if (!newLinks.some(l => l.url === link.url)) {
            newLinks.push(link);
          }
        }
      }
    } else {
      console.log(`[Vegamovies] No matches found.`);
    }
  } catch (e) {
    console.warn(`[Vegamovies] Sync warning:`, e.message);
  }

  item.links = newLinks;
  item.updatedAt = new Date().toISOString();

  fs.writeFileSync(filePath, JSON.stringify(item, null, 2), 'utf8');
  console.log(`[Success] Saved "${title}" with ${newLinks.length} total streaming/download links.`);
  return item;
}

// Run for specified title or Vishwanath & Sons by default
const target = process.argv[2] || 'tmdb-movie-1408162.json';
syncTitle(target)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Sync failed:', err);
    process.exit(1);
  });
