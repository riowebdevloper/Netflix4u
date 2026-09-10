const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

// Load environment variables for TMDB key
let tmdbKey = '445f2b5a8941c1d4bd5a869761a916e3';
try {
  const envContent = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
  const m = envContent.match(/TMDB_API_KEY=([a-zA-Z0-9_-]+)/);
  if (m) tmdbKey = m[1];
} catch(e) {}

console.log('Using TMDB key:', tmdbKey ? tmdbKey.slice(0, 6) + '...' : 'none');

// 1. Load data files
const summaryPath = path.join(DATA_DIR, 'catalog_summary.json');
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
console.log('Total items in catalog_summary:', summary.length);

const dotmobizPath = path.join(DATA_DIR, 'dotmobiz_complete_catalog.json');
const dotmobiz = fs.existsSync(dotmobizPath) ? JSON.parse(fs.readFileSync(dotmobizPath, 'utf8')) : [];
console.log('Total items in dotmobiz_complete_catalog:', dotmobiz.length);

const dotMap = new Map();
dotmobiz.forEach(item => {
  if (item.poster && !item.poster.includes('no-poster')) {
    if (item.id) dotMap.set(String(item.id), item);
    if (item.record_id) dotMap.set(String(item.record_id), item);
    if (item.slug) dotMap.set(String(item.slug), item);
    const clean = (item.title || '').replace(/\(\d{4}\)/g, '').replace(/^(NetFlix|Prime|Disney\+|Hotstar|SonyLIV|ZEE5)\s+/i, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean) dotMap.set(clean, item);
  }
});

// Load series.json for Hicine series featured_image
const seriesPath = path.join(DATA_DIR, 'series.json');
const seriesList = fs.existsSync(seriesPath) ? JSON.parse(fs.readFileSync(seriesPath, 'utf8')) : [];
const seriesMap = new Map();
seriesList.forEach(s => {
  const img = s.poster || s.featured_image;
  if (img && !img.includes('no-poster')) {
    if (s.record_id) seriesMap.set(String(s.record_id), img);
    if (s._id) seriesMap.set(String(s._id), img);
    if (s.url_slug) seriesMap.set(String(s.url_slug), img);
    const clean = (s.title || '').replace(/\(\d{4}\)/g, '').replace(/^(NetFlix|Prime|Disney\+|Hotstar|SonyLIV|ZEE5)\s+/i, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean) seriesMap.set(clean, img);
  }
});

// Load movies.json for Hicine movies featured_image
const moviesPath = path.join(DATA_DIR, 'movies.json');
const moviesList = fs.existsSync(moviesPath) ? JSON.parse(fs.readFileSync(moviesPath, 'utf8')) : [];
const moviesMap = new Map();
moviesList.forEach(m => {
  const img = m.poster || m.featured_image;
  if (img && !img.includes('no-poster')) {
    if (m.record_id) moviesMap.set(String(m.record_id), img);
    if (m._id) moviesMap.set(String(m._id), img);
    if (m.url_slug) moviesMap.set(String(m.url_slug), img);
    const clean = (m.title || '').replace(/\(\d{4}\)/g, '').replace(/^(NetFlix|Prime|Disney\+|Hotstar|SonyLIV|ZEE5)\s+/i, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean) moviesMap.set(clean, img);
  }
});

let fixedCount = 0;
const stillMissing = [];

