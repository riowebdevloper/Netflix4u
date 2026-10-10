/**
 * Static Asset Sync Script for Vercel Deployments
 * Ensures public/ contains images/, cf-fonts/, and icons/
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

console.log('Synchronizing static assets to public/...');
copyDirRecursive(path.join(ROOT, 'images'), path.join(PUBLIC_DIR, 'images'));
copyDirRecursive(path.join(ROOT, 'cf-fonts'), path.join(PUBLIC_DIR, 'cf-fonts'));
copyDirRecursive(path.join(ROOT, 'icons'), path.join(PUBLIC_DIR, 'icons'));
copyDirRecursive(path.join(ROOT, 'uploads'), path.join(PUBLIC_DIR, 'uploads'));

// Sync public/data directory for fast edge CDN delivery
const PUBLIC_DATA_DIR = path.join(PUBLIC_DIR, 'data');
if (!fs.existsSync(PUBLIC_DATA_DIR)) fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });

const DATA_DIR = path.join(ROOT, 'data');
if (fs.existsSync(DATA_DIR)) {
  const dataFiles = fs.readdirSync(DATA_DIR);
  for (const f of dataFiles) {
    if (!f.endsWith('.json')) continue;
    // Exclude massive files from static public folder to keep deployment ultra-fast
    if (f === 'details_map.json' || f === 'dotmobiz_complete_catalog.json') continue;
    const src = path.join(DATA_DIR, f);
    const dest = path.join(PUBLIC_DATA_DIR, f);
    try {
      fs.copyFileSync(src, dest);
    } catch(e) {}
  }
}

const rootFilesToSync = [
  'index.html',
  'favicon.ico',
  'favicon.svg',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'apple-touch-icon.png',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'robots.txt',
  'sitemap.xml',
  'manifest.json',
  'sw.js',
  '676d243f6147231bddf2863dfb1033ddbbd89377.html',
  '676d243f6147231bddf2863dfb1033ddbbd89377.txt',
  '863dfb1033ddbbd89377.html',
  '863dfb1033ddbbd89377.txt',
  '676d243f6147231bddf2.txt',
  '676d243f6147231bddf2.html',
  'llms.txt',
  'about.html',
  'contact.html',
  'privacy.html',
  'terms.html',
  'dmca.html',
  'editorial-policy.html',
  'corrections-policy.html',
  'movies.html',
  'series.html',
  'trending.html',
  'anime.html',
  'kdrama.html',
  'bollywood.html',
  'hollywood.html',
  'south-indian.html',
  'hindi-dubbed.html'
];

for (const f of rootFilesToSync) {
  const src = path.join(ROOT, f);
  const dest = path.join(PUBLIC_DIR, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

console.log('Static assets and SEO metadata files successfully synchronized to public/.');
