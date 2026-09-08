const { spawn } = require('child_process');
const http = require('http');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9240;

async function run() {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,900',
    'http://localhost:4173/'
  ]);

  await new Promise(r => setTimeout(r, 1500));

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

    send('Runtime.enable');
    send('Page.enable');

    console.log('=== TEST 1: HOME PAGE NAVIGATION ===');
    await new Promise(r => setTimeout(r, 1500));
    console.log('Step 1.1 Home URL:', await evalExpr('window.location.href'));

    // Click first movie
    const clickedMovie = await evalExpr(`(() => {
      const link = document.querySelector('a[href*="/movie/"], a[href*="/series/"]');
      if (link) {
        link.click();
        return { clicked: true, href: link.href };
      }
      return { clicked: false };
    })()`);
    console.log('Step 1.2 Clicked movie:', clickedMovie);

    await new Promise(r => setTimeout(r, 2500));
    console.log('Step 1.3 Detail Page URL:', await evalExpr('window.location.href'));

    // Inspect player and trailer iframes
    const iframes = await evalExpr(`(() => {
      return Array.from(document.querySelectorAll('iframe')).map(f => ({
        title: f.title,
        src: f.src,
        className: f.className
      }));
    })()`);
    console.log('Step 1.4 Iframes on page:', JSON.stringify(iframes, null, 2));

    // Inspect server buttons
    const serverButtons = await evalExpr(`(() => {
      const btns = Array.from(document.querySelectorAll('#player button')).map(b => ({
        text: b.innerText,
        active: b.getAttribute('aria-pressed') === 'true' || b.className.includes('bg-[var(--color-accent)]')
      }));
      return btns;
    })()`);
    console.log('Step 1.5 Server buttons in player:', JSON.stringify(serverButtons, null, 2));

    // Click Back Button (from History)
    console.log('\n=== TEST 2: BACK BUTTON FROM INTERNAL NAVIGATION ===');
    const backClick1 = await evalExpr(`(() => {
      const btn = document.querySelector('a[aria-label="Go back"], button[aria-label="Go back"]');
      if (btn) {
        btn.click();
        return { clicked: true, tagName: btn.tagName, href: btn.href };
      }
      return { clicked: false };
    })()`);
    console.log('Step 2.1 Back button clicked:', backClick1);

    await new Promise(r => setTimeout(r, 1500));
    console.log('Step 2.2 URL after back click (expected Home):', await evalExpr('window.location.href'));

    // Direct Visit Test
    console.log('\n=== TEST 3: BACK BUTTON FROM DIRECT URL VISIT (NO PRIOR HISTORY) ===');
    await evalExpr('window.location.href = "http://localhost:4173/movie/18025"');
    await new Promise(r => setTimeout(r, 2500));
    console.log('Step 3.1 Direct visit URL:', await evalExpr('window.location.href'));

    const backClick2 = await evalExpr(`(() => {
      const btn = document.querySelector('a[aria-label="Go back"], button[aria-label="Go back"]');
      if (btn) {
        btn.click();
        return { clicked: true, tagName: btn.tagName };
      }
      return { clicked: false };
    })()`);
    console.log('Step 3.2 Back button clicked on fresh load:', backClick2);

    await new Promise(r => setTimeout(r, 1500));
    console.log('Step 3.3 URL after direct back click (expected Home):', await evalExpr('window.location.href'));

    edge.kill();
    console.log('\n🎉 ALL VERIFICATION TESTS COMPLETED!');
    process.exit(0);
  });
}
run();
