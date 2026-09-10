const { spawn } = require('child_process');
const http = require('http');

async function getPosterStyles() {
  const port = 9464;
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    'https://www.netflix4u.in/'
  ]);
  await new Promise(r => setTimeout(r, 4000));
  const pages = await new Promise((res, rej) => {
    http.get('http://localhost:' + port + '/json/list', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
  const page = pages.find(p => p.url && p.url.includes('netflix4u.in')) || pages[0];
  const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const send = (method, params) => new Promise(res => {
    const cur = id++;
    const handler = evt => {
      const m = JSON.parse(evt.data);
      if (m.id === cur) {
        ws.removeEventListener('message', handler);
        res(m.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: cur, method, params }));
  });
  await new Promise(r => { ws.onopen = r; });
  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise(r => setTimeout(r, 4000));

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const card = document.querySelector('.hero-poster-card');
      if (!card) return 'NO HERO POSTER CARD';
      const img = card.querySelector('img');
      const csCard = window.getComputedStyle(card);
      const csImg = img ? window.getComputedStyle(img) : null;
      return {
        cardDisplay: csCard.display,
        cardWidth: csCard.width,
        cardHeight: csCard.height,
        cardBorder: csCard.border,
        cardBg: csCard.backgroundColor,
        imgDisplay: csImg?.display,
        imgWidth: csImg?.width,
        imgHeight: csImg?.height,
        imgNaturalWidth: img?.naturalWidth,
        imgNaturalHeight: img?.naturalHeight,
        imgSrc: img?.src,
        imgCurrentSrc: img?.currentSrc,
        imgComplete: img?.complete,
        cardRect: card.getBoundingClientRect(),
        imgRect: img?.getBoundingClientRect()
      };
    })()`,
    returnByValue: true
  });
  console.log('STYLES:', JSON.stringify(res.result?.value, null, 2));

  edge.kill();
}
getPosterStyles().catch(console.error);
