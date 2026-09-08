const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9266;
const ARTIFACTS_DIR = 'C:\\Users\\Riyaz\\.gemini\\antigravity-ide\\brain\\e5874258-8ef2-4b24-812d-8d9c7616dea1';

async function run() {
  console.log('Capturing official https://www.hicine.sbs/ ...');
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,900',
    'https://www.hicine.sbs/'
  ]);

  await new Promise(r => setTimeout(r, 4500));

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
        const h = e => {
          const m = JSON.parse(e.data);
          if (m.id === id) { ws.removeEventListener('message', h); res(m.result); }
        };
        ws.addEventListener('message', h);
      });
    };

    await new Promise(r => setTimeout(r, 2000));

    const snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'hicine_official_homepage.png'), Buffer.from(snap.data, 'base64'));
    console.log('✅ Captured official Hicine homepage!');
    edge.kill();
    process.exit(0);
  });
}

run().catch(console.error);
