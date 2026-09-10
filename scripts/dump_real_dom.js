const { spawn } = require('child_process');
const http = require('http');

async function dumpRealDom() {
  const port = 9460;
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
  console.log('Available targets:', pages.map(p => ({ type: p.type, url: p.url })));
  const page = pages.find(p => p.url && p.url.includes('netflix4u.in')) || pages.find(p => p.type === 'page');
  console.log('Selected target:', page.url);

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

  const imgs = await send('Runtime.evaluate', {
    expression: `(() => {
      const allImgs = Array.from(document.querySelectorAll('img')).map(i => ({
        src: i.src,
        alt: i.alt,
        complete: i.complete,
        naturalWidth: i.naturalWidth,
        width: i.clientWidth,
        height: i.clientHeight,
        parentClass: i.parentElement?.className
      }));
      return {
        totalImgs: allImgs.length,
        imgsWithNaturalWidthZero: allImgs.filter(i => i.naturalWidth === 0),
        sampleLoadedImgs: allImgs.filter(i => i.naturalWidth > 0).slice(0, 10)
      };
    })()`,
    returnByValue: true
  });
  console.log('IMAGE AUDIT:', JSON.stringify(imgs.result?.value, null, 2));

  // Also check why hero poster was black
  const heroCard = await send('Runtime.evaluate', {
    expression: `(() => {
      // Find the hero card element on the right of the hero
      const heroSection = document.querySelector('h1')?.closest('.relative');
      const heroImgs = Array.from(heroSection ? heroSection.querySelectorAll('img') : []).map(i => ({
        src: i.src,
        currentSrc: i.currentSrc,
        naturalWidth: i.naturalWidth,
        classes: i.className,
        style: i.getAttribute('style')
      }));
      return {
        heroImgs,
        heroHtml: heroSection ? heroSection.innerHTML.slice(0, 1500) : 'none'
      };
    })()`,
    returnByValue: true
  });
  console.log('HERO CARD AUDIT:', JSON.stringify(heroCard.result?.value, null, 2));

  edge.kill();
}
dumpRealDom().catch(console.error);
