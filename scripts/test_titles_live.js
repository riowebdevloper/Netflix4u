const { spawn } = require('child_process');
const http = require('http');

async function testTitles() {
  const port = 9472;
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
  await new Promise(r => { ws.onopen = r; });
  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise(r => setTimeout(r, 4000));

  const t1 = await send('Runtime.evaluate', {
    expression: `(() => ({
      title: document.title,
      h1: document.querySelector('h1')?.innerText || '',
      player: document.querySelector('iframe')?.src || '',
      downloads: Array.from(document.querySelectorAll('a[href*=\"vcloud\"], a[href*=\"workers.dev\"]')).map(a => a.innerText)
    }))()`,
    returnByValue: true
  });
  console.log('TMDB-MOVIE-1213243 detail:', JSON.stringify(t1.result?.value, null, 2));

  await send('Page.navigate', { url: 'https://www.netflix4u.in/movie/95770' });
  await new Promise(r => setTimeout(r, 4000));
  const t2 = await send('Runtime.evaluate', {
    expression: `(() => ({
      title: document.title,
      h1: document.querySelector('h1')?.innerText || '',
      player: document.querySelector('iframe')?.src || '',
      downloads: Array.from(document.querySelectorAll('a[href*=\"vcloud\"], a[href*=\"workers.dev\"]')).map(a => a.innerText)
    }))()`,
    returnByValue: true
  });
  console.log('95770 detail:', JSON.stringify(t2.result?.value, null, 2));

  edge.kill();
}
testTitles().catch(console.error);
