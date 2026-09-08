const http = require('http');
const { spawn } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9229;

async function checkGrid() {
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

  const evalRes = await new Promise((resolve) => {
    const id = 11;
    ws.addEventListener('message', function onM(e) {
      const msg = JSON.parse(e.data);
      if (msg.id === id) {
        ws.removeEventListener('message', onM);
        resolve(msg.result.result.value);
      }
    });
    ws.send(JSON.stringify({
      id,
      method: 'Runtime.evaluate',
      params: {
        expression: `
          (() => {
            const cards = Array.from(document.querySelectorAll('.group')).filter(el => el.querySelector('img'));
            return cards.slice(0, 5).map(c => {
              const img = c.querySelector('img');
              const title = c.querySelector('h3');
              const r = img ? img.getBoundingClientRect() : { width: 0, height: 0 };
              return {
                title: title ? title.textContent.trim() : '',
                titleClasses: title ? title.className : '',
                w: Math.round(r.width),
                h: Math.round(r.height),
                aspectRatio: (r.width / (r.height || 1)).toFixed(2)
              };
            });
          })()
        `,
        returnByValue: true
      }
    }));
  });

  console.log('Movie Card Metrics on /movies:');
  console.log(JSON.stringify(evalRes, null, 2));
  ws.close();
  edge.kill();
}
checkGrid();
