const cp = require('child_process');
const http = require('http');

async function testSeries() {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const port = 9226;
  const edgeProc = cp.spawn(edgePath, [
    '--headless',
    '--disable-gpu',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + process.env.TEMP + '\\edge_qa_' + Date.now(),
    'http://localhost:4173/series/91830-silo-2026-season-3-english-audio-web-dl-720p-480p-1080p-ep-01-added'
  ]);
  
  await new Promise(r => setTimeout(r, 2500));
  
  const versionData = await new Promise((res, rej) => {
    http.get('http://127.0.0.1:' + port + '/json/version', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
  
  const WS = globalThis.WebSocket;
  const ws = new WS(versionData.webSocketDebuggerUrl);
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  
  let msgId = 1;
  function send(method, params = {}) {
    return new Promise(resolve => {
      const id = msgId++;
      const handler = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  const targets = await send('Target.getTargets');
  const pageTarget = targets.targetInfos.find(t => t.type === 'page');
  const { sessionId } = await send('Target.attachToTarget', { targetId: pageTarget.targetId, flatten: true });

  function sendSession(method, params = {}) {
    return new Promise(resolve => {
      const id = msgId++;
      const handler = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, sessionId, method, params }));
    });
  }

  // Click Show Downloads
  await sendSession('Runtime.evaluate', {
    expression: '(() => { const b = Array.from(document.querySelectorAll("button")).find(x => x.textContent.includes("Download")); if (b) b.click(); })()'
  });

  await new Promise(r => setTimeout(r, 800));

  const result = await sendSession('Runtime.evaluate', {
    expression: 'Array.from(document.querySelectorAll("#download-links a")).map(a => ({ text: a.innerText.replace(/\\s+/g, " ").trim(), href: a.href }))',
    returnByValue: true
  });

  console.log('Series download links found:', result.result.value.length);
  if (result.result.value.length > 0) {
    console.log('Sample Series Link:', JSON.stringify(result.result.value[0], null, 2));
  }

  ws.close();
  edgeProc.kill();
}

testSeries().catch(console.error);
