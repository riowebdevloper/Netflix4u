const { spawn } = require('child_process');
const http = require('http');

async function debugDetail() {
  const port = 9474;
  console.log('--- Debugging https://www.netflix4u.in/movie/tmdb-movie-1213243 ---');
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    'https://www.netflix4u.in/movie/tmdb-movie-1213243'
  ]);
  await new Promise(r => setTimeout(r, 4000));
  const pages = await new Promise((res, rej) => {
    http.get('http://localhost:' + port + '/json/list', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
  const page = pages.find(p => p.url && p.url.includes('netflix4u.in')) || pages[0];
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

  const logs = [];
  const reqs = [];
  ws.onmessage = evt => {
    const m = JSON.parse(evt.data);
    if (m.method === 'Console.messageAdded') logs.push(m.params.message);
    if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params);
    if (m.method === 'Runtime.exceptionThrown') logs.push({ type: 'EXCEPTION', details: m.params.exceptionDetails });
    if (m.method === 'Network.responseReceived') {
      const resp = m.params.response;
      reqs.push({ url: resp.url, status: resp.status });
    }
  };

  await new Promise(r => { ws.onopen = r; });
  await send('Page.enable');
  await send('Console.enable');
  await send('Runtime.enable');
  await send('Network.enable');

  console.log('Waiting 6s for page to load and execute...');
  await new Promise(r => setTimeout(r, 6000));

  console.log('=== NETWORK REQUESTS ===');
  console.log(reqs.filter(r => r.url.includes('/api/') || r.url.includes('/data/') || r.url.includes('.js') || r.status >= 400));

  console.log('=== CONSOLE / EXCEPTIONS ===');
  console.log(JSON.stringify(logs, null, 2));

  const dom = await send('Runtime.evaluate', {
    expression: `(() => ({
      title: document.title,
      h1: document.querySelector('h1')?.innerText || '',
      rootInner: document.getElementById('root')?.innerHTML.slice(0, 1000)
    }))()`,
    returnByValue: true
  });
  console.log('DOM STATE:', JSON.stringify(dom.result?.value, null, 2));

  edge.kill();
}
debugDetail().catch(console.error);
