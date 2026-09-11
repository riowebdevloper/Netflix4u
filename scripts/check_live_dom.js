const { spawn } = require('child_process');
const http = require('http');

async function check() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new', '--remote-debugging-port=9231', '--disable-gpu', '--disable-extensions', 'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const tabs = await new Promise(res => http.get('http://127.0.0.1:9231/json', r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
  }));
  const pageTab = tabs.find(t => t.type === 'page' && !t.url.startsWith('chrome-extension://')) || tabs[0];
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 1;
  const send = (m, p = {}) => new Promise(res => {
    const msgId = id++;
    const h = msg => { const d = JSON.parse(msg.data); if (d.id === msgId) { ws.removeEventListener('message', h); res(d.result); } };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: msgId, method: m, params: p }));
  });

  await send('Page.enable');
  await send('Runtime.enable');

  await send('Page.navigate', { url: 'https://www.netflix4u.in/movie/335977' });
  await new Promise(r => setTimeout(r, 7000));

  const pageInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const dl = document.getElementById('download-links');
      const allA = Array.from(document.querySelectorAll('#download-links a')).map(a => ({
        text: a.innerText.trim(),
        href: a.href
      }));
      const desc = document.querySelector('div[class*="Storyline"] p, p.text-gray-300')?.innerText;
      const iframe = document.querySelector('iframe');
      return {
        url: window.location.href,
        h1: document.querySelector('h1')?.innerText,
        description: desc?.slice(0, 100),
        playerIframeSrc: iframe?.src,
        downloadLinksFound: !!dl,
        downloadHeading: dl?.querySelector('h2')?.innerText,
        downloadCount: allA.length,
        linksSample: allA.slice(0, 3)
      };
    })()`,
    returnByValue: true
  });
  console.log('Indiana Jones Live Result:', JSON.stringify(pageInfo.result.value, null, 2));
  ws.close();
  edge.kill();
}
check().catch(console.error);
