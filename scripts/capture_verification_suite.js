const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9277;
const ARTIFACTS_DIR = 'C:\\Users\\Riyaz\\.gemini\\antigravity-ide\\brain\\0c32ae2d-a3d8-4412-bbdf-71b4fbe97020';

async function runSuite() {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,800',
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
            res(m.result);
          }
        };
        ws.addEventListener('message', handler);
      });
    };

    await send('Page.enable');
    await send('Runtime.enable');

    // 1. Mobile Header & Hero (375x812)
    console.log('1. Capturing Mobile Header & Hero...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true
    });
    await send('Page.navigate', { url: 'http://localhost:4173/' });
    await new Promise(r => setTimeout(r, 3000));
    let snap = await send('Page.captureScreenshot', { format: 'png' });
    if (snap && snap.data) {
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'mobile_header_hero.png'), Buffer.from(snap.data, 'base64'));
      console.log('✅ Saved mobile_header_hero.png');
    }

    // 2. Mobile Footer (scroll to bottom)
    console.log('2. Capturing Mobile Footer...');
    await send('Runtime.evaluate', {
      expression: 'window.scrollTo(0, document.body.scrollHeight);'
    });
    await new Promise(r => setTimeout(r, 1500));
    snap = await send('Page.captureScreenshot', { format: 'png' });
    if (snap && snap.data) {
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'mobile_footer.png'), Buffer.from(snap.data, 'base64'));
      console.log('✅ Saved mobile_footer.png');
    }

    // 3. Desktop Home & Netflix Top 10 (1280x800)
    console.log('3. Capturing Desktop Netflix Home...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });
    await send('Page.navigate', { url: 'http://localhost:4173/' });
    await new Promise(r => setTimeout(r, 3000));
    snap = await send('Page.captureScreenshot', { format: 'png' });
    if (snap && snap.data) {
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'desktop_netflix_home.png'), Buffer.from(snap.data, 'base64'));
      console.log('✅ Saved desktop_netflix_home.png');
    }

    // 4. Desktop Series Category Grid (1280x800)
    console.log('4. Capturing Series Category Grid (Real Posters)...');
    await send('Page.navigate', { url: 'http://localhost:4173/series' });
    await new Promise(r => setTimeout(r, 3500));
    snap = await send('Page.captureScreenshot', { format: 'png' });
    if (snap && snap.data) {
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'desktop_series_posters.png'), Buffer.from(snap.data, 'base64'));
      console.log('✅ Saved desktop_series_posters.png');
    }

    // 5. Desktop Detail Page with Player & Trailer (1280x800)
    console.log('5. Capturing Detail Page with Trailer & Player...');
    await send('Page.navigate', { url: 'http://localhost:4173/movie/27205' });
    await new Promise(r => setTimeout(r, 3500));
    snap = await send('Page.captureScreenshot', { format: 'png' });
    if (snap && snap.data) {
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'desktop_detail_page.png'), Buffer.from(snap.data, 'base64'));
      console.log('✅ Saved desktop_detail_page.png');
    }

    // 6. Detail Page YouTube Trailer & Streaming section scrolled down
    console.log('6. Capturing Scrolled Detail Page (Trailer & Streaming)...');
    await send('Runtime.evaluate', {
      expression: 'window.scrollTo(0, 750);'
    });
    await new Promise(r => setTimeout(r, 2000));
    snap = await send('Page.captureScreenshot', { format: 'png' });
    if (snap && snap.data) {
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'desktop_trailer_player.png'), Buffer.from(snap.data, 'base64'));
      console.log('✅ Saved desktop_trailer_player.png');
    }

    ws.close();
    edge.kill();
    console.log('🎉 Suite complete!');
  });
}

runSuite().catch(e => {
  console.error('Suite error:', e);
  process.exit(1);
});
