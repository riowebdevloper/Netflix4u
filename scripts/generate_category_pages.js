/**
 * Generate Static Category Pages for Netflix4U
 * Creates movies.html, series.html, trending.html, anime.html, kdrama.html,
 * bollywood.html, hollywood.html, south-indian.html, hindi-dubbed.html
 */

const fs = require('fs');
const path = require('path');
const seoRenderer = require('../services/seoRenderer');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');

const summaryPath = path.join(DATA_DIR, 'catalog_summary.json');
let allItems = [];
if (fs.existsSync(summaryPath)) {
  allItems = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
}

const CATEGORIES = [
  { key: 'movies', filter: i => i.type === 'movie' || i.contentType === 'movie' },
  { key: 'series', filter: i => i.type === 'series' || i.contentType === 'series' },
  { key: 'trending', filter: (i, idx) => idx < 36 },
  { key: 'anime', filter: i => (i.genres && i.genres.includes('Animation')) || i.type === 'anime' || (i.origin_country && i.origin_country.includes('JP')) },
  { key: 'kdrama', filter: i => i.country === 'KR' || (i.language && i.language.toLowerCase().includes('korean')) || (i.origin_country && i.origin_country.includes('KR')) },
  { key: 'bollywood', filter: i => i.country === 'IN' || (i.language && i.language.toLowerCase().includes('hindi')) || (i.origin_country && i.origin_country.includes('IN')) },
  { key: 'hollywood', filter: i => i.country === 'US' || (i.language && i.language.toLowerCase().includes('english')) || (i.origin_country && i.origin_country.includes('US')) },
  { key: 'south-indian', filter: i => (i.language && ['tamil', 'telugu', 'malayalam', 'kannada'].some(l => i.language.toLowerCase().includes(l))) || (i.genres && i.genres.includes('South Indian')) },
  { key: 'hindi-dubbed', filter: i => (i.title && /hindi|dubbed|dual audio/i.test(i.title)) || (i.audio && /hindi/i.test(i.audio)) }
];

console.log(`Generating ${CATEGORIES.length} category HTML pages from ${allItems.length} catalog items...`);

for (const cat of CATEGORIES) {
  let matched = allItems.filter(cat.filter).slice(0, 36);
  if (matched.length === 0) {
    matched = allItems.slice(0, 24);
  }

  const canonicalUrl = `https://netflix4u.in/${cat.key}`;
  const html = seoRenderer.renderCategoryPage(cat.key, canonicalUrl, matched);

  const destRoot = path.join(ROOT, `${cat.key}.html`);
  fs.writeFileSync(destRoot, html, 'utf8');

  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }
  const destPublic = path.join(PUBLIC_DIR, `${cat.key}.html`);
  fs.writeFileSync(destPublic, html, 'utf8');

  console.log(`✓ Created: ${cat.key}.html (${matched.length} titles)`);
}

console.log('All category static pages successfully generated!');
