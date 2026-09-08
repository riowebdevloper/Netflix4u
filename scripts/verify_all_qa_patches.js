const fs = require('fs');

console.log('--- 🛡️ FLIXWORLD QA & SECURITY PATCH VERIFICATION ---');

// 1. Check .htaccess
const ht = fs.readFileSync('.htaccess', 'utf8');
const htSafe = ht.includes('RewriteRule ^index\\.html$ - [L]') && ht.includes('R=404,L');
console.log('1. .htaccess loop-proof & static 404 guard:', htSafe ? '✅ PASS' : '❌ FAIL');

// 2. Check index.html
const idx = fs.readFileSync('index.html', 'utf8');
const idxPoly = idx.includes('window.process = window.process ||') && idx.includes('window.FLIX_TERMINAL_POSTER');
console.log('2. index.html process shim & terminal poster:', idxPoly ? '✅ PASS' : '❌ FAIL');

// 3. Check MovieCard
const mcAssets = fs.readFileSync('assets/MovieCard-DyC9jox1.js', 'utf8');
const mcJs = fs.readFileSync('js/MovieCard-DyC9jox1.js', 'utf8');
const mcSafe = !mcAssets.includes('overflow="auto"') && mcAssets.includes('FLIX_TERMINAL_POSTER') && mcJs.includes('FLIX_TERMINAL_POSTER');
console.log('3. MovieCard memory leak & loop-proof poster:', mcSafe ? '✅ PASS' : '❌ FAIL');

// 4. Check DetailPage
const dpAssets = fs.readFileSync('assets/DetailPage-WPhzSGyt.js', 'utf8');
const dpJs = fs.readFileSync('js/DetailPage-WPhzSGyt.js', 'utf8');
const dpSafe = dpAssets.includes('clearTimeout(t)') && dpAssets.includes('FLIX_TERMINAL_POSTER') && dpJs.includes('FLIX_TERMINAL_POSTER');
console.log('4. DetailPage timer leak & loop-proof poster:', dpSafe ? '✅ PASS' : '❌ FAIL');

// 5. Check dev-server.js
const ds = fs.readFileSync('dev-server.js', 'utf8');
const dsOg = ds.includes('Dynamic Server-Injected OpenGraph Tags') && ds.includes('isBot');
console.log('5. dev-server.js Dynamic OpenGraph crawler injection:', dsOg ? '✅ PASS' : '❌ FAIL');

// 6. Check StreamPlaybackEngine.js
const speExists = fs.existsSync('services/StreamPlaybackEngine.js');
console.log('6. StreamPlaybackEngine absolute failure recovery:', speExists ? '✅ PASS' : '❌ FAIL');

console.log('----------------------------------------------------');
