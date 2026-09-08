const { spawn } = require('child_process');
const http = require('http');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9250;

async function run() {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,900',
    'http://localhost:4173/'
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

    await new Promise(r => setTimeout(r, 1500));
    console.log('1. Home history state:', await evalExpr('window.history.state'));
    console.log('1. Home history length:', await evalExpr('window.history.length'));

    // Click movie card
    const clickRes = await evalExpr(`(() => {
      const a = document.querySelector('a[href*="/movie/"]');
      if (a) {
        a.click();
        return { clicked: true, href: a.href };
      }
      return { clicked: false };
    })()`);
    console.log('2. Clicked movie:', clickRes);

    await new Promise(r => setTimeout(r, 1500));

    console.log('3. Movie page history state:', await evalExpr('window.history.state'));
    console.log('3. Movie page history length:', await evalExpr('window.history.length'));
    console.log('3. Movie page referrer:', await evalExpr('document.referrer'));

    // Inspect the Back button element itself
    const backBtnInfo = await evalExpr(`(() => {
      const el = document.querySelector('a[aria-label="Go back"], button[aria-label="Go back"]');
      if (!el) return null;
      return {
        tagName: el.tagName,
        href: el.href,
        outerHTML: el.outerHTML,
        className: el.className,
        rect: el.getBoundingClientRect(),
        style: window.getComputedStyle(el).zIndex
      };
    })()`);
    console.log('4. Back button info:', backBtnInfo);

    edge.kill();
    process.exit(0);
  });
}
run();
