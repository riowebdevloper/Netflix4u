const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 4173;
const ARTIFACTS_DIR = 'C:\\Users\\Riyaz\\.gemini\\antigravity-ide\\brain\\2c3210ff-268a-4e50-b595-016f8fc6e744';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9285;

async function run() {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + CDP_PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,950',
    'http://localhost:' + PORT + '/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  const pages = await new Promise((res, rej) => {
    http.get('http://localhost:' + CDP_PORT + '/json/list', r => {
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
            res(m.result);
          }
        };
        ws.addEventListener('message', handler);
      });
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await new Promise(r => setTimeout(r, 1000));

    await send('Runtime.evaluate', {
      expression: `
        document.getElementById('hicine-gate-overlay').style.display = 'none';
        fetch('/api/details?id=19293')
          .then(r => r.json())
          .then(data => {
            window.HicineModal.open(data);
            setTimeout(() => {
              const el = document.getElementById('hicine-dotmovies-downloads-list');
              if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
            }, 600);
          });
      `
    });
    await new Promise(r => setTimeout(r, 1400));

    const snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, '10_scrolled_dotmovies_downloads.png'), Buffer.from(snap.data, 'base64'));
    console.log('✅ Captured 10_scrolled_dotmovies_downloads.png');
    edge.kill();
    process.exit(0);
  });
}

run().catch(console.error);
