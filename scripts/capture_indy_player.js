const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Riyaz\\.gemini\\antigravity-ide\\brain\\190e2edd-8b46-4041-b3a9-d5841b888837';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new', '--remote-debugging-port=9233', '--disable-gpu', '--disable-extensions', 'about:blank'
  ]);
  await sleep(2000);

  const tabs = await new Promise(res => http.get('http://127.0.0.1:9233/json', r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
  }));
  const pageTab = tabs.find(t => t.type === 'page' && !t.url.startsWith('chrome-extension://')) || tabs[0];
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const send = (m, p = {}) => new Promise(res => {
    const msgId = id++;
    const h = msg => { const d = JSON.parse(msg.data); if (d.id === msgId) { ws.removeEventListener('message', h); res(d.result); } };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: msgId, method: m, params: p }));
  });

  await send('Page.enable');
  await send('Runtime.enable');

  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'https://www.netflix4u.in/movie/335977' });
  await sleep(7000);

  await send('Runtime.evaluate', { expression: `(() => {
    const p = document.getElementById('player') || document.querySelector('iframe');
    if (p) p.scrollIntoView({ behavior: 'instant', block: 'center' });
  })()` });
  await sleep(2000);

  const res = await send('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(res.data, 'base64');
  fs.writeFileSync(path.join(ARTIFACT_DIR, 'live_prod_indy_player.png'), buf);
  console.log('Saved live_prod_indy_player.png');

  ws.close();
  edge.kill();
}

main().catch(console.error);
