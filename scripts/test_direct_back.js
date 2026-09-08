const { spawn } = require('child_process');
const http = require('http');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9232;

async function run() {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,900',
    'http://localhost:4173/movie/18025'
  ]);

  await new Promise(r => setTimeout(r, 1500));

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
    console.log('Initial URL:', await evalExpr('window.location.href'));

    const clickResult = await evalExpr(`(() => {
      const btn = document.querySelector('button[aria-label="Go back"]');
      if (!btn) return 'BUTTON_NOT_FOUND';
      const rect = btn.getBoundingClientRect();
      btn.click();
      return { clicked: true, rect };
    })()`);
    console.log('Click result:', clickResult);

    await new Promise(r => setTimeout(r, 1200));
    console.log('URL after click:', await evalExpr('window.location.href'));

    edge.kill();
    process.exit(0);
  });
}
run();
