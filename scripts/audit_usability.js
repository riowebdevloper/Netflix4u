const { spawn } = require('child_process');
const http = require('http');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9239;

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
    let msgId = 1;
    const send = (method, params = {}) => {
      const id = msgId++;
      ws.send(JSON.stringify({ id, method, params }));
      return id;
    };

    const evalExpr = (expression) => {
      return new Promise(res => {
        const id = send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        const handler = evt => {
          const m = JSON.parse(evt.data);
          if (m.id === id) {
            ws.removeEventListener('message', handler);
            res(m.result && m.result.result ? m.result.result.value : null);
          }
        };
        ws.addEventListener('message', handler);
      });
    };

    send('Runtime.enable');
    send('Page.enable');

    await new Promise(r => setTimeout(r, 2000));

    // Audit Font Sizes
    const fontAudit = await evalExpr(`(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const fontSizes = {};
      elements.forEach(el => {
        if (el.textContent.trim().length > 0 && el.children.length === 0) {
          const size = window.getComputedStyle(el).fontSize;
          fontSizes[size] = (fontSizes[size] || 0) + 1;
        }
      });
      return fontSizes;
    })()`);
    console.log('Computed Font Sizes on Homepage:', fontAudit);

    // Audit Buttons
    const buttonAudit = await evalExpr(`(() => {
      const buttons = Array.from(document.querySelectorAll('button, a[role="button"], a.btn, [class*="rounded-"][class*="px-"]'));
      const styles = {};
      buttons.forEach(b => {
        const cs = window.getComputedStyle(b);
        const key = [
          cs.backgroundColor,
          cs.borderRadius,
          cs.paddingTop,
          cs.paddingRight,
          cs.fontSize,
          cs.fontWeight
        ].join(' | ');
        if (!styles[key]) {
          styles[key] = {
            count: 0,
            sampleText: (b.textContent || '').trim().slice(0, 30),
            tag: b.tagName,
            classes: b.className.slice(0, 60),
            bg: cs.backgroundColor,
            radius: cs.borderRadius,
            padding: cs.padding,
            fontSize: cs.fontSize
          };
        }
        styles[key].count++;
      });
      return Object.values(styles);
    })()`);
    console.log('Button Styles count:', buttonAudit.length);
    console.log('Sample button styles:', buttonAudit.slice(0, 15));

    ws.close();
    edge.kill();
    process.exit(0);
  });
}

run().catch(console.error);
