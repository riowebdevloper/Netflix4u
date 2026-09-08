const fs = require('fs');
const path = require('path');
const https = require('https');
const { cleanMovieTitle } = require('../services/dotmobizAdapter');

const HOME_FEED_PATH = path.resolve(__dirname, '..', 'data', 'home_feed.json');
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
          if (json.results && json.results[0]) {
            resolve(json.results[0]);
          } else {
            resolve(null);
          }
        } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function run() {
  const homeData = JSON.parse(fs.readFileSync(HOME_FEED_PATH, 'utf8'));
  console.log('⚡ Enriching home_feed.json with Clean Titles and Netflix-Grade TMDB Artwork...');

  const cache = new Map();

  for (const section of Object.keys(homeData)) {
    if (!Array.isArray(homeData[section])) continue;
    console.log(`\nProcessing section: [${section}] (${homeData[section].length} items)...`);

    for (const item of homeData[section]) {
      const originalTitle = item.title;
      const clean = cleanMovieTitle(originalTitle);
      item.title = clean;

      // Check if we already fetched TMDB artwork for this clean title
      let tmdb = cache.get(clean);
      if (tmdb === undefined) {
        tmdb = await searchTmdb(clean, item.type);
        if (!tmdb && item.type) {
          // Fallback search multi
          tmdb = await searchTmdb(clean, 'multi');
        }
        cache.set(clean, tmdb);
        await new Promise(r => setTimeout(r, 80)); // polite rate limit
      }

      if (tmdb) {
        if (tmdb.poster_path) {
          item.poster = `https://image.tmdb.org/t/p/w500${tmdb.poster_path}`;
        }
        if (tmdb.backdrop_path) {
          item.backdrop = `https://image.tmdb.org/t/p/original${tmdb.backdrop_path}`;
        } else if (item.poster) {
          item.backdrop = item.backdrop || item.poster;
        }
        if (tmdb.vote_average && tmdb.vote_average > 0) {
          item.rating = parseFloat(tmdb.vote_average.toFixed(1));
        }
        if (tmdb.overview && (!item.overview || item.overview.length < 50)) {
          item.overview = tmdb.overview;
        }
        console.log(`  ✅ "${clean}" -> Poster & 4K Backdrop updated!`);
      } else {
        console.log(`  ℹ️ "${clean}" -> Kept existing artwork`);
      }
    }
  }

  fs.writeFileSync(HOME_FEED_PATH, JSON.stringify(homeData, null, 2));
  console.log('\n🎉 Finished! home_feed.json is now 100% updated with Clean Titles and Netflix-Grade 4K Imagery.');
}

run();
