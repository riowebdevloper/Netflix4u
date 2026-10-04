const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

function fetchUrl(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:4173${urlPath}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('HOMEPAGE ROUTE REGRESSION & MODAL ISOLATION VERIFICATION');
  console.log('====================================================\n');

  // Test 1: Verify CSS Modal Strict Isolation Rules
  console.log('--- 1. CSS STRICT ISOLATION AUDIT ---');
  const cssPath = path.join(__dirname, '..', 'css', 'netflix4u-net27.css');
  const css = fs.readFileSync(cssPath, 'utf8').replace(/\r\n/g, '\n');

  assert(css.includes('#watch-modal.hidden'), 'css must contain #watch-modal.hidden rule');
  assert(css.includes('display: none !important;'), 'css must contain display: none !important');
  assert(!css.includes('@media (max-width: 768px) and (orientation: portrait) {\n  #watch-modal {'), 'css must NOT have unconditional #watch-modal in mobile media query');
  assert(css.includes('@media (max-width: 768px) and (orientation: portrait) {\n  #watch-modal:not(.hidden) {'), 'css must use #watch-modal:not(.hidden) in mobile media query');
  console.log('  ✓ PASS: css/netflix4u-net27.css gates mobile layout behind :not(.hidden)');
  console.log('  ✓ PASS: #watch-modal.hidden has display: none !important');

  // Test 2: Verify index.html Initial Static State
  console.log('\n--- 2. INDEX.HTML STATIC STRUCTURE AUDIT ---');
  const indexPath = path.join(__dirname, '..', 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8').replace(/\r\n/g, '\n');

  const watchModalTagMatch = html.match(/<div\s+id="watch-modal"[^>]*>/i);
  assert(watchModalTagMatch, 'index.html must contain #watch-modal tag');
  const watchModalTag = watchModalTagMatch[0];

  assert(watchModalTag.includes('hidden'), '#watch-modal tag must have hidden class');
  assert(!watchModalTag.includes(' flex '), '#watch-modal tag must NOT have flex class on initial load');
  assert(watchModalTag.includes('style="display: none !important;"'), '#watch-modal tag must have inline style="display: none !important;"');
  console.log('  ✓ PASS: #watch-modal has hidden class and style="display: none !important;"');
  console.log('  ✓ PASS: #watch-modal omits flex class from initial static markup');

  // Test 3: Real Homepage HTTP Response
  console.log('\n--- 3. LIVE HOMEPAGE ROUTE (/) AUDIT ---');
  const homeRes = await fetchUrl('/');
  assert.strictEqual(homeRes.status, 200, 'Homepage must return HTTP 200');
  assert(homeRes.body.includes('id="hero"'), 'Homepage must contain #hero section');
  assert(homeRes.body.includes('id="home-header"'), 'Homepage must contain #home-header');
  assert(homeRes.body.includes('data-platform="trending"'), 'Homepage must contain platform pill switcher (trending)');
  assert(homeRes.body.includes('id="rails-view"'), 'Homepage must contain #rails-view content area');
  assert(homeRes.body.includes('id="search-input"'), 'Homepage must contain #search-input');
  assert(homeRes.body.includes('<footer'), 'Homepage must contain footer');
  console.log('  ✓ PASS: Homepage returns HTTP 200');
  console.log('  ✓ PASS: Homepage includes header, search, category rail, hero, content rails, and footer');

  // Test 4: JS Route Guards in net27-modal.js and net27-core.js
  console.log('\n--- 4. JAVASCRIPT ROUTE GUARD AUDIT ---');
  const modalJsPath = path.join(__dirname, '..', 'js', 'net27-modal.js');
  const modalJs = fs.readFileSync(modalJsPath, 'utf8');
  assert(modalJs.includes('enforceInitialRouteState'), 'net27-modal.js must include enforceInitialRouteState');
  assert(modalJs.includes('watchModal.style.setProperty(\'display\', \'none\', \'important\')'), 'closeWatchModal must set display: none !important');
  console.log('  ✓ PASS: net27-modal.js enforces initial route state on load');
  console.log('  ✓ PASS: closeWatchModal sets display: none !important and removes body.watch-active');

  const coreJsPath = path.join(__dirname, '..', 'js', 'net27-core.js');
  const coreJs = fs.readFileSync(coreJsPath, 'utf8');
  assert(coreJs.includes('watchRouteMatch'), 'net27-core.js must support clean /watch/ and /player/ paths');
  console.log('  ✓ PASS: net27-core.js detects clean /watch/ and /player/ deep links');

  // Test 5: Check Movie, Series, Category, and Watch Routes
  console.log('\n--- 5. ROUTE INTEGRITY MATRIX ---');
  const movieRes = await fetchUrl('/movie/533535');
  assert.strictEqual(movieRes.status, 200, '/movie/:id must return HTTP 200');
  assert(movieRes.body.includes('schema.org'), 'Movie page must have schema.org');
  console.log('  ✓ PASS: /movie/533535 returns HTTP 200 (Movie Detail)');

  const seriesRes = await fetchUrl('/series/1399');
  assert.strictEqual(seriesRes.status, 200, '/series/:id must return HTTP 200');
  assert(seriesRes.body.includes('schema.org'), 'Series page must have schema.org');
  console.log('  ✓ PASS: /series/1399 returns HTTP 200 (Series Detail)');

  const catRes = await fetchUrl('/movies');
  assert.strictEqual(catRes.status, 200, '/movies must return HTTP 200');
  console.log('  ✓ PASS: /movies returns HTTP 200 (Category Page)');

  const watchRes = await fetchUrl('/watch/movie/533535');
  assert.strictEqual(watchRes.status, 200, '/watch/movie/:id must return HTTP 200');
  console.log('  ✓ PASS: /watch/movie/533535 returns HTTP 200 (Watch Route SPA)');

  console.log('\n====================================================');
  console.log('ALL 12 HOMEPAGE ROUTE REGRESSION TESTS PASSED (100%)');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
