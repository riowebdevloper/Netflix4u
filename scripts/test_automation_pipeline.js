#!/usr/bin/env node
/**
 * Test Automation Pipeline
 * Validates:
 * 1. Lock Acquisition & Release
 * 2. Deduplication & Idempotency
 * 3. Candidate Discovery
 * 4. Homepage Feed Generation
 * 5. Category Rebuild
 * 6. Sitemap Generation
 */

const fs = require('fs');
const path = require('path');
const {
  acquireLock,
  releaseLock,
  rebuildHomeFeed,
  rebuildCategories,
  rebuildSitemap,
  runIngestionPipeline
} = require('../services/ingestionService');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const HOME_FEED_PATH = path.join(DATA_DIR, 'home_feed.json');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const LOCK_FILE_PATH = path.join(DATA_DIR, '.sync.lock');

async function testPipeline() {
  console.log('========================================================');
  console.log('NETFLIX4U AUTOMATION PIPELINE UNIT & INTEGRATION TESTS');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✓ PASSED: ${message}`);
      passed++;
    } else {
      console.error(`✗ FAILED: ${message}`);
      failed++;
    }
  }

  // --- Test 1: Concurrency Lock ---
  console.log('--- Test 1: Concurrency Lock Acquisition & Release ---');
  releaseLock(); // Clean start
  assert(!fs.existsSync(LOCK_FILE_PATH), 'Lock file does not exist initially');

  const lock1 = acquireLock();
  assert(lock1 === true, 'Successfully acquired first lock');
  assert(fs.existsSync(LOCK_FILE_PATH), 'Lock file created on filesystem');

  const lock2 = acquireLock();
  assert(lock2 === false, 'Concurrent acquireLock returns false');

  releaseLock();
  assert(!fs.existsSync(LOCK_FILE_PATH), 'Lock file removed after releaseLock');

  // --- Test 2: Homepage Feed Generation ---
  console.log('\n--- Test 2: Homepage Feed Rebuild ---');
  rebuildHomeFeed();
  assert(fs.existsSync(HOME_FEED_PATH), 'home_feed.json exists after rebuild');
  const feed = JSON.parse(fs.readFileSync(HOME_FEED_PATH, 'utf8'));
  assert(Array.isArray(feed.trending) && feed.trending.length > 0, 'feed.trending contains items');
  assert(Array.isArray(feed.featured) && feed.featured.length > 0, 'feed.featured contains items');
  assert(Array.isArray(feed.popularMovies) && feed.popularMovies.length > 0, 'feed.popularMovies contains items');
  assert(Array.isArray(feed.popularSeries) && feed.popularSeries.length > 0, 'feed.popularSeries contains items');
  assert(Array.isArray(feed.anime), 'feed.anime is an array');
  assert(Array.isArray(feed.kdrama), 'feed.kdrama is an array');
  assert(!!feed.updatedAt, 'feed.updatedAt timestamp is present');

  // Ensure every item in feed has canonicalId
  const allFeedItems = [...feed.trending, ...feed.featured, ...feed.popularMovies, ...feed.popularSeries];
  const missingCanonical = allFeedItems.filter(i => !i.canonicalId && !i.id);
  assert(missingCanonical.length === 0, 'All feed items have canonical identifiers');

  // --- Test 3: Category Files Rebuild ---
  console.log('\n--- Test 3: Category JSON Files Rebuild ---');
  rebuildCategories();
  const catFiles = ['movies.json', 'series.json', 'anime.json', 'kdrama.json', 'trending.json'];
  for (const cf of catFiles) {
    const cfPath = path.join(DATA_DIR, cf);
    assert(fs.existsSync(cfPath), `${cf} exists`);
    const data = JSON.parse(fs.readFileSync(cfPath, 'utf8'));
    assert(Array.isArray(data), `${cf} is an array`);
  }

  // --- Test 4: Sitemap Generation ---
  console.log('\n--- Test 4: Sitemap Generator ---');
  rebuildSitemap();
  assert(fs.existsSync(SITEMAP_PATH), 'sitemap.xml exists');
  const sitemapXml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  assert(sitemapXml.includes('<urlset'), 'sitemap.xml has valid <urlset> root tag');
  assert(sitemapXml.includes('https://netflix4u.in/'), 'sitemap.xml contains homepage');
  assert(sitemapXml.includes('https://netflix4u.in/movies'), 'sitemap.xml contains /movies');
  assert(sitemapXml.includes('https://netflix4u.in/series'), 'sitemap.xml contains /series');

  // --- Test 5: Ingestion Pipeline Idempotency ---
  console.log('\n--- Test 5: Ingestion Pipeline Deduplication & Idempotency ---');
  const res1 = await runIngestionPipeline({ maxDiscovery: 3, concurrency: 2 });
  assert(res1.status === 'SUCCESS', 'Pipeline run 1 succeeded');

  const res2 = await runIngestionPipeline({ maxDiscovery: 3, concurrency: 2 });
  assert(res2.status === 'SUCCESS', 'Pipeline run 2 succeeded');
  assert(res2.metrics.added === 0, 'Run 2 added 0 duplicate items (strict deduplication verified)');

  console.log('\n========================================================');
  console.log(`AUTOMATION PIPELINE RESULTS: ${passed} PASSED, ${failed} FAILED.`);
  console.log('========================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

testPipeline().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
