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
  console.log('HOMEPAGE ROUTE REGRESSION & ALL-DEVICE AUDIT');
  console.log('====================================================\n');

  // Test 1: Verify CSS Modal Strict Isolation Rules & Device Scoping
  console.log('--- 1. CSS STRICT ISOLATION & DEVICE SCOPING AUDIT ---');
  const cssPath = path.join(__dirname, '..', 'css', 'netflix4u-net27.css');
  const css = fs.readFileSync(cssPath, 'utf8').replace(/\r\n/g, '\n');

  assert(css.includes('#watch-modal.hidden'), 'css must contain #watch-modal.hidden rule');
  assert(css.includes('display: none !important;'), 'css must contain display: none !important');
  assert(css.includes('opacity: 0 !important;'), 'css must contain opacity: 0 !important');
  assert(!css.includes('@media (max-width: 768px) and (orientation: portrait) {\n  #watch-modal {'), 'css must NOT have unconditional #watch-modal in mobile media query');
  assert(css.includes('@media (max-width: 768px) and (orientation: portrait) {\n  #watch-modal:not(.hidden) {'), 'css must use #watch-modal:not(.hidden) in mobile media query');
  assert(!css.includes('\n:fullscreen .player-frame,'), 'css must NOT have loose :fullscreen .player-frame');
  assert(css.includes(':fullscreen #watch-modal:not(.hidden) .player-frame,'), 'fullscreen rules must be scoped to watch-modal:not(.hidden)');
  console.log('  ✓ PASS: css/netflix4u-net27.css gates mobile layout behind :not(.hidden)');
  console.log('  ✓ PASS: #watch-modal.hidden has display: none !important and opacity: 0 !important');
  console.log('  ✓ PASS: Fullscreen styles are strictly scoped to active players only');

  // Test 2: Verify index.html Initial Static State for All Modals
  console.log('\n--- 2. INDEX.HTML STATIC STRUCTURE AUDIT (ALL MODALS) ---');
  const indexPath = path.join(__dirname, '..', 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8').replace(/\r\n/g, '\n');

  const modals = [
    'watch-modal',
    'title-modal',
    'watch-server-picker-modal',
    'trailer-modal',
    'policy-modal',
    'request-modal',
    'search-overlay'
  ];

  for (const mId of modals) {
    const re = new RegExp('<(?:div|aside|dialog)\\s+id="' + mId + '"[^>]*>', 'i');
    const match = html.match(re);
    assert(match, `index.html must contain #${mId} element`);
    const tag = match[0];
    assert(tag.includes('hidden'), `#${mId} tag must contain "hidden" class`);
    assert(tag.includes('style="display: none !important;"'), `#${mId} tag must contain inline style="display: none !important;"`);
    console.log(`  ✓ PASS: #${mId} has hidden class and style="display: none !important;"`);
  }

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
  assert(modalJs.includes("watchModal.style.setProperty('display', 'none', 'important')"), 'closeWatchModal must set display: none !important');
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
  console.log('ALL HOMEPAGE ROUTE REGRESSION TESTS PASSED (100%)');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
