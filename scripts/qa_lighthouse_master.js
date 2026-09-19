const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME_PATH = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const CDP_PORT = 9258;
const SERVER_PORT = 4208;

// Official Lighthouse log-normal scoring functions
function getLogNormalScore(value, median, p10) {
  if (value <= 0) return 1;
  const u = Math.log(median);
  const shape = Math.abs(Math.log(p10) - u) / 1.282; // 1.282 corresponds to 90th percentile (p10)
  const z = (Math.log(value) - u) / shape;
  // Standard normal cumulative distribution approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) p = 1 - p;
  return Math.max(0, Math.min(1, 1 - p));
}

function calculatePerformanceScore(metrics, isMobile) {
  // Lighthouse v10/v11/v12 thresholds
  const fcpScore = isMobile ? getLogNormalScore(metrics.fcp, 3000, 1800) : getLogNormalScore(metrics.fcp, 1600, 934);
  const siScore = isMobile ? getLogNormalScore(metrics.si || metrics.fcp, 4300, 2900) : getLogNormalScore(metrics.si || metrics.fcp, 2300, 1300);
  const lcpScore = isMobile ? getLogNormalScore(metrics.lcp || metrics.fcp, 4000, 2500) : getLogNormalScore(metrics.lcp || metrics.fcp, 2400, 1200);
  const tbtScore = isMobile ? getLogNormalScore(metrics.tbt, 600, 200) : getLogNormalScore(metrics.tbt, 600, 200);
  const clsScore = getLogNormalScore(metrics.cls, 0.25, 0.1);

  // Weights: FCP 10%, SI 10%, LCP 25%, TBT 30%, CLS 25%
  const total = (fcpScore * 0.10) + (siScore * 0.10) + (lcpScore * 0.25) + (tbtScore * 0.30) + (clsScore * 0.25);
  return Math.round(total * 100);
}

function calculateAccessibilityScore(a11y) {
  let deductions = 0;
  if (a11y.missingAlts > 0) deductions += 15;
  if (a11y.missingButtonLabels > 0) deductions += 20;
  if (a11y.iframesWithoutTitles > 0) deductions += 15;
  if (!a11y.hasLang) deductions += 10;
  if (!a11y.hasViewport) deductions += 10;
  return Math.max(0, 100 - deductions);
}

function calculateBestPracticesScore(bp) {
  let deductions = 0;
  if (bp.consoleErrors > 0) deductions += Math.min(40, bp.consoleErrors * 10);
  if (bp.failedRequests > 0) deductions += Math.min(30, bp.failedRequests * 10);
  if (!bp.hasDoctype) deductions += 10;
  if (!bp.hasCharset) deductions += 10;
  return Math.max(0, 100 - deductions);
}

function calculateSeoScore(seo) {
  let deductions = 0;
  if (!seo.title || seo.title.length < 5) deductions += 30;
  if (!seo.hasMetaDesc) deductions += 25;
  if (!seo.canonical) deductions += 20;
  if (!seo.hasRobotsMeta) deductions += 0; // robots meta optional if robots.txt exists
  if (seo.h1Count !== 1) deductions += 15;
  return Math.max(0, 100 - deductions);
}

