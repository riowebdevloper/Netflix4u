const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DEBUG_PORT = 9350;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
    this.consoleLogs = [];
    this.errors = [];
    this.failedRequests = [];
  }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = err => reject(err);
      this.ws.onmessage = msg => {
        const data = JSON.parse(msg.data);
        if (data.id && this.callbacks.has(data.id)) {
          const cb = this.callbacks.get(data.id);
          this.callbacks.delete(data.id);
          if (data.error) cb.reject(data.error);
          else cb.resolve(data.result);
        } else if (data.method === 'Runtime.consoleAPICalled') {
          const text = (data.params.args || []).map(a => a.value || JSON.stringify(a)).join(' ');
          this.consoleLogs.push({ type: data.params.type, text });
          if (data.params.type === 'error') this.errors.push(text);
        } else if (data.method === 'Runtime.exceptionThrown') {
          this.errors.push(data.params?.exceptionDetails?.text || 'Exception');
        } else if (data.method === 'Network.responseReceived') {
          if (data.params.response?.status >= 400) {
            this.failedRequests.push({
              url: data.params.response.url,
              status: data.params.response.status
            });
          }
        }
      };
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }
  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result?.value;
  }
  async waitFor(expression, maxMs = 12000, intervalMs = 500) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      try {
        const val = await this.evaluate(expression);
        if (val) return val;
      } catch (e) {}
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return false;
  }
  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const p = path.resolve(__dirname, '..', 'audit_artifacts', filename);
    fs.writeFileSync(p, Buffer.from(res.data, 'base64'));
    return p;
  }
  close() { if (this.ws) this.ws.close(); }
}

