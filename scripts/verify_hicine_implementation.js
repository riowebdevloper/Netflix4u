const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = 4173;
const ARTIFACTS_DIR = 'C:\\Users\\Riyaz\\.gemini\\antigravity-ide\\brain\\2c3210ff-268a-4e50-b595-016f8fc6e744';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9280;

async function checkApi(url) {
  return new Promise((res, rej) => {
    http.get(url, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
}

async function main() {
  console.log('--- 1. Fetching Real Title Details with Dotmovies & Hicine links ---');
  const details = await checkApi(`http://localhost:${PORT}/api/details?id=19293`);
  console.log('Title:', details.title);
  console.log('Download Options (Dotmovies):', details.downloadOptions?.length);
  console.log('Cloud Links (Hicine):', details.links?.length);

  console.log('--- 2. Testing Frontend with Microsoft Edge Headless ---');
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + CDP_PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,950',
    `http://localhost:${PORT}/`
  ]);

  await new Promise(r => setTimeout(r, 2500));

  const pages = await new Promise((res, rej) => {
    http.get('http://localhost:' + CDP_PORT + '/json/list', r => {
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

    await send('Page.enable');
    await send('Runtime.enable');
    await new Promise(r => setTimeout(r, 1500));

    // Bypass gate and open Detail Modal with real Mirzapur details
    console.log('Opening Detail Modal with real Mirzapur title, Dotmovies links, and player...');
    await send('Runtime.evaluate', {
      expression: `
        document.getElementById('hicine-gate-overlay').style.display = 'none';
        fetch('/api/details?id=19293')
          .then(r => r.json())
          .then(data => {
            window.HicineModal.open(data);
          });
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    // Capture Detail Modal with Hicine and Dotmovies links
    const snapModal = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, '07_real_dotmovies_and_hicine_modal.png'), Buffer.from(snapModal.data, 'base64'));
    console.log('✅ Captured 07_real_dotmovies_and_hicine_modal.png');

    // Switch to Watch Online (Streaming Player)
    console.log('Switching to Streaming Video Player tab...');
    await send('Runtime.evaluate', {
      expression: `
        document.getElementById('hicine-quick-watch-btn')?.click();
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    const snapPlayer = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, '08_real_streaming_video_player.png'), Buffer.from(snapPlayer.data, 'base64'));
    console.log('✅ Captured 08_real_streaming_video_player.png');

    // Test clicking Download to open Servers Ready
    console.log('Switching back to Download and opening Servers Ready modal...');
    await send('Runtime.evaluate', {
      expression: `
        document.getElementById('hicine-quick-dl-btn')?.click();
        const firstDlBtn = document.querySelector('#hicine-cloud-downloads-list .hicine-dl-btn');
        if (firstDlBtn) firstDlBtn.click();
      `
    });
    await new Promise(r => setTimeout(r, 1500));

    const snapServers = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACTS_DIR, '09_real_servers_ready_modal.png'), Buffer.from(snapServers.data, 'base64'));
    console.log('✅ Captured 09_real_servers_ready_modal.png');

    edge.kill();
    process.exit(0);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
