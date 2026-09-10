const { spawn } = require('child_process');
const http = require('http');

const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new',
  '--remote-debugging-port=9349',
  '--disable-gpu',
  '--no-sandbox',
  'about:blank'
]);

setTimeout(async () => {
  try {
    const pages = await new Promise((res, rej) => {
      http.get('http://localhost:9349/json/list', r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
      }).on('error', rej);
    });
    const page = pages.find(p => p.type === 'page');
    const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: 'Page.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 3, method: 'Console.enable' }));
      ws.send(JSON.stringify({ id: 4, method: 'Network.enable' }));
      ws.send(JSON.stringify({ id: 5, method: 'Page.navigate', params: { url: 'http://localhost:4173/' } }));
    };
    ws.onmessage = evt => {
      const m = JSON.parse(evt.data);
      if (m.method === 'Runtime.exceptionThrown') {
        console.log('EXCEPTION THROWN:', JSON.stringify(m.params.exceptionDetails, null, 2));
      }
      if (m.method === 'Console.messageAdded') {
        console.log('CONSOLE MSG:', m.params.message.text);
      }
      if (m.method === 'Network.responseReceived') {
        if (m.params.response.status >= 400) {
          console.log('NETWORK FAILED:', m.params.response.status, m.params.response.url);
        }
      }
      if (m.method === 'Page.loadEventFired') {
        setTimeout(() => {
          ws.send(JSON.stringify({
            id: 10,
            method: 'Runtime.evaluate',
            params: {
              expression: 'window.errors || []',
              returnByValue: true
            }
          }));
        }, 3000);
      }
      if (m.id === 10) {
        edge.kill();
        process.exit(0);
      }
    };
  } catch(e) {
    console.error('Err:', e);
    edge.kill();
    process.exit(1);
  }
}, 2000);
