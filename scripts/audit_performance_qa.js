const http = require('http');

function measureLatency(path) {
  return new Promise(resolve => {
    const start = Date.now();
    http.get('http://localhost:4173' + path, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        const duration = Date.now() - start;
        resolve({
          path,
          status: res.statusCode,
          duration,
          bytes: d.length,
          cacheControl: res.headers['cache-control'] || 'none'
        });
      });
    }).on('error', err => resolve({ path, error: err.message, duration: 9999 }));
  });
}

async function runPerformanceQA() {
  console.log('========================================================');
  console.log('AGENT 9 — PERFORMANCE & RESPONSE LATENCY QA');
  console.log('========================================================\n');

  const testEndpoints = [
    '/',
    '/api/health',
    '/api/summary',
    '/api/title?id=dotmobiz-96465',
    '/api/playback?id=dotmobiz-96465',
    '/data/home_feed.json',
    '/images/favicon.svg',
    '/robots.txt',
    '/sitemap.xml'
  ];

  let passed = 0;
  let failed = 0;

  for (const ep of testEndpoints) {
    const m = await measureLatency(ep);
    const isFast = m.duration < 500;
    const isOk = m.status === 200;

    if (isOk && isFast) {
      console.log(`  ✅ ${m.path} -> ${m.status} | Latency: ${m.duration}ms | Size: ${(m.bytes/1024).toFixed(1)} KB | Cache: ${m.cacheControl}`);
      passed++;
    } else if (isOk) {
      console.log(`  ⚠️ ${m.path} -> ${m.status} | Latency: ${m.duration}ms (Acceptable but >500ms) | Size: ${(m.bytes/1024).toFixed(1)} KB`);
      passed++;
    } else {
      console.log(`  ❌ ${m.path} -> ${m.status || m.error} | Latency: ${m.duration}ms`);
      failed++;
    }
  }

  console.log('\n========================================================');
  console.log(`PERFORMANCE RESULTS: Passed: ${passed}, Failed: ${failed}`);
  console.log('========================================================\n');
}

runPerformanceQA();
