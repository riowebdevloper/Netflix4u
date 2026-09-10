const { spawn } = require('child_process');
const http = require('http');

async function inspectHeroChildren() {
  const port = 9466;
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
      const hero = document.getElementById('hero-banner');
      if (!hero) return 'NO HERO BANNER';
      function getTree(el, depth = 0) {
        if (depth > 6) return null;
        const rect = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          id: el.id,
          classes: el.className,
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
          styles: {
            display: cs.display,
            position: cs.position,
            opacity: cs.opacity,
            visibility: cs.visibility,
            bg: cs.backgroundColor,
            border: cs.border
          },
          children: Array.from(el.children).map(c => getTree(c, depth + 1)).filter(Boolean)
        };
      }
      return getTree(hero);
    })()`,
    returnByValue: true
  });

  const fs = require('fs');
  fs.writeFileSync('audit_artifacts/hero_tree.json', JSON.stringify(res.result?.value, null, 2));
  console.log('Saved hero_tree.json');
  edge.kill();
}
inspectHeroChildren().catch(console.error);
