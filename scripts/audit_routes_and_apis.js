const http = require('http');

function get(path, headers = {}) {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:4173' + path, { headers: { 'User-Agent': 'Mozilla/5.0', ...headers } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({
        path,
        status: res.statusCode,
        headers: res.headers,
        bodyLength: data.length,
        body: data
      }));
    });
    req.on('error', (err) => resolve({ path, status: 0, error: err.message }));
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ path, status: 408, error: 'Timeout' });
    });
  });
}

async function runRoutingAndApiQa() {
  console.log('========================================================');
  console.log('AGENT 1 & 5 — APPLICATION ROUTING & API CONTRACT AUDIT');
  console.log('========================================================\n');

  const routesToTest = [
    // Core HTML Frontend Pages
    '/',
    '/movies',
    '/series',
    '/anime',
    '/kdrama',
    '/trending',
    '/genres',
    '/search',
    '/watchlist',
    '/movie/mirzapur-the-movie-2026',
    '/series/dotmobiz-96195',
    '/movie/invalid-id-xyz-999999',
    '/series/invalid-series-id-xyz-999999',

    // Core Backend APIs
    '/api/health',
    '/api/summary',
    '/api/search?q=mirzapur',
    '/api/search?q=',
    '/api/search?q=xyznonexistentmovie12345',
    '/api/title?id=mirzapur-the-movie-2026',
    '/api/title?id=dotmobiz-19293',
    '/api/title?id=12113389',
    '/api/title?id=invalid-id-9999999999',
    '/api/playback?id=mirzapur-the-movie-2026',
    '/api/playback?id=dotmobiz-96195&season=1&episode=1',
    '/api/playback?id=invalid-id-9999999999',
    '/api/download/hicine?vcloud=https://vcloud.fit/jvcvcbyokytoy31',
    '/api/download/hicine?id=mirzapur-the-movie-2026',
    '/api/download/hicine?id=nonexistent-id-999',
    '/api/poster-resolver?imdbId=tt34339725',
    '/api/poster-resolver?title=Mirzapur%20The%20Movie&type=movie',
    '/api/poster-resolver?title=Dhamaal%204&type=movie',
    '/api/trailer?title=Mirzapur%20The%20Movie&year=2026',
    '/api/cast?title=Mirzapur&tmdbId=1321008',
    '/api/recommendations?id=mirzapur-the-movie-2026',
    '/api/image-proxy?url=https://image.tmdb.org/t/p/w500/cdDKdCRyq6BYuNblpKUYqRPWvEg.jpg',

    // Static Assets
    '/robots.txt',
    '/sitemap.xml',
    '/images/favicon.svg',
    '/js/manifest.json'
  ];

  const results = [];
  for (const r of routesToTest) {
    const res = await get(r);
    let parsedJson = null;
    if (res.headers && res.headers['content-type'] && res.headers['content-type'].includes('application/json')) {
      try { parsedJson = JSON.parse(res.body); } catch(e) {}
    }
    results.push({
      route: r,
      status: res.status,
      contentType: res.headers ? res.headers['content-type'] : 'none',
      location: res.headers ? res.headers['location'] : null,
      bytes: res.bodyLength,
      jsonSuccess: parsedJson ? parsedJson.success : null,
      error: res.error
    });
    console.log(`[${res.status}] ${r} (${res.headers ? res.headers['content-type'] : res.error})`);
  }

  console.log('\n--- Route & API Audit Summary ---');
  console.log(`Total Tested: ${results.length}`);
  const failed = results.filter(r => r.status === 0 || r.status >= 500);
  console.log(`Failures (5xx or connection error): ${failed.length}`);
  if (failed.length > 0) {
    console.error('Failed routes:', failed);
  }
}

runRoutingAndApiQa();
