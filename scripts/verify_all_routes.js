const http = require('http');

const routes = [
  '/', '/movies', '/series', '/anime', '/kdrama', '/bollywood', '/hollywood',
  '/south-indian', '/hindi-dubbed', '/trending', '/genres', '/search',
  '/watchlist', '/about', '/contact', '/privacy', '/terms', '/dmca'
];

async function check() {
  console.log('🚀 Checking all FlixWorld frontend routes...\n');
  let ok = 0;
  for (const r of routes) {
    await new Promise(resolve => {
      http.get('http://localhost:4173' + r, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => {
          if (res.statusCode === 200 && d.includes('id="root"')) {
            console.log(`✅ Route [${r}] -> 200 OK (SPA HTML served)`);
            ok++;
          } else {
            console.error(`❌ Route [${r}] failed with status: ${res.statusCode}`);
          }
          resolve();
        });
      }).on('error', e => {
        console.error(`❌ Error on route ${r}:`, e.message);
        resolve();
      });
    });
  }
  console.log(`\n========================================`);
  console.log(`RESULT: ${ok}/${routes.length} Routes Verified OK!`);
  console.log(`========================================\n`);

  if (ok === routes.length) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

check();
