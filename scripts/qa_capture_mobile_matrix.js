const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const candidates = [
  '/Users/laptopbazaar/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];
const CHROME_PATH = candidates.find(c => fs.existsSync(c)) || 'google-chrome';

const CDP_PORT = 9299;
const SERVER_PORT = 4173; // Our running dev-server
const ARTIFACTS_DIR = path.resolve(__dirname, '..', 'audit_artifacts', 'mobile_verification');

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

// Conversation artifact directory if present
const CONV_ARTIFACTS_DIR = '/Users/laptopbazaar/.gemini/antigravity-ide/brain/9264ee67-c793-41c9-99bf-fa39d4e115a9';
const SCREENSHOTS_DEST = path.join(CONV_ARTIFACTS_DIR, 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DEST)) {
  try { fs.mkdirSync(SCREENSHOTS_DEST, { recursive: true }); } catch(e) {}
}

const VIEWPORTS = [
  { name: '320px_UltraCompact', width: 320, height: 568 },
  { name: '360px_CompactAndroid', width: 360, height: 640 },
  { name: '375px_iPhoneSE', width: 375, height: 667 },
  { name: '390px_iPhone13_14', width: 390, height: 844 },
  { name: '412px_Pixel_Galaxy', width: 412, height: 915 },
  { name: '430px_iPhoneProMax', width: 430, height: 932 }
];

