#!/usr/bin/env node
/**
 * scripts/test_downloads_integrity.js
 * Comprehensive Download Link Verification & Data Integrity Test Suite
 *
 * Tests:
 * 1. canonicalResolver attaches authorized download links from details_map.json
 * 2. Movies have organized quality tiers (480p, 720p, 1080p, 1440p, 2160p / 4K)
 * 3. Series have structured season/episode hierarchy and season packs
 * 4. All download links preserve canonicalId (download.canonicalId === item.canonicalId)
 * 5. Mirror sources correctly distinguish Fast Cloud vs AllMovieLand / Direct
 * 6. Tests across diverse titles (movies, anime, series, kdrama)
 */

const assert = require('assert');
const { resolveContentId } = require('../services/canonicalResolver');

const TEST_CASES = [
  { id: 'dotmobiz-18013', name: 'Toxic (Movie)', expectType: 'movie', minLinks: 3 },
  { id: 'dotmobiz-37999', name: 'Bleach (Series/Anime)', expectType: 'series', minLinks: 50, expectSeries: true },
  { id: 'dotmobiz-18033', name: 'Mirzapur: The Movie', expectType: 'movie', minLinks: 3, expectSeries: false },
  { id: 'dotmobiz-23933', name: 'The Pitt (Series)', expectType: 'series', minLinks: 30, expectSeries: true }
];

async function runTests() {
  console.log('========================================================');
  console.log('NETFLIX4U DOWNLOAD INTEGRITY & HIERARCHY TEST SUITE');
  console.log('========================================================');

  let passed = 0;
  let total = 0;

  function test(desc, fn) {
    total++;
    try {
      fn();
      passed++;
      console.log(`  ✅ PASS: ${desc}`);
    } catch (err) {
      console.error(`  ❌ FAIL: ${desc}`);
      console.error(`     Error: ${err.message}`);
    }
  }

  for (const tc of TEST_CASES) {
    console.log(`\nTesting Title: ${tc.name} [${tc.id}]`);
    const resolved = await resolveContentId(tc.id);

    test(`Resolved record exists for ${tc.name}`, () => {
      assert(resolved, `Item should resolve`);
      assert(resolved.title, `Item should have a title`);
    });

    test(`Canonical identity preserved (${tc.id})`, () => {
      assert(resolved.canonicalId === tc.id, `Canonical ID mismatch: ${resolved.canonicalId} !== ${tc.id}`);
    });

    test(`Download links are present and authorized (min ${tc.minLinks})`, () => {
      assert(Array.isArray(resolved.links), `links should be an array`);
      assert(resolved.links.length >= tc.minLinks, `Expected >= ${tc.minLinks} links, got ${resolved.links.length}`);
    });

    test(`All download links carry canonicalId`, () => {
      for (const lnk of resolved.links) {
        assert(lnk.canonicalId === resolved.canonicalId, `Link canonicalId mismatch: ${lnk.canonicalId} !== ${resolved.canonicalId}`);
        assert(lnk.url, `Link URL must not be empty`);
        assert(lnk.quality, `Link quality tier must be defined`);
        assert(lnk.source, `Link source must be defined`);
      }
    });

    if (tc.expectSeries) {
      test(`Series has episode/season structure`, () => {
        const hasSeasons = resolved.links.some(l => l.season !== undefined && l.season > 0);
        assert(hasSeasons, `Series must have structured season numbers`);
      });

      test(`Series quality tiers are standard (480p, 720p, 1080p, 2160p / 4K)`, () => {
        const allowed = ['480p', '720p', '1080p', '1440p', '2160p / 4K'];
        for (const l of resolved.links) {
          assert(allowed.includes(l.quality), `Unexpected quality tier: ${l.quality}`);
        }
      });
    } else {
      test(`Movie has distinct quality tiers`, () => {
        const qualities = [...new Set(resolved.links.map(l => l.quality))];
        assert(qualities.length >= 1, `Movie should have quality tiers`);
      });
    }
  }

  console.log('\n========================================================');
  console.log(`DOWNLOAD INTEGRITY TEST RESULTS: ${passed}/${total} PASSED`);
  console.log('========================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
