const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DEBUG_PORT = 9396;
const OUT_DIR = 'C:\\Users\\Riyaz\\.gemini\\antigravity-ide\\brain\\190e2edd-8b46-4041-b3a9-d5841b888837';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

(async () => {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + DEBUG_PORT,
    '--disable-gpu',
    '--disable-extensions',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const tabs = await fetchJson('http://127.0.0.1:' + DEBUG_PORT + '/json');
  const pageTarget = tabs.find(t => t.type === 'page' && !t.url.startsWith('chrome-extension://')) || tabs[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  const send = (method, params = {}) => new Promise(res => {
    const msgId = id++;
    const h = msg => {
      const d = JSON.parse(msg.data);
      if (d.id === msgId) { ws.removeEventListener('message', h); res(d.result); }
    };
    ws.addEventListener('message', h);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');

  // Listen to console
  ws.addEventListener('message', m => {
    const d = JSON.parse(m.data);
    if (d.method === 'Runtime.consoleAPICalled') {
      console.log('[BROWSER CONSOLE]', d.params.type, d.params.args?.map(a => a.value || a.description).join(' '));
    }
  });

  // Set desktop viewport 1440x900
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log('--- 1. Testing Homepage Footer ---');
  await send('Page.navigate', { url: 'https://www.netflix4u.in/' });
  await new Promise(r => setTimeout(r, 4000));

  // Scroll to bottom
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.body.scrollHeight)' });
  await new Promise(r => setTimeout(r, 1000));
  const homeFooterShot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT_DIR, 'debug_home_footer.png'), Buffer.from(homeFooterShot.data, 'base64'));
  console.log('Saved debug_home_footer.png');

  console.log('--- 2. Testing Movie Detail Page (Toxic 18013) ---');
  await send('Page.navigate', { url: 'https://www.netflix4u.in/movie/18013' });
  await new Promise(r => setTimeout(r, 4000));

  // Capture hero & info
  const movieHeroShot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT_DIR, 'debug_movie_hero.png'), Buffer.from(movieHeroShot.data, 'base64'));
  console.log('Saved debug_movie_hero.png');

  // Scroll to player & downloads
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0, 900)' });
  await new Promise(r => setTimeout(r, 1000));
  const moviePlayerShot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT_DIR, 'debug_movie_player.png'), Buffer.from(moviePlayerShot.data, 'base64'));
  console.log('Saved debug_movie_player.png');

  // Check detail page footer
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.body.scrollHeight)' });
  await new Promise(r => setTimeout(r, 1000));
  const movieFooterShot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT_DIR, 'debug_movie_footer.png'), Buffer.from(movieFooterShot.data, 'base64'));
  console.log('Saved debug_movie_footer.png');

  // Check movie info DOM details
  const movieDomInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        title: document.querySelector('h1')?.innerText,
        description: document.querySelector('p.leading-relaxed')?.innerText,
        allParagraphs: Array.from(document.querySelectorAll('p')).map(p => p.innerText.slice(0, 100)),
        playerIframe: document.querySelector('#player iframe')?.src,
        playerSources: Array.from(document.querySelectorAll('#player button')).map(b => b.innerText),
        downloadSection: document.querySelector('#download-links')?.innerText?.slice(0, 200),
        footerVisible: !!document.querySelector('footer') && window.getComputedStyle(document.querySelector('footer')).display !== 'none',
        footerRect: document.querySelector('footer')?.getBoundingClientRect()
      };
    })()`,
    returnByValue: true
  });
  console.log('Movie DOM info:', JSON.stringify(movieDomInfo.result?.value, null, 2));

  console.log('--- 3. Testing Another Movie (Pushpa 2 / Stree 2 / Leo) ---');
  await send('Page.navigate', { url: 'https://www.netflix4u.in/movie/335977' }); // Indiana Jones / or popular id
  await new Promise(r => setTimeout(r, 3000));
  const otherMovieInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        url: window.location.href,
        title: document.querySelector('h1')?.innerText,
        description: document.querySelector('p.leading-relaxed')?.innerText,
        playerIframe: document.querySelector('#player iframe')?.src,
        downloadsCount: document.querySelectorAll('#download-links a').length
      };
    })()`,
    returnByValue: true
  });
  console.log('Other movie info:', JSON.stringify(otherMovieInfo.result?.value, null, 2));

  console.log('--- 4. Testing Series Detail Page (The Pitt 23933) ---');
  await send('Page.navigate', { url: 'https://www.netflix4u.in/series/23933' });
  await new Promise(r => setTimeout(r, 4000));
  const seriesDomInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        title: document.querySelector('h1')?.innerText,
        description: document.querySelector('p.leading-relaxed')?.innerText,
        playerIframe: document.querySelector('#player iframe')?.src,
        playerSources: Array.from(document.querySelectorAll('#player button')).map(b => b.innerText),
        downloadsCount: document.querySelectorAll('#download-links a').length,
        footerVisible: !!document.querySelector('footer')
      };
    })()`,
    returnByValue: true
  });
  console.log('Series DOM info:', JSON.stringify(seriesDomInfo.result?.value, null, 2));

  // Mobile test (375x812)
  console.log('--- 5. Testing Mobile Viewport (375x812) Footer & Detail ---');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 812,
    deviceScaleFactor: 2,
    mobile: true
  });
  await send('Page.navigate', { url: 'https://www.netflix4u.in/' });
  await new Promise(r => setTimeout(r, 3000));
  await send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.body.scrollHeight)' });
  await new Promise(r => setTimeout(r, 1000));
  const mobileFooterShot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT_DIR, 'debug_mobile_footer.png'), Buffer.from(mobileFooterShot.data, 'base64'));
  console.log('Saved debug_mobile_footer.png');

  const mobileFooterCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const f = document.querySelector('footer');
      if (!f) return 'No footer';
      const r = f.getBoundingClientRect();
      const cs = window.getComputedStyle(f);
      return {
        display: cs.display,
        visibility: cs.visibility,
        height: r.height,
        bottomNav: document.querySelector('nav.fixed.bottom-0')?.offsetHeight,
        mobileColumnsDisplay: window.getComputedStyle(document.querySelector('.footer-mobile-columns') || f).display,
        htmlSnippet: f.innerHTML.slice(0, 400)
      };
    })()`,
    returnByValue: true
  });
  console.log('Mobile footer check:', JSON.stringify(mobileFooterCheck.result?.value, null, 2));

  ws.close();
  edge.kill();
  process.exit(0);
})();
