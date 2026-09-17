const https = require('https');
const fs = require('fs');
const path = require('path');

function fetchJson(u) {
  return new Promise(resolve => {
    https.get(u, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://netmirror.center/'
      },
      timeout: 8000
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function run() {
  const titles = [
    { type: 'movie', id: '123738' }, // The Runner (2026)
    { type: 'tv', id: '5069' },       // Reacher [Hindi] S1-S4
    { type: 'movie', id: '123505' }, // The Whisper Man (2026)
    { type: 'tv', id: '116884' },    // Dark Matter
    { type: 'movie', id: '122801' }, // Spider-Man: Brand New Day (2026)
    { type: 'tv', id: '2730' }       // Silo
  ];

  const items = [];
  for (const t of titles) {
    const data = await fetchJson(`https://api2.imdb3.shop/api/${t.type}/${t.id}`);
    if (data && data.results && data.results[0]) {
      const it = data.results[0];
      const cleanTitle = it.title.replace(/\s*\[.*?\]\s*/g, '').replace(/\s*S\d+.*$/i, '').trim();
      const year = it.release_date ? it.release_date.match(/\b(20\d{2}|19\d{2})\b/)?.[0] || '2026' : '2026';
      items.push({
        id: it.id,
        tmdbId: it.tm_id || it.id,
        title: cleanTitle,
        year: year,
        type: it.media_type || t.type,
        rating: Number(it.vote_average) || 8.2,
        backdrop: it.backdrop_path || '',
        overview: (it.dis || '').replace(/^["'\s]+|["'\s]+$/g, '') || `Watch ${cleanTitle} online in high definition with multi-audio streaming on Netflix4U.`
      });
    }
  }

  console.log('Fetched NetMirror Hero items:', items.length);
  console.log(JSON.stringify(items, null, 2));
}

run();
