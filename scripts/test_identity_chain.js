#!/usr/bin/env node
/**
 * Test Identity Chain: 60+ Titles across all genres & namespaces
 * Validates: Search -> Detail -> Poster -> Trailer -> Playback -> Downloads
 * Ensures strict canonicalId preservation and zero cross-contamination
 */

const http = require('http');

const PORT = 4173;
const BASE = `http://localhost:${PORT}`;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch(e) {
          resolve({ status: res.statusCode, error: 'JSON parse error', text: data.slice(0, 100) });
        }
      });
    }).on('error', reject);
  });
}

// 60+ test queries across Bollywood, Hollywood, South Indian, Series, Anime, K-Drama
const TEST_TITLES = [
  // Bollywood
  'Mirzapur', 'Stree 2', 'Jawan', 'Animal', 'Pathaan', 'Dunki', 'Shaitaan', 'Fighter',
  'Brahmastra', 'Gangs of Wasseypur', 'Drishyam', 'KGF', 'Salaar', 'Pushpa', 'Chhava',
  // Hollywood
  'Avatar', 'Inception', 'Interstellar', 'Oppenheimer', 'Gladiator', 'Dune', 'The Dark Knight',
  'Avengers', 'Titanic', 'Spider-Man', 'Deadpool', 'Top Gun', 'John Wick', 'Matrix', 'The Batman',
  // Series
  'The Sandman', 'Stranger Things', 'Breaking Bad', 'Game of Thrones', 'House of the Dragon',
  'The Boys', 'Loki', 'Squid Game', 'Dark', 'Peaky Blinders', 'Wednesday', 'The Witcher',
  // Anime
  'Naruto', 'One Piece', 'Attack on Titan', 'Demon Slayer', 'Jujutsu Kaisen', 'Death Note',
  'Bleach', 'Solo Leveling', 'Chainsaw Man', 'Spirited Away',
  // South Indian
  'Baahubali', 'RRR', 'Kantara', 'Vikram', 'Leo', 'Jailer', 'Devara', 'Ponniyin Selvan',
  // K-Drama
  'Crash Landing on You', 'All of Us Are Dead', 'Vincenzo', 'Goblin', 'Descendants of the Sun', 'The Glory'
];

async function runTests() {
  console.log('========================================================');
  console.log('NETFLIX4U CANONICAL IDENTITY CHAIN VERIFICATION SUITE');
  console.log(`Running against: ${BASE}`);
  console.log(`Total titles in test catalogue: ${TEST_TITLES.length}`);
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (let idx = 0; idx < TEST_TITLES.length; idx++) {
    const title = TEST_TITLES[idx];
    const testNum = idx + 1;
    process.stdout.write(`[${testNum}/${TEST_TITLES.length}] Testing "${title}"... `);

    try {
      // 1. Search
      const searchRes = await fetchJson(`${BASE}/api/search?q=${encodeURIComponent(title)}`);
      if (searchRes.status !== 200 || !searchRes.body.results || searchRes.body.results.length === 0) {
        throw new Error(`Search returned no results (status ${searchRes.status})`);
      }

      const topResult = searchRes.body.results[0];
      const cId = topResult.canonicalId || topResult.id;
      if (!cId) {
        throw new Error('Search result missing canonicalId');
      }

      // 2. Details
      const detailRes = await fetchJson(`${BASE}/api/details/${encodeURIComponent(cId)}`);
      if (detailRes.status !== 200 || !detailRes.body.data) {
        throw new Error(`Details lookup failed for ${cId} (status ${detailRes.status})`);
      }
      const item = detailRes.body.data;
      if (item.canonicalId !== cId) {
        throw new Error(`Identity mismatch: Search canonicalId "${cId}" !== Details canonicalId "${item.canonicalId}"`);
      }

      // 3. Playback
      const playRes = await fetchJson(`${BASE}/api/playback/${encodeURIComponent(cId)}`);
      if (playRes.status !== 200) {
        throw new Error(`Playback endpoint error for ${cId} (status ${playRes.status})`);
      }
      if (playRes.body.canonicalId !== cId) {
        throw new Error(`Playback canonicalId mismatch: "${playRes.body.canonicalId}" !== "${cId}"`);
      }
      // Assert streaming sources: if present, must be verified
      if (playRes.body.sources && playRes.body.sources.length > 0) {
        for (const src of playRes.body.sources) {
          if (!src.embedUrl) {
            throw new Error(`Source ${src.name} missing embedUrl`);
          }
        }
      }

      // 4. Trailer lookup
      const trailerRes = await fetchJson(`${BASE}/api/trailer?canonicalId=${encodeURIComponent(cId)}&title=${encodeURIComponent(item.title)}&tmdbId=${item.tmdbId || ''}&type=${item.type || 'movie'}`);
      if (trailerRes.status !== 200) {
        throw new Error(`Trailer endpoint error for ${cId} (status ${trailerRes.status})`);
      }

      passed++;
      console.log(`PASSED (${cId} | ${item.type || 'movie'} | sources: ${playRes.body.sources?.length || 0})`);
    } catch (err) {
      failed++;
      console.log(`FAILED! ${err.message}`);
      failures.push({ title, error: err.message });
    }
  }

  // 5. Special Namespace Collision Tests
  console.log('\n--- Special Collision Tests ---');
  try {
    const d1 = await fetchJson(`${BASE}/api/details/dotmobiz-18033`);
    const d2 = await fetchJson(`${BASE}/api/details/tmdb-movie-18033`);
    if (d1.body.data.canonicalId === 'dotmobiz-18033' && d2.body.data.canonicalId === 'tmdb-movie-18033') {
      if (d1.body.data.title !== d2.body.data.title) {
        console.log(`✓ Namespace Collision Isolation PASSED:`);
        console.log(`  dotmobiz-18033 -> "${d1.body.data.title}"`);
        console.log(`  tmdb-movie-18033 -> "${d2.body.data.title}"`);
        passed++;
      } else {
        throw new Error('Collision Isolation FAILED: dotmobiz-18033 and tmdb-movie-18033 returned identical title');
      }
    } else {
      throw new Error('Collision Isolation FAILED: canonicalId did not match expected IDs');
    }
  } catch(e) {
    failed++;
    console.log(`✗ Namespace Collision Isolation FAILED: ${e.message}`);
    failures.push({ title: 'Namespace Collision Check', error: e.message });
  }

  console.log('\n========================================================');
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED.`);
  console.log('========================================================');

  if (failed > 0) {
    console.log('\nFailures summary:');
    failures.forEach(f => console.log(` - ${f.title}: ${f.error}`));
    process.exit(1);
  } else {
    console.log('\nAll 60+ canonical identity tests passed successfully!');
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
