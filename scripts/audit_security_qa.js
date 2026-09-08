const http = require('http');
const fs = require('fs');
const path = require('path');

function probe(url, headers = {}) {
  return new Promise(resolve => {
    const req = http.get(url, { headers, timeout: 4000 }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
    });
    req.on('error', err => resolve({ status: 500, error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 504, error: 'timeout' }); });
  });
}

async function runSecurityQA() {
  console.log('========================================================');
  console.log('AGENT 6 — SECURITY & VULNERABILITY AUDIT');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  // 1. SSRF Tests on /api/image-proxy
  console.log('1. Auditing SSRF Protection on /api/image-proxy...');
  const ssrfVectors = [
    { target: 'http://localhost:4173/api/health', desc: 'Localhost rejection' },
    { target: 'http://127.0.0.1:4173/api/health', desc: 'Loopback IP rejection' },
    { target: 'http://169.254.169.254/latest/meta-data', desc: 'Cloud Metadata IP rejection' },
    { target: 'http://192.168.1.1/admin', desc: 'Private Class C IP rejection' },
    { target: 'http://10.0.0.1/secret', desc: 'Private Class A IP rejection' },
    { target: 'http://172.16.0.1/status', desc: 'Private Class B IP rejection' },
    { target: 'http://attacker-evil-domain.com/steal.png', desc: 'Non-whitelisted domain rejection' },
    { target: 'file:///etc/passwd', desc: 'Local file protocol rejection' },
    { target: 'ftp://ftp.server.com/img.jpg', desc: 'FTP protocol rejection' }
  ];

  for (const v of ssrfVectors) {
    const res = await probe(`http://localhost:4173/api/image-proxy?url=${encodeURIComponent(v.target)}`);
    if (res.status === 403 || res.status === 400) {
      console.log(`  ✅ SSRF Blocked (${v.desc}): HTTP ${res.status}`);
      passed++;
    } else {
      console.log(`  ❌ SSRF VULNERABILITY (${v.desc}): HTTP ${res.status}`);
      failed++;
    }
  }

  // 2. Path Traversal & Raw Database Dump Shield
  console.log('\n2. Auditing Path Traversal & Bulk DB Protection...');
  const traversalVectors = [
    { path: '/data/catalog_summary.json', desc: 'Public catalog summary feed', expect: [200] },
    { path: '/data/dotmobiz_complete_catalog.json', desc: 'Direct internal dotmobiz_complete_catalog.json dump', expect: [403, 404] },
    { path: '/data/dotmobiz_urls.json', desc: 'Direct internal dotmobiz_urls.json dump', expect: [403, 404] },
    { path: '/../../package.json', desc: 'Path traversal upward', expect: [403, 404] },
    { path: '/..%2F..%2Fpackage.json', desc: 'Encoded path traversal upward', expect: [403, 404] }
  ];

  for (const t of traversalVectors) {
    const res = await probe(`http://localhost:4173${t.path}`);
    if (t.expect.includes(res.status)) {
      console.log(`  ✅ Verified (${t.desc}): HTTP ${res.status}`);
      passed++;
    } else {
      console.log(`  ❌ UNEXPECTED RESPONSE (${t.desc}): HTTP ${res.status} (expected ${t.expect.join('/')})`);
      failed++;
    }
  }

  // 3. Client-Side Secrets Leak Scan
  console.log('\n3. Auditing Client-Side Bundles for Leaked Secrets...');
  const frontendDirs = ['js', 'assets'];
  const sensitivePatterns = [
    /hicine_website_secret/i,
    /445f2b5a8941c1d4bd5a869761a916e3/ // Server TMDB key
  ];

  let leaksFound = 0;
  for (const dir of frontendDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') || f.endsWith('.html'));
    for (const f of files) {
      const content = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const pat of sensitivePatterns) {
        if (pat.test(content)) {
          console.log(`  ❌ LEAKED SECRET FOUND in ${dir}/${f}: ${pat}`);
          leaksFound++;
        }
      }
    }
  }

  if (leaksFound === 0) {
    console.log('  ✅ No private credentials, TMDB API keys, or Hicine secrets found in client JS/HTML');
    passed++;
  } else {
    failed++;
  }

  // 4. CORS Headers Audit
  console.log('\n4. Auditing CORS Headers...');
  const corsRes = await probe('http://localhost:4173/api/health', {
    Origin: 'https://evil-hacker.com'
  });
  const allowOrigin = corsRes.headers['access-control-allow-origin'];
  if (allowOrigin !== '*' && allowOrigin !== 'https://evil-hacker.com') {
    console.log(`  ✅ Strict CORS: Access-Control-Allow-Origin = ${allowOrigin || 'RESTRICTED'}`);
    passed++;
  } else {
    console.log(`  ❌ Overly permissive CORS: ${allowOrigin}`);
    failed++;
  }

  console.log('\n========================================================');
  console.log(`SECURITY AUDIT RESULTS: Passed: ${passed}, Failed: ${failed}`);
  console.log('========================================================\n');
}

runSecurityQA();
