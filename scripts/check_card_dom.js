const http = require('http');
const { spawn } = require('child_process');

async function check() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new', '--remote-debugging-port=9288', '--disable-gpu', '--no-sandbox', '--window-size=1440,900', 'http://localhost:4173/'
  ]);
  await new Promise(r => setTimeout(r, 2500));
  const pages = await new Promise((res, rej) => {
    http.get('http://localhost:9288/json/list', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
  const page = pages.find(p => p.type === 'page');
  const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const send = (m, p = {}) => new Promise(res => {
    const msgId = id++;
    const h = evt => {
      const d = JSON.parse(evt.data);
      if (d.id === msgId) { ws.removeEventListener('message', h); res(d.result); }
    };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: msgId, method: m, params: p }));
  });
  await new Promise(r => ws.addEventListener('open', r));
  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise(r => setTimeout(r, 3500));

  const info = await send('Runtime.evaluate', {
    expression: `(() => {
      const card = document.querySelector('.hero-poster-card');
      const img = card ? card.querySelector('img') : null;
      if (!card || !img) return 'Card or img missing';
      return {
        cardRect: card.getBoundingClientRect(),
        imgRect: img.getBoundingClientRect(),
        imgNaturalWidth: img.naturalWidth,
        imgNaturalHeight: img.naturalHeight,
        imgComplete: img.complete,
        imgSrc: img.src,
        cardChildren: Array.from(card.children).map(c => ({
          tag: c.tagName,
          class: c.className,
          rect: c.getBoundingClientRect(),
          style: c.getAttribute('style'),
          computedBg: window.getComputedStyle(c).background,
          computedDisplay: window.getComputedStyle(c).display,
          computedZIndex: window.getComputedStyle(c).zIndex
        }))
      };
    })()`,
    returnByValue: true
  });
  console.log(JSON.stringify(info.result.value, null, 2));
  ws.close();
  edge.kill();
}
check().catch(console.error);
