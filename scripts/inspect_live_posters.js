const { spawn } = require('child_process');
const http = require('http');

async function inspectPosters() {
  const port = 9454;
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    'https://www.netflix4u.in/'
  ]);
  await new Promise(r => setTimeout(r, 4000));
  const pages = await new Promise((res, rej) => {
    http.get('http://localhost:' + port + '/json/list', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
  const page = pages[0];
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
      const imgs = Array.from(document.querySelectorAll('img')).map(img => ({
        src: img.src,
        currentSrc: img.currentSrc,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        complete: img.complete,
        className: img.className,
        alt: img.alt,
        display: window.getComputedStyle(img).display,
        visibility: window.getComputedStyle(img).visibility,
        opacity: window.getComputedStyle(img).opacity,
        parentElement: img.parentElement?.tagName + '.' + img.parentElement?.className
      }));
      return imgs;
    })()`,
    returnByValue: true
  });
  console.log('Total images found on homepage:', res.result?.value?.length);
  console.log('Sample images:', JSON.stringify(res.result?.value?.slice(0, 15), null, 2));

  // Also check hero poster element specifically
  const heroRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const hero = document.querySelector('h1')?.closest('div.relative') || document.body;
      const allImgsInHero = Array.from(document.querySelectorAll('header ~ div img, main img')).map(i => ({
        src: i.src,
        naturalWidth: i.naturalWidth,
        className: i.className,
        box: i.getBoundingClientRect()
      }));
      return {
        allImgsInHero: allImgsInHero.slice(0, 10),
        bodySnippet: document.body.innerHTML.slice(0, 1500)
      };
    })()`,
    returnByValue: true
  });
  console.log('Hero posters:', JSON.stringify(heroRes.result?.value?.allImgsInHero, null, 2));

  edge.kill();
}
inspectPosters().catch(console.error);
