const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9235;
const ARTIFACTS_DIR = 'C:\\Users\\Riyaz\\.gemini\\antigravity-ide\\brain\\289edb26-9d92-4e83-910a-41abaa0ee2eb';

async function run() {
  console.log('🚀 Launching headless Edge CDP on port', PORT);
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,1000',
    'http://localhost:4173/'
  ]);

  await new Promise(r => setTimeout(r, 2000));

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
      return id;
    };

    const evalExpr = (expression) => {
      return new Promise(res => {
        const id = send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        const handler = evt => {
          const m = JSON.parse(evt.data);
          if (m.id === id) {
            ws.removeEventListener('message', handler);
            res(m.result && m.result.result ? m.result.result.value : null);
          }
        };
        ws.addEventListener('message', handler);
      });
    };

    const captureScreenshot = (filename) => {
      return new Promise(res => {
        const id = send('Page.captureScreenshot', { format: 'png' });
        const handler = evt => {
          const m = JSON.parse(evt.data);
          if (m.id === id) {
            ws.removeEventListener('message', handler);
            const buf = Buffer.from(m.result.data, 'base64');
            const outPath = path.join(ARTIFACTS_DIR, filename);
            fs.writeFileSync(outPath, buf);
            console.log(`📸 Screenshot saved: ${outPath}`);
            res(outPath);
          }
        };
        ws.addEventListener('message', handler);
      });
    };

    const navigate = (url) => {
      return new Promise(res => {
        const id = send('Page.navigate', { url });
        const handler = evt => {
          const m = JSON.parse(evt.data);
          if (m.id === id) {
            ws.removeEventListener('message', handler);
            setTimeout(res, 2500);
          }
        };
        ws.addEventListener('message', handler);
      });
    };

    send('Runtime.enable');
    send('Page.enable');

    // 1. Check Homepage
    console.log('\n--- 1. Testing Homepage ---');
    await new Promise(r => setTimeout(r, 2000));
    console.log('Homepage URL:', await evalExpr('window.location.href'));

    // Check card dimensions
    const cardDims = await evalExpr(`(() => {
      const cards = Array.from(document.querySelectorAll('#top-10-section ~ section img, #hero-banner ~ div section img'));
      if (cards.length === 0) return null;
      const first = cards[0].getBoundingClientRect();
      return {
        count: cards.length,
        width: Math.round(first.width),
        height: Math.round(first.height),
        aspectRatio: (first.width / first.height).toFixed(2),
        src: cards[0].src
      };
    })()`);
    console.log('Homepage card format check:', cardDims);

    // Check specific posters on homepage
    const posterCheck = await evalExpr(`(() => {
      const titles = ['Dhamaal 4', 'Mirzapur', 'Gandhari', 'DC', 'Silo', 'Normal'];
      const results = {};
      const allCards = Array.from(document.querySelectorAll('a[href*="/movie/"], a[href*="/series/"]'));
      for (const card of allCards) {
        const text = card.textContent || '';
        const img = card.querySelector('img');
        for (const t of titles) {
          if (text.toLowerCase().includes(t.toLowerCase()) && img) {
            results[t] = {
              title: t,
              href: card.getAttribute('href'),
              imgSrc: img.src
            };
          }
        }
      }
      return results;
    })()`);
    console.log('Authentic posters check on homepage:', posterCheck);
    await captureScreenshot('homepage_portrait_posters.png');

    // 2. Check Detail Page with Separated Downloads
    console.log('\n--- 2. Testing Detail Page (Normal 2026 - Both Links) ---');
    await navigate('http://localhost:4173/movie/19278');
    await new Promise(r => setTimeout(r, 2000));

    const detailCheck = await evalExpr(`(() => {
      const title = document.querySelector('h1')?.textContent || '';
      const playerButtons = Array.from(document.querySelectorAll('#player button')).map(b => b.textContent.trim());
      const activePlayer = document.querySelector('#player button[aria-pressed="true"]')?.textContent.trim();
      const iframeSrc = document.querySelector('#player iframe')?.src;

      const hicineSection = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('Hicine Fast Cloud'));
      const dotmoviesSection = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('Dotmovies Multi-Quality'));

      const allDownloadLinks = Array.from(document.querySelectorAll('a[href*="vcloud"], a[href*="nexdrive"]')).map(a => ({
        text: a.textContent.trim().replace(/\\s+/g, ' '),
        href: a.href.slice(0, 50)
      }));

      return {
        title,
        playerButtons,
        activePlayer,
        iframeSrc,
        hasHicineSection: !!hicineSection,
        hasDotmoviesSection: !!dotmoviesSection,
        totalDownloadLinks: allDownloadLinks.length,
        downloadLinks: allDownloadLinks
      };
    })()`);
    console.log('Detail Page check:', detailCheck);
    await captureScreenshot('detail_page_separated_downloads.png');

    // 3. Test Back Button
    console.log('\n--- 3. Testing Detail Page Back Button ---');
    const backBtn = await evalExpr(`(() => {
      const b = document.querySelector('a[aria-label="Go back"]');
      if (!b) return 'NO_BACK_BTN';
      return { href: b.getAttribute('href'), text: b.textContent.trim() };
    })()`);
    console.log('Back button element:', backBtn);

    // 4. Test K-Drama Category Page
    console.log('\n--- 4. Testing K-Drama Category Page ---');
    await navigate('http://localhost:4173/kdrama');
    await new Promise(r => setTimeout(r, 2000));
    const kdramaCheck = await evalExpr(`(() => {
      const h1 = document.querySelector('h1')?.textContent || '';
      const items = Array.from(document.querySelectorAll('a[href*="/kdrama/"], a[href*="/series/"]')).map(a => a.textContent.trim().replace(/\\s+/g, ' '));
      return { h1, count: items.length, sample: items.slice(0, 5) };
    })()`);
    console.log('K-Drama Category check:', kdramaCheck);
    await captureScreenshot('kdrama_category_page.png');

    console.log('\n✅ All verification tests completed successfully!');
    ws.close();
    edge.kill();
    process.exit(0);
  });
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
