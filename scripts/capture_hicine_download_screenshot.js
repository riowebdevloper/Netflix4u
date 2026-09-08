const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const targetUrl = process.argv[2] || 'http://localhost:4173/series/301134#download';
const outFileName = process.argv[3] || 'hicine_series_downloads_verified.png';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9270;
const ARTIFACTS_DIR = 'C:\\Users\\Riyaz\\.gemini\\antigravity-ide\\brain\\e5874258-8ef2-4b24-812d-8d9c7616dea1';

async function capture() {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,1050',
    targetUrl
  ]);

  await new Promise(r => setTimeout(r, 3000));

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

    for (let i = 0; i < 30; i++) {
      const exists = await send('Runtime.evaluate', {
        expression: '!!document.getElementById("download-links")'
      });
      if (exists && exists.result && exists.result.value) break;
      await new Promise(r => setTimeout(r, 500));
    }

    await send('Runtime.evaluate', {
      expression: 'document.getElementById("download-links")?.scrollIntoView({behavior: "instant", block: "center"});'
    });

    await new Promise(r => setTimeout(r, 1200));

    const snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, outFileName), Buffer.from(snap.data, 'base64'));
    console.log('✅ Captured ' + outFileName);
    edge.kill();
    process.exit(0);
  });
}

capture().catch(e => { console.error(e); process.exit(1); });
