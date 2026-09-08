const http = require('http');
const { spawn } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9257;

async function run() {
  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=C:\\Users\\Riyaz\\AppData\\Local\\Temp\\edge_verify_detail_script'
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const targets = await new Promise((res, rej) => {
    http.get(`http://127.0.0.1:${CDP_PORT}/json`, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
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

  console.log('Navigating to http://localhost:4173/movie/96150 ...');
  await send('Page.navigate', { url: 'http://localhost:4173/movie/96150' });
  await new Promise(r => setTimeout(r, 4500));

  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const imgs = Array.from(document.querySelectorAll('img')).map(i => ({
        alt: i.alt,
        src: i.src.slice(0, 80),
        isTmdb: i.src.includes('image.tmdb.org'),
        isSvg: i.src.includes('no-poster.svg')
      }));
      return {
        title: document.querySelector('h1')?.textContent,
        totalImages: imgs.length,
        tmdbCount: imgs.filter(i => i.isTmdb).length,
        svgCount: imgs.filter(i => i.isSvg).length,
        images: imgs
      };
    })()`,
    returnByValue: true
  });

  console.log('Detail page result:', JSON.stringify(evalRes.result.value, null, 2));
  ws.close();
  edge.kill();
}

run().catch(console.error);
