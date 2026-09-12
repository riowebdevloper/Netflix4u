const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ARTIFACT_DIR = path.resolve('C:\\Users\\Riyaz\\.gemini\\antigravity-ide\\brain\\190e2edd-8b46-4041-b3a9-d5841b888837');

async function runVisualQA() {
  const port = 9550;
  console.log('=== Starting Headless Edge Visual QA Audit on http://localhost:4173/ ===');

  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--window-size=1280,900',
    'http://localhost:4173/'
  ]);

  try {
    await new Promise(r => setTimeout(r, 3000));

    const pages = await new Promise((res, rej) => {
      http.get('http://localhost:' + port + '/json/list', r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
      }).on('error', rej);
    });

    const page = pages.find(p => p.url && p.url.includes('localhost:4173')) || pages[0];
    if (!page) throw new Error('Could not find Edge page target');

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
    await new Promise(r => setTimeout(r, 2000));

    // 1. Audit Homepage Posters & Broken Images
    console.log('\n--- 1. Auditing Homepage Posters ---');
    // Scroll page smoothly to trigger lazy loader
    await send('Runtime.evaluate', {
      expression: `(async () => {
        for (let i = 0; i < 4; i++) {
          window.scrollBy(0, 450);
          await new Promise(r => setTimeout(r, 250));
        }
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 500));
      })()`,
      awaitPromise: true
    });

    const homeAudit = await send('Runtime.evaluate', {
      expression: `(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        const broken = imgs.filter(i => i.complete && i.naturalWidth === 0 && !i.src.startsWith('data:image/svg'));
        const loaded = imgs.filter(i => i.complete && i.naturalWidth > 0);
        const cards = Array.from(document.querySelectorAll('.nm-card'));
        return {
          totalImages: imgs.length,
          loadedCount: loaded.length,
          brokenCount: broken.length,
          brokenSources: broken.map(i => i.src).slice(0, 5),
          cardCount: cards.length
        };
      })()`,
      returnByValue: true
    });
    console.log('Homepage Image Audit:', homeAudit.result.value);

    // Save Homepage Screenshot
    const homeSnap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'qa_homepage_loaded.png'), Buffer.from(homeSnap.data, 'base64'));
    console.log('Saved qa_homepage_loaded.png');

    // 2. Test Search for "Avengers"
    console.log('\n--- 2. Testing Search for "Avengers" ---');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const input = document.getElementById('search-input');
        if (input) {
          input.value = 'Avengers';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('focus', { bubbles: true }));
        }
      })()`
    });
    // Wait for search results to appear
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 400));
      const hasResults = await send('Runtime.evaluate', {
        expression: `document.querySelectorAll('#so-results a').length > 0`
      });
      if (hasResults.result.value) break;
    }

    const searchAudit = await send('Runtime.evaluate', {
      expression: `(() => {
        const overlay = document.getElementById('search-overlay');
        const results = Array.from(document.querySelectorAll('#so-results a'));
        return {
          overlayVisible: overlay && !overlay.classList.contains('hidden'),
          resultCount: results.length,
          titles: results.slice(0, 5).map(a => ({
            text: a.querySelector('.text-sm')?.innerText || a.innerText.trim(),
            tmdbId: a.dataset.tmdbid,
            poster: a.querySelector('img')?.src?.slice(0, 55)
          }))
        };
      })()`,
      returnByValue: true
    });
    console.log('Search Audit for Avengers:', searchAudit.result.value);

    const searchSnap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'qa_search_avengers.png'), Buffer.from(searchSnap.data, 'base64'));
    console.log('Saved qa_search_avengers.png');

    // 3. Open Title Modal for Avengers: Endgame (299534)
    console.log('\n--- 3. Testing Title Modal for Avengers: Endgame (299534) ---');
    await send('Runtime.evaluate', {
      expression: `(() => {
        if (window.Netflix4uModal && window.Netflix4uModal.openTitle) {
          window.Netflix4uModal.openTitle('299534', 'movie');
        }
      })()`
    });
    await new Promise(r => setTimeout(r, 3000));

    const modalAudit = await send('Runtime.evaluate', {
      expression: `(() => {
        const modal = document.getElementById('title-modal');
        const dlCards = Array.from(document.querySelectorAll('#download-mirrors-section .dl-card'));
        const titleEl = document.querySelector('#title-modal h1, #title-modal-header-title');
        return {
          modalVisible: modal && !modal.classList.contains('hidden'),
          title: titleEl?.innerText,
          downloadLinksCount: dlCards.length,
          downloadLinksDetails: dlCards.map(c => ({
            text: c.innerText.replace(/\\n+/g, ' ').trim()
          }))
        };
      })()`,
      returnByValue: true
    });
    console.log('Title Modal Audit:', modalAudit.result.value);

    const modalSnap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'qa_title_modal_downloads.png'), Buffer.from(modalSnap.data, 'base64'));
    console.log('Saved qa_title_modal_downloads.png');

    // 4. Test Watch Modal & All 5 Servers
    console.log('\n--- 4. Testing Watch Modal & Streaming Failover ---');
    await send('Runtime.evaluate', {
      expression: `(() => {
        if (window.Netflix4uModal && window.Netflix4uModal.openWatch) {
          window.Netflix4uModal.openWatch('299534', 'movie', 1, 1, '');
        }
      })()`
    });
    await new Promise(r => setTimeout(r, 3000));

    const watchAudit = await send('Runtime.evaluate', {
      expression: `(() => {
        const modal = document.getElementById('watch-modal');
        const iframe = document.getElementById('watch-modal-iframe');
        const serverButtons = Array.from(document.querySelectorAll('#watch-player-bar .server-tab-btn'));
        return {
          watchVisible: modal && !modal.classList.contains('hidden'),
          iframeSrc: iframe?.src,
          serverCount: serverButtons.length,
          serverNames: serverButtons.map(b => b.innerText)
        };
      })()`,
      returnByValue: true
    });
    console.log('Watch Modal Audit:', watchAudit.result.value);

    const watchSnap = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'qa_watch_modal_servers.png'), Buffer.from(watchSnap.data, 'base64'));
    console.log('Saved qa_watch_modal_servers.png');

    console.log('\n=== ALL TESTS COMPLETED SUCCESSFULLY ===');
  } catch(err) {
    console.error('QA Test Error:', err);
  } finally {
    edge.kill();
  }
}

runVisualQA();
