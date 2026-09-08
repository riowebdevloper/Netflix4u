const http = require('http');
const { spawn } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9231;

async function testModal() {
  const edge = spawn(EDGE_PATH, ['--headless=new', '--remote-debugging-port=' + CDP_PORT, '--disable-gpu', 'http://localhost:4173/movies']);
  await new Promise(r => setTimeout(r, 2000));
  const res = await new Promise(r => http.get('http://localhost:' + CDP_PORT + '/json/list', res => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d)));
  }));
  const target = res.find(t => t.type === 'page');
  const ws = new globalThis.WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  await new Promise(r => setTimeout(r, 2500));

  function evalScript(expr) {
    return new Promise(resolve => {
      const id = Math.floor(Math.random() * 10000);
      function onM(e) {
        const msg = JSON.parse(e.data);
        if (msg.id === id) { ws.removeEventListener('message', onM); resolve(msg.result.result ? msg.result.result.value : null); }
      }
      ws.addEventListener('message', onM);
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true } }));
    });
  }

  const before = await evalScript('document.body.style.overflow');
  await evalScript('(() => { const btn = document.querySelector(\'button[title="Quick info"]\'); if (btn) btn.click(); })()');
  await new Promise(r => setTimeout(r, 800));
  const after = await evalScript(`
    (() => {
      const modal = document.querySelector('[role="dialog"], .fixed.inset-0');
      const h2 = document.querySelector('.fixed h2');
      return {
        bodyOverflow: document.body.style.overflow,
        modalTitle: h2 ? h2.textContent : null
      };
    })()
  `);
  console.log('Modal check result:', after);

  ws.close();
  edge.kill();
}
testModal();
