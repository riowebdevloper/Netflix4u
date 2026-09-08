const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9260;
const ARTIFACTS_DIR = 'C:\\Users\\Riyaz\\.gemini\\antigravity-ide\\brain\\a31fd809-fcc5-4ba2-ae03-7c44356c27a4';

async function capture() {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,1100',
    'http://localhost:4173/'
  ]);

  await new Promise(r => setTimeout(r, 2500));

  const pages = await new Promise((res, rej) => {
    http.get('http://localhost:' + PORT + '/json/list', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });

  const page = pages.find(p => p.type === 'page');
  const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);

  ws.addEventListener('open', async () => {
    let msgId = 1;
    const send = (method, params = {}) => {
      const id = msgId++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise(res => {
        const handler = evt => {
          const m = JSON.parse(evt.data);
          if (m.id === id) {
            ws.removeEventListener('message', handler);
            resolveResult(m.result);
          }
        };
        const resolveResult = (resVal) => res(resVal);
        ws.addEventListener('message', handler);
      });
    };

    await send('Page.enable');
    await send('Runtime.enable');

    // Wait for homepage to render
    await new Promise(r => setTimeout(r, 3500));

    // 1. Capture Homepage Hero & Trending row
    const snap1 = await send('Page.captureScreenshot', { format: 'png' });
    if (snap1 && snap1.data) {
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'verified_real_tmdb_posters_home.png'), Buffer.from(snap1.data, 'base64'));
      console.log('Saved verified_real_tmdb_posters_home.png');
    }

    // 2. Scroll down to movie cards rows
    await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 950)' });
    await new Promise(r => setTimeout(r, 2000));
    const snap2 = await send('Page.captureScreenshot', { format: 'png' });
    if (snap2 && snap2.data) {
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'verified_real_tmdb_posters_rows.png'), Buffer.from(snap2.data, 'base64'));
      console.log('Saved verified_real_tmdb_posters_rows.png');
    }

    // 3. Navigate to Movies Category page
    await send('Page.navigate', { url: 'http://localhost:4173/movies' });
    await new Promise(r => setTimeout(r, 3500));
    const snap3 = await send('Page.captureScreenshot', { format: 'png' });
    if (snap3 && snap3.data) {
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'verified_real_tmdb_posters_category.png'), Buffer.from(snap3.data, 'base64'));
      console.log('Saved verified_real_tmdb_posters_category.png');
    }

    ws.close();
    edge.kill();
    console.log('All screenshots captured successfully!');
  });
}

capture().catch(console.error);
