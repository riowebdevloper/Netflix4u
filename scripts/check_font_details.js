const { spawn } = require('child_process');
const http = require('http');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9241;

async function run() {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,1000',
    'http://localhost:4173/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  const pages = await new Promise((res, rej) => {
    http.get('http://localhost:' + PORT + '/json/list', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
  const page = pages.find(p => p.type === 'page');
  const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
  ws.addEventListener('open', async () => {
    await new Promise(r => setTimeout(r, 1000));
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: `(() => {
          const elements = Array.from(document.querySelectorAll('*'));
          const map = {};
          elements.forEach(el => {
            if (el.textContent.trim().length > 0 && el.children.length === 0) {
              const size = window.getComputedStyle(el).fontSize;
              if (!map[size]) {
                map[size] = [];
              }
              if (map[size].length < 3) {
                map[size].push({
                  tag: el.tagName,
                  class: el.className,
                  text: el.textContent.trim().slice(0, 35)
                });
              }
            }
          });
          return map;
        })()`,
        returnByValue: true
      }
    }));
  });
  ws.addEventListener('message', evt => {
    const data = JSON.parse(evt.data);
    if (data.id === 1) {
      console.log('FONT SIZE DETAILS:', JSON.stringify(data.result.result.value, null, 2));
      ws.close();
      edge.kill();
      process.exit(0);
    }
  });
}
run().catch(console.error);
