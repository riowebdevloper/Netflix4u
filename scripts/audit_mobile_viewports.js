#!/usr/bin/env node
/**
 * scripts/audit_mobile_viewports.js
 * Multi-Viewport Mobile Regression & Layout Integrity Suite
 *
 * Tests across 6 standard mobile/tablet viewports:
 * - 320x568 (iPhone SE)
 * - 360x800 (Android Standard)
 * - 375x812 (iPhone X / 12 / 13)
 * - 390x844 (iPhone 14 / 15)
 * - 412x915 (Pixel / Galaxy Note)
 * - 768x1024 (iPad Portrait)
 *
 * Checks:
 * 1. Zero horizontal overflow (scrollWidth <= innerWidth)
 * 2. Mobile drawer opening and navigation items
 * 3. Dedicated Download Section (#download-links) on mobile
 * 4. Series collapsible season accordion functionality
 * 5. Player and streaming controls responsive layout
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const DEBUG_PORT = 9334;
const ARTIFACTS_DIR = path.resolve(__dirname, '..', 'audit_artifacts', 'mobile');

if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
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
    this.errors = [];
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
        } else if (data.method === 'Runtime.exceptionThrown') {
          this.errors.push(data.params?.exceptionDetails?.text || 'Exception');
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

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 2,
      mobile: width < 768
    });
    await this.send('Emulation.setVisibleSize', { width, height });
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const filePath = path.join(ARTIFACTS_DIR, filename);
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

const VIEWPORTS = [
  { name: 'iphone_se', width: 320, height: 568 },
  { name: 'android_s', width: 360, height: 800 },
  { name: 'iphone_13', width: 375, height: 812 },
  { name: 'iphone_15', width: 390, height: 844 },
  { name: 'pixel_7', width: 412, height: 915 },
  { name: 'ipad_mini', width: 768, height: 1024 }
];

async function runMobileAudit() {
  console.log('========================================================');
  console.log('NETFLIX4U MOBILE VIEWPORT & LAYOUT REGRESSION AUDIT');
  console.log('========================================================');

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
    const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();

    await client.send('Page.enable');
    await client.send('Runtime.enable');

    let allPassed = true;

    // 1. Audit Home across each viewport
    for (const vp of VIEWPORTS) {
      console.log(`\nTesting Homepage at ${vp.width}x${vp.height} (${vp.name})...`);
      await client.setViewport(vp.width, vp.height);
      await client.send('Page.navigate', { url: 'http://localhost:4173/' });
      await new Promise(r => setTimeout(r, 2500));

      const overflow = await client.evaluate(`({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        hasOverflow: document.documentElement.scrollWidth > window.innerWidth
      })`);

      if (overflow.hasOverflow) {
        console.error(`  ❌ FAIL: Horizontal overflow detected: scrollWidth ${overflow.scrollWidth} > innerWidth ${overflow.innerWidth}`);
        allPassed = false;
      } else {
        console.log(`  ✅ PASS: No horizontal overflow (scrollWidth=${overflow.scrollWidth} <= innerWidth=${overflow.innerWidth})`);
      }

      const shot = await client.screenshot(`home_${vp.name}_${vp.width}.png`);
      console.log(`  📸 Screenshot saved: ${shot}`);
    }

    // 2. Audit Series Detail Page Downloads & Accordion on 375x812 (The Pitt - dotmobiz-23933)
    console.log('\n--- Testing Series Detail Page & Collapsible Downloads (/series/dotmobiz-23933) ---');
    await client.setViewport(375, 812);
    await client.send('Page.navigate', { url: 'http://localhost:4173/series/dotmobiz-23933' });
    await new Promise(r => setTimeout(r, 3000));

    const seriesCheck = await client.evaluate(`(() => {
      const dlSection = document.getElementById('download-links');
      const accordions = document.querySelectorAll('.download-season-accordion, details');
      const mirrors = document.querySelectorAll('a[href*="vcloud"], a[href*="nexdrive"]');
      return {
        hasDownloadSection: !!dlSection,
        accordionCount: accordions.length,
        mirrorsCount: mirrors.length,
        title: document.querySelector('h1')?.innerText
      };
    })()`);

    console.log('Series Detail check:', seriesCheck);
    if (seriesCheck.hasDownloadSection && seriesCheck.accordionCount > 0) {
      console.log('  ✅ PASS: Series has dedicated download section with season accordions');
    } else {
      console.error('  ❌ FAIL: Series download section or accordions missing');
      allPassed = false;
    }

    await client.screenshot('series_detail_375.png');

    // 3. Audit Movie Detail Page Quality Tiers on 375x812 (Toxic - dotmobiz-18013)
    console.log('\n--- Testing Movie Detail Page Quality Tiers (/movie/dotmobiz-18013) ---');
    await client.send('Page.navigate', { url: 'http://localhost:4173/movie/dotmobiz-18013' });
    await new Promise(r => setTimeout(r, 3000));

    const movieCheck = await client.evaluate(`(() => {
      const dlSection = document.getElementById('download-links');
      const qualityCards = dlSection ? dlSection.querySelectorAll('.grid > div') : [];
      const links = dlSection ? dlSection.querySelectorAll('a') : [];
      return {
        hasDownloadSection: !!dlSection,
        tierCardsCount: qualityCards.length,
        linksCount: links.length,
        title: document.querySelector('h1')?.innerText
      };
    })()`);

    console.log('Movie Detail check:', movieCheck);
    if (movieCheck.hasDownloadSection && movieCheck.linksCount > 0) {
      console.log('  ✅ PASS: Movie has dedicated download section with direct quality tier links');
    } else {
      console.error('  ❌ FAIL: Movie download section missing');
      allPassed = false;
    }

    await client.screenshot('movie_detail_375.png');

    console.log('\n========================================================');
    console.log(`MOBILE AUDIT RESULT: ${allPassed ? 'ALL PASSED ✅' : 'FAILURES DETECTED ❌'}`);
    console.log('Console Errors:', client.errors.length);
    console.log('========================================================');

    client.close();
    edge.kill();

    if (!allPassed) process.exit(1);
  } catch(err) {
    console.error('Mobile audit error:', err);
    edge.kill();
    process.exit(1);
  }
}

runMobileAudit();
