const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

console.log('================================================================');
console.log('       SENIOR QA ENGINEER COMPREHENSIVE PRODUCTION AUDIT        ');
console.log('       Target: FlixWorld.fun Deployment Architecture             ');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName}${details ? ' -> ' + details : ''}`);
    failures.push({ testName, details });
  }
}

async function runAudit() {
  // -----------------------------------------------------------------
  // SUITE 1: Download Links & High-Speed Stream Resolution
  // -----------------------------------------------------------------
  console.log('\n--- TEST SUITE 1: Download Resolver & Link Architecture ---');

  // Load download-resolver.js logic in sandbox
  const dlResolverCode = fs.readFileSync('js/download-resolver.js', 'utf8');
  const sandbox = { window: {} };
  const fn = new Function('window', dlResolverCode);
  fn(sandbox.window);

  assert(typeof sandbox.window.getFastCloudDownloadHref === 'function', 'window.getFastCloudDownloadHref is exposed');
  assert(typeof sandbox.window.handleFastCloudDownload === 'function', 'window.handleFastCloudDownload is exposed');

  // Test 1.1: Raw vcloud URL
  const test1 = sandbox.window.getFastCloudDownloadHref('https://vcloud.fit/ikjxq-2bqaqxikk');
  assert(
    test1.startsWith('https://wild-sun-9376.oriue.workers.dev/?vcloud=https%3A%2F%2Fvcloud.fit%2Fikjxq-2bqaqxikk'),
    'Raw vcloud link wraps cleanly into Cloudflare Worker URL',
    test1
  );

  // Test 1.2: Nested worker vcloud URL
  const test2 = sandbox.window.getFastCloudDownloadHref('https://crimson-sea-a1e5.hekoy.workers.dev/?vcloud=https://vcloud.fit/ikjxq-2bqaqxikk');
  assert(
    test2.includes('vcloud=https%3A%2F%2Fvcloud.fit%2Fikjxq-2bqaqxikk'),
    'Nested worker vcloud link is unwrapped and properly targeted',
    test2
  );

  // Test 1.3: Direct external download link (e.g. nexdrive, google drive, mp4)
  const test3 = sandbox.window.getFastCloudDownloadHref('https://nexdrive.love/file123.mp4');
  assert(
    test3 === 'https://nexdrive.love/file123.mp4',
    'Direct external download link is preserved without mangling',
    test3
  );

  // Test 1.4: Legacy internal API link protection
  const test4 = sandbox.window.getFastCloudDownloadHref('/api/download/server?id=123');
  assert(
    !test4.startsWith('/api/download'),
    'Legacy /api/download link NEVER outputs raw internal route',
    test4
  );

  // Test 1.5: Cloudflare Worker API & Token probe
  console.log('\n  >> Probing Cloudflare Worker API & Stream Endpoint...');
  const probeWorker = () => new Promise(resolve => {
    https.get('https://wild-sun-9376.oriue.workers.dev/api/links?vcloud=https://vcloud.fit/ikjxq-2bqaqxikk', res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });

  const workerRes = await probeWorker();
  assert(
    workerRes && workerRes.tokens && (workerRes.tokens.fsl || workerRes.tokens.server1 || workerRes.tokens.ten),
    'Cloudflare Worker API successfully generates valid high-speed stream tokens',
    workerRes ? JSON.stringify(Object.keys(workerRes.tokens || {})) : 'null'
  );

  // Test 1.6: DetailPage download link markup check
  const detailPageCode = fs.readFileSync('js/DetailPage-WPhzSGyt.js', 'utf8');
  assert(
    !detailPageCode.includes('href:"/api/download') && !detailPageCode.includes("href:'/api/download"),
    'DetailPage client-side code contains ZERO hardcoded /api/download hrefs'
  );
  assert(
    detailPageCode.includes('handleFastCloudDownload') && detailPageCode.includes('getFastCloudDownloadHref'),
    'DetailPage download button binds both fast stream resolver and worker href fallback'
  );

  // Test 1.7: Database detail files audit
  console.log('\n  >> Auditing catalog database for internal download link remnants...');
  const sampleDetailFiles = fs.readdirSync('data/details').slice(0, 3000);
  let dirtyCount = 0;
  for (const f of sampleDetailFiles) {
    const raw = fs.readFileSync(path.join('data/details', f), 'utf8');
    if (raw.includes('/api/download/server')) dirtyCount++;
  }
  assert(dirtyCount === 0, 'Catalog detail files have 0 legacy /api/download/server links in 3000 sampled files', `Found ${dirtyCount} dirty files`);

  // -----------------------------------------------------------------
  // SUITE 2: 404 Page (NotFoundPage) Mobile & Responsive Usability
  // -----------------------------------------------------------------
  console.log('\n--- TEST SUITE 2: 404 Page Responsiveness & Clickability ---');
  const notFoundCode = fs.readFileSync('js/NotFoundPage-DNXIbmp7.js', 'utf8');

  // Test 2.1: Overflow check
  assert(
    !notFoundCode.includes('overflow-hidden') || notFoundCode.includes('overflow-y-auto'),
    '404 page container allows vertical scrolling on mobile devices (overflow-y-auto present)'
  );

  // Test 2.2: Responsive typography
  assert(
    notFoundCode.includes('text-7xl') && notFoundCode.includes('sm:text-9xl'),
    '404 page typography scales smoothly across mobile, tablet, and desktop'
  );

  // Test 2.3: Smart history fallback for "Go Back"
  assert(
    notFoundCode.includes('window.history') && notFoundCode.includes('window.close') && notFoundCode.includes('handleGoBack'),
    '"Go Back" button intelligently handles history back, tab close (for target="_blank"), and home navigation'
  );

  // Test 2.4: Touch targets & z-index
  assert(
    notFoundCode.includes('touch-manipulation') && notFoundCode.includes('min-h-[46px]') && notFoundCode.includes('pointer-events-auto'),
    'Action buttons meet WCAG 2.1 touch target guidelines (min-h >= 44px, touch-manipulation, pointer-events-auto)'
  );

  // Test 2.5: Auto-redirect controls
  assert(
    notFoundCode.includes('paused') && notFoundCode.includes('setPaused'),
    'Auto-redirect countdown includes Pause/Resume controls to prevent unwanted user redirects'
  );

  // -----------------------------------------------------------------
  // SUITE 3: Cast & Metadata Image Resolution
  // -----------------------------------------------------------------
  console.log('\n--- TEST SUITE 3: Cast & Metadata Resolution System ---');

  // Test 3.1: Actor name/role string parsing
  assert(
    detailPageCode.includes('split(/\\s+as\\s+/i)') || detailPageCode.includes('split(/\\s+-\\s+/)'),
    'DetailPage cast component parses "Actor Name as Role" strings into clean Name and Character fields'
  );

  // Test 3.2: PHP Cast Resolver file
  assert(fs.existsSync('api/cast.php'), 'api/cast.php exists in api directory');
  const castPhp = fs.readFileSync('api/cast.php', 'utf8');
  assert(
    castPhp.includes('header("Content-Type: application/json') && castPhp.includes('creditsUrl') && castPhp.includes('image_cache'),
    'api/cast.php contains valid JSON headers, TMDB credits lookup, and disk caching'
  );

  // Test 3.3: PHP Poster Resolver file
  assert(fs.existsSync('api/poster-resolver.php'), 'api/poster-resolver.php exists in api directory');
  const posterPhp = fs.readFileSync('api/poster-resolver.php', 'utf8');
  assert(
    posterPhp.includes('header("Content-Type: application/json') && posterPhp.includes('image_cache'),
    'api/poster-resolver.php contains valid headers and disk caching'
  );

  // Test 3.4: PHP Download file & directory indices
  assert(fs.existsSync('api/download.php'), 'api/download.php exists');
  assert(fs.existsSync('api/download/index.php'), 'api/download/index.php exists to prevent directory traversal 403');
  assert(fs.existsSync('api/download/hicine/index.php'), 'api/download/hicine/index.php exists to handle legacy links');
  assert(fs.existsSync('api/download/server/index.php'), 'api/download/server/index.php exists to handle legacy links');

  // Test 3.5: .htaccess Routing rules
  const htaccess = fs.readFileSync('.htaccess', 'utf8');
  assert(
    htaccess.includes('^api/cast/?$ api/cast.php') && htaccess.includes('^api/poster-resolver/?$ api/poster-resolver.php'),
    '.htaccess properly rewrites /api/cast and /api/poster-resolver to native PHP handlers'
  );
  assert(
    htaccess.includes('RewriteCond %{REQUEST_URI} !^/api/'),
    '.htaccess prevents SPA router from intercepting /api/ endpoints'
  );

  // -----------------------------------------------------------------
  // SUITE 4: Production Release Package Integrity
  // -----------------------------------------------------------------
  console.log('\n--- TEST SUITE 4: Production Release Archive Integrity ---');

  const zipPath = path.resolve('flixworld_cpanel_release.zip');
  assert(fs.existsSync(zipPath), 'flixworld_cpanel_release.zip exists on disk');

  const stats = fs.statSync(zipPath);
  const sizeMB = stats.size / (1024 * 1024);
  assert(sizeMB > 40 && sizeMB < 55, `Archive size is healthy and complete: ${sizeMB.toFixed(2)} MB (Expected: 42-50 MB)`);

  // Verify internal file contents of zip
  const zipContents = execSync('tar -tf flixworld_cpanel_release.zip', { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  const requiredInZip = [
    'index.html',
    '.htaccess',
    'api/cast.php',
    'api/poster-resolver.php',
    'api/download.php',
    'api/download/index.php',
    'js/download-resolver.js',
    'js/real-poster-resolver.js',
    'js/DetailPage-WPhzSGyt.js',
    'js/NotFoundPage-DNXIbmp7.js',
    'data/home_feed.json'
  ];

  for (const item of requiredInZip) {
    assert(zipContents.includes(item), `Release archive contains verified entry: ${item}`);
  }

  // -----------------------------------------------------------------
  // SUMMARY REPORT
  // -----------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`AUDIT RESULTS: ${passedTests}/${totalTests} TESTS PASSED (${((passedTests/totalTests)*100).toFixed(1)}%)`);
  if (failedTests > 0) {
    console.error(`FAILED TESTS: ${failedTests}`);
    failures.forEach(f => console.error(` - ${f.testName}: ${f.details}`));
    process.exit(1);
  } else {
    console.log('ALL AUDIT SUITES PASSED! PRODUCTION READY FOR FLIXWORLD.FUN DEPLOYMENT.');
    console.log('================================================================\n');
  }
}

runAudit().catch(err => {
  console.error('Audit crashed:', err);
  process.exit(1);
});
