const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.resolve(__dirname, '../data');
const TMDB_API_KEY = '445f2b5a8941c1d4bd5a869761a916e3';

function cleanTitle(raw) {
  if (!raw) return '';
  let t = raw.replace(/&#039;/g, "'").replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  t = t.replace(/(\d{4})([a-zA-Z]+)/g, '$1 $2').replace(/([a-zA-Z]+)(\d{4})/g, '$1 $2');
  t = t.replace(/\[[^\]]*\]/gi, ' ').replace(/\([^\)]*\)/gi, ' ').replace(/\{[^\}]*\}/gi, ' ');
  t = t.replace(/\b(?:Season\s*\d+|S\d{1,2}|Ep(?:isode)?\s*\d+|All\s*Episodes?|Complete\s*Season).*$/gi, '');
  t = t.replace(/\b(19\d{2}|20\d{2})\b\s*(?:[A-Za-z]+)?\s*(?:Audio|Dubbed|Web|Rip|720p|1080p|480p|576p|2160p|Season|Ep|Bengali|Hoichoi|Hulu|Netflix|Prime|Hotstar|Zee5|SonyLiv|Aha|All|$).*$/gi, '');
  t = t.replace(/\b(19\d{2}|20\d{2})\s*$/gi, '');
  t = t.replace(/\b(?:JioHotstar|Hotstar|Netflix|Prime(?:\s*Video)?|Zee5|SonyLiv|Disney\+?|Hulu|Hoichoi|Aha|Voot|MX\s*Player|Apple(?:\s*TV)?)\s*(?:Original)?\b/gi, '');
  t = t.replace(/\b(?:Hindi|English|Tamil|Telugu|Malayalam|Kannada|Bengali|Korean|Japanese|Chinese|Marathi|Punjabi|Multi|Dual|Line)\s*(?:-|–|—)?\s*(?:Audio|Dubbed)?\b/gi, '');
  t = t.replace(/\b(?:Audio|Dubbed|Subbed|Original Audio|Clean Audio|Line Audio)\b/gi, '');
  t = t.replace(/\b(?:\d{3,4}\s*p|2160p|1080p|720p|480p|576p|4K|FHD|UHD|HD|SD|HQ)\b/gi, '');
  t = t.replace(/\b(?:WEB[- ]?DL|WEB[- ]?Rip|HQ[- ]?HDTC|HDTC|HDRip|BluRay|BRRip|DVDRip|DVD|Pre[- ]?DVD|HEVC|x264|x265|CamRip|CAM|Rip|Line)\b/gi, '');
  t = t.replace(/[-–—:|/\\]+\s*$/g, '').replace(/^\s*[-–—:|/\\]+/g, '').replace(/\s{2,}/g, ' ').trim();
  return t || raw.trim();
}

function fetchJson(url) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: { 'User-Agent': 'FlixWorld-PosterFetcher/2.0' },
      timeout: 8000
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function findPoster(title, imdbId, type) {
  // 1. Try by IMDb ID if available
  if (imdbId && imdbId.startsWith('tt')) {
    const url = `https://api.tmdb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const res = await fetchJson(url);
    if (res) {
      const match = (res.movie_results && res.movie_results[0]) || (res.tv_results && res.tv_results[0]);
      if (match && match.poster_path) {
        return {
          poster: `https://image.tmdb.org/t/p/w500${match.poster_path}`,
          backdrop: match.backdrop_path ? `https://image.tmdb.org/t/p/original${match.backdrop_path}` : null,
          rating: match.vote_average ? parseFloat(match.vote_average.toFixed(1)) : null,
          title: match.title || match.name
        };
      }
    }
  }

  // 2. Try by clean title
  const clean = cleanTitle(title);
  if (!clean || clean.length < 2) return null;

  const endpoint = (type === 'series' || type === 'anime' || type === 'kdrama') ? 'tv' : 'movie';
  const url = `https://api.tmdb.org/3/search/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(clean)}`;
  const res = await fetchJson(url);

  let match = res && res.results && res.results[0];

  // If no match in specific endpoint, try multi search
  if (!match) {
    const multiUrl = `https://api.tmdb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(clean)}`;
    const multiRes = await fetchJson(multiUrl);
    match = multiRes && multiRes.results && multiRes.results[0];
  }

  if (match && match.poster_path) {
    return {
      poster: `https://image.tmdb.org/t/p/w500${match.poster_path}`,
      backdrop: match.backdrop_path ? `https://image.tmdb.org/t/p/original${match.backdrop_path}` : null,
      rating: match.vote_average ? parseFloat(match.vote_average.toFixed(1)) : null,
      title: match.title || match.name
    };
  }

  return null;
}

