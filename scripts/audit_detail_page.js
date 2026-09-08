const { spawn } = require('child_process');
const http = require('http');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9246;

async function run() {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,1000',
    'http://localhost:4173/movie/96065'
  ]);

  await new Promise(r => setTimeout(r, 2500));

  const pages = await new Promise((res, rej) => {
    http.get('http://localhost:' + PORT + '/json/list', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });

  const page = pages.find(p => p.type === 'page');
  const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);

  ws.addEventListener('open', async () => {
    let msgId = 1;
    const send = (method, params = {}) => {
      const id = msgId++;
      ws.send(JSON.stringify({ id, method, params }));
      return new Promise(res => {
        const handler = evt => {
          const m = JSON.parse(evt.data);
          if (m.id === id) {
            ws.removeEventListener('message', handler);
            res(m.result);
          }
        };
        ws.addEventListener('message', handler);
      });
    };

    await new Promise(r => setTimeout(r, 2000));

    const evalResult = await send('Runtime.evaluate', {
      expression: `(() => {
        const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
        const styles = {};
        buttons.forEach(b => {
          const cs = window.getComputedStyle(b);
          const key = [
            cs.backgroundColor,
            cs.borderRadius,
            cs.paddingTop + ' ' + cs.paddingRight,
            cs.fontSize,
            cs.fontWeight
          ].join(' | ');
          if (!styles[key]) {
            styles[key] = {
              count: 0,
              sampleText: (b.textContent || '').trim().slice(0, 30),
              tag: b.tagName,
              classes: b.className.slice(0, 80),
              bg: cs.backgroundColor,
              radius: cs.borderRadius,
              padding: cs.padding,
              fontSize: cs.fontSize,
              fontWeight: cs.fontWeight
            };
          }
          styles[key].count++;
        });
        return Object.values(styles);
      })()`,
      returnByValue: true
    });

    console.log('Button Styles count:', evalResult.result.value.length);
    console.log('Styles:', JSON.stringify(evalResult.result.value, null, 2));

    // Also check heading structure
    const headings = await send('Runtime.evaluate', {
      expression: `(() => {
        return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
          tag: h.tagName,
          text: h.textContent.trim().slice(0, 40),
          classes: h.className
        }));
      })()`,
      returnByValue: true
    });
    console.log('Headings:', JSON.stringify(headings.result.value, null, 2));

    ws.close();
    edge.kill();
    process.exit(0);
  });
}

run().catch(console.error);
