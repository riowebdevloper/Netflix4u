const fs = require('fs');
const path = require('path');
const { cleanDotmobizTitle } = require('../services/dotmobizAdapter');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const COMPLETE_PATH = path.join(DATA_DIR, 'dotmobiz_complete_catalog.json');
const SUMMARY_PATH = path.join(DATA_DIR, 'catalog_summary.json');
const HARVESTED_PATH = path.resolve(__dirname, '..', 'scratch', 'dotmobiz_harvested.json');

// 1. Load harvested items map
const harvested = JSON.parse(fs.readFileSync(HARVESTED_PATH, 'utf8'));
const harvestedMap = new Map();
for (const h of harvested) {
  let cover = h.image;
  if (cover && !cover.startsWith('/') && !cover.startsWith('http')) cover = '/' + cover;
  harvestedMap.set(String(h.postId), { ...h, cover });
}

// 2. Load complete dotmobiz catalog (15,427 items)
const dotmobizList = JSON.parse(fs.readFileSync(COMPLETE_PATH, 'utf8'));
console.log(`📡 Loaded ${dotmobizList.length} items from dotmobiz_complete_catalog.json`);

// 3. Process and enrich all dotmobiz items
let kdramaCount = 0, animeCount = 0, seriesCount = 0, movieCount = 0;

for (const item of dotmobizList) {
  const recId = String(item.record_id || item.id || '').replace('dotmobiz-', '');
  const rawText = `${item.title || ''} ${item.rawTitle || ''} ${item.slug || ''}`.toLowerCase();

  // Categorize
  if (/k[- ]?drama|korean/i.test(rawText)) {
    item.type = 'kdrama';
    item.categories = ['K-Drama', 'Drama', 'Asian'];
    kdramaCount++;
  } else if (/anime|animation/i.test(rawText)) {
    item.type = 'anime';
    item.categories = ['Anime', 'Animation'];
    animeCount++;
  } else if ((/season|episode|web[- ]?series|\[ep/i.test(rawText) || item.type === 'series') && !/the[- ]movie/i.test(rawText)) {
    item.type = 'series';
    item.categories = ['Web Series', 'Drama', 'TV Shows'];
    seriesCount++;
  } else {
    item.type = 'movie';
    item.categories = ['Bollywood', 'Hollywood', 'Movies'];
    movieCount++;
  }

  // Pure title
  item.title = cleanDotmobizTitle(item.rawTitle || item.title);

  // If in harvested, attach authentic cover and metadata
  if (harvestedMap.has(recId)) {
    const h = harvestedMap.get(recId);
    item.poster = h.cover;
    item.backdrop = h.cover;
    item.imdbId = h.imdbId || '';
    item.rating = h.rating && h.rating > 0 ? h.rating : 8.5;
  }
}

console.log(`Tagged: ${movieCount} movies, ${seriesCount} series, ${kdramaCount} k-drama, ${animeCount} anime.`);

// Save back updated dotmobiz_complete_catalog.json
fs.writeFileSync(COMPLETE_PATH, JSON.stringify(dotmobizList));
console.log(`✅ Saved updated dotmobiz_complete_catalog.json`);

// 4. Merge into catalog_summary.json without dropping any items!
let existing = [];
if (fs.existsSync(SUMMARY_PATH)) {
  existing = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'));
}

// Keep all Hicine items
const nonDotmobiz = existing.filter(x => !String(x.id).startsWith('dotmobiz-'));
console.log(`Preserving ${nonDotmobiz.length} authentic Hicine items.`);

// Split dotmobiz: 25 top releases first, followed by all remaining dotmobiz
const top25 = dotmobizList.filter(c => harvestedMap.has(String(c.record_id)));
const remainingDotmobiz = dotmobizList.filter(c => !harvestedMap.has(String(c.record_id)));

const combinedSummary = [
  ...top25,
  ...remainingDotmobiz, // ALL 15,400+ remaining items!
  ...nonDotmobiz
];

fs.writeFileSync(SUMMARY_PATH, JSON.stringify(combinedSummary));
console.log(`🎉 Combined catalog_summary.json successfully written! Total titles: ${combinedSummary.length}`);
