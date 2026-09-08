const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9265;
const ARTIFACTS_DIR = 'C:\\Users\\Riyaz\\.gemini\\antigravity-ide\\brain\\e5874258-8ef2-4b24-812d-8d9c7616dea1';

async function run() {
  console.log('Unlocking and capturing official Hicine UI...');
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,950',
    'https://www.hicine.sbs/'
  ]);

  await new Promise(r => setTimeout(r, 4000));

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

    // Inject bypass tokens into localStorage and sessionStorage
    await send('Runtime.evaluate', {
      expression: `
        localStorage.setItem('hicine_token_received', 'true');
        localStorage.setItem('hicine_token_timestamp', Date.now().toString());
        sessionStorage.setItem('hiiCineSessionValidated', '1');
        window.location.reload();
      `
    });

    await new Promise(r => setTimeout(r, 4000));

    const snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'hicine_unlocked_homepage.png'), Buffer.from(snap.data, 'base64'));
    console.log('✅ Captured unlocked Hicine homepage!');
    edge.kill();
    process.exit(0);
  });
}

run().catch(console.error);
