const fs = require('fs');
const path = require('path');
const { cleanMovieTitle } = require('../services/dotmobizAdapter');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const COMPLETE_PATH = path.join(DATA_DIR, 'dotmobiz_complete_catalog.json');
const SUMMARY_PATH = path.join(DATA_DIR, 'catalog_summary.json');
const HARVESTED_PATH = path.resolve(__dirname, '..', 'scratch', 'dotmobiz_harvested.json');
const HOME_PATH = path.join(DATA_DIR, 'home_feed.json');

// Build an artwork lookup map from harvested and home_feed
const artworkMap = new Map();

if (fs.existsSync(HARVESTED_PATH)) {
  const h = JSON.parse(fs.readFileSync(HARVESTED_PATH, 'utf8'));
  for (const item of h) {
    const clean = cleanMovieTitle(item.title);
    artworkMap.set(clean.toLowerCase(), {
      poster: item.poster || item.image,
      backdrop: item.backdrop || item.poster || item.image
    });
    if (item.postId) {
      artworkMap.set(`dotmobiz-${item.postId}`, {
        poster: item.poster || item.image,
        backdrop: item.backdrop || item.poster || item.image
      });
    }
  }
}

if (fs.existsSync(HOME_PATH)) {
  const home = JSON.parse(fs.readFileSync(HOME_PATH, 'utf8'));
  for (const key of Object.keys(home)) {
    if (Array.isArray(home[key])) {
      for (const item of home[key]) {
        if (item.poster && !item.poster.includes('placehold.co')) {
          const clean = cleanMovieTitle(item.title);
          artworkMap.set(clean.toLowerCase(), {
            poster: item.poster,
            backdrop: item.backdrop || item.poster
          });
          if (item.id) {
            artworkMap.set(item.id, {
              poster: item.poster,
              backdrop: item.backdrop || item.poster
            });
          }
        }
      }
    }
  }
}

console.log(`Loaded ${artworkMap.size} pre-cached high-resolution artwork mappings.`);

// 1. Process dotmobiz_complete_catalog.json
if (fs.existsSync(COMPLETE_PATH)) {
  const completeList = JSON.parse(fs.readFileSync(COMPLETE_PATH, 'utf8'));
  let changed = 0;
  for (const item of completeList) {
    const clean = cleanMovieTitle(item.title);
    if (clean !== item.title) {
      item.title = clean;
      changed++;
    }
    const art = artworkMap.get(item.id) || artworkMap.get(clean.toLowerCase());
    if (art && art.poster) {
      item.poster = art.poster;
      item.backdrop = art.backdrop || art.poster;
    }
  }
  fs.writeFileSync(COMPLETE_PATH, JSON.stringify(completeList));
  console.log(`✅ dotmobiz_complete_catalog.json: Cleaned ${changed} titles out of ${completeList.length} total.`);
}

// 2. Process catalog_summary.json
if (fs.existsSync(SUMMARY_PATH)) {
  const summaryList = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'));
  let changed = 0;
  for (const item of summaryList) {
    const clean = cleanMovieTitle(item.title);
    if (clean !== item.title) {
      item.title = clean;
      changed++;
    }
    const art = artworkMap.get(item.id) || artworkMap.get(clean.toLowerCase());
    if (art && art.poster) {
      item.poster = art.poster;
      item.backdrop = art.backdrop || art.poster;
    }
  }
  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summaryList));
  console.log(`✅ catalog_summary.json: Cleaned ${changed} titles out of ${summaryList.length} total.`);
}

console.log('🎉 Catalog titles and artwork synchronization complete!');
