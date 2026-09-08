const http = require('http');
const { spawn } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9230;

async function checkHoverAndModal() {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + CDP_PORT,
    '--disable-gpu',
    'http://localhost:4173/movies'
  ]);
  await new Promise(r => setTimeout(r, 2000));
  
  const res = await new Promise(r => http.get('http://localhost:' + CDP_PORT + '/json/list', res => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => r(JSON.parse(d)));
  }));
  const target = res.find(t => t.type === 'page');
  const ws = new globalThis.WebSocket(target.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r));
  await new Promise(r => setTimeout(r, 3000));

  function sendCmd(method, params = {}) {
    return new Promise((resolve) => {
      const id = Math.floor(Math.random() * 100000);
      function onM(e) {
        const msg = JSON.parse(e.data);
        if (msg.id === id) {
          ws.removeEventListener('message', onM);
          resolve(msg.result);
        }
      }
      ws.addEventListener('message', onM);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  // Click quick info button on first movie card
  const modalOpened = await sendCmd('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.querySelector('.group button[title="Quick info"]');
        if (!btn) return false;
        btn.click();
        return true;
      })()
    `,
    returnByValue: true
  });
  console.log('Clicked quick info button:', modalOpened.result.value);
  await new Promise(r => setTimeout(r, 800));

  const modalState = await sendCmd('Runtime.evaluate', {
    expression: `
      (() => {
        const modal = document.querySelector('.fixed.inset-0.z-\\[100\\]');
        if (!modal) return null;
        const title = modal.querySelector('h2')?.textContent;
        const watchNow = modal.querySelector('a')?.textContent;
        const watchlist = modal.querySelector('button')?.textContent;
        return { hasModal: true, title, watchNow, watchlist };
      })()
    `,
    returnByValue: true
  });
  console.log('Modal state detected:', modalState.result.value);

  ws.close();
  edge.kill();
}
checkHoverAndModal();
