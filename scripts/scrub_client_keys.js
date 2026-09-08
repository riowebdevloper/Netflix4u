const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.resolve(__dirname, '..', 'js', 'index-CQL8lqua.js'),
  path.resolve(__dirname, '..', 'assets', 'index-CQL8lqua.js'),
  path.resolve(__dirname, '..', 'js', 'DetailPage-WPhzSGyt.js'),
  path.resolve(__dirname, '..', 'assets', 'DetailPage-WPhzSGyt.js'),
  path.resolve(__dirname, '..', 'js', 'real-poster-resolver.js'),
  path.resolve(__dirname, '..', 'assets', 'real-poster-resolver.js')
];

const TMDB_KEY = '445f2b5a8941c1d4bd5a869761a916e3';
const HICINE_KEY = 'hicine_website_secret_2025_exi9epdmrns';

for (const file of targetFiles) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');
  let changed = false;

  // 1. Remove hicine secrets
  if (code.includes(HICINE_KEY)) {
    code = code.split(HICINE_KEY).join('');
    changed = true;
  }

  // 2. Remove x-api-key headers
  if (/'x-api-key':\s*['"][^'"]*['"]/.test(code)) {
    code = code.replace(/'x-api-key':\s*['"][^'"]*['"]/g, "'x-client': 'flixworld-web'");
    changed = true;
  }

  // 3. Scrub TMDB key in Q0 and route L0 to /api/tmdb
  const q0Pattern = 'Q0="' + TMDB_KEY + '",L0="https://api.tmdb.org/3"';
  if (code.includes(q0Pattern)) {
    code = code.split(q0Pattern).join('Q0="",L0="/api/tmdb"');
    changed = true;
    console.log('✅ Replaced Q0/L0 with secure /api/tmdb proxy in:', path.basename(file));
  }

  // 4. Scrub any remaining TMDB_KEY references in client files
  if (code.includes(TMDB_KEY)) {
    code = code.split(TMDB_KEY).join('');
    changed = true;
    console.log('✅ Scrubbed stray TMDB key in:', path.basename(file));
  }

  if (changed) {
    fs.writeFileSync(file, code, 'utf8');
  }
}

console.log('🛡️ Client-side API key scrubbing complete.');
