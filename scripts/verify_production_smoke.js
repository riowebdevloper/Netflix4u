const https = require('https');

const BASE_URL = 'https://netflix4u.in';

function probe(urlPath, options = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = https.get(`${BASE_URL}${urlPath}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/json,*/*'
      },
      timeout: 10000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { if (data.length < 50000) data += chunk; });
      res.on('end', () => {
        const duration = Date.now() - start;
        resolve({
          path: urlPath,
          status: res.statusCode,
          duration,
          headers: res.headers,
          dataLength: data.length,
          bodySample: data.substring(0, 300),
          fullBody: data
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ path: urlPath, status: 0, error: 'TIMEOUT' });
    });

    req.on('error', (err) => {
      resolve({ path: urlPath, status: 0, error: err.message });
    });
  });
}

async function runSmokeTest() {
  console.log('====================================================');
  console.log('PHASE 13: PRODUCTION LIVE SMOKE TEST (https://netflix4u.in/)');
  console.log('====================================================\n');

  const tests = [
    { name: '1. Production Homepage (/)', path: '/', expectStatus: 200, mustInclude: 'id="hero"' },
    { name: '2. Movie Route (/movies)', path: '/movies', expectStatus: 200, mustInclude: 'canonical' },
    { name: '3. TV Route (/series)', path: '/series', expectStatus: 200, mustInclude: 'canonical' },
    { name: '4. Trending Route (/trending)', path: '/trending', expectStatus: 200, mustInclude: 'canonical' },
    { name: '5. Regional Bollywood (/bollywood)', path: '/bollywood', expectStatus: 200, mustInclude: 'canonical' },
    { name: '6. Regional South Indian (/south-indian)', path: '/south-indian', expectStatus: 200, mustInclude: 'canonical' },
    { name: '7. Anime Hub (/anime)', path: '/anime', expectStatus: 200, mustInclude: 'canonical' },
    { name: '8. K-Drama Hub (/kdrama)', path: '/kdrama', expectStatus: 200, mustInclude: 'canonical' },
    { name: '9. Dual Audio (/hindi-dubbed)', path: '/hindi-dubbed', expectStatus: 200, mustInclude: 'canonical' },
    { name: '10. API: Version Endpoint (/version.json)', path: '/version.json', expectStatus: 200, mustInclude: 'version' },
    { name: '11. API: Curated Trending (/api/catalog/curated/trending)', path: '/api/catalog/curated/trending', expectStatus: 200, mustInclude: 'rails' },
    { name: '12. API: Curated Netflix (/api/catalog/curated/netflix)', path: '/api/catalog/curated/netflix', expectStatus: 200, mustInclude: 'rails' },
    { name: '13. API: Curated Prime Video (/api/catalog/curated/primevideo)', path: '/api/catalog/curated/primevideo', expectStatus: 200, mustInclude: 'rails' },
    { name: '14. API: Stream Player Movie (/api/stream-player?id=533535&type=movie)', path: '/api/stream-player?id=533535&type=movie', expectStatus: 200, mustInclude: 'player-shell' },
    { name: '15. API: Stream Player TV (/api/stream-player?id=1399&type=tv&se=1&ep=1)', path: '/api/stream-player?id=1399&type=tv&se=1&ep=1', expectStatus: 200, mustInclude: 'season-selector' },
    { name: '16. Safety: Missing Source Behavior (/api/details?id=invalid-unverified-bogus)', path: '/api/details?id=invalid-unverified-bogus', expectStatus: 404, mustInclude: 'not found' }
  ];

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    const res = await probe(t.path);
    const statusMatch = res.status === t.expectStatus;
    const bodyMatch = !t.mustInclude || (res.fullBody && res.fullBody.toLowerCase().includes(t.mustInclude.toLowerCase()));

    if (statusMatch && bodyMatch) {
      console.log(`  ✓ PASS: ${t.name} -> HTTP ${res.status} (${res.duration}ms)`);
      passed++;
    } else {
      console.log(`  ❌ FAIL: ${t.name} -> Got HTTP ${res.status}, Error: ${res.error || 'Body mismatch'}`);
      failed++;
    }
  }

  console.log('\n====================================================');
  console.log(`SMOKE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (${passed + failed} TOTAL)`);
  console.log('====================================================');
}

runSmokeTest().catch(console.error);
