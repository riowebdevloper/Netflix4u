const fs = require('fs');
const path = require('path');
const https = require('https');

const SUMMARY_PATH = path.resolve(__dirname, '../data/catalog_summary.json');
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
      headers: { 'User-Agent': 'FlixWorld-CatalogEnricher/2.0' },
      timeout: 6000
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
  if (imdbId && imdbId.startsWith('tt')) {
    const url = `https://api.tmdb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const res = await fetchJson(url);
    if (res) {
      const match = (res.movie_results && res.movie_results[0]) || (res.tv_results && res.tv_results[0]);
      if (match && match.poster_path) {
        return `https://image.tmdb.org/t/p/w500${match.poster_path}`;
      }
    }
  }

  const clean = cleanTitle(title);
  if (!clean || clean.length < 2) return null;

  const endpoint = (type === 'series' || type === 'anime' || type === 'kdrama') ? 'tv' : 'movie';
  const url = `https://api.tmdb.org/3/search/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(clean)}`;
  const res = await fetchJson(url);

  let match = res && res.results && res.results[0];
  if (!match) {
    const multiUrl = `https://api.tmdb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(clean)}`;
    const multiRes = await fetchJson(multiUrl);
    match = multiRes && multiRes.results && multiRes.results[0];
  }

  if (match && match.poster_path) {
    return `https://image.tmdb.org/t/p/w500${match.poster_path}`;
  }
  return null;
}

async function enrichCatalogTop(limit = 800) {
  console.log(`Loading catalog_summary.json to enrich top ${limit} items...`);
  const catalog = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'));

  let count = 0;
  let updated = 0;
  const concurrency = 8;
  const queue = [];

  for (let i = 0; i < Math.min(catalog.length, limit); i++) {
    const item = catalog[i];
    if (item.poster && item.poster.includes('image.tmdb.org')) continue;
    queue.push(item);
  }

  console.log(`Found ${queue.length} items to enrich in top ${limit}.`);

  for (let i = 0; i < queue.length; i += concurrency) {
    const batch = queue.slice(i, i + concurrency);
    await Promise.all(batch.map(async (item) => {
      const poster = await findPoster(item.title || item.rawTitle, item.imdbId, item.type);
      if (poster) {
        item.poster = poster;
        if (!item.backdrop || item.backdrop.includes('no-poster')) item.backdrop = poster;
        updated++;
      }
    }));
    count += batch.length;
    if (count % 80 === 0 || count === queue.length) {
      console.log(`Progress: ${count}/${queue.length} processed (${updated} real TMDB posters found)`);
    }
    await new Promise(r => setTimeout(r, 60));
  }

  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(catalog), 'utf8');
  console.log(`✅ Finished! ${updated} top catalog items now have real TMDB posters!`);
}

enrichCatalogTop(800);
