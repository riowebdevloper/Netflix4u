const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9238;
const ARTIFACTS_DIR = 'C:\\Users\\Riyaz\\.gemini\\antigravity-ide\\brain\\ca1f0081-e90f-470b-867a-7b38882236d9';

async function run() {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,1100',
    'http://localhost:4173/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

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
      return id;
    };

    const evalExpr = (expression) => {
      return new Promise(res => {
        const id = send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        const handler = evt => {
          const m = JSON.parse(evt.data);
          if (m.id === id) {
            ws.removeEventListener('message', handler);
            res(m.result && m.result.result ? m.result.result.value : null);
          }
        };
        ws.addEventListener('message', handler);
      });
    };

    send('Runtime.enable');
    send('Page.enable');

    await new Promise(r => setTimeout(r, 2000));

    // Scroll down and wait for all images to paint
    await evalExpr('window.scrollTo(0, 850)');
    await new Promise(r => setTimeout(r, 3500));

    const id = send('Page.captureScreenshot', { format: 'png' });
    ws.addEventListener('message', evt => {
      const m = JSON.parse(evt.data);
      if (m.id === id) {
        const outPath = path.join(ARTIFACTS_DIR, 'homepage_movie_cards_fully_loaded.png');
        fs.writeFileSync(outPath, Buffer.from(m.result.data, 'base64'));
        console.log(`📸 Screenshot saved: ${outPath}`);
        ws.close();
        edge.kill();
        process.exit(0);
      }
    });
  });
}

run().catch(console.error);
