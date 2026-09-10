const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

async function testLiveProduction() {
  console.log('--- Launching Edge Headless to audit LIVE https://www.netflix4u.in/ ---');
  const port = 9450;
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,800',
    'https://www.netflix4u.in/'
  ]);

  await new Promise(r => setTimeout(r, 4000));

  try {
    const pages = await new Promise((res, rej) => {
      http.get(`http://localhost:${port}/json/list`, r => {
        let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
      }).on('error', rej);
    });

    const page = pages.find(p => p.type === 'page' && p.url.includes('netflix4u.in')) || pages[0];
    if (!page) {
      throw new Error('No page found in Edge CDP');
    }
    console.log('Connected to target page:', page.url);

    const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
    let msgId = 1;
    const callbacks = new Map();

    function sendCmd(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        callbacks.set(id, resolve);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    const consoleLogs = [];
    const failedRequests = [];

    ws.onmessage = evt => {
      const msg = JSON.parse(evt.data);
      if (callbacks.has(msg.id)) {
        const cb = callbacks.get(msg.id);
        callbacks.delete(msg.id);
        cb(msg.result);
      }
      if (msg.method === 'Console.messageAdded') {
        consoleLogs.push({ level: msg.params.message.level, text: msg.params.message.text });
      }
      if (msg.method === 'Runtime.consoleAPICalled') {
        consoleLogs.push({
          type: msg.params.type,
          args: msg.params.args.map(a => a.value || a.description || '')
        });
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        consoleLogs.push({
          type: 'EXCEPTION',
          details: msg.params.exceptionDetails?.text,
          exception: msg.params.exceptionDetails?.exception?.description
        });
      }
      if (msg.method === 'Network.responseReceived') {
        const resp = msg.params.response;
        if (resp.status >= 400) {
          failedRequests.push({ url: resp.url, status: resp.status, statusText: resp.statusText });
        }
      }
      if (msg.method === 'Network.loadingFailed') {
        failedRequests.push({ url: msg.params.requestId, error: msg.params.errorText });
      }
    };

    await new Promise(r => { ws.onopen = r; });

    await sendCmd('Page.enable');
    await sendCmd('Console.enable');
    await sendCmd('Runtime.enable');
    await sendCmd('Network.enable');

    console.log('Waiting 5s for full page hydration & dynamic feeds...');
    await new Promise(r => setTimeout(r, 5000));

    // Audit 1: Check DOM state
    const evalRes1 = await sendCmd('Runtime.evaluate', {
      expression: `(() => {
        return {
          title: document.title,
          heroTitle: document.querySelector('.hero-title, h1, .nf-hero-title')?.innerText || '',
          movieCardCount: document.querySelectorAll('.group, .movie-card, [data-card-id]').length,
          sectionHeadings: Array.from(document.querySelectorAll('h2, h3')).map(h => h.innerText).slice(0, 10),
          directDownloadsNotice: document.body.innerText.includes('Direct Downloads Syncing'),
          localStorageKeys: Object.keys(localStorage),
          windowLocation: window.location.href,
          scriptSrcs: Array.from(document.querySelectorAll('script[src]')).map(s => s.src)
        };
      })()`,
      returnByValue: true
    });

    console.log('=== DOM AUDIT OF LIVE PRODUCTION ===');
    console.log(JSON.stringify(evalRes1.result?.value, null, 2));

    console.log('=== FAILED NETWORK REQUESTS ===');
    console.log(failedRequests.slice(0, 10));

    console.log('=== CONSOLE LOGS & ERRORS ===');
    console.log(consoleLogs.filter(l => l.type === 'error' || l.level === 'error' || l.type === 'EXCEPTION'));

    // Take screenshot of live homepage
    const screenshot = await sendCmd('Page.captureScreenshot', { format: 'png' });
    if (screenshot?.data) {
      fs.writeFileSync('audit_artifacts/live_prod_direct_audit.png', Buffer.from(screenshot.data, 'base64'));
      console.log('Saved audit_artifacts/live_prod_direct_audit.png');
    }

    // Now test navigating to a movie detail page
    console.log('Navigating to Toxic detail page on live site...');
    await sendCmd('Page.navigate', { url: 'https://www.netflix4u.in/movie/dotmobiz-18013' });
    await new Promise(r => setTimeout(r, 5000));

    const evalDetail = await sendCmd('Runtime.evaluate', {
      expression: `(() => {
        const downloadBtns = Array.from(document.querySelectorAll('a, button')).filter(el => {
          const t = el.innerText || '';
          return t.includes('480p') || t.includes('720p') || t.includes('1080p') || t.includes('Download');
        }).map(el => ({ text: el.innerText, href: el.href || '' }));

        return {
          title: document.title,
          heading: document.querySelector('h1')?.innerText || '',
          hasPlayer: !!document.querySelector('iframe, video'),
          playerSrc: document.querySelector('iframe')?.src || '',
          downloadButtons: downloadBtns,
          bodySnippet: document.body.innerText.slice(0, 500)
        };
      })()`,
      returnByValue: true
    });

    console.log('=== DETAIL PAGE AUDIT (Toxic dotmobiz-18013) ===');
    console.log(JSON.stringify(evalDetail.result?.value, null, 2));

    const detailScreenshot = await sendCmd('Page.captureScreenshot', { format: 'png' });
    if (detailScreenshot?.data) {
      fs.writeFileSync('audit_artifacts/live_prod_detail_audit.png', Buffer.from(detailScreenshot.data, 'base64'));
      console.log('Saved audit_artifacts/live_prod_detail_audit.png');
    }

    edge.kill();
    console.log('--- Edge Headless audit finished ---');
  } catch (err) {
    console.error('Audit failed:', err);
    edge.kill();
  }
}

testLiveProduction();
