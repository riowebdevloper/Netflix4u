/**
 * Verification Script: Hicine Downloads + AllMovieLand Streaming Fix
 */
const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');

const {
  isHicineDownloadUrl,
  resolveCloudDownloadUrl,
  handleUniversalApi
} = require('../services/apiCore');
const {
  getAllmovielandCacheKey,
  getProvider
} = require('../services/playerResolver');

console.log('====================================================');
console.log('NETFLIX4U HICINE & ALLMOVIELAND INTEGRATION TEST');
console.log('====================================================');

async function run() {
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    ${err.message}`);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    ${err.message}`);
    }
  }

  console.log('\n--- PART A: HICINE DOWNLOAD VERIFICATION ---');

  test('isHicineDownloadUrl accepts authorized Hicine domains', () => {
    assert.strictEqual(isHicineDownloadUrl('https://vcloud.fit/h16lblcs3ziwlnw'), true);
    assert.strictEqual(isHicineDownloadUrl('https://wild-sun-9376.oriue.workers.dev/?vcloud=https://vcloud.fit/abc'), true);
    assert.strictEqual(isHicineDownloadUrl('https://crimson-sea-a1e5.hekoy.workers.dev/?vcloud=https://vcloud.fit/abc'), true);
    assert.strictEqual(isHicineDownloadUrl('https://pub-182393379e2e4b728d4fe7323e6953d0.r2.dev/file.mkv'), true);
    assert.strictEqual(isHicineDownloadUrl('https://api.hicine.sbs/download/123'), true);
  });

  test('isHicineDownloadUrl strictly rejects non-Hicine hosts and fake fallbacks', () => {
    assert.strictEqual(isHicineDownloadUrl('https://dotmobiz.com/movie/123'), false);
    assert.strictEqual(isHicineDownloadUrl('https://nexdrive.love/download/123'), false);
    assert.strictEqual(isHicineDownloadUrl('https://allmovieland.link/movie/123'), false);
    assert.strictEqual(isHicineDownloadUrl('https://vidsrc.sbs/embed/movie/123'), false);
    assert.strictEqual(isHicineDownloadUrl('https://randomhost.com/video.mp4'), false);
    assert.strictEqual(isHicineDownloadUrl('javascript:alert(1)'), false);
    assert.strictEqual(isHicineDownloadUrl(''), false);
  });

  await asyncTest('Live Hicine resolution resolves to direct Cloudflare R2 file', async () => {
    const res = await resolveCloudDownloadUrl('https://vcloud.fit/h16lblcs3ziwlnw');
    assert.ok(res, 'Resolution result must not be null');
    assert.strictEqual(res.ok, true, 'Resolution ok must be true');
    assert.ok(res.directUrl, 'directUrl must exist');
    assert.match(res.directUrl, /https:\/\/pub-[a-f0-9]+\.r2\.dev\//i, 'Must resolve to Cloudflare R2 direct stream');
  });

  await asyncTest('Unavailable Hicine download returns controlled unavailable JSON', async () => {
    // Spin up lightweight mock server on handleUniversalApi
    const server = http.createServer(handleUniversalApi);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;

    try {
      const resp = await fetch(`http://localhost:${port}/api/download-file?title=NonExistentMovie999999&id=999999999&json=1`);
      assert.strictEqual(resp.status, 200);
      const data = await resp.json();
      assert.strictEqual(data.ok, false);
      assert.strictEqual(data.directUrl, '');
      assert.strictEqual(data.message, 'Download currently unavailable.');
    } finally {
      server.close();
    }
  });

  await asyncTest('Unavailable Hicine download returns controlled HTML page without player mirrors', async () => {
    const server = http.createServer(handleUniversalApi);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;

    try {
      const resp = await fetch(`http://localhost:${port}/api/download-file?title=NonExistentMovie999999&id=999999999`);
      assert.strictEqual(resp.status, 200);
      const html = await resp.text();
      assert.match(html, /Download Currently Unavailable/i);
      assert.doesNotMatch(html, /allmovieland\.link/i, 'Must NOT contain AllMovieLand embed mirror');
      assert.doesNotMatch(html, /vidsrc\.sbs/i, 'Must NOT contain VidSrc embed mirror');
      assert.doesNotMatch(html, /Direct Stream Mirror 1/i);
      assert.match(html, /Watch Online \(Player\)/i);
    } finally {
      server.close();
    }
  });

  test('net27-modal.js has no dotmoviesSectionHtml or synthetic Dotmovies links', () => {
    const modalCode = fs.readFileSync(path.join(__dirname, '../js/net27-modal.js'), 'utf8');
    assert.doesNotMatch(modalCode, /dotmoviesSectionHtml/);
    assert.doesNotMatch(modalCode, /Direct Ultra HD \(Dotmovies\)/);
    assert.doesNotMatch(modalCode, /ad-slot-modal-dotmovies/);
  });

  console.log('\n--- PART B: ALLMOVIELAND INTEGRATION VERIFICATION ---');

  test('AllMovieLand adapter is disabled in registry with offline notes', () => {
    const aml = getProvider('allmovieland');
    assert.ok(aml, 'AllMovieLand adapter must exist in registry');
    assert.strictEqual(aml.enabled, false, 'AllMovieLand must be marked enabled: false');
    assert.match(aml.notes, /DISABLED \/ INCOMPATIBLE/i);
  });

  test('AllMovieLand cache keys are strictly isolated (Section B11)', () => {
    const movieKey = getAllmovielandCacheKey({ type: 'movie', id: '533535' });
    assert.strictEqual(movieKey, 'allmovieland:movie:533535');

    const tvKey = getAllmovielandCacheKey({ type: 'tv', id: '79744', season: 2, episode: 5 });
    assert.strictEqual(tvKey, 'allmovieland:tv:79744:s2:e5');
  });

  await asyncTest('Stream player serves controlled Netflix4U error UX for AllMovieLand', async () => {
    const server = http.createServer(handleUniversalApi);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;

    try {
      const resp = await fetch(`http://localhost:${port}/api/stream-player?type=movie&id=533535&server=allmovieland`);
      assert.strictEqual(resp.status, 200);
      const html = await resp.text();

      // Ensure controlled UX container exists
      assert.match(html, /id="layer-allmovieland"/);
      assert.match(html, /Streaming source unavailable on this server/);
      assert.match(html, /AllMovieLand returned &quot;File Not Found&quot;/);

      // Ensure no raw cross-origin iframe for AllMovieLand that produces 404/403
      assert.doesNotMatch(html, /<iframe id="iframe-allmovieland"/);

      // Ensure server pill reflects status
      assert.match(html, /⚠️ AllMovieLand \(Unavailable\)/);
    } finally {
      server.close();
    }
  });

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} / ${total} TESTS PASSED`);
  console.log('====================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
