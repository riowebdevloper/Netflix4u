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

const rootFilesToSync = [
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
  '676d243f6147231bddf2.html'
];

for (const f of rootFilesToSync) {
  const src = path.join(ROOT, f);
  const dest = path.join(PUBLIC_DIR, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

console.log('Static assets and SEO metadata files successfully synchronized to public/.');
