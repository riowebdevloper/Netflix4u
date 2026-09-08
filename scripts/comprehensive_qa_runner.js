const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DEBUG_PORT = 9333;
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'audit_artifacts');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
    this.events = [];
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
        } else if (data.method) {
          this.handleEvent(data.method, data.params);
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

  handleEvent(method, params) {
    if (method === 'Runtime.consoleAPICalled') {
      const text = (params.args || []).map(a => a.value || JSON.stringify(a)).join(' ');
      this.consoleLogs.push({ type: params.type, text });
      if (params.type === 'error') {
        this.errors.push(text);
      }
    } else if (method === 'Runtime.exceptionThrown') {
      const desc = params.exceptionDetails?.exception?.description || params.exceptionDetails?.text;
      this.errors.push(desc);
    } else if (method === 'Network.responseReceived') {
      if (params.response?.status >= 400) {
        this.failedRequests.push({
          url: params.response.url,
          status: params.response.status
        });
      }
    }
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768
    });
    await this.send('Emulation.setVisibleSize', { width, height });
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const filePath = path.join(SCREENSHOT_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    return filePath;
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result?.value;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runAudit() {
  console.log('🚀 Launching Edge headless instance...');
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + DEBUG_PORT,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
    const tabs = await fetchJson('http://127.0.0.1:' + DEBUG_PORT + '/json');
    const pageTarget = tabs.find(t => t.type === 'page') || tabs[0];
    const wsUrl = pageTarget.webSocketDebuggerUrl;
    console.log('📡 Connected to Edge DevTools WebSocket:', wsUrl);

    const client = new CDPClient(wsUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Network.enable');

    console.log('\n--- 1. Testing Home Page (Desktop 1440x900) ---');
    await client.setViewport(1440, 900);
    await client.send('Page.navigate', { url: 'http://localhost:4173/' });
    await new Promise(r => setTimeout(r, 3500));

    const title = await client.evaluate('document.title');
    console.log('Page Title:', title);

    const movieCardsCount = await client.evaluate('document.querySelectorAll("a[href*=\'/movie/\'], a[href*=\'/series/\']").length');
    console.log('Rendered Movie / Series Cards Count:', movieCardsCount);

    const desktopShot = await client.screenshot('desktop_home.png');
    console.log('📸 Saved desktop screenshot to:', desktopShot);

    console.log('\n--- 2. Testing Tablet Viewport (768x1024) ---');
    await client.setViewport(768, 1024);
    await new Promise(r => setTimeout(r, 1000));
    const tabletShot = await client.screenshot('tablet_home.png');
    console.log('📸 Saved tablet screenshot to:', tabletShot);

    console.log('\n--- 3. Testing Mobile Viewport (375x812) ---');
    await client.setViewport(375, 812);
    await new Promise(r => setTimeout(r, 1000));
    const mobileShot = await client.screenshot('mobile_home.png');
    console.log('📸 Saved mobile screenshot to:', mobileShot);

    console.log('\n--- 4. Testing Card Navigation & Details Page (/movie/38068) ---');
    await client.setViewport(1440, 900);
    await client.send('Page.navigate', { url: 'http://localhost:4173/movie/38068' });
    await new Promise(r => setTimeout(r, 4000));

    const detailsTitle = await client.evaluate('document.title');
    console.log('Details Page Title:', detailsTitle);

    const h1Text = await client.evaluate('document.querySelector("h1")?.innerText');
    console.log('Details Page H1 Header:', h1Text);

    const hasPlayer = await client.evaluate('!!document.getElementById("player")');
    console.log('Has Video Player Section:', hasPlayer);

    const hasDownload = await client.evaluate('!!document.getElementById("download-links") || !!document.querySelector("button[aria-label*=\'download\']")');
    console.log('Has Download Controls:', hasDownload);

    const backBtnText = await client.evaluate('document.querySelector(".back-btn-container, .back-btn-wrapper")?.innerText');
    console.log('Has Functional Back Button:', !!backBtnText, `("${backBtnText?.trim()}")`);

    // Check if any popup modal or verification gate exists
    const hasGate = await client.evaluate('!!document.getElementById("hicine-gate") || !!document.querySelector(".hicine-modal")');
    console.log('🚫 Popup modal / human verification gate present:', hasGate);

    const detailsShot = await client.screenshot('desktop_details.png');
    console.log('📸 Saved details screenshot to:', detailsShot);

    console.log('\n--- 5. Testing Back Button Flow ---');
    await client.evaluate('document.querySelector(".back-btn-wrapper")?.click()');
    await new Promise(r => setTimeout(r, 1500));
    const backUrl = await client.evaluate('window.location.href');
    console.log('Current URL after clicking Back Button:', backUrl);

    console.log('\n================ AUDIT REPORT ================');
    console.log('Console Errors:', client.errors.length);
    if (client.errors.length > 0) {
      console.log('Error Details:', client.errors);
    }
    console.log('Failed Network Requests (4xx/5xx):', client.failedRequests.length);
    if (client.failedRequests.length > 0) {
      console.log('Failed Requests:', client.failedRequests);
    }

    client.close();
  } catch (err) {
    console.error('Audit failed with error:', err);
  } finally {
    edge.kill();
    console.log('\n🏁 Edge browser closed. Audit script complete.');
  }
}

runAudit();
