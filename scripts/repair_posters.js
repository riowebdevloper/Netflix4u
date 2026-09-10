#!/usr/bin/env node
/**
 * scripts/repair_posters.js
 * Automated Poster Self-Repair & Hygiene Pipeline
 *
 * 1. Scans data/catalog_summary.json for items with placeholders (placehold.co, no-poster).
 * 2. Queries TMDB search to heal posters and backdrops with official artwork.
 * 3. Updates catalog_summary.json and corresponding detail files.
 * 4. Sets unresolvable items to POSTER_PENDING (hidden from public feeds).
 * 5. Rebuilds home_feed.json, category files, and sitemap.xml with 100% verified posters.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const dns = require('dns');

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const ROOT = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(ROOT, 'data', 'catalog_summary.json');
const DETAILS_DIR = path.join(ROOT, 'data', 'details');
const TMDB_API_KEY = process.env.TMDB_API_KEY || '445f2b5a8941c1d4bd5a869761a916e3';

const {
  verifyPosterUrl,
  rebuildHomeFeed,
  rebuildCategories,
  rebuildSitemap
} = require('../services/ingestionService');

function cleanTitle(title) {
  if (!title) return '';
  return title
    .replace(/\[.*?\]|\(.*?\)/g, '')
    .replace(/\b(480p|720p|1080p|2160p|4k|uhd|fhd|hd|web-dl|bluray|x264|x265|hevc|hindi|english|dual audio|season \d+|s\d+|ep\d+)\b/gi, '')
    .replace(/[-_.]+/g, ' ')
    .trim();
}

function searchTmdb(title, year, type) {
  return new Promise((resolve) => {
    const q = encodeURIComponent(title);
    const endpoint = type === 'series' ? 'tv' : 'movie';
    const yearParam = year ? (endpoint === 'tv' ? `&first_air_date_year=${year}` : `&year=${year}`) : '';
    const url = `https://api.tmdb.org/3/search/${endpoint}?api_key=${TMDB_API_KEY}&query=${q}${yearParam}`;

    const req = https.get(url, { family: 4, timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            if (json.results && json.results.length > 0) {
              const match = json.results.find(r => r.poster_path) || json.results[0];
              if (match && match.poster_path) {
                return resolve({
                  poster: `https://image.tmdb.org/t/p/w500${match.poster_path}`,
                  backdrop: match.backdrop_path ? `https://image.tmdb.org/t/p/original${match.backdrop_path}` : null,
                  tmdbId: String(match.id),
                  rating: match.vote_average ? parseFloat(match.vote_average.toFixed(1)) : undefined,
                  overview: match.overview
                });
              }
            }
          } catch(e) {}
        }
        resolve(null);
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function repairCatalog(maxApiQueries = 300) {
  console.log('========================================================');
  console.log('NETFLIX4U AUTOMATED POSTER REPAIR & HYGIENE PIPELINE');
  console.log('========================================================');

  if (!fs.existsSync(CATALOG_PATH)) {
    console.error('Catalog file not found:', CATALOG_PATH);
    process.exit(1);
  }

  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  console.log(`Loaded catalog: ${catalog.length} items.`);

  let placeholderCount = 0;
  let healedCount = 0;
  let pendingCount = 0;
  let publishedCount = 0;
  let apiQueries = 0;

  // Track items needing repair
  const needsRepairIndices = [];
  for (let i = 0; i < catalog.length; i++) {
    const item = catalog[i];
    const isInvalid = !verifyPosterUrl(item.poster);
    if (isInvalid) {
      placeholderCount++;
      needsRepairIndices.push(i);
    } else {
      item.status = 'PUBLISHED';
      publishedCount++;
    }
  }

  console.log(`Found ${placeholderCount} items with placeholders/unverified artwork.`);
  console.log(`Attempting TMDB self-repair for up to ${maxApiQueries} items...`);

  // Process in small batches
  const BATCH_SIZE = 5;
  for (let b = 0; b < needsRepairIndices.length && apiQueries < maxApiQueries; b += BATCH_SIZE) {
    const batchIndices = needsRepairIndices.slice(b, b + BATCH_SIZE);
    await Promise.all(batchIndices.map(async (idx) => {
      if (apiQueries >= maxApiQueries) return;
      apiQueries++;
      const item = catalog[idx];
      const title = cleanTitle(item.title || item.rawTitle);
      if (!title) return;

      const tmdbRes = await searchTmdb(title, item.year, item.type);
      if (tmdbRes && tmdbRes.poster) {
        item.poster = tmdbRes.poster;
        if (tmdbRes.backdrop) item.backdrop = tmdbRes.backdrop;
        if (tmdbRes.tmdbId && !item.tmdbId) item.tmdbId = tmdbRes.tmdbId;
        if (tmdbRes.rating && !item.rating) item.rating = tmdbRes.rating;
        item.status = 'PUBLISHED';
        healedCount++;

        // Update detail file if exists
        try {
          const detailPath = path.join(DETAILS_DIR, `${item.id}.json`);
          if (fs.existsSync(detailPath)) {
            const detail = JSON.parse(fs.readFileSync(detailPath, 'utf8'));
            detail.poster = item.poster;
            if (item.backdrop) detail.backdrop = item.backdrop;
            if (item.tmdbId) detail.tmdbId = item.tmdbId;
            detail.status = 'PUBLISHED';
            fs.writeFileSync(detailPath, JSON.stringify(detail, null, 2), 'utf8');
          }
        } catch(e) {}
      }
    }));
  }

  // Final hygiene pass: Any item still having an unverified poster MUST be marked POSTER_PENDING
  for (let i = 0; i < catalog.length; i++) {
    const item = catalog[i];
    if (!verifyPosterUrl(item.poster)) {
      item.status = 'POSTER_PENDING';
      pendingCount++;
    } else {
      item.status = 'PUBLISHED';
    }
  }

  // Save updated catalog
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`Saved catalog_summary.json.`);

  console.log('--------------------------------------------------------');
  console.log(`Healed with Official TMDB Artwork: ${healedCount}`);
  console.log(`Verified PUBLISHED Titles:         ${catalog.filter(c => c.status === 'PUBLISHED').length}`);
  console.log(`Quarantined POSTER_PENDING Titles: ${pendingCount}`);
  console.log('--------------------------------------------------------');

  console.log('Rebuilding home_feed.json, categories, and sitemap...');
  rebuildHomeFeed(catalog);
  rebuildCategories(catalog);
  rebuildSitemap(catalog);

  console.log('✅ Poster self-repair and catalog re-indexing complete.');
}

if (require.main === module) {
  const max = parseInt(process.argv.find(a => a.startsWith('--max='))?.split('=')[1] || '100', 10);
  repairCatalog(max).catch(err => {
    console.error('Fatal error in repairCatalog:', err);
    process.exit(1);
  });
}

module.exports = { repairCatalog, cleanTitle, searchTmdb };