async function enrichHomeFeed() {
  console.log('🚀 Starting TMDB Poster Enrichment for home_feed.json, trending.json, and recent.json...');

  const homeFeedPath = path.join(DATA_DIR, 'home_feed.json');
  const feed = JSON.parse(fs.readFileSync(homeFeedPath, 'utf8'));

  const cache = new Map();
  let updatedCount = 0;
  let totalCount = 0;

  for (const [section, items] of Object.entries(feed)) {
    if (!Array.isArray(items)) continue;
    console.log(`\nProcessing Section: [${section}] (${items.length} items)`);

    for (const it of items) {
      totalCount++;
      const currentPoster = it.poster || '';
      const isTmdb = currentPoster.includes('image.tmdb.org');

      // If already a valid TMDB poster, skip unless needed
      if (isTmdb && !currentPoster.endsWith('.')) {
        continue;
      }

      const key = `${it.title}__${it.imdbId || ''}`;
      let data = cache.get(key);

      if (data === undefined) {
        data = await findPoster(it.title, it.imdbId, it.type);
        cache.set(key, data);
        await new Promise(r => setTimeout(r, 60)); // Polite rate limit (approx 16 req/sec)
      }

      if (data && data.poster) {
        it.poster = data.poster;
        if (data.backdrop) it.backdrop = data.backdrop;
        if (data.rating) it.rating = data.rating;
        updatedCount++;
        console.log(`  ✅ [${section}] "${it.title}" -> ${data.poster}`);
      } else {
        console.log(`  ⚠️ [${section}] "${it.title}" -> No TMDB match, kept fallback`);
      }
    }
  }

  fs.writeFileSync(homeFeedPath, JSON.stringify(feed, null, 2), 'utf8');
  console.log(`\n🎉 home_feed.json updated! ${updatedCount} items enriched with real TMDB posters.`);

  // Also enrich trending.json
  const trendingPath = path.join(DATA_DIR, 'trending.json');
  if (fs.existsSync(trendingPath)) {
    const tr = JSON.parse(fs.readFileSync(trendingPath, 'utf8'));
    for (const item of tr) {
      const data = await findPoster(item.title, item.imdbId, item.type);
      if (data && data.poster) {
        item.poster = data.poster;
        item.featured_image = data.poster;
        if (data.backdrop) item.backdrop = data.backdrop;
      }
    }
    fs.writeFileSync(trendingPath, JSON.stringify(tr, null, 2), 'utf8');
    console.log('✅ trending.json updated with real TMDB posters.');
  }

  // Also enrich recent.json
  const recentPath = path.join(DATA_DIR, 'recent.json');
  if (fs.existsSync(recentPath)) {
    const rc = JSON.parse(fs.readFileSync(recentPath, 'utf8'));
    for (const item of rc) {
      const data = await findPoster(item.title, item.imdbId, item.type);
      if (data && data.poster) {
        item.poster = data.poster;
        item.featured_image = data.poster;
        if (data.backdrop) item.backdrop = data.backdrop;
      }
    }
    fs.writeFileSync(recentPath, JSON.stringify(rc, null, 2), 'utf8');
    console.log('✅ recent.json updated with real TMDB posters.');
  }
}

enrichHomeFeed();
