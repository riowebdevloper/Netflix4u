const { spawn } = require('child_process');
const http = require('http');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9226;

async function run() {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,900',
    'http://localhost:4173/'
  ]);

  let version = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 300));
    try {
      version = await new Promise((res, rej) => {
        http.get(`http://localhost:${PORT}/json/version`, r => {
          let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
        }).on('error', rej);
      });
      if (version) break;
    } catch(e) {}
  }

  const pages = await new Promise((res, rej) => {
    http.get(`http://localhost:${PORT}/json/list`, r => {
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

    // Wait for page to render
    await new Promise(r => setTimeout(r, 1500));

    // Scroll step by step: 0 -> 800 -> 1600 -> 2400 -> 0
    const scrollPositions = [];
    for (const target of [800, 1600, 2400, 0]) {
      await evalExpr(`window.scrollTo({ top: ${target}, behavior: 'instant' })`);
      await new Promise(r => setTimeout(r, 150));
      const pos = await evalExpr(`({ target: ${target}, currentY: window.scrollY, totalHeight: document.documentElement.scrollHeight })`);
      scrollPositions.push(pos);
    }

    console.log('Scroll Journey Results:', JSON.stringify(scrollPositions, null, 2));
    edge.kill();
    process.exit(0);
  });
}
run();
