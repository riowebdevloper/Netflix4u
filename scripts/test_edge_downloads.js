const cp = require('child_process');
const http = require('http');
const fs = require('fs');

async function getWebSocketDebuggerUrl(port) {
  for (let i = 0; i < 30; i++) {
    try {
      const data = await new Promise((res, rej) => {
        http.get(`http://127.0.0.1:${port}/json/version`, r => {
          let d = ''; r.on('data', c => d += c); r.on('end', () => {
            try { res(JSON.parse(d)); } catch(e) { rej(e); }
          });
        }).on('error', rej);
      });
      if (data && data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
    } catch(e) {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('Could not connect to Edge debugger');
}

async function runBrowserTest() {
  console.log('Launching headless Edge for download verification...');
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9224;
  const edgeProc = cp.spawn(edgePath, [
    '--headless',
    '--disable-gpu',
    `--remote-debugging-port=${port}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=' + process.env.TEMP + '\\edge_qa_profile_' + Date.now(),
    'about:blank'
  ]);

  try {
    const wsUrl = await getWebSocketDebuggerUrl(port);
    console.log('Connected to Edge via CDP:', wsUrl);

    const WS = globalThis.WebSocket || require('ws');
    const ws = new WS(wsUrl);
    await new Promise(r => ws.addEventListener('open', r, { once: true }));

    let msgId = 1;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        const handler = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === id) {
            ws.removeEventListener('message', handler);
            resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await send('Target.setDiscoverTargets', { discover: true });
    const targets = await send('Target.getTargets');
    const pageTarget = targets.targetInfos.find(t => t.type === 'page');
    const { sessionId } = await send('Target.attachToTarget', { targetId: pageTarget.targetId, flatten: true });

    function sendSession(method, params = {}) {
      return new Promise((resolve) => {
        const id = msgId++;
        const handler = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.id === id) {
            ws.removeEventListener('message', handler);
            resolve(msg.result);
          }
        };
        ws.addEventListener('message', handler);
        ws.send(JSON.stringify({ id, sessionId, method, params }));
      });
    }

    await sendSession('Page.enable');
    await sendSession('Runtime.enable');
    await sendSession('Network.enable');

    console.log('Navigating to http://localhost:4173/movie/mirzapur-the-movie-2026 ...');
    await sendSession('Page.navigate', { url: 'http://localhost:4173/movie/mirzapur-the-movie-2026' });

    await new Promise(r => setTimeout(r, 2500));

    // Check if handlers exist
    const checkHandlers = await sendSession('Runtime.evaluate', {
      expression: `JSON.stringify({
        hasResolver: typeof window.handleFastCloudDownload === 'function',
        hasHrefHelper: typeof window.getFastCloudDownloadHref === 'function'
      })`
    });
    console.log('Handler check:', checkHandlers.result.value);

    // Click Download button to open download panel
    console.log('Clicking movie hero Download button...');
    const clickShowDownloads = await sendSession('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const dlBtn = btns.find(b => b.textContent.includes('Download'));
        if (dlBtn) {
          dlBtn.click();
          return { clicked: true, text: dlBtn.textContent };
        }
        return { clicked: false };
      })()`,
      returnByValue: true
    });
    console.log('Click Download button result:', clickShowDownloads.result.value);

    await new Promise(r => setTimeout(r, 1000));

    // Check download links rendered in the DOM
    const inspectLinks = await sendSession('Runtime.evaluate', {
      expression: `(() => {
        const panel = document.getElementById('download-links');
        if (!panel) return { foundPanel: false };
        const links = Array.from(panel.querySelectorAll('a'));
        return {
          foundPanel: true,
          linkCount: links.length,
          links: links.map(a => ({
            text: a.textContent.replace(/\\s+/g, ' ').trim(),
            href: a.href
          }))
        };
      })()`,
      returnByValue: true
    });
    console.log('Download Panel DOM:', JSON.stringify(inspectLinks.result.value, null, 2));

    // Capture screenshot of the download panel
    const screenshot = await sendSession('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('audit_artifacts/browser_download_panel_verified.png', Buffer.from(screenshot.data, 'base64'));
    console.log('Saved screenshot to audit_artifacts/browser_download_panel_verified.png');

    // Click the first Fast Cloud link to trigger handleFastCloudDownload
    console.log('Clicking the first Fast Cloud link...');
    const clickFastLink = await sendSession('Runtime.evaluate', {
      expression: `(() => {
        const panel = document.getElementById('download-links');
        const firstLink = panel && panel.querySelector('a');
        if (firstLink) {
          firstLink.click();
          return { clicked: true, htmlDuringClick: firstLink.innerHTML };
        }
        return { clicked: false };
      })()`,
      returnByValue: true
    });
    console.log('Click Fast Link result:', clickFastLink.result.value);

    await new Promise(r => setTimeout(r, 1200));

    // Check button state after click
    const checkStateAfter = await sendSession('Runtime.evaluate', {
      expression: `(() => {
        const panel = document.getElementById('download-links');
        const firstLink = panel && panel.querySelector('a');
        return { htmlAfter: firstLink ? firstLink.innerHTML : '' };
      })()`,
      returnByValue: true
    });
    console.log('State after resolution:', checkStateAfter.result.value);

    ws.close();
  } finally {
    edgeProc.kill('SIGKILL');
  }
}

runBrowserTest().then(() => console.log('Edge browser test complete!')).catch(e => console.error('Error:', e));
