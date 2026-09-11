const http = require('http');
const { spawn } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DEBUG_PORT = 9395;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

(async () => {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + DEBUG_PORT,
    '--disable-gpu',
    '--disable-extensions',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const tabs = await fetchJson('http://127.0.0.1:' + DEBUG_PORT + '/json');
  const pageTarget = tabs.find(t => t.type === 'page' && !t.url.startsWith('chrome-extension://')) || tabs[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const send = (method, params = {}) => new Promise(res => {
    const msgId = id++;
    const h = msg => {
      const d = JSON.parse(msg.data);
      if (d.id === msgId) { ws.removeEventListener('message', h); res(d.result); }
    };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'https://www.netflix4u.in/' });
  await new Promise(r => setTimeout(r, 5000));

  const footerInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const f = document.querySelector('footer');
      if (!f) return 'No footer in DOM!';
      const cs = window.getComputedStyle(f);
      return {
        found: true,
        display: cs.display,
        visibility: cs.visibility,
        opacity: cs.opacity,
        height: cs.height,
        rect: f.getBoundingClientRect(),
        offsetParent: !!f.offsetParent,
        innerHTML: f.innerHTML.slice(0, 300)
      };
    })()`,
    returnByValue: true
  });

  console.log('Footer inspection:', JSON.stringify(footerInfo.result?.value, null, 2));

  // Also inspect on detail page
  await send('Page.navigate', { url: 'https://www.netflix4u.in/movie/18013' });
  await new Promise(r => setTimeout(r, 5000));

  const detailFooter = await send('Runtime.evaluate', {
    expression: `(() => {
      const f = document.querySelector('footer');
      if (!f) return 'No footer on detail page!';
      const cs = window.getComputedStyle(f);
      return {
        found: true,
        display: cs.display,
        height: cs.height,
        offsetParent: !!f.offsetParent
      };
    })()`,
    returnByValue: true
  });
  console.log('Detail footer inspection:', JSON.stringify(detailFooter.result?.value, null, 2));

  ws.close();
  edge.kill();
})();
