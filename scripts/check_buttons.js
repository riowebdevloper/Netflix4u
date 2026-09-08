const { spawn } = require('child_process');
const http = require('http');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9240;

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
    await new Promise(r => setTimeout(r, 2000));
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: `(() => {
          const btns = Array.from(document.querySelectorAll('button, a[role="button"], a.btn'));
          const styles = {};
          btns.forEach(b => {
            const cs = window.getComputedStyle(b);
            const key = [cs.backgroundColor, cs.borderRadius, cs.padding, cs.fontSize, cs.fontWeight].join(' | ');
            if (!styles[key]) styles[key] = {
              text: (b.textContent || '').trim().slice(0, 30),
              className: b.className,
              tag: b.tagName,
              count: 0
            };
            styles[key].count++;
          });
          return {
            count: Object.keys(styles).length,
            styles
          };
        })()`,
        returnByValue: true
      }
    }));
  });

  ws.addEventListener('message', evt => {
    const data = JSON.parse(evt.data);
    if (data.id === 1) {
      console.log('BUTTONS:', JSON.stringify(data.result.result.value, null, 2));
      ws.close();
      edge.kill();
      process.exit(0);
    }
  });
}

run().catch(console.error);
