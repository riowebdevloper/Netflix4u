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
console.log('Static assets successfully synchronized to public/.');
