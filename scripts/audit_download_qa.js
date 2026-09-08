const http = require('http');
const https = require('https');

function probeUrl(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.request(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': '*/*'
        },
        timeout: 5000
      }, res => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          location: res.headers.location
        });
      });
      req.on('error', err => resolve({ error: err.message }));
      req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
      req.end();
    } catch(e) {
      resolve({ error: e.message });
    }
  });
}

function getJson(path) {
  return new Promise(resolve => {
    http.get('http://localhost:4173' + path, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, data: d }); }
      });
    }).on('error', err => resolve({ status: 500, error: err.message }));
  });
}

async function runDownloadQA() {
  console.log('========================================================');
  console.log('AGENT 3 — DOWNLOAD SYSTEM QA AUDIT');
  console.log('========================================================\n');

  const testCases = [
    {
      name: 'Mirzapur: The Movie 2026 (480p Fast Cloud)',
      url: '/api/download/hicine?vcloud=https://vcloud.fit/jvcvcbyokytoy31&quality=480p'
    },
    {
      name: 'Mirzapur: The Movie 2026 (720p Fast Cloud)',
      url: '/api/download/hicine?vcloud=https://vcloud.fit/30m9m58rwyi33tr&quality=720p'
    },
    {
      name: 'Mirzapur: The Movie 2026 (1080p Fast Cloud)',
      url: '/api/download/hicine?vcloud=https://vcloud.fit/q74m73x8f8iymw4&quality=1080p'
    },
    {
      name: 'Black Box 2026 (480p Fast Cloud)',
      url: '/api/download/hicine?vcloud=https://vcloud.fit/xqa2ycj2sqeyxta&quality=480p'
    },
    {
      name: 'Black Box 2026 (720p Fast Cloud)',
      url: '/api/download/hicine?vcloud=https://vcloud.fit/ycym3jnpvnwx1an&quality=720p'
    },
    {
      name: 'Black Box 2026 (1080p Fast Cloud)',
      url: '/api/download/hicine?vcloud=https://vcloud.fit/3i6px3kx0o3xrax&quality=1080p'
    },
    {
      name: 'Invalid vcloud parameter',
      url: '/api/download/hicine?vcloud=invalid-source-url'
    },
    {
      name: 'Missing vcloud parameter',
      url: '/api/download/hicine'
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    console.log(`Testing: ${tc.name}...`);
    const initialProbe = await probeUrl('http://localhost:4173' + tc.url);

    if (tc.name.includes('Invalid') || tc.name.includes('Missing')) {
      // Expect controlled redirect to home or 400
      if (initialProbe.statusCode === 302 || initialProbe.statusCode === 400) {
        console.log(`  ✅ Controlled Response: HTTP ${initialProbe.statusCode}`);
        passed++;
      } else {
        console.log(`  ❌ Unexpected status for invalid input: ${initialProbe.statusCode}`);
        failed++;
      }
      continue;
    }

    if (initialProbe.statusCode !== 302 || !initialProbe.location) {
      console.log(`  ❌ Did not redirect to download stream (HTTP ${initialProbe.statusCode})`);
      failed++;
      continue;
    }

    const redirectUrl = initialProbe.location;
    console.log(`  Redirects to: ${redirectUrl.slice(0, 70)}...`);

    // Probe the final destination
    const targetProbe = await probeUrl(redirectUrl);
    if (targetProbe.statusCode === 200 || targetProbe.statusCode === 206 || targetProbe.statusCode === 302) {
      const ct = (targetProbe.headers && targetProbe.headers['content-type']) || 'unknown';
      const cl = (targetProbe.headers && targetProbe.headers['content-length']) || 'unknown';
      const mb = cl !== 'unknown' ? (parseInt(cl, 10) / (1024 * 1024)).toFixed(1) + ' MB' : 'stream';
      console.log(`  ✅ Target Verified: HTTP ${targetProbe.statusCode} | Type: ${ct} | Size: ${mb}`);
      passed++;
    } else {
      console.log(`  ⚠️ Target returned HTTP ${targetProbe.statusCode || targetProbe.error}`);
      // If target server is third-party stream, record as unverified or fail
      failed++;
    }
  }

  console.log('\n========================================================');
  console.log(`DOWNLOAD QA RESULTS: Passed: ${passed}, Failed: ${failed}`);
  console.log('========================================================\n');
}

runDownloadQA();
