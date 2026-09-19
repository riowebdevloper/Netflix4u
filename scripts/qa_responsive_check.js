const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const CDP_PORT = 9244;
const SERVER_PORT = 4188;

const VIEWPORTS = [
  320, 360, 375, 390, 412, 430, 480, 540, 600,
  768, 820, 912, 1024, 1280, 1366, 1440, 1536, 1920, 2560
];

async function main() {
  console.log('=== NETFLIX4U RESPONSIVE & AUDIT QA RUNNER ===');
  console.log('1. Starting local dev server on port', SERVER_PORT);
  
  process.env.PORT = String(SERVER_PORT);
  const server = spawn('node', ['server.js'], {
    env: { ...process.env, PORT: String(SERVER_PORT) },
    stdio: 'pipe'
  });

  server.stdout.on('data', d => {
    // console.log('[Server]', d.toString().trim());
  });

  // Wait for server to be responsive
  await new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      http.get(`http://localhost:${SERVER_PORT}/`, res => {
        if (res.statusCode === 200) {
          clearInterval(interval);
          resolve(true);
        }
      }).on('error', () => {
        if (attempts > 30) {
          clearInterval(interval);
          reject(new Error('Server failed to start'));
        }
      });
    }, 200);
  });
  console.log('✓ Server ready at http://localhost:' + SERVER_PORT);

  console.log('2. Launching headless browser on CDP port', CDP_PORT);
  const os = require('os');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-qa-'));
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + CDP_PORT,
    '--remote-debugging-address=127.0.0.1',
    '--user-data-dir=' + tmpDir,
    '--disable-gpu',
    '--no-sandbox',
    `http://localhost:${SERVER_PORT}/`
  ]);

  const pages = await new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      http.get(`http://127.0.0.1:${CDP_PORT}/json/list`, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const list = JSON.parse(data);
            if (Array.isArray(list) && list.length > 0) {
              clearInterval(interval);
              resolve(list);
            }
          } catch(e) {}
        });
      }).on('error', () => {
        if (attempts > 40) {
          clearInterval(interval);
          reject(new Error('Chrome CDP failed to start'));
        }
      });
    }, 250);
  });

  const page = pages.find(p => p.type === 'page') || pages[0];
  if (!page) throw new Error('No browser page found');

  const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });

  let msgId = 1;
  const send = (method, params = {}) => {
    return new Promise(res => {
      const id = msgId++;
      const handler = evt => {
        const m = JSON.parse(evt.data);
        if (m.id === id) {
          ws.removeEventListener('message', handler);
          res(m.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  const evalExpr = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res && res.result ? res.result.value : null;
  };

  await send('Page.enable');
  await send('DOM.enable');

  console.log('3. Navigating to page...');
  await send('Page.navigate', { url: `http://localhost:${SERVER_PORT}/` });
  await new Promise(r => setTimeout(r, 2500));

  console.log('\n4. Testing Responsive Viewports Matrix (320px -> 2560px):');
  let allPassed = true;
  const results = [];

  for (const width of VIEWPORTS) {
    const height = Math.round(width * 0.75) > 900 ? 900 : Math.round(width * 0.75);
    await send('Emulation.setDeviceMetricsOverride', {
      width: width,
      height: height,
      deviceScaleFactor: 1,
      mobile: width < 768
    });

    await new Promise(r => setTimeout(r, 200));

    const check = await evalExpr(`(() => {
      const docEl = document.documentElement;
      const body = document.body;
      const scrollW = docEl.scrollWidth;
      const clientW = docEl.clientWidth;
      const hasOverflow = scrollW > clientW + 1;
      
      const header = document.getElementById('home-header');
      const hero = document.getElementById('hero');
      const searchInput = document.getElementById('search-input');
      
      return {
        width: window.innerWidth,
        clientW: clientW,
        scrollW: scrollW,
        hasOverflow: hasOverflow,
        headerW: header ? header.offsetWidth : null,
        heroW: hero ? hero.offsetWidth : null,
        headerOk: header ? header.offsetWidth <= clientW : true,
        heroOk: hero ? hero.offsetWidth <= clientW : true
      };
    })()`);

    const ok = !check.hasOverflow && check.headerOk && check.heroOk;
    if (!ok) allPassed = false;

    results.push({ width, ...check, pass: ok });
    console.log(`  ${ok ? '✓ PASS' : '✗ FAIL'}: Viewport ${width}px — scrollWidth: ${check.scrollW}px, clientWidth: ${check.clientW}px (Overflow: ${check.hasOverflow})`);
  }

  console.log('\n5. Testing Modal Download Attributes & Title Integration:');
  await evalExpr(`(() => {
    if (window.Netflix4uModal && window.Netflix4uModal.openTitle) {
      window.Netflix4uModal.openTitle(1408162, 'movie');
    }
  })()`);

  // Poll until modal title is rendered or timeout
  for (let t = 0; t < 25; t++) {
    await new Promise(r => setTimeout(r, 200));
    const title = await evalExpr(`document.getElementById('modal-title') ? document.getElementById('modal-title').textContent.trim() : ''`);
    if (title) break;
  }

  const modalResult = await evalExpr(`(() => {
    const titleEl = document.getElementById('modal-title');
    const modalTitleText = titleEl ? titleEl.textContent.trim() : null;
    const modalTitleAttr = titleEl ? titleEl.getAttribute('data-modal-title') : null;
    const fastDlButtons = Array.from(document.querySelectorAll('[data-fast-download]')).map(b => ({
      title: b.getAttribute('data-title'),
      id: b.getAttribute('data-tmdbid'),
      href: b.getAttribute('href')
    }));

    return {
      modalOpen: !document.getElementById('title-modal').classList.contains('hidden'),
      modalTitleText: modalTitleText,
      modalTitleAttr: modalTitleAttr,
      fastDlCount: fastDlButtons.length,
      sampleBtn: fastDlButtons[0]
    };
  })()`);

  console.log('  Modal check result:', JSON.stringify(modalResult, null, 2));

  console.log('\n6. Checking LCP Backdrop Image Dimensions in DOM:');
  const imgCheck = await evalExpr(`(() => {
    const heroImg = document.querySelector('#hero img');
    return {
      src: heroImg ? heroImg.src : null,
      srcset: heroImg ? heroImg.srcset : null,
      fetchpriority: heroImg ? heroImg.getAttribute('fetchpriority') : null,
      naturalWidth: heroImg ? heroImg.naturalWidth : null,
      naturalHeight: heroImg ? heroImg.naturalHeight : null
    };
  })()`);
  console.log('  Hero Image configuration:', JSON.stringify(imgCheck, null, 2));

  console.log('\n7. Checking Console Errors:');
  const consoleErrors = await evalExpr(`(() => {
    return window.__qa_errors || [];
  })()`);
  console.log('  Captured errors:', consoleErrors.length);

  // Close browser and server
  ws.close();
  chrome.kill();
  server.kill();

  console.log('\n========================================');
  console.log('QA RESPONSIVE RESULT:', allPassed ? 'ALL VIEWPORTS PASSED (100%)' : 'SOME VIEWPORTS FAILED');
  console.log('========================================');

  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('QA Runner encountered error:', err);
  process.exit(1);
});
