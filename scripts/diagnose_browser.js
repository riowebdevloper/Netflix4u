const { spawn } = require('child_process');
const http = require('http');

const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new',
  '--remote-debugging-port=9346',
  '--disable-gpu',
  '--no-sandbox',
  'http://localhost:4173/'
]);

setTimeout(async () => {
  try {
    const pages = await new Promise((res, rej) => {
      http.get('http://localhost:9346/json/list', r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
      }).on('error', rej);
    });
    const ws = new globalThis.WebSocket(pages[0].webSocketDebuggerUrl);
    ws.onopen = () => {
      ws.send(JSON.stringify({ id: 1, method: 'Console.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 3, method: 'Runtime.evaluate', params: { expression: 'document.getElementById("root")?.innerHTML?.substring(0, 300)' } }));
      ws.send(JSON.stringify({ id: 4, method: 'Runtime.evaluate', params: { expression: 'window.__lastError || "no error"' } }));
    };
    ws.onmessage = evt => {
      const m = JSON.parse(evt.data);
      if (m.method === 'Console.messageAdded') {
        console.log('BROWSER CONSOLE:', m.params.message.text);
      }
      if (m.method === 'Runtime.consoleAPICalled') {
        console.log('CONSOLE API:', m.params.args.map(a => a.value || a.description));
      }
      if (m.method === 'Runtime.exceptionThrown') {
        console.log('RUNTIME EXCEPTION:', m.params.exceptionDetails);
      }
      if (m.id === 3) {
        console.log('ROOT HTML:', m.result?.result?.value);
      }
      if (m.id === 4) {
        console.log('LAST ERROR:', m.result?.result?.value);
        edge.kill();
        process.exit(0);
      }
    };
  } catch(e) {
    console.error('Diag err:', e);
    edge.kill();
    process.exit(1);
  }
}, 3500);
