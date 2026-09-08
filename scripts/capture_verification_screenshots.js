const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9244;
const ARTIFACTS_DIR = 'C:\\Users\\Riyaz\\.gemini\\antigravity-ide\\brain\\ca1f0081-e90f-470b-867a-7b38882236d9';

async function capture() {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,1200',
    'http://localhost:4173/movie/19293'
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

    // Capture detail page with download links
    const snap1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'verified_dotmobiz_player_and_downloads.png'), Buffer.from(snap1.data, 'base64'));
    console.log('Saved verified_dotmobiz_player_and_downloads.png');

    // Scroll down to player
    await send('Runtime.evaluate', {
      expression: 'document.getElementById("player").scrollIntoView({ behavior: "instant" })'
    });
    await new Promise(r => setTimeout(r, 1000));
    const snap2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'verified_dotmobiz_videoplayer.png'), Buffer.from(snap2.data, 'base64'));
    console.log('Saved verified_dotmobiz_videoplayer.png');

    // Navigate to homepage to capture standardized type scale & buttons
    await send('Page.navigate', { url: 'http://localhost:4173/' });
    await new Promise(r => setTimeout(r, 2500));
    const snap3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, 'verified_type_scale_and_buttons.png'), Buffer.from(snap3.data, 'base64'));
    console.log('Saved verified_type_scale_and_buttons.png');

    ws.close();
    edge.kill();
    process.exit(0);
  });
}

capture().catch(console.error);
