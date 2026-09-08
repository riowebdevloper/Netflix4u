const { spawn } = require('child_process');
const http = require('http');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9253;

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

    const debug = await evalExpr(`(() => {
      const btn = document.querySelector('a[aria-label="Go back"], button[aria-label="Go back"]');
      if (!btn) return { error: 'NO_BUTTON' };
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const el = document.elementFromPoint(cx, cy);

      const parent = btn.parentElement;
      return {
        btn: {
          tag: btn.tagName,
          rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
          zIndex: window.getComputedStyle(btn).zIndex,
          pointerEvents: window.getComputedStyle(btn).pointerEvents
        },
        parent: {
          className: parent.className,
          zIndex: window.getComputedStyle(parent).zIndex,
          position: window.getComputedStyle(parent).position,
          rect: parent.getBoundingClientRect()
        },
        overlappingElement: {
          tag: el ? el.tagName : null,
          className: el ? el.className : null,
          outerHTML: el ? el.outerHTML.slice(0, 200) : null,
          zIndex: el ? window.getComputedStyle(el).zIndex : null,
          pointerEvents: el ? window.getComputedStyle(el).pointerEvents : null
        }
      };
    })()`);
    console.log('Detailed Stacking Diagnosis:', JSON.stringify(debug, null, 2));

    edge.kill();
    process.exit(0);
  });
}
run();
