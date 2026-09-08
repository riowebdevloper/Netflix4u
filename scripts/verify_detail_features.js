const { spawn } = require('child_process');
const http = require('http');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9243;

async function run() {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,1000',
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
    await new Promise(r => setTimeout(r, 2000));

    // Evaluate detail page state
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: `(() => {
          const title = document.querySelector('h1')?.textContent || '';
          const activeServerBtn = document.querySelector('#player button[aria-pressed="true"]')?.textContent || '';
          const allServerBtns = Array.from(document.querySelectorAll('#player button')).map(b => b.textContent.trim()).filter(Boolean);
          const iframeSrc = document.querySelector('#player iframe')?.src || '';
          
          const hicineSection = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('Hicine'));
          const dotmoviesSection = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.includes('Dotmovies'));
          
          const allDlLinks = Array.from(document.querySelectorAll('a[href*="http"]')).filter(a => a.textContent.includes('Download') || a.textContent.includes('Fast Cloud') || a.closest('.grid'));
          const dlText = allDlLinks.map(a => a.textContent.trim());

          return {
            title,
            activeServerBtn,
            allServerBtns,
            iframeSrc,
            hasHicineSection: !!hicineSection,
            hasDotmoviesSection: !!dotmoviesSection,
            downloadLinksFound: allDlLinks.length,
            sampleDlText: dlText.slice(0, 8)
          };
        })()`,
        returnByValue: true
      }
    }));
  });

  ws.addEventListener('message', evt => {
    const data = JSON.parse(evt.data);
    if (data.id === 1) {
      console.log('DETAIL PAGE VERIFICATION:', JSON.stringify(data.result.result.value, null, 2));
      ws.close();
      edge.kill();
      process.exit(0);
    }
  });
}

run().catch(console.error);
