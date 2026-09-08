const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9254;
const ARTIFACT_DIR = 'C:\\Users\\Riyaz\\.gemini\\antigravity-ide\\brain\\37f4cc17-9f29-49c1-a3f4-6477032bb84d';

async function capture() {
  console.log('Starting Edge in headless mode...');
  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1440,960',
    '--user-data-dir=C:\\Users\\Riyaz\\AppData\\Local\\Temp\\edge_preview_qa_unlocked'
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
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false
  });

  // Pre-authorize human verification gate in browser context
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      try {
        localStorage.setItem('fw_hicine_gate_token', 'verified_' + Date.now());
        localStorage.setItem('fw_hicine_gate_time', String(Date.now()));
        localStorage.setItem('hicine_token_received', 'verified_' + Date.now());
        localStorage.setItem('hicine_token_timestamp', String(Date.now()));
      } catch(e) {}
    `
  });

  // 1. Home Page Preview
  console.log('Navigating to Home Page http://localhost:4173/ ...');
  await send('Page.navigate', { url: 'http://localhost:4173/' });
  await new Promise(r => setTimeout(r, 4500));
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  const homePath = path.join(ARTIFACT_DIR, 'live_preview_home.png');
  fs.writeFileSync(homePath, Buffer.from(shot1.data, 'base64'));
  console.log('Saved Home Preview to:', homePath);

  // 2. Detail Page Preview
  console.log('Navigating to Detail Page http://localhost:4173/movie/dotmobiz-19290 ...');
  await send('Page.navigate', { url: 'http://localhost:4173/movie/dotmobiz-19290' });
  await new Promise(r => setTimeout(r, 4500));
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  const detailPath = path.join(ARTIFACT_DIR, 'live_preview_detail.png');
  fs.writeFileSync(detailPath, Buffer.from(shot2.data, 'base64'));
  console.log('Saved Detail Page Preview to:', detailPath);

  // 3. Bollywood Page Preview
  console.log('Navigating to Bollywood Catalog http://localhost:4173/bollywood ...');
  await send('Page.navigate', { url: 'http://localhost:4173/bollywood' });
  await new Promise(r => setTimeout(r, 4500));
  const shot3 = await send('Page.captureScreenshot', { format: 'png' });
  const bollyPath = path.join(ARTIFACT_DIR, 'live_preview_bollywood.png');
  fs.writeFileSync(bollyPath, Buffer.from(shot3.data, 'base64'));
  console.log('Saved Bollywood Preview to:', bollyPath);

  ws.close();
  edge.kill();
  console.log('All unlocked previews captured successfully!');
}

capture().catch(err => {
  console.error('Error capturing live previews:', err);
  process.exit(1);
});