summary.forEach((item, idx) => {
  let p = item.poster;
  const isMissing = !p || p.includes('no-poster') || p.includes('placeholder') || p === '';

  if (isMissing) {
    const clean = (item.title || '').replace(/\(\d{4}\)/g, '').replace(/^(NetFlix|Prime|Disney\+|Hotstar|SonyLIV|ZEE5)\s+/i, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    
    // Tier 1: Match from dotmobiz complete catalog
    const dot = dotMap.get(String(item.id)) || dotMap.get(String(item.record_id)) || dotMap.get(String(item.slug)) || dotMap.get(clean);
    if (dot && dot.poster && !dot.poster.includes('no-poster')) {
      item.poster = dot.poster;
      item.backdrop = dot.backdrop || dot.poster;
      if (dot.imdbId && !item.imdbId) item.imdbId = dot.imdbId;
      fixedCount++;
      return;
    }

    // Tier 2: Match from series list
    const sImg = seriesMap.get(String(item.record_id)) || seriesMap.get(String(item.id)) || seriesMap.get(clean);
    if (sImg) {
      item.poster = sImg;
      item.backdrop = sImg;
      fixedCount++;
      return;
    }

    // Tier 3: Match from movies list
    const mImg = moviesMap.get(String(item.record_id)) || moviesMap.get(String(item.id)) || moviesMap.get(clean);
    if (mImg) {
      item.poster = mImg;
      item.backdrop = mImg;
      fixedCount++;
      return;
    }

    // Tier 4: Check if item itself has featured_image
    if (item.featured_image && !item.featured_image.includes('no-poster')) {
      item.poster = item.featured_image;
      item.backdrop = item.featured_image;
      fixedCount++;
      return;
    }

    stillMissing.push({ item, idx });
  }
});

console.log(`✅ Instant reconciliation complete: Fixed ${fixedCount} posters!`);
console.log(`Remaining missing to fetch via TMDB: ${stillMissing.length}`);

// TMDB lookup helper
function fetchTmdbPoster(title, type = 'movie') {
  return new Promise(resolve => {
    if (!tmdbKey) return resolve(null);
    const clean = title.replace(/\(\d{4}\)/g, '').replace(/^(NetFlix|Prime|Disney\+|Hotstar|SonyLIV|ZEE5)\s+/i, '').replace(/\[[^\]]*\]/g, '').trim();
    const endpoint = (type === 'series' || type === 'anime' || type === 'kdrama' || type === 'tv') ? 'tv' : 'movie';
    const url = `https://api.tmdb.org/3/search/${endpoint}?api_key=${tmdbKey}&query=${encodeURIComponent(clean)}`;
    
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 4000 }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json && json.results && json.results.length > 0) {
            const first = json.results[0];
            const poster = first.poster_path ? `https://image.tmdb.org/t/p/w500${first.poster_path}` : null;
            const backdrop = first.backdrop_path ? `https://image.tmdb.org/t/p/original${first.backdrop_path}` : poster;
            return resolve({ poster, backdrop, tmdbId: first.id });
          }
        } catch(e) {}
        resolve(null);
      });
    }).on('error', () => resolve(null));
  });
}

async function resolveRemaining() {
  let resolvedViaApi = 0;
  for (let i = 0; i < stillMissing.length; i++) {
    const { item } = stillMissing[i];
    const res = await fetchTmdbPoster(item.title, item.type);
    if (res && res.poster) {
      item.poster = res.poster;
      item.backdrop = res.backdrop || res.poster;
      if (res.tmdbId) item.tmdbId = res.tmdbId;
      resolvedViaApi++;
    }
    // Small delay to be courteous to TMDB
    if (i % 10 === 0) {
      await new Promise(r => setTimeout(r, 100));
      process.stdout.write(`Progress: ${i + 1}/${stillMissing.length} (Resolved: ${resolvedViaApi})\r`);
    }
  }
  console.log(`\n🎉 TMDB lookup resolved: ${resolvedViaApi} additional items!`);

  // Write updated catalog_summary.json
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log('💾 Saved reconciled catalog_summary.json successfully!');

  // Also verify home_feed.json
  const homeFeedPath = path.join(DATA_DIR, 'home_feed.json');
  if (fs.existsSync(homeFeedPath)) {
    const homeFeed = JSON.parse(fs.readFileSync(homeFeedPath, 'utf8'));
    let hfUpdated = 0;
    for (const [key, list] of Object.entries(homeFeed)) {
      if (Array.isArray(list)) {
        list.forEach(card => {
          if (!card.poster || card.poster.includes('no-poster')) {
            const match = summary.find(s => String(s.id) === String(card.id) || String(s.record_id) === String(card.record_id));
            if (match && match.poster && !match.poster.includes('no-poster')) {
              card.poster = match.poster;
              card.backdrop = match.backdrop || match.poster;
              hfUpdated++;
            }
          }
        });
      }
    }
    fs.writeFileSync(homeFeedPath, JSON.stringify(homeFeed, null, 2), 'utf8');
    console.log(`💾 Updated home_feed.json (${hfUpdated} items repaired)`);
  }

  // Check final missing count in summary
  const finalMissing = summary.filter(s => !s.poster || s.poster.includes('no-poster')).length;
  console.log(`\nFINAL STATS: Missing posters down from 13,071 to ${finalMissing} out of ${summary.length} items (${((1 - finalMissing/summary.length) * 100).toFixed(2)}% populated!)`);
}

resolveRemaining();
