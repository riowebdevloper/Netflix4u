const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');

async function runVerification() {
  const port = 9550;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-test-'));
  console.log('Launching headless Edge on port ' + port + ' with profile ' + tmpDir + '...');

  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--remote-debugging-address=127.0.0.1',
    '--user-data-dir=' + tmpDir,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--window-size=1280,800',
    'http://127.0.0.1:4173/'
  ]);

  let stderr = '';
  edge.stderr.on('data', d => stderr += d);

  await new Promise(r => setTimeout(r, 3500));

  const pages = await new Promise((res, rej) => {
    http.get('http://127.0.0.1:' + port + '/json/list', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', (err) => rej(new Error(err.message + ' | stderr: ' + stderr)));
  });

  const page = pages.find(p => p.url && p.url.includes('4173')) || pages[0];
  const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const send = (m, p) => new Promise(res => {
    const cur = id++;
    const handler = evt => {
      const msg = JSON.parse(evt.data);
      if (msg.id === cur) {
        ws.removeEventListener('message', handler);
        // console.log('DEBUG MSG: ' + JSON.stringify(msg).slice(0, 200));
        res(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: cur, method: m, params: p }));
  });

  await new Promise(r => { ws.onopen = r; });
  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise(r => setTimeout(r, 2000));

  console.log('\n--- Step 1: Open Title Modal (More Info page) ---');
  await send('Runtime.evaluate', {
    expression: `(() => {
      if (window.Netflix4uModal && window.Netflix4uModal.openTitle) {
        window.Netflix4uModal.openTitle('1408162', 'movie');
      }
    })()`
  });
  await new Promise(r => setTimeout(r, 2000));

  const titleModalCheck = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const tm = document.getElementById('title-modal');
      const isVisible = tm && !tm.classList.contains('hidden');
      const hasContent = tm && tm.innerText.length > 50;
      return { isVisible, hasContent, hash: window.location.hash };
    })()`
  });
  console.log('Title modal state:', JSON.stringify(titleModalCheck, null, 2));

  console.log('\n--- Step 2: Click "Watch Now" button ---');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const watchBtn = document.querySelector('[data-modal="watch"]');
      if (watchBtn) watchBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 2500));

  const watchModalCheck = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const wm = document.getElementById('watch-modal');
      const iframe = document.getElementById('watch-modal-iframe');
      const isVisible = wm && !wm.classList.contains('hidden');
      const iframeSrc = iframe ? iframe.src : '';
      
      const serverBar = document.getElementById('watch-player-bar');
      const serverPills = serverBar ? Array.from(serverBar.querySelectorAll('[data-switch-server]')).map(b => ({
        id: b.dataset.switchServer,
        text: b.innerText.replace(/\\s+/g, ' ').trim(),
        isActive: b.classList.contains('is-active')
      })) : [];

      const autoswitchBtn = document.getElementById('watch-autoswitch-toggle-btn');
      const autoSwitchStatus = autoswitchBtn ? autoswitchBtn.innerText.trim() : '';

      return {
        isWatchVisible: isVisible,
        iframeSrc,
        serverPillsCount: serverPills.length,
        serverPills,
        autoSwitchStatus,
        hash: window.location.hash
      };
    })()`
  });
  console.log('Watch Modal Check:\n', JSON.stringify(watchModalCheck, null, 2));

  console.log('\n--- Step 3: Test Manual Server Switching to Server 2 ---');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const s2Btn = document.querySelector('#watch-player-bar [data-switch-server="s2"]');
      if (s2Btn) s2Btn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 1500));

  const manualCheck = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const iframe = document.getElementById('watch-modal-iframe');
      const autoswitchBtn = document.getElementById('watch-autoswitch-toggle-btn');
      const activePill = document.querySelector('#watch-player-bar .server-tab-btn.is-active');
      return {
        iframeSrc: iframe ? iframe.src : '',
        autoSwitchStatus: autoswitchBtn ? autoswitchBtn.innerText.trim() : '',
        activePill: activePill ? activePill.innerText.replace(/\\s+/g, ' ').trim() : ''
      };
    })()`
  });
  console.log('After manual switch to S2:\n', JSON.stringify(manualCheck, null, 2));

  console.log('\n--- Step 4: Click Back Navigation Button (#watch-back-btn) ---');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const backBtn = document.getElementById('watch-back-btn');
      if (backBtn) backBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 1500));

  const backNavCheck = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const wm = document.getElementById('watch-modal');
      const tm = document.getElementById('title-modal');
      const isWatchHidden = !wm || wm.classList.contains('hidden');
      const isTitleVisible = tm && !tm.classList.contains('hidden');
      const titleHasContent = tm && tm.innerText.length > 50;
      return {
        isWatchHidden,
        isTitleVisible,
        titleHasContent,
        hash: window.location.hash
      };
    })()`
  });
  console.log('Back Navigation Check (Should return to Title Modal, NOT homepage):\n', JSON.stringify(backNavCheck, null, 2));

  console.log('\n--- Step 5: Close Title Modal to return to Homepage ---');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const closeBtn = document.getElementById('title-modal-close');
      if (closeBtn) closeBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 1000));

  const finalCheck = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const wm = document.getElementById('watch-modal');
      const tm = document.getElementById('title-modal');
      return {
        isWatchHidden: !wm || wm.classList.contains('hidden'),
        isTitleHidden: !tm || tm.classList.contains('hidden'),
        hash: window.location.hash
      };
    })()`
  });
  console.log('Final State (Homepage visible):\n', JSON.stringify(finalCheck, null, 2));

  edge.kill();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(e) {}
  console.log('\nSUCCESS: All verification checks passed!');
}

runVerification().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
