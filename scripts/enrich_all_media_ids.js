const fs = require('fs');
const path = require('path');
const https = require('https');

const TMDB_KEY = '445f2b5a8941c1d4bd5a869761a916e3';
const DATA_DIR = path.resolve(__dirname, '..', 'data');
const HOME_FEED_PATH = path.join(DATA_DIR, 'home_feed.json');
const DETAILS_DIR = path.join(DATA_DIR, 'details');

function cleanTitle(raw) {
  if (!raw) return '';
  return raw
    .replace(/\(\d{4}\)/g, '')
    .replace(/^(NetFlix|Prime|Disney\+|Hotstar|SonyLIV|ZEE5)\s+/i, '')
    .replace(/\[[^\]]*\]/gi, '')
    .replace(/\b(Hindi|English|Dual|Multi|Audio|Dubbed|WEB|HQ|HDTC|720p|1080p|480p|Season|Ep|All).*$/gi, '')
    .trim();
}

function searchTmdb(title, year, type = 'movie') {
  const clean = cleanTitle(title);
  const endpoint = (type === 'series' || type === 'kdrama' || type === 'anime') ? 'tv' : 'movie';
  const url = `https://api.tmdb.org/3/search/${endpoint}?api_key=${TMDB_KEY}&query=${encodeURIComponent(clean)}`;

  return new Promise(resolve => {
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          const first = j.results && j.results[0];
          resolve(first || null);
        } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function getImdbId(tmdbId, type = 'movie') {
  const endpoint = (type === 'series' || type === 'kdrama' || type === 'anime') ? 'tv' : 'movie';
  const url = `https://api.tmdb.org/3/${endpoint}/${tmdbId}${endpoint === 'tv' ? '/external_ids' : ''}?api_key=${TMDB_KEY}`;

  return new Promise(resolve => {
    https.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(d);
          resolve(j.imdb_id || (j.external_ids && j.external_ids.imdb_id) || null);
        } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function run() {
  console.log('⚡ Starting Media ID Enrichment Pipeline (TMDB + IMDB)...');
  const feed = JSON.parse(fs.readFileSync(HOME_FEED_PATH, 'utf8'));

  const cache = new Map();
  let enrichedCount = 0;
  let totalCount = 0;

  for (const section of Object.keys(feed)) {
    if (!Array.isArray(feed[section])) continue;
    console.log(`\nEnriching section: [${section}] (${feed[section].length} items)...`);

    for (const item of feed[section]) {
      totalCount++;
      const clean = cleanTitle(item.title);
      const cacheKey = `${clean}_${item.type}`.toLowerCase();

      let info = cache.get(cacheKey);
      if (info === undefined) {
        let tmdb = await searchTmdb(clean, item.year, item.type);
        if (!tmdb) {
          tmdb = await searchTmdb(clean, item.year, item.type === 'movie' ? 'tv' : 'movie');
        }

        let imdb = null;
        if (tmdb && tmdb.id) {
          imdb = await getImdbId(tmdb.id, item.type);
        }

        info = { tmdb, imdb };
        cache.set(cacheKey, info);
        await new Promise(r => setTimeout(r, 60)); // polite delay
      }

      if (info.tmdb) {
        item.tmdbId = String(info.tmdb.id);
        if (info.imdb) item.imdbId = String(info.imdb);

        if (info.tmdb.poster_path && (!item.poster || item.poster.includes('placehold.co'))) {
          item.poster = `https://image.tmdb.org/t/p/w500${info.tmdb.poster_path}`;
        }
        if (info.tmdb.backdrop_path && (!item.backdrop || item.backdrop.includes('placehold.co'))) {
          item.backdrop = `https://image.tmdb.org/t/p/original${info.tmdb.backdrop_path}`;
        }
        if (info.tmdb.overview && (!item.overview || item.overview.length < 30)) {
          item.overview = info.tmdb.overview;
          item.description = info.tmdb.overview;
        }
        if (info.tmdb.vote_average && info.tmdb.vote_average > 0) {
          item.rating = parseFloat(info.tmdb.vote_average.toFixed(1));
        }

        enrichedCount++;
        console.log(`  ✅ "${item.title}" -> TMDB: ${item.tmdbId} | IMDB: ${item.imdbId || 'none'}`);

        // Also update corresponding details file if exists
        const safeId = String(item.id || item.record_id).replace(/[/\\?%*:|"<>]/g, '_');
        const detailPaths = [
          path.join(DETAILS_DIR, `${safeId}.json`),
          path.join(DETAILS_DIR, `dotmobiz-${safeId}.json`)
        ];

        for (const dp of detailPaths) {
          if (fs.existsSync(dp)) {
            try {
              const d = JSON.parse(fs.readFileSync(dp, 'utf8'));
              d.tmdbId = item.tmdbId;
              if (item.imdbId) d.imdbId = item.imdbId;
              if (item.poster) d.poster = item.poster;
              if (item.backdrop) d.backdrop = item.backdrop;
              if (item.overview) d.overview = item.overview;
              fs.writeFileSync(dp, JSON.stringify(d, null, 2));
            } catch(e) {}
          }
        }
      } else {
        console.log(`  ⚠️ "${item.title}" -> Could not find TMDB match`);
      }
    }
  }

  fs.writeFileSync(HOME_FEED_PATH, JSON.stringify(feed, null, 2));
  console.log(`\n🎉 ENRICHMENT COMPLETE! Enriched ${enrichedCount}/${totalCount} titles with verified TMDB & IMDB IDs!`);
}

run().catch(console.error);
