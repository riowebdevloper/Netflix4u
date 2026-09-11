const http = require('http');
const { spawn } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DEBUG_PORT = 9397;

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
  const pageTarget = tabs.find(t => t.type === 'page') || tabs[0];
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: 'https://www.netflix4u.in/movie/18013' });
  await new Promise(r => setTimeout(r, 4000));
  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.querySelector('div[class*="aspect-"]');
      if (!el) return 'no el';
      const cs = window.getComputedStyle(el);
      const img = el.querySelector('img');
      const imgCs = img ? window.getComputedStyle(img) : null;
      
      const sheets = Array.from(document.styleSheets);
      const matches = [];
      for (const sheet of sheets) {
        try {
          const rules = sheet.cssRules || sheet.rules;
          for (const rule of rules) {
            if (rule.selectorText && el.matches(rule.selectorText)) {
              matches.push({ href: sheet.href, selector: rule.selectorText, cssText: rule.cssText });
            }
          }
        } catch(e){}
      }

      return {
        width: cs.width,
        height: cs.height,
        aspectRatio: cs.aspectRatio,
        flexShrink: cs.flexShrink,
        alignSelf: cs.alignSelf,
        imgWidth: imgCs?.width,
        imgHeight: imgCs?.height,
        imgNaturalWidth: img?.naturalWidth,
        imgNaturalHeight: img?.naturalHeight,
        matches
      };
    })()`,
    returnByValue: true
  });
  console.log('POSTER DIV INSPECTION:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
  edge.kill();
  process.exit(0);
})();
