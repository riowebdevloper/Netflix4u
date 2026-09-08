const fs = require('fs');
const path = require('path');
const https = require('https');
const { cleanMovieTitle } = require('../services/dotmobizAdapter');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const COMPLETE_PATH = path.join(DATA_DIR, 'dotmobiz_complete_catalog.json');
const SUMMARY_PATH = path.join(DATA_DIR, 'catalog_summary.json');
const TMDB_API_KEY = '445f2b5a8941c1d4bd5a869761a916e3';

function searchTmdb(query, type) {
  return new Promise((resolve) => {
    const endpoint = type === 'series' ? 'tv' : (type === 'movie' ? 'movie' : 'multi');
    const url = `https://api.tmdb.org/3/search/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(d);
          resolve((json.results && json.results[0]) || null);
        } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function run() {
  const completeList = JSON.parse(fs.readFileSync(COMPLETE_PATH, 'utf8'));
  const summaryList = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'));

  const placeholderItems = completeList.filter(x => x.poster && x.poster.includes('placehold.co')).slice(0, 150);
  console.log(`Enriching top ${placeholderItems.length} Dotmobiz catalog items with official TMDB high-res posters and 16:9 backdrops...`);

  const artMap = new Map();

  for (let i = 0; i < placeholderItems.length; i++) {
    const item = placeholderItems[i];
    const clean = cleanMovieTitle(item.title);
    item.title = clean;

    let res = await searchTmdb(clean, item.type);
    if (!res) {
      res = await searchTmdb(clean, 'multi');
    }

    if (res) {
      if (res.poster_path) {
        item.poster = `https://image.tmdb.org/t/p/w500${res.poster_path}`;
      }
      if (res.backdrop_path) {
        item.backdrop = `https://image.tmdb.org/t/p/original${res.backdrop_path}`;
      } else if (item.poster) {
        item.backdrop = item.poster;
      }
      if (res.vote_average) item.rating = parseFloat(res.vote_average.toFixed(1));

      artMap.set(item.id, {
        title: item.title,
        poster: item.poster,
        backdrop: item.backdrop,
        rating: item.rating
      });
      console.log(`[${i+1}/${placeholderItems.length}] ✅ "${clean}" -> TMDB HD: ${item.poster}`);
    } else {
      console.log(`[${i+1}/${placeholderItems.length}] ℹ️ "${clean}" -> No TMDB match`);
    }

    await new Promise(r => setTimeout(r, 60));
  }

  // Update complete catalog
  fs.writeFileSync(COMPLETE_PATH, JSON.stringify(completeList));

  // Sync to summary
  for (const item of summaryList) {
    if (artMap.has(item.id)) {
      const art = artMap.get(item.id);
      item.title = art.title;
      item.poster = art.poster;
      item.backdrop = art.backdrop;
      if (art.rating) item.rating = art.rating;
    }
  }
  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(summaryList));
  console.log(`🎉 Successfully enriched top ${placeholderItems.length} catalog items with Netflix-quality artwork!`);
}

run();