async function run() {
  console.log('====================================================');
  console.log('PHASE 11: REAL MOBILE TESTING & SCREENSHOT AUDIT');
  console.log('Target Resolutions: 320px, 360px, 375px, 390px, 412px, 430px');
  console.log('====================================================\n');

  console.log('Using Browser Binary:', CHROME_PATH);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-mobile-qa-'));
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + CDP_PORT,
    '--user-data-dir=' + tmpDir,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--window-size=1280,800',
    `http://localhost:${SERVER_PORT}/`
  ]);

  await new Promise(r => setTimeout(r, 2000));

  let pages = [];
  for (let i = 0; i < 20; i++) {
    try {
      pages = await new Promise((res, rej) => {
        http.get(`http://localhost:${CDP_PORT}/json/list`, r => {
          let d = ''; r.on('data', c => d += c);
          r.on('end', () => { try { res(JSON.parse(d)); } catch(e) { rej(e); } });
        }).on('error', rej);
      });
      if (pages.length) break;
    } catch(e) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  const page = pages.find(p => p.type === 'page') || pages[0];
  if (!page) throw new Error('Failed to attach to Chromium page');

  const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });

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
  await send('DOM.enable');

  async function capture(filename) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    if (res && res.data) {
      const buf = Buffer.from(res.data, 'base64');
      fs.writeFileSync(path.join(ARTIFACTS_DIR, filename), buf);
      if (fs.existsSync(SCREENSHOTS_DEST)) {
        fs.writeFileSync(path.join(SCREENSHOTS_DEST, filename), buf);
      }
      console.log(`  📸 Captured: ${filename}`);
      return true;
    }
    return false;
  }

  // --- Step 1: Responsive Viewport Check Matrix (320px - 430px) ---
  console.log('--- 1. MOBILE RESPONSIVE MATRIX & OVERFLOW CHECK ---');
  for (const vp of VIEWPORTS) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 2,
      mobile: true
    });
    await send('Page.navigate', { url: `http://localhost:${SERVER_PORT}/` });
    await new Promise(r => setTimeout(r, 1500));

    const metrics = await send('Runtime.evaluate', {
      expression: `({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      })`,
      returnByValue: true
    });

    const val = metrics.result.value;
    const pass = !val.hasOverflow;
    console.log(`  ${pass ? '✓ PASS' : '❌ FAIL'}: ${vp.name} (${vp.width}x${vp.height}) - scrollWidth: ${val.scrollWidth}px, clientWidth: ${val.clientWidth}px (Overflow: ${val.hasOverflow})`);

    // Capture mobile homepage screenshot for this viewport
    await capture(`homepage_${vp.width}px.png`);
  }

  // --- Step 2: Movie Detail & Movie Player ---
  console.log('\n--- 2. MOVIE PLAYER & MODAL VERIFICATION (390px iPhone) ---');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true
  });
  await send('Page.navigate', { url: `http://localhost:${SERVER_PORT}/#title=533535-movie` });
  await new Promise(r => setTimeout(r, 2000));
  await capture('movie_detail_390px.png');

  // Open Movie Player
  await send('Page.navigate', { url: `http://localhost:${SERVER_PORT}/#w=533535-movie` });
  await new Promise(r => setTimeout(r, 2500));
  await capture('movie_player_390px.png');

  // --- Step 3: Web Series Detail & Series Player ---
  console.log('\n--- 3. SERIES PLAYER, SEASON & EPISODE CONTROLS (390px iPhone) ---');
  await send('Page.navigate', { url: `http://localhost:${SERVER_PORT}/#title=1399-tv` });
  await new Promise(r => setTimeout(r, 2000));
  await capture('series_detail_390px.png');

  // Open Series Player S1 E1
  await send('Page.navigate', { url: `http://localhost:${SERVER_PORT}/#w=1399-tv-1-1` });
  await new Promise(r => setTimeout(r, 2500));
  await capture('series_player_s1e1_390px.png');

  // Verify Season Selector & Episode Selector
  const epUiCheck = await send('Runtime.evaluate', {
    expression: `({
      seasonSelectExists: Boolean(document.getElementById('watch-season-select') || document.getElementById('watch-mobile-season-select')),
      episodeSelectExists: Boolean(document.getElementById('watch-episode-select') || document.getElementById('watch-mobile-episode-select')),
      prevBtnExists: Boolean(document.getElementById('watch-prev-ep-btn') || document.getElementById('watch-mobile-prev-ep')),
      nextBtnExists: Boolean(document.getElementById('watch-next-ep-btn') || document.getElementById('watch-mobile-next-ep')),
      activeIndicator: (document.getElementById('watch-ep-indicator') || {}).textContent || ''
    })`,
    returnByValue: true
  });
  console.log('  Series Controls DOM Status:', epUiCheck.result.value);

  // Switch to S1 E2
  await send('Runtime.evaluate', {
    expression: "location.hash = '#w=1399-tv-1-2';"
  });
  await new Promise(r => setTimeout(r, 2000));
  await capture('series_player_s1e2_390px.png');

  // --- Step 4: Server Selector Modal ---
  console.log('\n--- 4. SERVER SELECTOR MODAL AUDIT ---');
  await send('Runtime.evaluate', {
    expression: `if (window.Netflix4uModal && window.Netflix4uModal.openServerPicker) {
      window.Netflix4uModal.openServerPicker(533535, 'movie', 1, 1, '', 'Deadpool & Wolverine', 2024, 'tt6263850', '533535', '');
    }`
  });
  await new Promise(r => setTimeout(r, 1500));
  await capture('server_selector_modal_390px.png');

  // --- Step 5: Category & Footer Results ---
  console.log('\n--- 5. CATEGORY RESULTS & FOOTER AUDIT ---');
  await send('Page.navigate', { url: `http://localhost:${SERVER_PORT}/movies` });
  await new Promise(r => setTimeout(r, 2000));
  await capture('category_movies_390px.png');

  await send('Page.navigate', { url: `http://localhost:${SERVER_PORT}/series` });
  await new Promise(r => setTimeout(r, 2000));
  await capture('category_series_390px.png');

  // Footer on Homepage
  await send('Page.navigate', { url: `http://localhost:${SERVER_PORT}/` });
  await new Promise(r => setTimeout(r, 1500));
  await send('Runtime.evaluate', {
    expression: 'window.scrollTo(0, document.body.scrollHeight);'
  });
  await new Promise(r => setTimeout(r, 1000));
  await capture('footer_results_390px.png');

  // Cleanup
  chrome.kill();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(e) {}

  console.log('\n====================================================');
  console.log('PHASE 11 REAL MOBILE SCREENSHOT VERIFICATION COMPLETE');
  console.log('Saved to audit_artifacts/mobile_verification/ and brain/screenshots/');
  console.log('====================================================');
}

run().catch(err => {
  console.error('Mobile QA Runner Error:', err);
  process.exit(1);
});
