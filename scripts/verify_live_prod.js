const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DEBUG_PORT = 9226;
const ARTIFACT_DIR = 'C:\\Users\\Riyaz\\.gemini\\antigravity-ide\\brain\\190e2edd-8b46-4041-b3a9-d5841b888837';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('--- Starting headless Edge for LIVE production verification ---');
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + DEBUG_PORT,
    '--disable-gpu',
    '--disable-extensions',
    'about:blank'
  ]);
  await sleep(2000);

  try {
    const tabs = await fetchJson('http://127.0.0.1:' + DEBUG_PORT + '/json');
    const pageTarget = tabs.find(t => t.type === 'page') || tabs[0];
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

    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      return r && r.result ? r.result.value : null;
    };

    const takeScreenshot = async (filename) => {
      const res = await send('Page.captureScreenshot', { format: 'png' });
      const buf = Buffer.from(res.data, 'base64');
      fs.writeFileSync(path.join(ARTIFACT_DIR, filename), buf);
      console.log(`Saved ${filename}`);
    };

    const setViewport = async (w, h, isMobile = false) => {
      await send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: h,
        deviceScaleFactor: 1,
        mobile: isMobile
      });
    };

    await send('Page.enable');
    await send('Runtime.enable');

    // ==========================================
    // Test 1: Desktop Footer on Live Production
    // ==========================================
    console.log('\n>>> 1. Testing Live Production Desktop Footer (1440x900)...');
    await setViewport(1440, 900, false);
    await send('Page.navigate', { url: 'https://www.netflix4u.in/' });
    await sleep(5000);

    const desktopFooter = await evaluate(`(() => {
      const footer = document.querySelector('footer');
      if (!footer) return { footerVisible: false };
      const rect = footer.getBoundingClientRect();
      const desktopGrid = footer.querySelector('.md\\\\:grid, div.hidden');
      const links = Array.from(footer.querySelectorAll('a')).map(a => a.innerText.trim()).filter(Boolean);
      return {
        footerVisible: rect.height > 0,
        desktopGridDisplay: desktopGrid ? window.getComputedStyle(desktopGrid).display : null,
        linksCount: links.length,
        linksSample: links.slice(0, 8)
      };
    })()`);
    console.log('Live Desktop Footer Check:', JSON.stringify(desktopFooter, null, 2));

    await evaluate(`window.scrollTo(0, document.body.scrollHeight)`);
    await sleep(800);
    await takeScreenshot('live_prod_desktop_footer.png');

    // ==========================================
    // Test 2: Mobile Footer on Live Production
    // ==========================================
    console.log('\n>>> 2. Testing Live Production Mobile Footer (375x812)...');
    await setViewport(375, 812, true);
    await sleep(1500);
    const mobileFooter = await evaluate(`(() => {
      const footer = document.querySelector('footer');
      if (!footer) return { footerVisible: false };
      const mobileContainer = footer.querySelector('.md\\\\:hidden, div:last-child');
      const links = Array.from(footer.querySelectorAll('a')).map(a => a.innerText.trim()).filter(Boolean);
      return {
        footerVisible: footer.offsetHeight > 0,
        mobileContainerDisplay: mobileContainer ? window.getComputedStyle(mobileContainer).display : null,
        linksCount: links.length
      };
    })()`);
    console.log('Live Mobile Footer Check:', JSON.stringify(mobileFooter, null, 2));
    await takeScreenshot('live_prod_mobile_footer.png');

    // ==========================================
    // Test 3: Movie Detail UI on Live Production (Toxic 18013)
    // ==========================================
    console.log('\n>>> 3. Testing Live Movie Detail (Toxic 18013)...');
    await setViewport(1440, 900, false);
    await send('Page.navigate', { url: 'https://www.netflix4u.in/movie/18013' });
    await sleep(6000);

    const toxicUI = await evaluate(`(() => {
      const h1 = document.querySelector('h1');
      const poster = document.querySelector('div[class*="min-h"] .aspect-\\\\[2\\\\/3\\\\], .hero-detail-poster');
      const descEl = document.querySelector('p[class*="line-clamp"], div[class*="Storyline"] p, p.text-stone-300');
      const iframe = document.querySelector('iframe');
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean);
      const downloadSection = Array.from(document.querySelectorAll('a')).filter(a => (a.href && a.href.includes('/api/download')) || a.innerText.includes('Download') || a.innerText.includes('1080p') || a.innerText.includes('720p'));
      return {
        title: h1 ? h1.innerText : null,
        h1Top: h1 ? h1.getBoundingClientRect().top : null,
        posterWidth: poster ? poster.offsetWidth : null,
        posterHeight: poster ? poster.offsetHeight : null,
        description: descEl ? descEl.innerText.slice(0, 100) : (document.body.innerText.includes('drug cartel') ? 'Found in body text' : 'Not found'),
        playerIframeSrc: iframe ? iframe.src : null,
        playerButtons: buttons.filter(b => b.includes('Server') || b.includes('Season') || b.startsWith('E')),
        downloadLinksCount: downloadSection.length
      };
    })()`);
    console.log('Live Toxic Check:', JSON.stringify(toxicUI, null, 2));
    await takeScreenshot('live_prod_movie_hero.png');

    await evaluate(`(() => {
      const p = document.getElementById('streaming-player-section') || document.querySelector('iframe');
      if (p) p.scrollIntoView({ behavior: 'instant', block: 'center' });
    })()`);
    await sleep(1000);
    await takeScreenshot('live_prod_movie_player.png');

    // ==========================================
    // Test 4: Series Detail UI on Live Production (The Pitt 23933)
    // ==========================================
    console.log('\n>>> 4. Testing Live Series Detail (The Pitt 23933)...');
    await send('Page.navigate', { url: 'https://www.netflix4u.in/series/23933' });
    await sleep(6000);

    const pittUI = await evaluate(`(() => {
      const h1 = document.querySelector('h1');
      const poster = document.querySelector('div[class*="min-h"] .aspect-\\\\[2\\\\/3\\\\], .hero-detail-poster');
      const descEl = document.querySelector('p[class*="line-clamp"], div[class*="Storyline"] p, p.text-stone-300');
      const iframe = document.querySelector('iframe');
      const downloadSection = Array.from(document.querySelectorAll('a')).filter(a => (a.href && a.href.includes('/api/download')) || a.innerText.includes('Download') || a.innerText.includes('1080p') || a.innerText.includes('720p'));
      return {
        title: h1 ? h1.innerText : null,
        h1Top: h1 ? h1.getBoundingClientRect().top : null,
        posterHeight: poster ? poster.offsetHeight : null,
        description: descEl ? descEl.innerText.slice(0, 100) : (document.body.innerText.includes('Pittsburgh') ? 'Found in body text' : 'Not found'),
        playerIframeSrc: iframe ? iframe.src : null,
        downloadLinksCount: downloadSection.length
      };
    })()`);
    console.log('Live The Pitt Check:', JSON.stringify(pittUI, null, 2));

    // ==========================================
    // Test 5: TMDB Movie Detail on Live Production (Indiana Jones 335977)
    // ==========================================
    console.log('\n>>> 5. Testing Live TMDB-Loaded Movie (Indiana Jones 335977)...');
    await send('Page.navigate', { url: 'https://www.netflix4u.in/movie/335977' });
    await sleep(6000);

    const indyUI = await evaluate(`(() => {
      const h1 = document.querySelector('h1');
      const descEl = document.querySelector('p[class*="line-clamp"], div[class*="Storyline"] p, p.text-stone-300');
      const iframe = document.querySelector('iframe');
      const downloadLinks = Array.from(document.querySelectorAll('a')).filter(a => a.href && (a.href.includes('/api/download') || a.innerText.includes('Download') || a.innerText.includes('1080p') || a.innerText.includes('720p')));
      return {
        title: h1 ? h1.innerText : null,
        description: descEl ? descEl.innerText.slice(0, 100) : 'Not found',
        playerIframeSrc: iframe ? iframe.src : null,
        downloadLinksCount: downloadLinks.length
      };
    })()`);
    console.log('Live Indiana Jones Check:', JSON.stringify(indyUI, null, 2));
    await takeScreenshot('live_prod_indiana_jones.png');

    console.log('\n--- ALL LIVE PRODUCTION CHECKS COMPLETED ---');
    ws.close();
  } finally {
    edge.kill();
  }
}

main().catch(err => {
  console.error('Fatal live error:', err);
  process.exit(1);
});
