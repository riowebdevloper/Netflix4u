const fs = require('fs');
const path = require('path');
const { cleanDotmobizTitle } = require('../services/dotmobizAdapter');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const HARVESTED_PATH = path.join(ROOT, 'scratch', 'dotmobiz_harvested.json');
const HOME_FEED_PATH = path.join(DATA_DIR, 'home_feed.json');
const DETAILS_DIR = path.join(DATA_DIR, 'details');
const MOVIES_PATH = path.join(DATA_DIR, 'movies.json');
const SERIES_PATH = path.join(DATA_DIR, 'series.json');
const ANIME_PATH = path.join(DATA_DIR, 'anime.json');

// 1. Load authentic covers from scratch/dotmobiz_harvested.json
const harvested = JSON.parse(fs.readFileSync(HARVESTED_PATH, 'utf8'));
const authenticDotmobizList = [];

for (const item of harvested) {
  let cover = item.image;
  if (cover && !cover.startsWith('/') && !cover.startsWith('http')) {
    cover = '/' + cover;
  }
  const pureTitle = cleanDotmobizTitle(item.title);
  const pureKey = pureTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
  const rawKey = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');

  authenticDotmobizList.push({
    postId: String(item.postId),
    pureTitle,
    pureKey,
    rawKey,
    cover,
    item
  });

  item.poster = cover;
  item.image = cover;
  if (!item.backdrop || item.backdrop.includes('oVij5a') || item.backdrop.includes('jAt8u6')) {
    item.backdrop = cover;
  }
}

fs.writeFileSync(HARVESTED_PATH, JSON.stringify(harvested, null, 2));

// 2. Load Hicine images
const hicineImageMap = new Map();
function loadHicine(filePath) {
  if (fs.existsSync(filePath)) {
    const list = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const it of list) {
      if (it.featured_image) {
        hicineImageMap.set(String(it.id), it.featured_image);
        const t = it.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        hicineImageMap.set(t, it.featured_image);
      }
    }
  }
}
loadHicine(MOVIES_PATH);
loadHicine(SERIES_PATH);
loadHicine(ANIME_PATH);

// Helper to find Dotmobiz cover - STRICT MATCHING ONLY
function findDotmobizCover(title, id) {
  const clean = (title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const idStr = String(id || '');

  for (const entry of authenticDotmobizList) {
    if (entry.postId === idStr || `dotmobiz-${entry.postId}` === idStr) {
      return entry.cover;
    }
    // Strict equality check
    if (clean && (clean === entry.pureKey || clean === entry.rawKey)) {
      return entry.cover;
    }
    // If long title, only match if clean title starts with entry pureKey or vice versa (minimum 5 chars)
    if (entry.pureKey.length >= 5 && clean.length >= 5) {
      if (clean.startsWith(entry.pureKey) || entry.pureKey.startsWith(clean)) {
        return entry.cover;
      }
    }
  }
  return null;
}

// 3. Fix home_feed.json
const homeFeed = JSON.parse(fs.readFileSync(HOME_FEED_PATH, 'utf8'));
let fixedHomeCount = 0;

for (const [sectionKey, items] of Object.entries(homeFeed)) {
  if (Array.isArray(items)) {
    for (const item of items) {
      const dotCover = findDotmobizCover(item.title, item.id) || findDotmobizCover(item.originalTitle, item.id);
      if (dotCover) {
        if (item.poster !== dotCover) {
          console.log(`[HomeFeed:${sectionKey}] Updating ${item.title} -> ${dotCover} (was ${item.poster})`);
          item.poster = dotCover;
          item.backdrop = dotCover;
          fixedHomeCount++;
        }
      } else {
        const idStr = String(item.id || '');
        const cleanT = (item.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const hicCover = hicineImageMap.get(idStr) || hicineImageMap.get(cleanT);
        if (hicCover && item.poster !== hicCover) {
          console.log(`[HomeFeed:${sectionKey}] Restoring Hicine CDN image for ${item.title} -> ${hicCover}`);
          item.poster = hicCover;
          fixedHomeCount++;
        }
      }
    }
  }
}

fs.writeFileSync(HOME_FEED_PATH, JSON.stringify(homeFeed, null, 2));
console.log(`✅ Fixed ${fixedHomeCount} poster entries in home_feed.json!`);

// 4. Update details files
let fixedDetails = 0;
for (const entry of authenticDotmobizList) {
  const filePaths = [
    path.join(DETAILS_DIR, `${entry.postId}.json`),
    path.join(DETAILS_DIR, `dotmobiz-${entry.postId}.json`)
  ];
  for (const fp of filePaths) {
    if (fs.existsSync(fp)) {
      try {
        const d = JSON.parse(fs.readFileSync(fp, 'utf8'));
        d.poster = entry.cover;
        d.image = entry.cover;
        d.backdrop = entry.cover;
        fs.writeFileSync(fp, JSON.stringify(d, null, 2));
        fixedDetails++;
      } catch(e) {}
    }
  }
}
console.log(`✅ Updated ${fixedDetails} detail files with authentic covers.`);
