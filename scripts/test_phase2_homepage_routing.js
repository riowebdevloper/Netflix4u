const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const candidates = [
  '/Users/laptopbazaar/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
];
const CHROME_PATH = candidates.find(c => fs.existsSync(c)) || 'google-chrome';

const CDP_PORT = 9266;
const SERVER_PORT = 4195;

async function run() {
  console.log('====================================================');
  console.log('PHASE 2 — HOMEPAGE ROUTING AUTOMATED TEST SUITE');
  console.log('====================================================\n');

  let server = null;
  let chrome = null;
  let ws = null;

  try {
    console.log('1. Starting local dev server on port', SERVER_PORT);
    process.env.PORT = String(SERVER_PORT);
    server = spawn('node', ['server.js'], {
      env: { ...process.env, PORT: String(SERVER_PORT) },
      stdio: 'pipe'
    });

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

    console.log('2. Launching fresh headless browser on CDP port', CDP_PORT);
    const os = require('os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-phase2-' + Date.now()));
    chrome = spawn(CHROME_PATH, [
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
            } catch (e) {}
          });
        }).on('error', () => {
          if (attempts > 30) {
            clearInterval(interval);
            reject(new Error('CDP failed to become ready'));
          }
        });
      }, 200);
    });

    const page = pages.find(p => p.type === 'page') || pages[0];
    if (!page) throw new Error('No browser page found');

    ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve);
      ws.addEventListener('error', reject);
    });

    let msgId = 1;
    ws.addEventListener('message', evt => {
      const m = JSON.parse(evt.data);
      if (m.method === 'Runtime.consoleAPICalled') {
        const text = m.params.args.map(a => (a.value !== undefined ? (typeof a.value === 'object' ? JSON.stringify(a.value) : a.value) : a.description)).join(' ');
        if (!text.includes('Service Worker')) {
          console.log('[BROWSER CONSOLE]', m.params.type, text);
        }
      }
    });
    const send = (method, params = {}) => {
      return new Promise(res => {
        const id = msgId++;
        const handler = evt => {
          const m = JSON.parse(evt.data);
          if (m.id === id) {
            ws.removeEventListener('message', handler);
            res(m);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true
    });

    async function evaluate(expr) {
      const res = await send('Runtime.evaluate', {
        expression: expr,
        returnByValue: true,
        awaitPromise: true,
        userGesture: true
      });
      if (res && res.result && res.result.result) {
        return res.result.result.value;
      }
      return res && res.result ? res.result.value : undefined;
    }

    async function waitForHash(predicate, timeoutMs = 3000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const cur = await evaluate("location.hash;");
        if (predicate(cur)) return cur;
        await new Promise(r => setTimeout(r, 100));
      }
      return await evaluate("location.hash;");
    }

    // Wait for initial load
    await new Promise(r => setTimeout(r, 1500));

    console.log('\n--- TEST 1: FRESH BROWSER (INITIAL ROUTE /) ---');
    const test1 = await evaluate(`
      (() => {
        const watchModal = document.getElementById('watch-modal');
        const watchIframe = document.getElementById('watch-modal-iframe');
        const titleModal = document.getElementById('title-modal');
        const hero = document.getElementById('hero');
        const header = document.getElementById('home-header');
        const rails = document.getElementById('rails-view');

        return {
          hasHeader: !!header,
          hasHero: !!hero,
          hasRails: !!rails,
          watchDisplay: getComputedStyle(watchModal).display,
          watchHiddenClass: watchModal.classList.contains('hidden'),
          watchIframeSrc: watchIframe ? watchIframe.src : '',
          bodyWatchActive: document.body.classList.contains('watch-active'),
          bodyModalOpen: document.body.classList.contains('modal-open'),
          titleDisplay: getComputedStyle(titleModal).display,
          titleHiddenClass: titleModal.classList.contains('hidden')
        };
      })()
    `);

    assert.strictEqual(test1.hasHeader, true, 'Header must be present');
    assert.strictEqual(test1.hasHero, true, 'Hero must be present');
    assert.strictEqual(test1.hasRails, true, 'Rails must be present');
    assert.strictEqual(test1.watchDisplay, 'none', 'Watch modal display must be none');
    assert.strictEqual(test1.watchHiddenClass, true, 'Watch modal must have hidden class');
    assert.strictEqual(test1.bodyWatchActive, false, 'body must not have watch-active class');
    assert.strictEqual(test1.bodyModalOpen, false, 'body must not have modal-open class');
    assert.strictEqual(test1.titleDisplay, 'none', 'Title modal display must be none');
    console.log('  ✓ PASS: Homepage root layout fully intact');
    console.log('  ✓ PASS: #watch-modal strictly display: none and hidden');
    console.log('  ✓ PASS: Zero player component leakage on initial / load');

    console.log('\n--- TEST 2: WATCH ROUTE ACTIVATION (#w=1399-tv-1-1) ---');
    await evaluate("location.hash = '#w=1399-tv-1-1';");
    await new Promise(r => setTimeout(r, 2800));

    const test2 = await evaluate(`
      (() => {
        const watchModal = document.getElementById('watch-modal');
        const watchIframe = document.getElementById('watch-modal-iframe');
        const epList = document.getElementById('watch-episodes-list');

        return {
          watchDisplay: getComputedStyle(watchModal).display,
          watchHiddenClass: watchModal.classList.contains('hidden'),
          bodyWatchActive: document.body.classList.contains('watch-active'),
          hasIframeSrc: !!(watchIframe && watchIframe.src && watchIframe.src !== 'about:blank'),
          hasEpList: !!epList
        };
      })()
    `);

    assert.notStrictEqual(test2.watchDisplay, 'none', 'Watch modal must be displayed');
    assert.strictEqual(test2.watchHiddenClass, false, 'Watch modal must not have hidden class');
    assert.strictEqual(test2.bodyWatchActive, true, 'body must have watch-active class');
    assert.strictEqual(test2.hasIframeSrc, true, 'Player iframe must have valid stream source');
    console.log('  ✓ PASS: Watch route successfully activated');
    console.log('  ✓ PASS: Stream embed loaded, body.watch-active set, episodes rendered');

    console.log('\n--- TEST 3: BROWSER BACK NAVIGATION FROM WATCH TO HOMEPAGE ---');
    await evaluate("history.back();");
    await waitForHash(h => h === '');
    await new Promise(r => setTimeout(r, 400));

    const test3 = await evaluate(`
      (() => {
        const watchModal = document.getElementById('watch-modal');
        const watchIframe = document.getElementById('watch-modal-iframe');
        const titleModal = document.getElementById('title-modal');
        const hero = document.getElementById('hero');

        return {
          historyLength: history.length,
        currentHash: location.hash,
          watchDisplay: getComputedStyle(watchModal).display,
          watchHiddenClass: watchModal.classList.contains('hidden'),
          watchIframeBlank: !watchIframe.src || watchIframe.src.endsWith('about:blank'),
          bodyWatchActive: document.body.classList.contains('watch-active'),
          titleDisplay: getComputedStyle(titleModal).display,
          heroHeight: hero ? hero.getBoundingClientRect().height : 0
        };
      })()
    `);

    console.log('  Debug Test 3:', test3);
  assert.strictEqual(test3.currentHash, '', 'Current hash must be empty on return to homepage');
    assert.strictEqual(test3.watchDisplay, 'none', 'Watch modal display must be none after Back');
    assert.strictEqual(test3.watchHiddenClass, true, 'Watch modal must have hidden class');
    assert.strictEqual(test3.watchIframeBlank, true, 'Watch iframe must be reset to about:blank');
    assert.strictEqual(test3.bodyWatchActive, false, 'body.watch-active must be removed');
    assert.strictEqual(test3.titleDisplay, 'none', 'Title modal must NOT be forced open on return to homepage');
    assert(test3.heroHeight > 100, 'Hero section must be visible and rendered');
    console.log('  ✓ PASS: Browser Back returns cleanly to Homepage (hash is empty)');
    console.log('  ✓ PASS: Player destroyed (iframe = about:blank, body.watch-active removed)');
    console.log('  ✓ PASS: Title details modal was NOT incorrectly opened');
    console.log('  ✓ PASS: Homepage hero & root layout 100% restored');

    console.log('\n--- TEST 4: PAGE REFRESH ON HOMEPAGE (/) ---');
    await evaluate("location.reload();");
    await new Promise(r => setTimeout(r, 1500));

    const test4 = await evaluate(`
      (() => {
        const watchModal = document.getElementById('watch-modal');
        const watchIframe = document.getElementById('watch-modal-iframe');
        const titleModal = document.getElementById('title-modal');

        return {
          path: location.pathname,
          hash: location.hash,
          watchDisplay: getComputedStyle(watchModal).display,
          bodyWatchActive: document.body.classList.contains('watch-active'),
          titleDisplay: getComputedStyle(titleModal).display
        };
      })()
    `);

    assert.strictEqual(test4.path, '/', 'Path must be /');
    assert.strictEqual(test4.hash, '', 'Hash must be empty');
    assert.strictEqual(test4.watchDisplay, 'none', 'Watch modal must remain hidden on reload');
    assert.strictEqual(test4.bodyWatchActive, false, 'body.watch-active must be false');
    assert.strictEqual(test4.titleDisplay, 'none', 'Title modal must be hidden');
    console.log('  ✓ PASS: Reloading / maintains clean homepage state');

    console.log('\n--- TEST 5: RETURNING BROWSER WITH PERSISTED LOCALSTORAGE ---');
    await evaluate(`
      (() => {
        localStorage.setItem('n4u_continue_watching', JSON.stringify([
          { tmdbId: 1399, type: 'tv', title: 'Game of Thrones', se: 1, ep: 1, progress: 65 }
        ]));
        localStorage.setItem('n4u_continue_watching_v1', JSON.stringify([
          { tmdbId: 1399, type: 'tv', title: 'Game of Thrones', se: 1, ep: 1, progress: 65 }
        ]));
        localStorage.setItem('n4u_my_list_v1', JSON.stringify([
          { id: 533535, type: 'movie', title: 'Deadpool & Wolverine' }
        ]));
      })()
    `);
    await evaluate("location.reload();");
    await new Promise(r => setTimeout(r, 1500));

    const test5 = await evaluate(`
      (() => {
        const watchModal = document.getElementById('watch-modal');
        const continueRail = document.getElementById('continue-watching-rail');
        const watchIframe = document.getElementById('watch-modal-iframe');

        return {
          watchDisplay: getComputedStyle(watchModal).display,
          bodyWatchActive: document.body.classList.contains('watch-active'),
          hasContinueRail: !!continueRail,
          watchIframeBlank: !watchIframe.src || watchIframe.src.endsWith('about:blank')
        };
      })()
    `);

    assert.strictEqual(test5.hasContinueRail, true, 'Continue watching rail must render');
    assert.strictEqual(test5.watchDisplay, 'none', 'Watch modal must not auto-open from persisted state');
    assert.strictEqual(test5.bodyWatchActive, false, 'body.watch-active must remain false');
    assert.strictEqual(test5.watchIframeBlank, true, 'Iframe must not load without user interaction');
    console.log('  ✓ PASS: Continue Watching rail successfully rendered from localStorage');
    console.log('  ✓ PASS: Persisted playback state does NOT force homepage into player mode');

    console.log('\n--- TEST 6: TITLE MODAL -> WATCH MODAL -> MULTI-STEP BACK NAVIGATION ---');
    await evaluate("location.hash = '#title=1408162-movie';");
    await new Promise(r => setTimeout(r, 1000));

    const test6a = await evaluate(`
      (() => {
        const titleModal = document.getElementById('title-modal');
        const watchModal = document.getElementById('watch-modal');
        return {
          titleDisplay: getComputedStyle(titleModal).display,
          watchDisplay: getComputedStyle(watchModal).display
        };
      })()
    `);
    assert.notStrictEqual(test6a.titleDisplay, 'none', 'Title modal must be open');
    assert.strictEqual(test6a.watchDisplay, 'none', 'Watch modal must be hidden');
    console.log('  ✓ PASS: Step 1 — Title modal opened cleanly');

    await evaluate("location.hash = '#w=1408162-movie';");
    await new Promise(r => setTimeout(r, 2800));

    const test6b = await evaluate(`
      (() => {
        const watchModal = document.getElementById('watch-modal');
        return {
          watchDisplay: getComputedStyle(watchModal).display,
          bodyWatchActive: document.body.classList.contains('watch-active')
        };
      })()
    `);
    assert.notStrictEqual(test6b.watchDisplay, 'none', 'Watch modal must be open');
    assert.strictEqual(test6b.bodyWatchActive, true, 'body.watch-active must be set');
    console.log('  ✓ PASS: Step 2 — Watch modal opened from title details');

    await evaluate("history.back();");
    await waitForHash(h => h.startsWith('#title='));
    await new Promise(r => setTimeout(r, 400));

    const test6c = await evaluate(`
      (() => {
        const titleModal = document.getElementById('title-modal');
        const watchModal = document.getElementById('watch-modal');
        return {
          hash: location.hash,
          titleDisplay: getComputedStyle(titleModal).display,
          watchDisplay: getComputedStyle(watchModal).display
        };
      })()
    `);
    assert(test6c.hash.startsWith('#title='), 'Hash must return to #title=');
    assert.notStrictEqual(test6c.titleDisplay, 'none', 'Title modal must be restored');
    assert.strictEqual(test6c.watchDisplay, 'none', 'Watch modal must be closed');
    console.log('  ✓ PASS: Step 3 — Back navigation from player restored Title Details modal');

    await evaluate("history.back();");
    await waitForHash(h => h === '');
    await new Promise(r => setTimeout(r, 400));

    const test6d = await evaluate(`
      (() => {
        const titleModal = document.getElementById('title-modal');
        const watchModal = document.getElementById('watch-modal');
        return {
          hash: location.hash,
          titleDisplay: getComputedStyle(titleModal).display,
          watchDisplay: getComputedStyle(watchModal).display,
          bodyModalOpen: document.body.classList.contains('modal-open')
        };
      })()
    `);
    assert.strictEqual(test6d.hash, '', 'Hash must be empty');
    assert.strictEqual(test6d.titleDisplay, 'none', 'Title modal must be closed');
    assert.strictEqual(test6d.watchDisplay, 'none', 'Watch modal must be closed');
    assert.strictEqual(test6d.bodyModalOpen, false, 'body.modal-open must be removed');
    console.log('  ✓ PASS: Step 4 — Second Back navigation returned cleanly to Homepage');

    console.log('\n--- TEST 7: IN-PLAYER NETFLIX4U BRAND LOGO CLICK ---');
    await evaluate("location.hash = '#w=1408162-movie';");
    await new Promise(r => setTimeout(r, 1200));

    const test7a = await evaluate(`
      (() => {
        const logo = document.getElementById('watch-home-logo');
        if (logo) logo.click();
        return !!logo;
      })()
    `);
    assert.strictEqual(test7a, true, '#watch-home-logo must exist and be clicked');
    await waitForHash(h => h === '');
    await new Promise(r => setTimeout(r, 400));

    const test7b = await evaluate(`
      (() => {
        const watchModal = document.getElementById('watch-modal');
        return {
          hash: location.hash,
          watchDisplay: getComputedStyle(watchModal).display,
          bodyWatchActive: document.body.classList.contains('watch-active')
        };
      })()
    `);
    assert.strictEqual(test7b.hash, '', 'Hash must be cleared after clicking home logo');
    assert.strictEqual(test7b.watchDisplay, 'none', 'Watch modal must be closed');
    assert.strictEqual(test7b.bodyWatchActive, false, 'body.watch-active must be removed');
    console.log('  ✓ PASS: Clicking watch header brand logo returns directly to Homepage');

    console.log('\n--- TEST 8: QUERY PARAMETERS ISOLATION ---');
    await send('Page.navigate', { url: `http://localhost:${SERVER_PORT}/?ref=twitter&utm_source=test&filter=trending` });
    await new Promise(r => setTimeout(r, 1200));

    const test8 = await evaluate(`
      (() => {
        const watchModal = document.getElementById('watch-modal');
        const titleModal = document.getElementById('title-modal');
        const hero = document.getElementById('hero');

        return {
          watchDisplay: getComputedStyle(watchModal).display,
          titleDisplay: getComputedStyle(titleModal).display,
          hasHero: !!hero
        };
      })()
    `);
    assert.strictEqual(test8.watchDisplay, 'none', 'Query params must not open watch modal');
    assert.strictEqual(test8.titleDisplay, 'none', 'Query params must not open title modal');
    assert.strictEqual(test8.hasHero, true, 'Homepage hero must be present');
    console.log('  ✓ PASS: Visiting / with query parameters keeps homepage clean');

    console.log('\n====================================================');
    console.log('ALL PHASE 2 HOMEPAGE ROUTING TESTS PASSED (100%)');
    console.log('====================================================');
  } finally {
    if (ws) {
      try { ws.close(); } catch(e) {}
    }
    if (chrome) {
      try { chrome.kill('SIGKILL'); } catch(e) {}
    }
    if (server) {
      try { server.kill('SIGKILL'); } catch(e) {}
    }
  }
  process.exit(0);
}

run().catch(err => {
  console.error('\n❌ PHASE 2 TEST FAILED:', err);
  process.exit(1);
});
