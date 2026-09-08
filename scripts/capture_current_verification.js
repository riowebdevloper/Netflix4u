const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9268;
const ARTIFACTS_DIR = 'C:\\Users\\Riyaz\\.gemini\\antigravity-ide\\brain\\d9518aec-fa35-4058-8681-13cfbb3e8c3d';

async function runEdgeAudits() {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=390,844',
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
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });

    await new Promise(r => setTimeout(r, 2500));

    // 1. Capture Mobile Home View
    const snap1 = await send('Page.captureScreenshot', { format: 'png' });
    if (snap1 && snap1.data) {
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'mobile_home_view.png'), Buffer.from(snap1.data, 'base64'));
      console.log('✅ Captured mobile_home_view.png');
    }

    // 2. Open Mobile Menu Drawer
    await send('Runtime.evaluate', {
      expression: `(() => {
        const menuBtn = document.querySelector('button[aria-label="Menu"]');
        if (menuBtn) menuBtn.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 1200));

    const snap2 = await send('Page.captureScreenshot', { format: 'png' });
    if (snap2 && snap2.data) {
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'mobile_drawer_open.png'), Buffer.from(snap2.data, 'base64'));
      console.log('✅ Captured mobile_drawer_open.png');
    }

    // 3. Navigate to /401
    await send('Page.navigate', { url: 'http://localhost:4173/401' });
    await new Promise(r => setTimeout(r, 2500));
    const snap3 = await send('Page.captureScreenshot', { format: 'png' });
    if (snap3 && snap3.data) {
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'unauthorized_401_view.png'), Buffer.from(snap3.data, 'base64'));
      console.log('✅ Captured unauthorized_401_view.png');
    }

    // 4. Navigate to /contact
    await send('Page.navigate', { url: 'http://localhost:4173/contact' });
    await new Promise(r => setTimeout(r, 2500));
    const snap4 = await send('Page.captureScreenshot', { format: 'png' });
    if (snap4 && snap4.data) {
      fs.writeFileSync(path.join(ARTIFACTS_DIR, 'contact_page_view.png'), Buffer.from(snap4.data, 'base64'));
      console.log('✅ Captured contact_page_view.png');
    }

    ws.close();
    edge.kill();
    process.exit(0);
  });
}

runEdgeAudits().catch(err => {
  console.error(err);
  process.exit(1);
});
