const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DEBUG_PORT = 9400;
const DEV_PORT = 4173;
const OUT_DIR = 'C:\\Users\\Riyaz\\.gemini\\antigravity-ide\\brain\\190e2edd-8b46-4041-b3a9-d5841b888837';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

(async () => {
  console.log('--- Step 1: Starting dev-server.js ---');
  const server = spawn('node', ['dev-server.js'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit'
  });

  await new Promise(r => setTimeout(r, 2000));

  console.log('--- Step 2: Starting headless Edge ---');
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + DEBUG_PORT,
    '--disable-gpu',
    '--disable-extensions',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 2000));

  const tabs = await fetchJson('http://127.0.0.1:' + DEBUG_PORT + '/json');
  const pageTarget = tabs.find(t => t.type === 'page') || tabs[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const send = (method, params = {}) => new Promise(res => {
    const msgId = id++;
    const h = msg => {
      const d = JSON.parse(msg.data);
      if (d.id === msgId) { ws.removeEventListener('message', h); res(d.result); }
    };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');

  // ==========================================
  // Test 1: Desktop Footer Visibility
  // ==========================================
  console.log('\n>>> Testing Desktop Footer (1440x900)...');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://localhost:${DEV_PORT}/` });
  await new Promise(r => setTimeout(r, 3500));

  // Scroll to bottom
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.body.scrollHeight)' });
  await new Promise(r => setTimeout(r, 800));

  const desktopFooterCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const f = document.querySelector('footer');
      const desktopGrid = f?.querySelector('.hidden.md\\\\:grid') || f?.querySelector('[class*="md:grid"]');
      const links = Array.from(f?.querySelectorAll('a') || []).map(a => a.innerText.trim()).filter(Boolean);
      return {
        footerVisible: !!f && window.getComputedStyle(f).display !== 'none',
        desktopGridDisplay: desktopGrid ? window.getComputedStyle(desktopGrid).display : null,
        linksCount: links.length,
        linksSample: links.slice(0, 8)
      };
    })()`,
    returnByValue: true
  });
  console.log('Desktop Footer Check:', JSON.stringify(desktopFooterCheck.result?.value, null, 2));

  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT_DIR, 'verify_desktop_footer.png'), Buffer.from(shot1.data, 'base64'));
  console.log('Saved verify_desktop_footer.png');

  // ==========================================
  // Test 2: Mobile Footer Visibility (375x812)
  // ==========================================
  console.log('\n>>> Testing Mobile Footer (375x812)...');
  await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: `http://localhost:${DEV_PORT}/` });
  await new Promise(r => setTimeout(r, 3000));
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.body.scrollHeight)' });
  await new Promise(r => setTimeout(r, 800));

  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT_DIR, 'verify_mobile_footer.png'), Buffer.from(shot2.data, 'base64'));
  console.log('Saved verify_mobile_footer.png');

  // ==========================================
  // Test 3: Movie Info Page UI (Toxic 18013)
  // ==========================================
  console.log('\n>>> Testing Movie Info Page UI (Toxic 18013, Desktop 1440x900)...');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `http://localhost:${DEV_PORT}/movie/18013` });
  await new Promise(r => setTimeout(r, 4000));

  const toxicUiCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const h1 = document.querySelector('h1');
      const poster = document.querySelector('.hero-detail-poster') || document.querySelector('div[class*="aspect-"]');
      const synopsisEl = document.querySelector('div.detail-hero-section') || document.querySelector('div[class*="min-h"]');
      const descText = synopsisEl?.querySelector('p.leading-relaxed')?.innerText;
      const playerIframe = document.querySelector('#player iframe');
      const playerButtons = Array.from(document.querySelectorAll('#player button')).map(b => b.innerText.trim()).filter(Boolean);
      const downloadLinksCount = document.querySelectorAll('#download-links a').length;

      return {
        title: h1?.innerText,
        h1Top: h1?.getBoundingClientRect().top,
        posterWidth: poster?.getBoundingClientRect().width,
        posterHeight: poster?.getBoundingClientRect().height,
        description: descText?.slice(0, 100),
        playerIframeSrc: playerIframe?.src,
        playerButtons,
        downloadLinksCount
      };
    })()`,
    returnByValue: true
  });
  console.log('Toxic UI Check:', JSON.stringify(toxicUiCheck.result?.value, null, 2));

  const shot3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT_DIR, 'verify_movie_hero.png'), Buffer.from(shot3.data, 'base64'));
  console.log('Saved verify_movie_hero.png');

  // Scroll to player & downloads
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 600)' });
  await new Promise(r => setTimeout(r, 800));
  const shot4 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT_DIR, 'verify_movie_player.png'), Buffer.from(shot4.data, 'base64'));
  console.log('Saved verify_movie_player.png');

  // ==========================================
  // Test 4: Series Info Page (The Pitt 23933)
  // ==========================================
  console.log('\n>>> Testing Series Info Page (The Pitt 23933)...');
  await send('Page.navigate', { url: `http://localhost:${DEV_PORT}/series/23933` });
  await new Promise(r => setTimeout(r, 4000));

  const pittUiCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const h1 = document.querySelector('h1');
      const poster = document.querySelector('.hero-detail-poster') || document.querySelector('div[class*="aspect-"]');
      const descText = document.querySelector('div[class*="min-h"]')?.querySelector('p.leading-relaxed')?.innerText;
      const playerIframe = document.querySelector('#player iframe');
      const playerButtons = Array.from(document.querySelectorAll('#player button')).map(b => b.innerText.trim()).filter(Boolean);
      const downloadLinksCount = document.querySelectorAll('#download-links a').length;

      return {
        title: h1?.innerText,
        h1Top: h1?.getBoundingClientRect().top,
        posterHeight: poster?.getBoundingClientRect().height,
        description: descText?.slice(0, 100),
        playerIframeSrc: playerIframe?.src,
        playerButtons,
        downloadLinksCount
      };
    })()`,
    returnByValue: true
  });
  console.log('The Pitt UI Check:', JSON.stringify(pittUiCheck.result?.value, null, 2));

  // ==========================================
  // Test 5: TMDB-Loaded Movie (Indiana Jones 335977)
  // ==========================================
  console.log('\n>>> Testing TMDB-Loaded Movie (Indiana Jones 335977)...');
  await send('Page.navigate', { url: `http://localhost:${DEV_PORT}/movie/335977` });
  await new Promise(r => setTimeout(r, 4000));

  const ijCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const h1 = document.querySelector('h1');
      const descText = document.querySelector('div[class*="min-h"]')?.querySelector('p.leading-relaxed')?.innerText;
      const playerIframe = document.querySelector('#player iframe');
      const downloadLinksCount = document.querySelectorAll('#download-links a').length;

      return {
        title: h1?.innerText,
        description: descText?.slice(0, 100),
        playerIframeSrc: playerIframe?.src,
        downloadLinksCount
      };
    })()`,
    returnByValue: true
  });
  console.log('Indiana Jones Check:', JSON.stringify(ijCheck.result?.value, null, 2));

  ws.close();
  edge.kill();
  server.kill();
  console.log('\n--- ALL CHECKS FINISHED SUCCESSFULLY ---');
  process.exit(0);
})();
