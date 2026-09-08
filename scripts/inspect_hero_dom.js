const http = require('http');
const { spawn } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9279;

async function run() {
  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,900',
    'http://localhost:4173/'
  ]);
  await new Promise(r => setTimeout(r, 2500));
  const targets = await new Promise((res, rej) => {
    http.get(`http://127.0.0.1:${PORT}/json`, r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
  const page = targets.find(t => t.type === 'page');
  const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const send = (method, params = {}) => {
    return new Promise(res => {
      const msgId = id++;
      const handler = evt => {
        const m = JSON.parse(evt.data);
        if (m.id === msgId) {
          ws.removeEventListener('message', handler);
          res(m.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  };
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise(r => setTimeout(r, 3500));

  const domInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const hero = document.getElementById('hero-banner');
      if (!hero) return 'No hero banner!';
      const bgImg = hero.querySelector('.hero-bg-img');
      const divs = bgImg ? Array.from(bgImg.children).map(c => ({
        tag: c.tagName,
        class: c.className,
        style: c.getAttribute('style'),
        computedZ: window.getComputedStyle(c).zIndex,
        computedDisplay: window.getComputedStyle(c).display,
        computedBg: window.getComputedStyle(c).backgroundImage || window.getComputedStyle(c).background
      })) : [];
      return {
        heroRect: hero.getBoundingClientRect(),
        bgImgRect: bgImg ? bgImg.getBoundingClientRect() : null,
        children: divs
      };
    })()`,
    returnByValue: true
  });

  console.log('DOM Info:', JSON.stringify(domInfo.result.value, null, 2));
  ws.close();
  edge.kill();
}

run().catch(console.error);
