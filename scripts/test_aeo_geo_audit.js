const fs = require('fs');
const { renderMoviePage, renderSeriesPage, renderCategoryPage } = require('../services/seoRenderer.js');

console.log('====================================================');
console.log('NETFLIX4U AEO + GEO + LLMO + AI SEARCH TEST SUITE');
console.log('====================================================\n');

let passed = 0;
let total = 0;

function assert(condition, name) {
  total++;
  if (condition) {
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${name}`);
  }
}

// 1. Movie Test
console.log('--- 1. MOVIE DETAIL PAGE (AEO/GEO/LLMO) ---');
const movieData = JSON.parse(fs.readFileSync('./data/details/tmdb-movie-1514863.json', 'utf8'));
const movieHtml = renderMoviePage(movieData, 'https://netflix4u.in/movie/tmdb-movie-1514863');

assert(movieHtml.includes('Best of the Best</h1>'), 'Semantic H1 with exact movie title');
assert(movieHtml.includes('"@type":"Movie"'), 'Valid Schema.org Movie structured data');
assert(movieHtml.includes('"@type":"BreadcrumbList"'), 'Valid BreadcrumbList schema');
assert(movieHtml.includes('"@type":"FAQPage"'), 'Valid FAQPage schema');
assert(movieHtml.includes('Direct Answer &amp; Release Summary'), 'Direct Answer Block (AEO)');
assert(movieHtml.includes('Quick Facts &amp; Technical Specs'), 'Visible Quick Facts Table (LLMO)');
assert(movieHtml.includes('Where to Watch Best of the Best'), 'Where to Watch Section');
assert(movieHtml.includes('Frequently Asked Questions'), 'Frequently Asked Questions Section');
assert(movieHtml.includes('Netflix4U is <strong>NOT</strong> affiliated with'), 'Brand Independence & Trademark Notice');
assert(movieHtml.includes(movieData.director), 'Director matches visible text');
assert(movieHtml.includes(movieData.year.toString()), 'Release year matches visible text');

// 2. Series Test
console.log('\n--- 2. TV SERIES DETAIL PAGE (AEO/GEO/LLMO) ---');
const seriesData = JSON.parse(fs.readFileSync('./data/details/tmdb-series-112470.json', 'utf8'));
const seriesHtml = renderSeriesPage(seriesData, 'https://netflix4u.in/series/tmdb-series-112470');

assert(seriesHtml.includes('Ici tout commence</h1>'), 'Semantic H1 with exact series title');
assert(seriesHtml.includes('"@type":"TVSeries"'), 'Valid Schema.org TVSeries structured data');
assert(seriesHtml.includes('"@type":"FAQPage"'), 'Valid FAQPage schema');
assert(seriesHtml.includes('Series Summary &amp; Broadcast Details'), 'Series Summary Direct Answer');
assert(seriesHtml.includes('Quick Facts'), 'Visible Series Facts Table');
assert(seriesHtml.includes('Where to Watch Ici tout commence All Episodes'), 'Where to Watch All Episodes Section');

// 3. Category Test
console.log('\n--- 3. CATEGORY / DISCOVERY HUBS ---');
const catHtml = renderCategoryPage('movies', 'https://netflix4u.in/movies', [movieData]);
assert(catHtml.includes('Discover &amp; Stream Movies Online'), 'Category semantic H1');
assert(catHtml.includes('"@type":"CollectionPage"'), 'Category CollectionPage schema');
assert(catHtml.includes('"@type":"BreadcrumbList"'), 'Category BreadcrumbList schema');

// 4. Trust Pages Exist on Disk
console.log('\n--- 4. E-E-A-T TRUST & LEGAL PAGES ---');
const trustFiles = [
  'about.html',
  'contact.html',
  'privacy.html',
  'terms.html',
  'dmca.html',
  'editorial-policy.html',
  'corrections-policy.html'
];
for (const file of trustFiles) {
  assert(fs.existsSync(`./${file}`), `Trust file exists: ${file}`);
}

console.log('\n====================================================');
console.log(`TEST SUMMARY: ${passed} / ${total} TESTS PASSED`);
console.log(`STATUS: ${passed === total ? 'ALL TESTS PASSED (100% SUCCESS)' : 'SOME TESTS FAILED'}`);
console.log('====================================================');

process.exit(passed === total ? 0 : 1);
