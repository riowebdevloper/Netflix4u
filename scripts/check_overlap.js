const { spawn } = require('child_process');
const http = require('http');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9227;

async function run() {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=400,800',
    'http://localhost:4173/'
  ]);

  await new Promise(r => setTimeout(r, 1200));

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
    await new Promise(r => setTimeout(r, 2000));

    const info = await evalExpr(`(() => {
      const header = document.querySelector('header');
      const backBtn = document.querySelector('button[aria-label="Go back"]');
      const firstPill = document.querySelector('header a[href="/trending"]');
      const children = header ? Array.from(header.children).map(c => ({
        tag: c.tagName,
        className: c.className,
        rect: c.getBoundingClientRect()
      })) : [];

      return {
        headerRect: header ? { top: header.getBoundingClientRect().top, bottom: header.getBoundingClientRect().bottom, height: header.getBoundingClientRect().height } : null,
        firstPillRect: firstPill ? { top: firstPill.getBoundingClientRect().top, bottom: firstPill.getBoundingClientRect().bottom, left: firstPill.getBoundingClientRect().left } : null,
        backBtnRect: backBtn ? { top: backBtn.getBoundingClientRect().top, bottom: backBtn.getBoundingClientRect().bottom, left: backBtn.getBoundingClientRect().left } : null,
        headerChildren: children
      };
    })()`);

    console.log('Bounding Rects & Children:', JSON.stringify(info, null, 2));
    edge.kill();
    process.exit(0);
  });
}
run();
