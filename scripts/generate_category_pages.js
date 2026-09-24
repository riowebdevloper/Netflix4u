/**
 * Generate Static Category Pages for Netflix4U
 * Creates movies.html, series.html, trending.html, anime.html, kdrama.html,
 * bollywood.html, hollywood.html, south-indian.html, hindi-dubbed.html
 */

const fs = require('fs');
const path = require('path');
const seoRenderer = require('../services/seoRenderer');
const { filterCatalogByCategory } = require('../services/categoryFilters');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');

const summaryPath = path.join(DATA_DIR, 'catalog_summary.json');
let allItems = [];
if (fs.existsSync(summaryPath)) {
  allItems = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
}

const CATEGORY_KEYS = [
  'movies',
  'series',
  'trending',
  'anime',
  'kdrama',
  'bollywood',
  'hollywood',
  'south-indian',
  'hindi-dubbed'
];

console.log(`Generating ${CATEGORY_KEYS.length} category HTML pages from ${allItems.length} catalog items...`);

for (const catKey of CATEGORY_KEYS) {
  const matched = filterCatalogByCategory(allItems, catKey).slice(0, 36);

  const canonicalUrl = `https://netflix4u.in/${catKey}`;
  const html = seoRenderer.renderCategoryPage(catKey, canonicalUrl, matched);

  const destRoot = path.join(ROOT, `${catKey}.html`);
  fs.writeFileSync(destRoot, html, 'utf8');

  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }
  const destPublic = path.join(PUBLIC_DIR, `${catKey}.html`);
  fs.writeFileSync(destPublic, html, 'utf8');

  console.log(`✓ Created: ${catKey}.html (${matched.length} titles)`);
}

console.log('All category static pages successfully generated!');
