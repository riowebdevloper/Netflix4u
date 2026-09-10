const { spawn } = require('child_process');
const http = require('http');

async function inspectHeroBadge() {
  const port = 9462;
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
  await new Promise(r => setTimeout(r, 5000));

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const allFHD = Array.from(document.querySelectorAll('*')).filter(el => el.innerText?.trim() === 'FHD');
      return allFHD.map(el => ({
        tag: el.tagName,
        className: el.className,
        outerHtml: el.outerHTML,
        parent: {
          tag: el.parentElement?.tagName,
          className: el.parentElement?.className,
          rect: el.parentElement?.getBoundingClientRect(),
          styles: {
            display: window.getComputedStyle(el.parentElement).display,
            visibility: window.getComputedStyle(el.parentElement).visibility,
            background: window.getComputedStyle(el.parentElement).backgroundColor
          },
          innerHTML: el.parentElement?.innerHTML
        }
      }));
    })()`,
    returnByValue: true
  });
  console.log('FHD Elements:', JSON.stringify(res.result?.value, null, 2));

  edge.kill();
}
inspectHeroBadge().catch(console.error);
