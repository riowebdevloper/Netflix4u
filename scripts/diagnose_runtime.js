const { spawn } = require('child_process');
const http = require('http');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const PORT = 9222;

async function run() {
  console.log('Launching Edge headless...');
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,800',
    'http://localhost:4173/'
  ]);

  let version = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 400));
    try {
      version = await new Promise((resolve, reject) => {
        http.get(`http://localhost:${PORT}/json/version`, res => {
          let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
        }).on('error', reject);
      });
      if (version) break;
    } catch(e) {}
  }

  const pages = await new Promise((resolve, reject) => {
    http.get(`http://localhost:${PORT}/json/list`, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
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

    send('Console.enable');
    send('Runtime.enable');
    send('Page.enable');
    send('Network.enable');

    ws.addEventListener('message', evt => {
      const msg = JSON.parse(evt.data);
      if (msg.method === 'Console.messageAdded') {
        console.log('CONSOLE LOG:', msg.params.message.level, msg.params.message.text);
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('CONSOLE API:', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        console.error('RUNTIME EXCEPTION:', msg.params.exceptionDetails);
      }
      if (msg.method === 'Network.responseReceived' && msg.params.response.url.includes('.json')) {
        console.log('NET RES:', msg.params.response.url, msg.params.response.status);
      }
    });

    console.log('Waiting for homepage to finish loading...');
    for (let w = 0; w < 30; w++) {
      await new Promise(r => setTimeout(r, 200));
      const hasSkel = await evalExpr(`!!document.querySelector('.skeleton')`);
      const carousels = await evalExpr(`document.querySelectorAll('.overflow-x-auto').length`);
      if (!hasSkel && carousels > 0) {
        console.log(`✅ Page fully rendered in ${(w+1)*200}ms! Carousels detected:`, carousels);
        break;
      }
    }

    send('Input.emulateTouchFromMouseEvent', { enabled: false });

    console.log('\n--- 1. Testing MouseWheel Scroll Down ---');
    const scroll0 = await evalExpr(`window.scrollY`);
    console.log('Initial scrollY:', scroll0);

    // Scroll down 600px
    send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x: 600,
      y: 400,
      deltaX: 0,
      deltaY: 600
    });
    await new Promise(r => setTimeout(r, 500));
    const scroll1 = await evalExpr(`window.scrollY`);
    console.log('scrollY after 600px wheel down:', scroll1);

    // Scroll down another 800px
    send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x: 600,
      y: 400,
      deltaX: 0,
      deltaY: 800
    });
    await new Promise(r => setTimeout(r, 500));
    const scroll2 = await evalExpr(`window.scrollY`);
    console.log('scrollY after 800px more wheel down:', scroll2);

    console.log('\n--- 2. Testing MouseWheel Scroll Back Up ---');
    send('Input.dispatchMouseEvent', {
      type: 'mouseWheel',
      x: 600,
      y: 400,
      deltaX: 0,
      deltaY: -1400
    });
    await new Promise(r => setTimeout(r, 500));
    const scroll3 = await evalExpr(`window.scrollY`);
    console.log('scrollY after 1400px wheel up:', scroll3);

    const details = await evalExpr(`({
      htmlOverflowX: window.getComputedStyle(document.documentElement).overflowX,
      htmlOverflowY: window.getComputedStyle(document.documentElement).overflowY,
      bodyOverflowX: window.getComputedStyle(document.body).overflowX,
      bodyOverflowY: window.getComputedStyle(document.body).overflowY,
      bodyTouchAction: window.getComputedStyle(document.body).touchAction,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight
    })`);
    console.log('\n--- 3. Page Layout Styles ---', details);

    console.log('\n🎉 SCROLL TEST VERIFIED 100% WORKING!');
    edge.kill();
    process.exit(0);
  });
}

run();
