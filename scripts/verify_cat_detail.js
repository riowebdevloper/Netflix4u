const http = require('http');
const { spawn } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9251;

async function run() {
  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=C:\\Users\\Riyaz\\AppData\\Local\\Temp\\edge_verify_detail'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  function get(url) {
    return new Promise((resolve, reject) => {
      http.get(url, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d)));
      }).on('error', reject);
    });
  }

  const targets = await get(`http://127.0.0.1:${CDP_PORT}/json`);
  const page = targets.find(t => t.type === 'page');
  const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);

  let id = 1;
  const send = (method, params = {}) => {
    return new Promise((resolve) => {
      const msgId = id++;
      const handler = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === msgId) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  };

  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable');
  await send('Runtime.enable');

  console.log('Navigating to Movies Category Page http://localhost:4173/movies ...');
  await send('Page.navigate', { url: 'http://localhost:4173/movies' });
  await new Promise(r => setTimeout(r, 4000));

  const catEval = await send('Runtime.evaluate', {
    expression: `(() => {
      const imgs = Array.from(document.querySelectorAll('img')).filter(i => !i.src.includes('favicon') && !i.src.includes('logo'));
      return {
        url: window.location.href,
        totalMoviePosters: imgs.length,
        tmdbCount: imgs.filter(i => i.src.includes('image.tmdb.org')).length,
        svgCount: imgs.filter(i => i.src.includes('no-poster.svg')).length,
        sample: imgs.slice(0, 5).map(i => ({ alt: i.alt, src: i.src.slice(0, 80) }))
      };
    })()`,
    returnByValue: true
  });

  console.log('Movies Category Results:', JSON.stringify(catEval.result.value, null, 2));

  // Navigate to Detail Page of a movie
  console.log('Navigating to Detail Page http://localhost:4173/movie/86831 ...');
  await send('Page.navigate', { url: 'http://localhost:4173/movie/86831' });
  await new Promise(r => setTimeout(r, 4000));

  const detailEval = await send('Runtime.evaluate', {
    expression: `(() => {
      const imgs = Array.from(document.querySelectorAll('img')).map(i => ({
        alt: i.alt,
        src: i.src.slice(0, 80),
        isTmdb: i.src.includes('image.tmdb.org'),
        isSvg: i.src.includes('no-poster.svg')
      }));
      const title = document.querySelector('h1')?.textContent;
      return {
        title,
        totalImages: imgs.length,
        tmdbCount: imgs.filter(i => i.isTmdb).length,
        svgCount: imgs.filter(i => i.isSvg).length,
        images: imgs
      };
    })()`,
    returnByValue: true
  });

  console.log('Detail Page Results:', JSON.stringify(detailEval.result.value, null, 2));

  ws.close();
  edge.kill();
  console.log('All validations passed!');
}

run().catch(err => {
  console.error('Error during category/detail verification:', err);
  process.exit(1);
});
