const { spawn } = require('child_process');
const http = require('http');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9230;

async function run() {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,900',
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
    send('Page.enable');

    // 1. Wait on Home page
    await new Promise(r => setTimeout(r, 1500));
    console.log('Current URL 1:', await evalExpr('window.location.href'));

    // 2. Click on a movie card to navigate to detail page
    const navResult = await evalExpr(`(() => {
      const firstCard = document.querySelector('a[href*="/movie/"], a[href*="/series/"]');
      if (firstCard) {
        firstCard.click();
        return { clicked: true, href: firstCard.href };
      }
      return { clicked: false };
    })()`);
    console.log('Navigated to movie:', navResult);

    // 3. Wait 2s for DetailPage to load
    await new Promise(r => setTimeout(r, 2000));
    console.log('Current URL 2 (on DetailPage):', await evalExpr('window.location.href'));

    const pageElements = await evalExpr(`(() => {
      const buttons = Array.from(document.querySelectorAll('button')).map(b => ({ text: b.innerText, aria: b.getAttribute('aria-label'), class: b.className }));
      const hasSkeleton = !!document.querySelector('.skeleton');
      const rootHtml = document.getElementById('root') ? document.getElementById('root').innerHTML.slice(0, 500) : 'no root';
      return { buttons, hasSkeleton, rootHtml };
    })()`);
    console.log('DetailPage Elements:', JSON.stringify(pageElements, null, 2));

    edge.kill();
    process.exit(0);
  });
}
run();
