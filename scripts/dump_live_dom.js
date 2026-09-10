const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function dumpDom() {
  const port = 9458;
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    'https://www.netflix4u.in/'
  ]);
  await new Promise(r => setTimeout(r, 4000));
  const pages = await new Promise((res, rej) => {
    http.get('http://localhost:' + port + '/json/list', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
  const page = pages[0];
  const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const send = (method, params) => new Promise(res => {
    const cur = id++;
    const handler = evt => {
      const m = JSON.parse(evt.data);
      if (m.id === cur) {
        ws.removeEventListener('message', handler);
        res(m.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: cur, method, params }));
  });
  await new Promise(r => { ws.onopen = r; });
  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise(r => setTimeout(r, 5000));

  const res = await send('Runtime.evaluate', {
    expression: 'document.querySelector("main") ? document.querySelector("main").innerHTML.slice(0, 3000) : document.body.innerHTML.slice(0, 3000)',
    returnByValue: true
  });
  console.log('MAIN SNIPPET:');
  console.log(res.result?.value);

  const cardRes = await send('Runtime.evaluate', {
    expression: '(() => { const cards = Array.from(document.querySelectorAll(".group")); return cards.slice(0, 3).map(c => c.outerHTML); })()',
    returnByValue: true
  });
  console.log('SAMPLE CARDS:');
  console.log(cardRes.result?.value);

  edge.kill();
}
dumpDom().catch(console.error);
