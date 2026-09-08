const fs = require('fs');
const path = require('path');
const { cleanDotmobizTitle } = require('../services/dotmobizAdapter');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const HOME_FEED_PATH = path.join(DATA_DIR, 'home_feed.json');
const HARVESTED_PATH = path.join(ROOT, 'scratch', 'dotmobiz_harvested.json');

// 1. Load Dotmobiz covers
const harvested = JSON.parse(fs.readFileSync(HARVESTED_PATH, 'utf8'));
const dotmobizMap = new Map();

for (const h of harvested) {
  let cover = h.image;
  if (cover && !cover.startsWith('/') && !cover.startsWith('http')) cover = '/' + cover;
  const pureTitle = cleanDotmobizTitle(h.title).toLowerCase().replace(/[^a-z0-9]/g, '');
  dotmobizMap.set(String(h.postId), cover);
  dotmobizMap.set(`dotmobiz-${h.postId}`, cover);
  dotmobizMap.set(pureTitle, cover);
  dotmobizMap.set(h.title.toLowerCase().replace(/[^a-z0-9]/g, ''), cover);
}

// 2. Load Hicine images
const hicineMap = new Map();
function loadHicine(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) return;
  const list = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  for (const item of list) {
    if (!item.featured_image) continue;
    if (item.record_id) hicineMap.set(String(item.record_id), item.featured_image);
    if (item.url_slug) hicineMap.set(item.url_slug, item.featured_image);
    const cleanTitle = (item.title || '').replace(/\(\d{4}\)/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanTitle) {
      hicineMap.set(cleanTitle, item.featured_image);
    }
  }
}
loadHicine('movies.json');
loadHicine('series.json');
loadHicine('anime.json');

// 3. Process home_feed.json
const homeFeed = JSON.parse(fs.readFileSync(HOME_FEED_PATH, 'utf8'));
let updatedCount = 0;

for (const [secKey, items] of Object.entries(homeFeed)) {
  if (!Array.isArray(items)) continue;
  for (const item of items) {
    const idStr = String(item.id || '');
    const cleanT = (item.title || '').replace(/\(\d{4}\)/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanOrig = (item.originalTitle || '').replace(/\(\d{4}\)/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

    let correctPoster = null;

    // Check Dotmobiz first
    if (dotmobizMap.has(idStr)) correctPoster = dotmobizMap.get(idStr);
    else if (dotmobizMap.has(cleanT)) correctPoster = dotmobizMap.get(cleanT);
    else if (dotmobizMap.has(cleanOrig)) correctPoster = dotmobizMap.get(cleanOrig);

    // If not found in Dotmobiz, check Hicine
    if (!correctPoster) {
      if (hicineMap.has(idStr)) correctPoster = hicineMap.get(idStr);
      else if (hicineMap.has(cleanT)) correctPoster = hicineMap.get(cleanT);
      else if (hicineMap.has(cleanOrig)) correctPoster = hicineMap.get(cleanOrig);
    }

    if (correctPoster && item.poster !== correctPoster) {
      console.log(`[${secKey}] "${item.title}" -> ${correctPoster} (was ${item.poster})`);
      item.poster = correctPoster;
      item.backdrop = correctPoster;
      updatedCount++;
    }
  }
}

fs.writeFileSync(HOME_FEED_PATH, JSON.stringify(homeFeed, null, 2));
console.log(`\n🎉 Successfully reconciled home feed posters! Updated ${updatedCount} items.`);
