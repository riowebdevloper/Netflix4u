const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9272;
const ARTIFACTS_DIR = 'C:\\Users\\Riyaz\\.gemini\\antigravity-ide\\brain\\a31fd809-fcc5-4ba2-ae03-7c44356c27a4';

async function run() {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,1000',
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

    // Wait until images are fully decoded & rendered
    async function waitForImages() {
      for (let i = 0; i < 30; i++) {
        const res = await send('Runtime.evaluate', {
          expression: `(() => {
            const imgs = Array.from(document.querySelectorAll('#hero-banner img'));
            if (!imgs.length) return false;
            return imgs.every(img => img.complete && img.naturalWidth > 0);
          })()`,
          returnByValue: true
        });
        if (res.result && res.result.value) {
          await new Promise(r => setTimeout(r, 400));
          return true;
        }
        await new Promise(r => setTimeout(r, 300));
      }
      return false;
    }

    // 1. Capture Desktop Hero with Real Poster Card
    await waitForImages();
    const desktopSnap = await send('Page.captureScreenshot', { format: 'png' });
    if (desktopSnap && desktopSnap.data) {
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'hero_desktop_fixed.png'), Buffer.from(desktopSnap.data, 'base64'));
      console.log('Saved hero_desktop_fixed.png');
    }

    // 2. Set Mobile Emulation (iPhone 14 / modern smartphone: 390x844)
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 1000));
    await waitForImages();

    const mobileSnap = await send('Page.captureScreenshot', { format: 'png' });
    if (mobileSnap && mobileSnap.data) {
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'hero_mobile_fixed.png'), Buffer.from(mobileSnap.data, 'base64'));
      console.log('Saved hero_mobile_fixed.png');
    }

    // 3. Set Tablet Emulation (iPad / Tablet: 768x1024)
    await send('Emulation.setDeviceMetricsOverride', {
      width: 768,
      height: 1024,
      deviceScaleFactor: 2,
      mobile: true
    });
    await new Promise(r => setTimeout(r, 1000));
    await waitForImages();

    const tabletSnap = await send('Page.captureScreenshot', { format: 'png' });
    if (tabletSnap && tabletSnap.data) {
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'hero_tablet_fixed.png'), Buffer.from(tabletSnap.data, 'base64'));
      console.log('Saved hero_tablet_fixed.png');
    }

    ws.close();
    edge.kill();
    console.log('All device screenshots saved!');
  });
}

run().catch(console.error);
