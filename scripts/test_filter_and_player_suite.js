/**
 * Comprehensive Automated Verification Suite
 * Tests:
 * 1. Filter Taxonomy & Provider Normalization
 * 2. Curated API Endpoints for All Chips (Trending, Netflix, Prime, JioHotstar, SonyLIV, Crunchyroll, Kids, Latest, MX)
 * 3. ID Set Comparison & Divergence Assertions
 * 4. Stream Player HTML Generation (Movie & TV Series with Season/Episode Selector)
 * 5. Category HTML Pages Structure & Content
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const { HOME_FILTERS, PROVIDER_ALIASES, normalizeProvider, CATEGORY_FILTERS } = require('../services/categoryFilters');
const { handleCatalogCurated, handleStreamPlayer } = require('../services/apiCore');

async function runTestSuite() {
  console.log('====================================================');
  console.log('NETFLIX4U AUTOMATED VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // --- SECTION 1: CENTRALIZED TAXONOMY & PROVIDER NORMALIZATION ---
  console.log('--- 1. CENTRALIZED FILTER TAXONOMY & NORMALIZATION ---');
  assert(typeof HOME_FILTERS === 'object' && HOME_FILTERS !== null, 'HOME_FILTERS is exported and an object');
  assert(HOME_FILTERS.trending && HOME_FILTERS.trending.type === 'ranking', 'HOME_FILTERS.trending is ranking type');
  assert(HOME_FILTERS.myList && HOME_FILTERS.myList.type === 'local', 'HOME_FILTERS.myList is local type');
  assert(HOME_FILTERS.latest && HOME_FILTERS.latest.type === 'release', 'HOME_FILTERS.latest is release type');
  assert(HOME_FILTERS.netflix && HOME_FILTERS.netflix.provider === 'netflix', 'HOME_FILTERS.netflix maps to netflix');
  assert(HOME_FILTERS.prime && HOME_FILTERS.prime.provider === 'prime-video', 'HOME_FILTERS.prime maps to prime-video');
  assert(HOME_FILTERS.jiohotstar && HOME_FILTERS.jiohotstar.provider === 'jiohotstar', 'HOME_FILTERS.jiohotstar maps to jiohotstar');
  assert(HOME_FILTERS.sonyliv && HOME_FILTERS.sonyliv.provider === 'sonyliv', 'HOME_FILTERS.sonyliv maps to sonyliv');
  assert(HOME_FILTERS.crunchyroll && HOME_FILTERS.crunchyroll.provider === 'crunchyroll', 'HOME_FILTERS.crunchyroll maps to crunchyroll');
  assert(HOME_FILTERS.kids && HOME_FILTERS.kids.type === 'category', 'HOME_FILTERS.kids is category type');

  assert(normalizeProvider('Hotstar') === 'jioHotstar', 'normalizeProvider("Hotstar") -> jioHotstar');
  assert(normalizeProvider('Disney+ Hotstar') === 'jioHotstar', 'normalizeProvider("Disney+ Hotstar") -> jioHotstar');
  assert(normalizeProvider('Amazon Prime Video') === 'primeVideo', 'normalizeProvider("Amazon Prime Video") -> primeVideo');
  assert(normalizeProvider('Sony LIV') === 'sonyLiv', 'normalizeProvider("Sony LIV") -> sonyLiv');
  assert(normalizeProvider('Netflix') === 'netflix', 'normalizeProvider("Netflix") -> netflix');

  // --- SECTION 2: CURATED CHIPS DATA & ENDPOINTS ---
  console.log('\n--- 2. CURATED CHIPS DATA AUDIT & API RESOLUTION ---');
  const chipKeys = ['trending', 'netflix', 'primevideo', 'jiohotstar', 'sonyliv', 'crunchyroll', 'kids', 'latestrelease', 'mx'];
  const extractedIds = {};

  for (const chip of chipKeys) {
    const mockReq = { url: `/api/catalog/curated/${chip}`, headers: { host: 'localhost:4173' } };
    let statusCode = 0;
    let responseBody = null;
    const mockRes = {
      setHeader: () => {},
      writeHead: (code) => { statusCode = code; },
      end: (data) => {
        try { responseBody = JSON.parse(data); } catch(e) { responseBody = data; }
      }
    };

    await handleCatalogCurated(mockReq, mockRes);
    assert(statusCode === 200, `Endpoint /api/catalog/curated/${chip} returned HTTP 200`);
    assert(responseBody && Array.isArray(responseBody.rails) && responseBody.rails.length > 0, `Chip ${chip} returned valid rails array (${responseBody?.rails?.length || 0} rails)`);
    
    // Collect all unique IDs for this chip
    const ids = new Set();
    if (responseBody && responseBody.rails) {
      for (const rail of responseBody.rails) {
        for (const item of (rail.items || [])) {
          const id = String(item.tmdbId || item.canonicalId || item.id || '');
          if (id) ids.add(id);
        }
      }
    }
    extractedIds[chip] = Array.from(ids);
    assert(extractedIds[chip].length >= 10, `Chip ${chip} has ${extractedIds[chip].length} verified unique items (>= 10 required)`);
  }

  // --- SECTION 3: ID SET COMPARISON (DIVERGENCE) ---
  console.log('\n--- 3. ID SET COMPARISON MATRIX ---');
  const netflixIds = new Set(extractedIds['netflix']);
  const primeIds = new Set(extractedIds['primevideo']);
  const jioIds = new Set(extractedIds['jiohotstar']);
  const sonyIds = new Set(extractedIds['sonyliv']);
  const crunchyIds = new Set(extractedIds['crunchyroll']);
  const trendingIds = extractedIds['trending'];
  const latestIds = extractedIds['latestrelease'];

  // Pairwise overlap calculations
  const netflixPrimeOverlap = extractedIds['netflix'].filter(id => primeIds.has(id)).length;
  const netflixJioOverlap = extractedIds['netflix'].filter(id => jioIds.has(id)).length;
  const primeSonyOverlap = extractedIds['primevideo'].filter(id => sonyIds.has(id)).length;
  const jioSonyOverlap = extractedIds['jiohotstar'].filter(id => sonyIds.has(id)).length;

  console.log(`  * Netflix vs Prime Video overlap: ${netflixPrimeOverlap} / ${extractedIds['netflix'].length}`);
  console.log(`  * Netflix vs JioHotstar overlap: ${netflixJioOverlap} / ${extractedIds['netflix'].length}`);
  console.log(`  * Prime Video vs SonyLIV overlap: ${primeSonyOverlap} / ${extractedIds['primevideo'].length}`);
  console.log(`  * JioHotstar vs SonyLIV overlap: ${jioSonyOverlap} / ${extractedIds['jiohotstar'].length}`);

  assert(netflixPrimeOverlap < extractedIds['netflix'].length * 0.3, 'Netflix and Prime Video datasets are genuinely divergent');
  assert(netflixJioOverlap < extractedIds['netflix'].length * 0.3, 'Netflix and JioHotstar datasets are genuinely divergent');
  assert(primeSonyOverlap < extractedIds['primevideo'].length * 0.3, 'Prime Video and SonyLIV datasets are genuinely divergent');

  // Verify Trending vs Latest ranking logic
  const trendingTop5 = trendingIds.slice(0, 5).join(',');
  const latestTop5 = latestIds.slice(0, 5).join(',');
  assert(trendingTop5 !== latestTop5, 'Trending top 5 and Latest Release top 5 are not identical in order or items');

  // --- SECTION 4: STREAM PLAYER LAYOUT & OTT CONTROLS ---
  console.log('\n--- 4. STREAM PLAYER 16:9 LAYOUT & OTT CONTROLS ---');
  
  // Test TV Series Player
  const tvReq = { url: '/api/stream-player?id=1399&type=tv&se=1&ep=1', headers: { host: 'localhost:4173' } };
  let tvCode = 0;
  let tvHtml = '';
  const tvRes = {
    setHeader: () => {},
    writeHead: (c) => { tvCode = c; },
    end: (d) => { tvHtml = String(d); }
  };
  await handleStreamPlayer(tvReq, tvRes);
  assert(tvCode === 200, 'TV Stream Player returns HTTP 200');
  assert(tvHtml.includes('class="player-shell"'), 'TV Player contains .player-shell wrapper');
  assert(tvHtml.includes('class="player-frame"'), 'TV Player contains .player-frame iframe container');
  assert(tvHtml.includes('aspect-ratio: 16 / 9'), 'TV Player specifies aspect-ratio: 16 / 9');
  assert(tvHtml.includes('id="season-selector"'), 'TV Player includes dynamic Season selector <select>');
  assert(tvHtml.includes('id="episode-selector"'), 'TV Player includes dynamic Episode selector <select>');
  assert(tvHtml.includes('id="player-prev-ep"'), 'TV Player includes Previous Episode button');
  assert(tvHtml.includes('id="player-next-ep"'), 'TV Player includes Next Episode button');
  assert(tvHtml.includes('switchEpisode('), 'TV Player includes zero-reload switchEpisode script');

  // Test Movie Player
  const movieReq = { url: '/api/stream-player?id=533535&type=movie', headers: { host: 'localhost:4173' } };
  let movieCode = 0;
  let movieHtml = '';
  const movieRes = {
    setHeader: () => {},
    writeHead: (c) => { movieCode = c; },
    end: (d) => { movieHtml = String(d); }
  };
  await handleStreamPlayer(movieReq, movieRes);
  assert(movieCode === 200, 'Movie Stream Player returns HTTP 200');
  assert(movieHtml.includes('class="player-shell"'), 'Movie Player contains .player-shell wrapper');
  assert(movieHtml.includes('aspect-ratio: 16 / 9'), 'Movie Player specifies aspect-ratio: 16 / 9');
  assert(!movieHtml.includes('id="season-selector"'), 'Movie Player cleanly omits TV episode navigation');

  // --- SECTION 5: CATEGORY PAGES AUDIT ---
  console.log('\n--- 5. CATEGORY HTML PAGES VERIFICATION ---');
  const catFiles = [
    'movies.html', 'series.html', 'trending.html',
    'bollywood.html', 'south-indian.html', 'hollywood.html',
    'anime.html', 'kdrama.html', 'hindi-dubbed.html'
  ];
  for (const catFile of catFiles) {
    const fullPath = path.join(__dirname, '..', catFile);
    assert(fs.existsSync(fullPath), `${catFile} exists on disk`);
    const content = fs.readFileSync(fullPath, 'utf8');
    const cardMatches = content.match(/href="\/(?:movie|tv|series)\/[^"]+"/g) || [];
    assert(cardMatches.length >= 20, `${catFile} has ${cardMatches.length} rendered media cards (>= 20 required)`);
    assert(content.includes('<link rel="canonical"'), `${catFile} contains canonical link tag`);
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
