const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const targetUrl = process.argv[2] || 'http://localhost:4173/series/dotmobiz-94715';
const outFileName = process.argv[3] || 'series_cast_lioness_verified.png';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9290;
const ARTIFACTS_DIR = 'C:\\Users\\Riyaz\\.gemini\\antigravity-ide\\brain\\289edb26-9d92-4e83-910a-41abaa0ee2eb';

async function capture() {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + PORT,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1280,1200',
    targetUrl
  ]);

  await new Promise(r => setTimeout(r, 4000));

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
      return new Promise(res => {
        const h = e => {
          const m = JSON.parse(e.data);
          if (m.id === id) { ws.removeEventListener('message', h); res(m.result); }
        };
        ws.addEventListener('message', h);
      });
    };

    await send('Runtime.enable');
    await send('Page.enable');

    // Wait for page to render
    for (let i = 0; i < 20; i++) {
      const chk = await send('Runtime.evaluate', {
        returnByValue: true,
        expression: 'Boolean(document.querySelector("h1") || document.querySelector("h2"))'
      });
      if (chk?.result?.value) break;
      await new Promise(r => setTimeout(r, 500));
    }

    // Scroll to cast section
    await send('Runtime.evaluate', {
      expression: `(() => {
        const castH2 = Array.from(document.querySelectorAll("h2")).find(h => h.textContent.trim() === "Cast");
        if (castH2) castH2.scrollIntoView({ behavior: "instant", block: "start" });
      })()`
    });

    // Wait for images to load
    await new Promise(r => setTimeout(r, 3500));

    // Inspect cast cards state
    const evalRes = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const castH2 = Array.from(document.querySelectorAll("h2")).find(h => h.textContent.trim() === "Cast");
        const section = castH2?.closest("section");
        if (!section) return { found: false };
        const cards = Array.from(section.querySelectorAll(".group"));
        return {
          found: true,
          totalCastCount: cards.length,
          cards: cards.slice(0, 6).map(c => {
            const img = c.querySelector("img");
            const pName = c.querySelector("p.font-medium") || c.querySelector("p");
            const pChar = c.querySelector("p.text-gray-500");
            return {
              actor: pName?.textContent?.trim(),
              role: pChar?.textContent?.trim(),
              src: img?.src?.slice(0, 80),
              isTmdb: img?.src?.includes("image.tmdb.org"),
              naturalWidth: img?.naturalWidth,
              naturalHeight: img?.naturalHeight,
              loadedOk: img ? (img.naturalWidth > 0 && img.complete) : false
            };
          })
        };
      })()`
    });

    console.log('FINAL CAST DOM REPORT:', JSON.stringify(evalRes?.result?.value, null, 2));

    const snap = await send('Page.captureScreenshot', { format: 'png' });
    const outPath = path.join(ARTIFACTS_DIR, outFileName);
    fs.writeFileSync(outPath, Buffer.from(snap.data, 'base64'));
    console.log('✅ Captured screenshot to ' + outPath);
    edge.kill();
    process.exit(0);
  });
}

capture().catch(e => { console.error(e); process.exit(1); });
