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
  t = t.replace(/\b(?:\d{3,4}\s*p|2160p|1080p|720p|480p|576p|4K|FHD|HD|SD|HQ)\b/gi, '');
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
    if (multiRes && multiRes.results) {
      match = multiRes.results.find(r => r.poster_path);
    }
  }

  if (match && match.poster_path) {
    return `https://image.tmdb.org/t/p/w500${match.poster_path}`;
  }

  return null;
}

async function main() {
  console.log('Reading catalog_summary.json for batch 2 (items 800 to 2500)...');
  const catalog = JSON.parse(fs.readFileSync(SUMMARY_PATH, 'utf8'));

  const startIdx = 800;
  const endIdx = Math.min(2500, catalog.length);
  const toProcess = [];

  for (let i = startIdx; i < endIdx; i++) {
    const item = catalog[i];
    if (!item.poster || item.poster.includes('no-poster') || item.poster.includes('placehold')) {
      toProcess.push({ index: i, item });
    }
  }

  console.log(`Found ${toProcess.length} items to enrich in range [${startIdx}, ${endIdx}].`);

  let count = 0;
  let found = 0;
  const BATCH_SIZE = 8;

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async ({ index, item }) => {
      const poster = await findPoster(item.title, item.imdbId, item.type);
      if (poster) {
        catalog[index].poster = poster;
        if (!catalog[index].backdrop || catalog[index].backdrop.includes('no-poster')) {
          catalog[index].backdrop = poster;
        }
        found++;
      }
    }));

    count += batch.length;
    if (count % 100 === 0 || count === toProcess.length) {
      console.log(`Progress: ${count}/${toProcess.length} processed (${found} real TMDB posters found)`);
      // Incremental save
      fs.writeFileSync(SUMMARY_PATH, JSON.stringify(catalog));
    }
    await new Promise(r => setTimeout(r, 80));
  }

  fs.writeFileSync(SUMMARY_PATH, JSON.stringify(catalog));
  console.log(`✅ Batch 2 finished! ${found} more catalog items now have real TMDB posters!`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
