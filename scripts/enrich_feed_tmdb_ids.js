/**
 * Enrich Feed Items with Authentic TMDB IDs and Posters
 * Resolves accurate TMDB IDs for home_feed.json and trending.json
 */
const fs = require('fs');
const path = require('path');
const { resolveTmdbId, TMDB_API_KEY } = require('../services/apiCore');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const HOME_FEED_PATH = path.join(ROOT, 'data', 'home_feed.json');
const TRENDING_PATH = path.join(ROOT, 'data', 'trending.json');

function fetchTmdbPoster(tmdbId, isTv) {
  return new Promise(resolve => {
    const endpoint = isTv ? 'tv' : 'movie';
    const url = `https://api.tmdb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000 }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(d);
          resolve({
            poster: json.poster_path ? `https://image.tmdb.org/t/p/w500${json.poster_path}` : null,
            backdrop: json.backdrop_path ? `https://image.tmdb.org/t/p/w1280${json.backdrop_path}` : null,
            rating: json.vote_average ? Number(json.vote_average.toFixed(1)) : null
          });
        } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function enrichFeed() {
  console.log('Starting Feed Enrichment...');

  // 1. Enrich home_feed.json
  if (fs.existsSync(HOME_FEED_PATH)) {
    const homeFeed = JSON.parse(fs.readFileSync(HOME_FEED_PATH, 'utf8'));
    let total = 0, enriched = 0;

    for (const [section, items] of Object.entries(homeFeed)) {
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        total++;
        const isTv = item.type === 'series' || item.type === 'tv';
        let tid = item.tmdbId ? Number(item.tmdbId) : null;
        if (!tid || isNaN(tid) || tid < 1000) {
          tid = await resolveTmdbId(item.title, item.year, isTv ? 'tv' : 'movie', item.imdbId);
          if (tid) {
            item.tmdbId = tid;
            enriched++;
          }
        }

        // Clean placehold.co images
        if (tid && (item.poster?.includes('placehold.co') || !item.poster)) {
          const meta = await fetchTmdbPoster(tid, isTv);
          if (meta?.poster) item.poster = meta.poster;
          if (meta?.backdrop && (!item.backdrop || item.backdrop.includes('placehold.co'))) item.backdrop = meta.backdrop;
          if (meta?.rating) item.rating = meta.rating;
        }
      }
    }
    fs.writeFileSync(HOME_FEED_PATH, JSON.stringify(homeFeed, null, 2), 'utf8');
    console.log(`home_feed.json enriched: ${enriched} new TMDB IDs added across ${total} items.`);
  }

  // 2. Enrich trending.json
  if (fs.existsSync(TRENDING_PATH)) {
    const trending = JSON.parse(fs.readFileSync(TRENDING_PATH, 'utf8'));
    let total = 0, enriched = 0;

    if (Array.isArray(trending)) {
      for (const item of trending) {
        total++;
        const isTv = item.type === 'series' || item.type === 'tv';
        let tid = item.tmdbId ? Number(item.tmdbId) : null;
        if (!tid || isNaN(tid) || tid < 1000) {
          tid = await resolveTmdbId(item.title, item.year, isTv ? 'tv' : 'movie', item.imdbId);
          if (tid) {
            item.tmdbId = tid;
            enriched++;
          }
        }

        if (tid && (item.poster?.includes('placehold.co') || !item.poster)) {
          const meta = await fetchTmdbPoster(tid, isTv);
          if (meta?.poster) item.poster = meta.poster;
          if (meta?.backdrop && (!item.backdrop || item.backdrop.includes('placehold.co'))) item.backdrop = meta.backdrop;
        }
      }
      fs.writeFileSync(TRENDING_PATH, JSON.stringify(trending, null, 2), 'utf8');
      console.log(`trending.json enriched: ${enriched} new TMDB IDs added across ${total} items.`);
    }
  }

  console.log('Feed enrichment completed successfully.');
}

enrichFeed().catch(err => console.error('Enrichment failed:', err));