async function run() {
  console.log('=== RUNNING FULL LIVE PRODUCTION REGRESSION AUDIT (v3.3.4) ===');
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + DEBUG_PORT,
    '--disable-gpu',
    '--disable-extensions',
    '--no-first-run',
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 2000));
  try {
    const tabs = await fetchJson('http://127.0.0.1:' + DEBUG_PORT + '/json');
    const pageTarget = tabs.find(t => t.type === 'page' && !t.url.startsWith('chrome-extension://')) || tabs[0];
    const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');

    // TEST 1: DESKTOP HOMEPAGE
    console.log('\n--- 1. Testing Live Desktop (1440x900) ---');
    await client.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await client.send('Page.navigate', { url: 'https://www.netflix4u.in/' });
    await client.waitFor('document.querySelectorAll("a[href*=\'/movie/\'], a[href*=\'/series/\']").length > 20');
    // Allow posters to load
    await new Promise(r => setTimeout(r, 4000));

    const dTitle = await client.evaluate('document.title');
    const dHero = await client.evaluate('document.querySelector(".hero-title")?.innerText');
    const dCards = await client.evaluate('document.querySelectorAll("a[href*=\'/movie/\'], a[href*=\'/series/\']").length');
    const dHeroWatchHref = await client.evaluate('document.querySelector(".hero-buttons-row a.btn-primary")?.getAttribute("href")');
    const dShot = await client.screenshot('live_v334_desktop.png');

    console.log('Desktop Title:', dTitle);
    console.log('Desktop Hero Title:', dHero);
    console.log('Desktop Hero Watch Href:', dHeroWatchHref);
    console.log('Desktop Content Cards count:', dCards);
    console.log('Saved screenshot:', dShot);

    // TEST 2: MOBILE HOMEPAGE
    console.log('\n--- 2. Testing Live Mobile (375x812) ---');
    await client.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 3, mobile: true });
    await client.send('Page.navigate', { url: 'https://www.netflix4u.in/' });
    await client.waitFor('document.querySelector(".hero-title")?.innerText');
    await new Promise(r => setTimeout(r, 3000));

    const mTitle = await client.evaluate('document.title');
    const mHero = await client.evaluate('document.querySelector(".hero-title")?.innerText');
    const mShot = await client.screenshot('live_v334_mobile.png');

    console.log('Mobile Title:', mTitle);
    console.log('Mobile Hero Title:', mHero);
    console.log('Saved screenshot:', mShot);

    // Switch back to desktop for detail and category tests
    await client.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    // TEST 3: THE PITT SERIES DETAIL (/series/23933)
    console.log('\n--- 3. Testing The Pitt Series (/series/23933) ---');
    await client.send('Page.navigate', { url: 'https://www.netflix4u.in/series/23933' });
    await client.waitFor('document.querySelector("h1")?.innerText && !document.querySelector(".spinner")');
    await new Promise(r => setTimeout(r, 3000));

    const pittTitle = await client.evaluate('document.title');
    const pittH1 = await client.evaluate('document.querySelector("h1")?.innerText');
    const pittPlayer = await client.evaluate('!!document.getElementById("player")');
    const pittDls = await client.evaluate('document.querySelectorAll("#download-links a").length');
    const pittShot = await client.screenshot('live_v334_the_pitt.png');

    console.log('Pitt Title:', pittTitle);
    console.log('Pitt H1:', pittH1);
    console.log('Pitt Player present:', pittPlayer);
    console.log('Pitt Download links count:', pittDls);
    console.log('Saved screenshot:', pittShot);

    // TEST 4: TOXIC 2026 MOVIE DETAIL (/movie/18013)
    console.log('\n--- 4. Testing Toxic (2026) Movie (/movie/18013) ---');
    await client.send('Page.navigate', { url: 'https://www.netflix4u.in/movie/18013' });
    await client.waitFor('document.querySelector("h1")?.innerText && !document.querySelector(".spinner")');
    await new Promise(r => setTimeout(r, 3000));

    const toxicTitle = await client.evaluate('document.title');
    const toxicH1 = await client.evaluate('document.querySelector("h1")?.innerText');
    const toxicPlayer = await client.evaluate('!!document.getElementById("player")');
    const toxicDls = await client.evaluate('document.querySelectorAll("#download-links a").length');
    const toxicShot = await client.screenshot('live_v334_toxic.png');

    console.log('Toxic Title:', toxicTitle);
    console.log('Toxic H1:', toxicH1);
    console.log('Toxic Player present:', toxicPlayer);
    console.log('Toxic Download links count:', toxicDls);
    console.log('Saved screenshot:', toxicShot);

    // TEST 5: CATEGORY BOLLYWOOD (/category/bollywood)
    console.log('\n--- 5. Testing Category Bollywood (/category/bollywood) ---');
    await client.send('Page.navigate', { url: 'https://www.netflix4u.in/category/bollywood' });
    await client.waitFor('document.querySelectorAll("a[href*=\'/movie/\'], a[href*=\'/series/\'], a[href*=\'/kdrama/\']").length > 10');
    await new Promise(r => setTimeout(r, 4000));

    const bolTitle = await client.evaluate('document.title');
    const bolH1 = await client.evaluate('document.querySelector("h1")?.innerText');
    const bolCards = await client.evaluate('document.querySelectorAll("a[href*=\'/movie/\'], a[href*=\'/series/\'], a[href*=\'/kdrama/\']").length');
    const bolImgs = await client.evaluate(`
      (() => {
        const imgs = Array.from(document.querySelectorAll('.group.relative img'));
        return {
          total: imgs.length,
          naturalLoaded: imgs.filter(i => i.naturalWidth > 0).length,
          renderedWithHeight: imgs.filter(i => i.clientHeight > 100).length,
          sampleSrc: imgs.slice(0, 3).map(i => ({ src: i.src, w: i.clientWidth, h: i.clientHeight }))
        };
      })()
    `);
    console.log('Bollywood Title:', bolTitle);
    console.log('Bollywood H1:', bolH1);
    console.log('Bollywood Cards count:', bolCards);
    console.log('Bollywood Posters Health:', bolImgs);
    const bolShot = await client.screenshot('live_v334_bollywood.png');
    console.log('Saved screenshot:', bolShot);

    // TEST 6: CATEGORY SOUTH INDIAN (/category/south-indian)
    console.log('\n--- 6. Testing Category South Indian (/category/south-indian) ---');
    await client.send('Page.navigate', { url: 'https://www.netflix4u.in/category/south-indian' });
    await client.waitFor('document.querySelectorAll("a[href*=\'/movie/\'], a[href*=\'/series/\'], a[href*=\'/kdrama/\']").length > 10');
    await new Promise(r => setTimeout(r, 4000));

    const southTitle = await client.evaluate('document.title');
    const southH1 = await client.evaluate('document.querySelector("h1")?.innerText');
    const southCards = await client.evaluate('document.querySelectorAll("a[href*=\'/movie/\'], a[href*=\'/series/\'], a[href*=\'/kdrama/\']").length');
    const southImgs = await client.evaluate(`
      (() => {
        const imgs = Array.from(document.querySelectorAll('.group.relative img'));
        return {
          total: imgs.length,
          naturalLoaded: imgs.filter(i => i.naturalWidth > 0).length,
          renderedWithHeight: imgs.filter(i => i.clientHeight > 100).length
        };
      })()
    `);
    console.log('South Indian Title:', southTitle);
    console.log('South Indian H1:', southH1);
    console.log('South Indian Cards count:', southCards);
    console.log('South Indian Posters Health:', southImgs);
    const southShot = await client.screenshot('live_v334_south_indian.png');
    console.log('Saved screenshot:', southShot);
    console.log('\n=== AUDIT SUMMARY ===');
    console.log('Total Console Errors:', client.errors.length);
    console.log('Total Failed Requests (4xx/5xx):', client.failedRequests.length);
    if (client.errors.length) console.log('Errors:', client.errors);
    if (client.failedRequests.length) console.log('Failed requests:', client.failedRequests);

    client.close();
    edge.kill();
  } catch(e) {
    console.error('Audit failed:', e);
    edge.kill();
  }
}
run();
