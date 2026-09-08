const http = require('http');
const { spawn } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9249;

async function run() {
  console.log('Launching Edge for live verification...');
  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=C:\\Users\\Riyaz\\AppData\\Local\\Temp\\edge_verify_posters'
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

  console.log('Navigating to http://localhost:4173 ...');
  await send('Page.navigate', { url: 'http://localhost:4173' });

  await new Promise(r => setTimeout(r, 4500));

  // Check poster elements on the page
  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const imgs = Array.from(document.querySelectorAll('img')).map(img => ({
        alt: img.alt,
        src: img.src.slice(0, 80),
        isTmdb: img.src.includes('image.tmdb.org'),
        isSvg: img.src.includes('no-poster.svg'),
        complete: img.complete,
        naturalWidth: img.naturalWidth
      }));
      const resolverExists = typeof window.resolveRealPoster === 'function';
      return {
        totalImages: imgs.length,
        tmdbCount: imgs.filter(i => i.isTmdb).length,
        svgCount: imgs.filter(i => i.isSvg).length,
        resolverExists,
        sampleImages: imgs.slice(0, 10)
      };
    })()`,
    returnByValue: true
  });

  console.log('Live Homepage Evaluation Results:');
  console.log(JSON.stringify(evalRes.result ? evalRes.result.value : evalRes, null, 2));

  // Test dynamic resolution of a sample movie
  const dynamicTest = await send('Runtime.evaluate', {
    expression: `new Promise((resolve) => {
      if (!window.resolveRealPoster) return resolve({ error: 'no resolver' });
      window.resolveRealPoster('Oppenheimer', null, 'movie', (poster, backdrop) => {
        resolve({ title: 'Oppenheimer', poster, backdrop });
      });
    })`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Dynamic TMDB Resolver Test Result:');
  console.log(JSON.stringify(dynamicTest.result ? dynamicTest.result.value : dynamicTest, null, 2));

  ws.close();
  edge.kill();
  console.log('Verification finished successfully!');
}

run().catch(err => {
  console.error('Error during verification:', err);
  process.exit(1);
});
