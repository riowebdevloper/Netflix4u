const fs = require('fs');
const https = require('https');
const path = require('path');

const TMDB_API_KEY = '445f2b5a8941c1d4bd5a869761a916e3';
const catalogPath = path.join(__dirname, '..', 'data', 'catalog_summary.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

function cleanTitle(raw) {
  if (!raw) return '';
  let t = raw.replace(/&#039;/g, "'").replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  t = t.replace(/\bAmp\b/gi, 'and');
  t = t.replace(/(\d{4})([a-zA-Z]+)/g, '$1 $2').replace(/([a-zA-Z]+)(\d{4})/g, '$1 $2');
  t = t.replace(/\[[^\]]*\]/gi, ' ').replace(/\([^\)]*\)/gi, ' ').replace(/\{[^\}]*\}/gi, ' ');
  t = t.replace(/\b(?:Aka|A\.k\.a)\b.*$/gi, '');
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

function queryTmdb(query, type) {
  return new Promise(resolve => {
    const clean = cleanTitle(query);
    if (!clean || clean.length < 2) return resolve(null);
    const endpoint = (type === 'series' || type === 'anime' || type === 'kdrama') ? 'tv' : 'movie';
    const url = `https://api.tmdb.org/3/search/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(clean)}`;

    https.get(url, { timeout: 4000 }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          let match = json.results && json.results.find(r => r.poster_path);
          if (match && match.poster_path) {
            return resolve({
              poster: `https://image.tmdb.org/t/p/w500${match.poster_path}`,
              backdrop: match.backdrop_path ? `https://image.tmdb.org/t/p/original${match.backdrop_path}` : `https://image.tmdb.org/t/p/w500${match.poster_path}`
            });
          }
        } catch(e) {}

        // Fallback to multi
        const multiUrl = `https://api.tmdb.org/3/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(clean)}`;
        https.get(multiUrl, { timeout: 4000 }, mres => {
          let mdata = '';
          mres.on('data', c => mdata += c);
          mres.on('end', () => {
            try {
              const mjson = JSON.parse(mdata);
              const mmatch = mjson.results && mjson.results.find(r => r.poster_path);
              if (mmatch && mmatch.poster_path) {
                return resolve({
                  poster: `https://image.tmdb.org/t/p/w500${mmatch.poster_path}`,
                  backdrop: mmatch.backdrop_path ? `https://image.tmdb.org/t/p/original${mmatch.backdrop_path}` : `https://image.tmdb.org/t/p/w500${mmatch.poster_path}`
                });
              }
            } catch(e) {}
            resolve(null);
          });
        }).on('error', () => resolve(null));
      });
    }).on('error', () => resolve(null));
  });
}

async function run() {
  const missing = catalog.filter(x => !x.poster || x.poster.includes('no-poster.svg'));
  console.log(`Starting enrichment for ${missing.length} missing posters...`);
  
  // Process first 600 items in batches of 15
  const batchSize = 15;
  const targetItems = missing.slice(0, 600);
  let resolvedCount = 0;

  for (let i = 0; i < targetItems.length; i += batchSize) {
    const chunk = targetItems.slice(i, i + batchSize);
    await Promise.all(chunk.map(async item => {
      const res = await queryTmdb(item.title || item.rawTitle, item.type);
      if (res && res.poster) {
        item.poster = res.poster;
        item.backdrop = res.backdrop;
        resolvedCount++;
      }
    }));
    process.stdout.write(`Processed ${Math.min(i + batchSize, targetItems.length)}/${targetItems.length} (Resolved: ${resolvedCount})\r`);
  }

  console.log(`\nEnrichment finished! Successfully resolved ${resolvedCount} posters.`);
  if (resolvedCount > 0) {
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8');
    console.log('Saved updated catalog_summary.json!');
  }
}

run();