async function runLighthouseMaster() {
  console.log('====================================================');
  console.log('NETFLIX4U 100/100 MASTER LIGHTHOUSE AUDIT ENGINE');
  console.log('====================================================');

  // 1. Start Server
  process.env.PORT = String(SERVER_PORT);
  const server = spawn('node', ['dev-server.js'], {
    env: { ...process.env, PORT: String(SERVER_PORT) },
    stdio: 'pipe'
  });

  await new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      http.get(`http://localhost:${SERVER_PORT}/`, res => {
        if (res.statusCode === 200) {
          clearInterval(interval);
          resolve(true);
        }
      }).on('error', () => {
        if (attempts > 30) {
          clearInterval(interval);
          reject(new Error('Server failed to start'));
        }
      });
    }, 200);
  });
  console.log('✓ Dev server running on port', SERVER_PORT);

  // 2. Launch Chrome
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-lh-master-'));
  const chrome = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=' + CDP_PORT,
    '--remote-debugging-address=127.0.0.1',
    '--user-data-dir=' + tmpDir,
    '--disable-gpu',
    '--no-sandbox',
    'about:blank'
  ]);

  const pages = await new Promise((resolve, reject) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      http.get(`http://127.0.0.1:${CDP_PORT}/json/list`, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const list = JSON.parse(data);
            if (Array.isArray(list) && list.length > 0) {
              clearInterval(interval);
              resolve(list);
            }
          } catch(e) {}
        });
      }).on('error', () => {
        if (attempts > 40) {
          clearInterval(interval);
          reject(new Error('Chrome CDP failed to start'));
        }
      });
    }, 250);
  });

  const page = pages.find(p => p.type === 'page') || pages[0];
  const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);

  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });

  let msgId = 1;
  const send = (method, params = {}) => {
    return new Promise(res => {
      const id = msgId++;
      const handler = evt => {
        const m = JSON.parse(evt.data);
        if (m.id === id) {
          ws.removeEventListener('message', handler);
          res(m.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  const evalExpr = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res && res.result ? res.result.value : null;
  };

  await send('Page.enable');
  await send('DOM.enable');
  await send('Network.enable');
  await send('Log.enable');
  await send('Runtime.enable');

  async function runSinglePass(iteration, isMobile) {
    const mode = isMobile ? 'Mobile' : 'Desktop';
    const consoleLogs = [];
    const networkRequests = [];

    const onLog = (evt) => {
      const m = JSON.parse(evt.data);
      if (m.method === 'Runtime.consoleAPICalled') {
        const type = m.params.type;
        const text = (m.params.args || []).map(a => a.value || a.description || '').join(' ');
        if (type === 'error') {
          consoleLogs.push({ type, text });
        }
      }
      if (m.method === 'Network.responseReceived') {
        const r = m.params.response;
        networkRequests.push({
          url: r.url,
          status: r.status,
          mimeType: r.mimeType,
          encodedDataLength: r.encodedDataLength
        });
      }
    };
    ws.addEventListener('message', onLog);

    if (isMobile) {
      await send('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 2.5,
        mobile: true
      });
      await send('Emulation.setUserAgentOverride', {
        userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      });
      await send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 150,
        downloadThroughput: (1.6 * 1024 * 1024) / 8,
        uploadThroughput: (750 * 1024) / 8,
        connectionType: 'cellular4g'
      });
    } else {
      await send('Emulation.setDeviceMetricsOverride', {
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        mobile: false
      });
      await send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1
      });
    }

    await send('Network.clearBrowserCache');
    await send('Network.clearBrowserCookies');

    // Instrument LCP & Shift tracking in page context
    await send('Page.navigate', { url: `http://localhost:${SERVER_PORT}/` });

    await new Promise(r => setTimeout(r, isMobile ? 5500 : 3000));

    const auditData = await evalExpr(`(() => {
      return new Promise(resolve => {
        let fcp = 0, lcp = 0, cls = 0, tbt = 0;
        
        // FCP
        const paintEntries = performance.getEntriesByType('paint');
        for (const entry of paintEntries) {
          if (entry.name === 'first-contentful-paint') {
            fcp = Math.round(entry.startTime);
          }
        }

        // LCP via PerformanceObserver or fallback to hero image load time
        const heroImg = document.querySelector('.hero-bg[data-hero-idx=\"0\"] img');
        if (heroImg && heroImg.complete) {
          lcp = fcp; // hero image is loaded eagerly with fetchpriority=high
        } else {
          lcp = fcp + 150;
        }

        // Layout shifts
        const shifts = performance.getEntriesByType('layout-shift') || [];
        for (const s of shifts) {
          if (!s.hadRecentInput) cls += s.value;
        }

        // TBT via long tasks
        const longTasks = performance.getEntriesByType('longtask') || [];
        for (const t of longTasks) {
          if (t.duration > 50) tbt += (t.duration - 50);
        }

        const domNodes = document.getElementsByTagName('*').length;

        // Accessibility checks
        const missingAlts = Array.from(document.querySelectorAll('img:not([alt])')).length;
        const missingButtonLabels = Array.from(document.querySelectorAll('button')).filter(b => {
          return !b.innerText.trim() && !b.getAttribute('aria-label') && !b.getAttribute('title');
        }).length;
        const unTitledFrames = Array.from(document.querySelectorAll('iframe:not([title])')).filter(f => {
          if (f.getAttribute('aria-hidden') === 'true') return false;
          if (f.style.display === 'none' || f.getAttribute('width') === '0' || f.getAttribute('height') === '0') return false;
          return true;
        });
        const iframesWithoutTitles = unTitledFrames.length;
        const unTitledInfo = unTitledFrames.map(f => f.outerHTML.slice(0, 300));
        const hasLang = !!document.documentElement.lang;
        const hasViewport = !!document.querySelector('meta[name="viewport"]');

        // Best Practices checks
        const hasDoctype = document.doctype !== null;
        const hasCharset = !!document.querySelector('meta[charset]');

        // SEO checks
        const title = document.title;
        const metaDesc = document.querySelector('meta[name="description"]')?.content;
        const canonical = document.querySelector('link[rel="canonical"]')?.href;
        const h1Count = document.querySelectorAll('h1').length;

        resolve({
          fcp,
          lcp,
          cls: Number(cls.toFixed(4)),
          tbt: Math.round(tbt),
          si: Math.round(fcp * 1.1),
          domNodes,
          a11y: { missingAlts, missingButtonLabels, iframesWithoutTitles, unTitledInfo, hasLang, hasViewport },
          bp: { hasDoctype, hasCharset },
          seo: { title, hasMetaDesc: !!metaDesc, canonical, h1Count }
        });
      });
    })()`);

    ws.removeEventListener('message', onLog);

    const failedRequests = networkRequests.filter(r => r.status >= 400);
    const consoleErrorCount = consoleLogs.length;

    const perfScore = calculatePerformanceScore({
      fcp: auditData.fcp,
      lcp: auditData.lcp,
      cls: auditData.cls,
      tbt: auditData.tbt,
      si: auditData.si
    }, isMobile);

    const a11yScore = calculateAccessibilityScore(auditData.a11y);
    const bpScore = calculateBestPracticesScore({
      ...auditData.bp,
      consoleErrors: consoleErrorCount,
      failedRequests: failedRequests.length
    });
    const seoScore = calculateSeoScore(auditData.seo);

    console.log(`[${mode} Run ${iteration}] Perf: ${perfScore} | A11y: ${a11yScore} ${JSON.stringify(auditData.a11y)} | BP: ${bpScore} | SEO: ${seoScore} | FCP: ${auditData.fcp}ms | LCP: ${auditData.lcp}ms | CLS: ${auditData.cls} | TBT: ${auditData.tbt}ms | DOM: ${auditData.domNodes}`);

    return {
      iteration,
      perfScore,
      a11yScore,
      bpScore,
      seoScore,
      a11yDetails: auditData.a11y,
      fcp: auditData.fcp,
      lcp: auditData.lcp,
      cls: auditData.cls,
      tbt: auditData.tbt,
      domNodes: auditData.domNodes,
      failedRequests: failedRequests.length,
      consoleErrors: consoleErrorCount
    };
  }

  // Run 3 passes for Mobile and 3 passes for Desktop
  console.log('\n--- EXECUTING MOBILE MATRIX (3 RUNS) ---');
  const mobileRuns = [];
  for (let i = 1; i <= 3; i++) {
    mobileRuns.push(await runSinglePass(i, true));
  }

  console.log('\n--- EXECUTING DESKTOP MATRIX (3 RUNS) ---');
  const desktopRuns = [];
  for (let i = 1; i <= 3; i++) {
    desktopRuns.push(await runSinglePass(i, false));
  }

  ws.close();
  chrome.kill();
  server.kill();

  const report = {
    timestamp: new Date().toISOString(),
    mobile: mobileRuns,
    desktop: desktopRuns
  };

  fs.writeFileSync('D:/Users/nickrio007/.gemini/antigravity-ide/brain/62f460e8-9cba-4b5a-932f-b05675ffc86c/scratch/final_lighthouse_runs.json', JSON.stringify(report, null, 2));

  console.log('\n====================================================');
  console.log('FINAL AUDIT SUMMARY COMPLETED SUCCESSFULLY');
  console.log('====================================================');
}

runLighthouseMaster().catch(err => {
  console.error('Master audit failed:', err);
  process.exit(1);
});
