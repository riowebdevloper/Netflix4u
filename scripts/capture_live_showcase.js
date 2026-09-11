const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\Riyaz\\.gemini\\antigravity-ide\\brain\\190e2edd-8b46-4041-b3a9-d5841b888837';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new', '--remote-debugging-port=9232', '--disable-gpu', '--disable-extensions', 'about:blank'
  ]);
  await sleep(2000);

  const tabs = await new Promise(res => http.get('http://127.0.0.1:9232/json', r => {
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

  const setViewport = async (w, h, isMobile = false) => {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: isMobile });
  };

  const takeScreenshot = async (filename) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buf);
    console.log(`Saved ${filename}`);
  };

  await send('Page.enable');
  await send('Runtime.enable');

  // 1. Desktop Footer
  console.log('Capturing Desktop Footer...');
  await setViewport(1440, 900, false);
  await send('Page.navigate', { url: 'https://www.netflix4u.in/' });
  await sleep(4000);
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.body.scrollHeight)' });
  await sleep(1000);
  await takeScreenshot('live_prod_footer_desktop.png');

  // 2. Mobile Footer
  console.log('Capturing Mobile Footer...');
  await setViewport(375, 812, true);
  await sleep(1000);
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.body.scrollHeight)' });
  await sleep(800);
  await takeScreenshot('live_prod_footer_mobile.png');

  // 3. Toxic Hero UI
  console.log('Capturing Toxic Hero UI...');
  await setViewport(1440, 900, false);
  await send('Page.navigate', { url: 'https://www.netflix4u.in/movie/18013' });
  await sleep(5000);
  await takeScreenshot('live_prod_toxic_hero.png');

  // 4. Toxic Streaming Player
  console.log('Capturing Toxic Player...');
  await send('Runtime.evaluate', { expression: `(() => {
    const p = document.getElementById('player') || document.querySelector('iframe');
    if (p) p.scrollIntoView({ behavior: 'instant', block: 'center' });
  })()` });
  await sleep(1000);
  await takeScreenshot('live_prod_toxic_player.png');

  // 5. Toxic Downloads Section
  console.log('Capturing Toxic Downloads...');
  await send('Runtime.evaluate', { expression: `(() => {
    const d = document.getElementById('download-links');
    if (d) d.scrollIntoView({ behavior: 'instant', block: 'center' });
  })()` });
  await sleep(1000);
  await takeScreenshot('live_prod_toxic_downloads.png');

  // 6. Indiana Jones Downloads Section
  console.log('Capturing Indiana Jones Downloads...');
  await send('Page.navigate', { url: 'https://www.netflix4u.in/movie/335977' });
  await sleep(5000);
  await send('Runtime.evaluate', { expression: `(() => {
    const d = document.getElementById('download-links');
    if (d) d.scrollIntoView({ behavior: 'instant', block: 'center' });
  })()` });
  await sleep(1000);
  await takeScreenshot('live_prod_indy_downloads.png');

  ws.close();
  edge.kill();
  console.log('All screenshots captured successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
