const https = require('https');

function getJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', ...headers } }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, raw: d }); }
      });
    }).on('error', reject);
  });
}

async function testApi() {
  console.log('Testing Hicine API backend endpoints...');

  // Test root / health
  const root = await getJson('https://api.hicine.sbs/');
  console.log('API Root status:', root.status, root.data || root.raw?.slice(0, 100));

  // Test movies endpoint with key
  const movies = await getJson('https://api.hicine.sbs/api/movies?page=1&limit=5', {
    'x-api-key': 'hicine_website_secret_2025_exi9epdmrns'
  });
  console.log('Movies status:', movies.status, 'Keys:', Object.keys(movies.data || {}));
  if (movies.data && movies.data.data) {
    console.log('Sample movie title:', movies.data.data[0]?.title);
    console.log('Sample categories:', movies.data.data[0]?.categories);
  }

  // Test series endpoint
  const series = await getJson('https://api.hicine.sbs/api/series?page=1&limit=5', {
    'x-api-key': 'hicine_website_secret_2025_exi9epdmrns'
  });
  console.log('Series status:', series.status, 'Keys:', Object.keys(series.data || {}));
  if (series.data && series.data.data) {
    console.log('Sample series title:', series.data.data[0]?.title);
  }
}

testApi().catch(console.error);
