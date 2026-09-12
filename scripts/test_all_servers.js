const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = path.resolve('C:\\Users\\Riyaz\\.gemini\\antigravity-ide\\brain\\190e2edd-8b46-4041-b3a9-d5841b888837');

async function testAllServers() {
  const port = 9610;
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,800',
    'http://localhost:4173/'
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const pages = await new Promise(res => {
    http.get('http://localhost:' + port + '/json/list', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    });
  });

  const page = pages.find(p => p.url && p.url.includes('localhost:4173')) || pages[0];
  const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const send = (m, p) => new Promise(res => {
    const cur = id++;
    const handler = evt => {
      const msg = JSON.parse(evt.data);
      if (msg.id === cur) { ws.removeEventListener('message', handler); res(msg.result); }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: cur, method: m, params: p }));
  });

  await new Promise(r => { ws.onopen = r; });
  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise(r => setTimeout(r, 2500));

  const servers = [
    { name: 'Server 1 - Peachify', url: 'https://peachify.top/embed/movie/299534' },
    { name: 'Server 2 - VidLink', url: 'https://vidlink.pro/movie/299534?multiLang=true' },
    { name: 'Server 3 - 2Embed', url: 'https://www.2embed.cc/embed/299534' },
    { name: 'Server 4 - VidSrc PM', url: 'https://vidsrc.pm/embed/movie/299534' },
    { name: 'Server 5 - AutoEmbed', url: 'https://autoembed.co/movie/tmdb/299534' }
  ];

  for (let i = 0; i < servers.length; i++) {
    const s = servers[i];
    console.log(`Testing ${s.name}: ${s.url}`);
    await send('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.getElementById('watch-modal-iframe');
        const modal = document.getElementById('watch-modal');
        if (modal) { modal.classList.remove('hidden'); }
        if (iframe) { iframe.src = '${s.url}'; }
      })()`
    });
    await new Promise(r => setTimeout(r, 4000));
    const snap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, `server_test_${i + 1}.png`), Buffer.from(snap.data, 'base64'));
    console.log(`Saved server_test_${i + 1}.png`);
  }

  edge.kill();
}
testAllServers().catch(e => console.error(e));
