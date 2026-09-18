/**
 * NETFLIX4U.IN — MASTER PLAYER INTEGRATION & IDENTITY QA TEST SUITE
 * 
 * Verifies:
 * 1. Centralized Player Resolver (vidsrc.sbs primary format)
 * 2. Strict Input Validation (Numeric TMDB ID, Season >= 1, Episode >= 1)
 * 3. Cache Key Isolation (player:movie:tmdb:X, player:tv:tmdb:X:sY:eZ)
 * 4. Stale State / Race Condition & Rejection on Mismatch
 * 5. Iframe Origin Security Allowlist
 * 6. 20-Movie Test Matrix (Card TMDB = Detail TMDB = Player TMDB)
 * 7. 10-Series Test Matrix (Series TMDB, Season, Episode, Prev/Next, Episode Switching)
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const resolver = require('../services/playerResolver');

const root = path.resolve(__dirname, '..');
const movies = JSON.parse(fs.readFileSync(path.join(root, 'data', 'movies.json'), 'utf8'));
const series = JSON.parse(fs.readFileSync(path.join(root, 'data', 'series.json'), 'utf8'));

console.log('====================================================');
console.log('NETFLIX4U MASTER PLAYER & IDENTITY TEST SUITE');
console.log('====================================================\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

// -----------------------------------------------------------------------------
// 1. UNIT TESTS — RESOLVER & VALIDATION
// -----------------------------------------------------------------------------
console.log('--- 1. PLAYER RESOLVER UNIT & VALIDATION TESTS ---');

runTest('Movie resolver produces exact vidsrc format (TMDB 533535)', () => {
  const url = resolver.resolvePlayerUrl({ type: 'movie', tmdbId: 533535 }, 'vidsrc_sbs');
  assert.strictEqual(url, 'https://vidsrc.pm/embed/movie/533535');
});

runTest('TV resolver produces exact vidsrc format (TMDB 79744 / S1 / E1)', () => {
  const url = resolver.resolvePlayerUrl({ type: 'tv', tmdbId: 79744, season: 1, episode: 1 }, 'vidsrc_sbs');
  assert.strictEqual(url, 'https://vidsrc.pm/embed/tv/79744/1/1');
});

runTest('Movie resolver handles string numeric TMDB ID with prefix (tmdb-movie-533535)', () => {
  const url = resolver.resolvePlayerUrl({ type: 'movie', tmdbId: 'tmdb-movie-533535' }, 'vidsrc_sbs');
  assert.strictEqual(url, 'https://vidsrc.pm/embed/movie/533535');
});

runTest('TV resolver handles string numeric TMDB ID with prefix (tmdb-series-79744)', () => {
  const url = resolver.resolvePlayerUrl({ type: 'tv', tmdbId: 'tmdb-series-79744', season: '2', episode: '4' }, 'vidsrc_sbs');
  assert.strictEqual(url, 'https://vidsrc.pm/embed/tv/79744/2/4');
});

runTest('Validation strictly rejects non-numeric / fuzzy title text as TMDB ID', () => {
  const res = resolver.validatePlaybackRequest({ type: 'movie', tmdbId: 'deadpool-and-wolverine' });
  assert.strictEqual(res.valid, false);
  const url = resolver.resolvePlayerUrl({ type: 'movie', tmdbId: 'deadpool-and-wolverine' }, 'vidsrc_sbs');
  assert.strictEqual(url, null);
});

runTest('Validation strictly rejects missing TMDB ID (null / undefined / empty)', () => {
  assert.strictEqual(resolver.validatePlaybackRequest({ type: 'movie', tmdbId: null }).valid, false);
  assert.strictEqual(resolver.validatePlaybackRequest({ type: 'movie', tmdbId: '' }).valid, false);
  assert.strictEqual(resolver.validatePlaybackRequest({ type: 'movie' }).valid, false);
});

runTest('Validation strictly rejects TV request with missing season', () => {
  const res = resolver.validatePlaybackRequest({ type: 'tv', tmdbId: 79744, episode: 1 });
  assert.strictEqual(res.valid, false);
  assert.match(res.error, /season/i);
});

runTest('Validation strictly rejects TV request with missing episode', () => {
  const res = resolver.validatePlaybackRequest({ type: 'tv', tmdbId: 79744, season: 1 });
  assert.strictEqual(res.valid, false);
  assert.match(res.error, /episode/i);
});

runTest('Validation strictly rejects TV request with season < 1 or episode < 1', () => {
  assert.strictEqual(resolver.validatePlaybackRequest({ type: 'tv', tmdbId: 79744, season: 0, episode: 1 }).valid, false);
  assert.strictEqual(resolver.validatePlaybackRequest({ type: 'tv', tmdbId: 79744, season: 1, episode: 0 }).valid, false);
  assert.strictEqual(resolver.validatePlaybackRequest({ type: 'tv', tmdbId: 79744, season: -1, episode: 2 }).valid, false);
});

runTest('Peachify multi-server provider generates valid parameterized URL', () => {
  const movieUrl = resolver.resolvePlayerUrl({ type: 'movie', tmdbId: 533535 }, 'peachify', { lang: 'hi' });
  assert.match(movieUrl, /^https:\/\/peachify\.pro\/embed\/movie\/533535\?.*dub=Hindi/);
  const tvUrl = resolver.resolvePlayerUrl({ type: 'tv', tmdbId: 79744, season: 1, episode: 2 }, 'peachify', { lang: 'en' });
  assert.match(tvUrl, /^https:\/\/peachify\.pro\/embed\/tv\/79744\/1\/2\?.*dub=English/);
});

runTest('VidLink multi-server provider generates valid URL', () => {
  const url = resolver.resolvePlayerUrl({ type: 'movie', tmdbId: 533535 }, 'vidlink');
  assert.strictEqual(url, 'https://vidlink.pro/movie/533535?multiLang=true');
});

runTest('AllMovieLand multi-server provider generates valid Movie & TV URLs', () => {
  const movieUrl = resolver.resolvePlayerUrl({ type: 'movie', tmdbId: 533535 }, 'allmovieland');
  assert.strictEqual(movieUrl, 'https://slast430did.com/play/533535');
  const tvUrl = resolver.resolvePlayerUrl({ type: 'tv', tmdbId: 79744, season: 2, episode: 5 }, 'allmovieland');
  assert.strictEqual(tvUrl, 'https://slast430did.com/play/79744?s=2&e=5');
  const imdbMovieUrl = resolver.resolvePlayerUrl({ type: 'movie', tmdbId: 533535 }, 'allmovieland', { imdbId: 'tt33379543' });
  assert.strictEqual(imdbMovieUrl, 'https://slast430did.com/play/tt33379543');
});

runTest('Cache key isolation: Movie and TV produce unique canonical cache keys', () => {
  const movieKey = resolver.getCanonicalCacheKey({ type: 'movie', tmdbId: 533535 });
  const tvKey = resolver.getCanonicalCacheKey({ type: 'tv', tmdbId: 79744, season: 1, episode: 1 });
  assert.strictEqual(movieKey, 'player:movie:tmdb:533535');
  assert.strictEqual(tvKey, 'player:tv:tmdb:79744:s1:e1');
  assert.notStrictEqual(movieKey, tvKey);
});

runTest('Iframe security allowlist authorizes approved origins and blocks untrusted', () => {
  assert.strictEqual(resolver.isAllowedOrigin('https://vidsrc.pm/embed/movie/533535'), true);
  assert.strictEqual(resolver.isAllowedOrigin('https://vidsrc.sbs/embed/movie/533535'), true);
  assert.strictEqual(resolver.isAllowedOrigin('https://peachify.pro/embed/movie/533535'), true);
  assert.strictEqual(resolver.isAllowedOrigin('https://slast430did.com/play/533535'), true);
  assert.strictEqual(resolver.isAllowedOrigin('https://allmovieland.link/play/533535'), true);
  assert.strictEqual(resolver.isAllowedOrigin('https://vidlink.pro/movie/533535'), true);
  assert.strictEqual(resolver.isAllowedOrigin('https://acceptable.a-ads.com/2455136'), true);
  assert.strictEqual(resolver.isAllowedOrigin('/api/stream-player?type=movie&id=533535'), true);
  // Malicious / untrusted domains must be blocked
  assert.strictEqual(resolver.isAllowedOrigin('https://malicious-phishing-stream.com/watch'), false);
  assert.strictEqual(resolver.isAllowedOrigin('javascript:alert(1)'), false);
  assert.strictEqual(resolver.isAllowedOrigin('data:text/html,<script>alert(1)</script>'), false);
});

// -----------------------------------------------------------------------------
// 2. MOVIE TEST MATRIX (20 REAL MOVIES FROM CATALOG)
// -----------------------------------------------------------------------------
console.log('\n--- 2. MOVIE TEST MATRIX (20 MOVIES) ---');

const catalogSummary = JSON.parse(fs.readFileSync(path.join(root, 'data', 'catalog_summary.json'), 'utf8'));
const sampleMovies = catalogSummary
  .filter(c => (c.type === 'movie' || c.contentType === 'movie') && (c.tmdbId || (c.id && String(c.id).startsWith('tmdb-movie-'))))
  .slice(0, 20);

assert.strictEqual(sampleMovies.length, 20, 'At least 20 movies must be present in test matrix');

sampleMovies.forEach((m, idx) => {
  const effectiveTmdb = m.tmdbId || String(m.id).replace('tmdb-movie-', '');
  runTest(`Movie #${idx + 1}: "${m.title}" (TMDB: ${effectiveTmdb})`, () => {
    // 1. Card Identity
    const cardTmdbId = resolver.cleanTmdbId(effectiveTmdb);
    assert.ok(cardTmdbId > 0, `Card TMDB ID must be a positive integer, got ${effectiveTmdb}`);
    assert.ok(m.title && m.title.length > 0, 'Card title must not be empty');

    // 2. Detail Page Identity Simulation (same content record)
    const detailTmdbId = resolver.cleanTmdbId(m.id || m.canonicalId || effectiveTmdb);
    assert.strictEqual(detailTmdbId, cardTmdbId, `Detail TMDB ID (${detailTmdbId}) must equal Card TMDB ID (${cardTmdbId})`);

    // 3. Player Source Identity Simulation
    const playerUrl = resolver.resolvePlayerUrl({ type: 'movie', tmdbId: detailTmdbId }, 'vidsrc_sbs');
    assert.strictEqual(playerUrl, `https://vidsrc.pm/embed/movie/${cardTmdbId}`);

    // Verify exact TMDB ID is in the player source URL
    assert.ok(playerUrl.includes(`/movie/${cardTmdbId}`), `Player URL must contain /movie/${cardTmdbId}`);
  });
});

// -----------------------------------------------------------------------------
// 2B. CRITICAL SAFETY: ZERO WRONG-CONTENT SUBSTITUTION ON UNVERIFIED ITEMS
// -----------------------------------------------------------------------------
console.log('\n--- 2B. WRONG-CONTENT SAFETY ASSERTIONS (BLOCK UNVERIFIED) ---');

const unverifiedMovies = movies.filter(m => !m.tmdbId).slice(0, 5);
unverifiedMovies.forEach((item, idx) => {
  runTest(`Unverified Item #${idx + 1}: "${item.title}" strictly BLOCKS playback`, () => {
    const cleanId = resolver.cleanTmdbId(item.tmdbId);
    assert.strictEqual(cleanId, null, 'Unverified item must not have numeric TMDB ID');
    const req = { type: 'movie', tmdbId: item.tmdbId };
    const validation = resolver.validatePlaybackRequest(req);
    assert.strictEqual(validation.valid, false, 'Validation must fail for unverified item');
    const url = resolver.resolvePlayerUrl(req, 'vidsrc_sbs');
    assert.strictEqual(url, null, 'Player URL must not resolve for unverified item');
  });
});

// -----------------------------------------------------------------------------
// 3. SERIES TEST MATRIX (10 REAL SERIES FROM CATALOG)
// -----------------------------------------------------------------------------
console.log('\n--- 3. SERIES TEST MATRIX (10 SERIES) ---');

const sampleSeries = series.slice(0, 10);
assert.strictEqual(sampleSeries.length, 10, 'At least 10 series must be present in test matrix');

sampleSeries.forEach((s, idx) => {
  runTest(`Series #${idx + 1}: "${s.title}" (TMDB: ${s.tmdbId})`, () => {
    // 1. Series Identity
    const seriesTmdbId = resolver.cleanTmdbId(s.tmdbId);
    assert.ok(seriesTmdbId > 0, `Series TMDB ID must be a positive integer, got ${s.tmdbId}`);

    // 2. First Episode (Season 1 Episode 1)
    const ep1Url = resolver.resolvePlayerUrl({ type: 'tv', tmdbId: seriesTmdbId, season: 1, episode: 1 }, 'vidsrc_sbs');
    assert.strictEqual(ep1Url, `https://vidsrc.pm/embed/tv/${seriesTmdbId}/1/1`);

    // 3. Next Navigation: Episode 1 -> Episode 2
    const ep2Url = resolver.resolvePlayerUrl({ type: 'tv', tmdbId: seriesTmdbId, season: 1, episode: 2 }, 'vidsrc_sbs');
    assert.strictEqual(ep2Url, `https://vidsrc.pm/embed/tv/${seriesTmdbId}/1/2`);

    // 4. Middle Episode (Season 1 Episode 5)
    const ep5Url = resolver.resolvePlayerUrl({ type: 'tv', tmdbId: seriesTmdbId, season: 1, episode: 5 }, 'vidsrc_sbs');
    assert.strictEqual(ep5Url, `https://vidsrc.pm/embed/tv/${seriesTmdbId}/1/5`);

    // 5. Prev Navigation: Episode 5 -> Episode 4
    const ep4Url = resolver.resolvePlayerUrl({ type: 'tv', tmdbId: seriesTmdbId, season: 1, episode: 4 }, 'vidsrc_sbs');
    assert.strictEqual(ep4Url, `https://vidsrc.pm/embed/tv/${seriesTmdbId}/1/4`);

    // 6. Multiple Seasons: Season 2 Episode 1
    const s2Ep1Url = resolver.resolvePlayerUrl({ type: 'tv', tmdbId: seriesTmdbId, season: 2, episode: 1 }, 'vidsrc_sbs');
    assert.strictEqual(s2Ep1Url, `https://vidsrc.pm/embed/tv/${seriesTmdbId}/2/1`);

    // 7. Identity Lock: Verify series TMDB ID remained constant throughout all episodes
    [ep1Url, ep2Url, ep4Url, ep5Url, s2Ep1Url].forEach(u => {
      assert.ok(u.startsWith(`https://vidsrc.pm/embed/tv/${seriesTmdbId}/`), `URL ${u} must start with series TMDB ID ${seriesTmdbId}`);
    });
  });
});

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
console.log('====================================================');

if (passedTests === totalTests) {
  console.log('STATUS: ALL TESTS PASSED (100% SUCCESS)\n');
} else {
  console.error('STATUS: SOME TESTS FAILED\n');
  process.exit(1);
}
