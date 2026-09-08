const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const STAGING = path.join(ROOT, 'temp_cpanel_stage');
const OUTPUT_ZIP = path.join(ROOT, 'flixworld_cpanel_release.zip');

console.log('=== Building Production cPanel Release Package ===');
console.log('Root directory:', ROOT);
console.log('Staging directory:', STAGING);

// 1. Clean previous staging or zip
if (fs.existsSync(STAGING)) {
  fs.rmSync(STAGING, { recursive: true, force: true });
}
if (fs.existsSync(OUTPUT_ZIP)) {
  fs.unlinkSync(OUTPUT_ZIP);
}
fs.mkdirSync(STAGING, { recursive: true });

// Helper: copy directory recursively with filter
function copyDirRecursive(src, dest, filterFn) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (filterFn && !filterFn(srcPath, entry)) continue;
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath, filterFn);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 2. Copy Root Production Files
const ROOT_FILES = [
  'index.html',
  'server.js',
  'app.js',
  'dev-server.js',
  'package.json',
  '.htaccess',
  '.env.example',
  'favicon.ico',
  'favicon.svg',
  'og-image.jpg',
  'robots.txt',
  'sitemap.xml',
  'CPANEL_DEPLOYMENT_GUIDE.md'
];

console.log('Copying root production files...');
for (const file of ROOT_FILES) {
  const src = path.join(ROOT, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(STAGING, file));
  } else {
    console.warn('Warning: Missing root file:', file);
  }
}

// 3. Copy Standard Folders
const STANDARD_DIRS = ['api', 'css', 'fonts', 'images', 'uploads', 'services', 'public'];
for (const dir of STANDARD_DIRS) {
  console.log(`Copying ${dir}/...`);
  copyDirRecursive(path.join(ROOT, dir), path.join(STAGING, dir));
}

// 4. Copy Clean JS Directory (omit .bak, .pre_)
console.log('Copying js/ (excluding backups)...');
copyDirRecursive(path.join(ROOT, 'js'), path.join(STAGING, 'js'), (srcPath, entry) => {
  return !entry.name.includes('.bak') && !entry.name.includes('.pre_');
});

// 5. Copy Clean Assets Directory (omit .bak, .pre_)
console.log('Copying assets/ (excluding backups)...');
copyDirRecursive(path.join(ROOT, 'assets'), path.join(STAGING, 'assets'), (srcPath, entry) => {
  return !entry.name.includes('.bak') && !entry.name.includes('.pre_');
});

// 6. Copy Data Directory (high-speed robocopy for details, omit image_cache)
console.log('Copying data/ catalog files...');
fs.mkdirSync(path.join(STAGING, 'data'), { recursive: true });
for (const entry of fs.readdirSync(path.join(ROOT, 'data'), { withFileTypes: true })) {
  if (entry.isFile()) {
    fs.copyFileSync(path.join(ROOT, 'data', entry.name), path.join(STAGING, 'data', entry.name));
  }
}

console.log('Copying data/details (30,000+ files via multithreaded robocopy)...');
try {
  execSync(`robocopy "${path.join(ROOT, 'data', 'details')}" "${path.join(STAGING, 'data', 'details')}" /MT:32 /NFL /NDL /NJH /NJS /nc /ns /np`, { stdio: 'ignore' });
} catch (e) {
  // Robocopy exit codes 1-3 indicate success with files copied
}

// Create empty image_cache directory in staging
fs.mkdirSync(path.join(STAGING, 'data', 'image_cache'), { recursive: true });

// 7. Copy Scratch (only dotmobiz_harvested.json)
console.log('Setting up scratch/dotmobiz_harvested.json...');
fs.mkdirSync(path.join(STAGING, 'scratch'), { recursive: true });
const harvestedSrc = path.join(ROOT, 'scratch', 'dotmobiz_harvested.json');
if (fs.existsSync(harvestedSrc)) {
  fs.copyFileSync(harvestedSrc, path.join(STAGING, 'scratch', 'dotmobiz_harvested.json'));
}

// 8. Create ZIP using bsdtar (C-speed, no path limits)
console.log('Compressing files into flixworld_cpanel_release.zip using bsdtar...');
const startTime = Date.now();

try {
  // Run tar command with cwd set to staging directory so paths are root-relative
  execSync(`tar -a -c -f "${OUTPUT_ZIP}" * .htaccess`, {
    cwd: STAGING,
    stdio: 'inherit'
  });
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Compression completed in ${elapsed}s`);
} catch (err) {
  console.error('Error running tar:', err.message);
  process.exit(1);
}

// 9. Verify Zip File Size
if (fs.existsSync(OUTPUT_ZIP)) {
  const stats = fs.statSync(OUTPUT_ZIP);
  const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`SUCCESS! Archive created: ${OUTPUT_ZIP} (${sizeMB} MB)`);
} else {
  console.error('Error: Zip file was not created.');
  process.exit(1);
}

// 10. Clean up staging directory
console.log('Cleaning up staging directory...');
fs.rmSync(STAGING, { recursive: true, force: true });
console.log('=== cPanel Build Complete ===');
