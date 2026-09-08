const { spawn } = require('child_process');
const http = require('http');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9299;

const testUrls = [
  'http://localhost:4173/',
  'http://localhost:4173/movies',
  'http://localhost:4173/series',
  'http://localhost:4173/anime',
  'http://localhost:4173/kdrama',
  'http://localhost:4173/bollywood',
  'http://localhost:4173/trending',
  'http://localhost:4173/search?q=mirzapur',
  'http://localhost:4173/movie/18025',
  'http://localhost:4173/series/301134',
  'http://localhost:4173/about',
  'http://localhost:4173/contact',
  'http://localhost:4173/nonexistent-route-for-testing'
];

async function run() {
  console.log('🔍 Launching Deep Bug & Console Error Hunter...\n');

  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,900',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 2500));

  const pages = await new Promise((res, rej) => {
    http.get('http://localhost:' + PORT + '/json/list', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });

  const page = pages.find(p => p.type === 'page');
  const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);

  await new Promise(res => ws.addEventListener('open', res));

  let msgId = 1;
  const send = (method, params = {}) => {
    const id = msgId++;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise(res => {
      const h = e => {
        const m = JSON.parse(e.data);
        if (m.id === id) { ws.removeEventListener('message', h); res(m.result); }
      };
      ws.addEventListener('message', h);
    });
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');

  const collectedErrors = [];
  const failedRequests = [];

  ws.addEventListener('message', evt => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg.method === 'Runtime.exceptionThrown') {
        collectedErrors.push({
          type: 'UNCAUGHT_EXCEPTION',
          desc: msg.params?.exceptionDetails?.text || '',
          exception: msg.params?.exceptionDetails?.exception?.description || ''
        });
      }
      if (msg.method === 'Console.messageAdded' && msg.params?.message?.level === 'error') {
        collectedErrors.push({
          type: 'CONSOLE_ERROR',
          text: msg.params?.message?.text || ''
        });
      }
      if (msg.method === 'Network.responseReceived') {
        const resp = msg.params?.response;
        // Ignore expected 404 on testing nonexistent route, and 302/200
        if (resp && resp.status >= 400 && !resp.url.includes('nonexistent-route') && !resp.url.includes('favicon.ico')) {
          failedRequests.push({
            url: resp.url,
            status: resp.status,
            statusText: resp.statusText
          });
        }
      }
    } catch(e) {}
  });

  for (const url of testUrls) {
    console.log(`Checking: ${url}`);
    await send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 2000));

    // Check for horizontal overflow
    const overflow = await send('Runtime.evaluate', {
      expression: 'document.documentElement.scrollWidth > window.innerWidth'
    });
    if (overflow?.result?.value) {
      collectedErrors.push({
        type: 'OVERFLOW_BUG',
        url,
        desc: 'Horizontal scroll detected!'
      });
    }

    // Check for broken images on page
    const brokenImages = await send('Runtime.evaluate', {
      expression: `(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        const broken = imgs.filter(i => i.complete && i.naturalWidth === 0 && !i.src.includes('data:image'));
        return broken.map(i => i.src);
      })()`,
      returnByValue: true
    });
    if (brokenImages?.result?.value && brokenImages.result.value.length > 0) {
      collectedErrors.push({
        type: 'BROKEN_IMAGES',
        url,
        images: brokenImages.result.value
      });
    }
  }

  console.log('\n========================================');
  console.log('AUDIT SUMMARY:');
  console.log('========================================');
  console.log(`Total Uncaught Exceptions & Console Errors: ${collectedErrors.length}`);
  console.log(`Total Failed Network Requests: ${failedRequests.length}`);

  if (collectedErrors.length > 0) {
    console.log('\n❌ Errors Found:');
    console.dir(collectedErrors, { depth: null });
  }

  if (failedRequests.length > 0) {
    console.log('\n❌ Failed Network Requests:');
    console.dir(failedRequests, { depth: null });
  }

  if (collectedErrors.length === 0 && failedRequests.length === 0) {
    console.log('\n🎉 ZERO ERRORS! The application has 0 runtime exceptions, 0 broken images, 0 horizontal overflows, and 0 failed asset requests.');
  }

  edge.kill();
  process.exit(collectedErrors.length === 0 ? 0 : 1);
}

run().catch(e => {
  console.error('Test script error:', e);
  process.exit(1);
});
