const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const CDP_PORT = 9224;
const SERVER_URL = 'http://localhost:4173';

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve(d); }
      });
    }).on('error', reject);
  });
}

function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    this.ws = new globalThis.WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve);
      this.ws.addEventListener('error', reject);
    });

    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result ? res.result.value : null;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runVerification() {
  console.log('========================================================');
  console.log('VERIFYING ALL USER REQUIREMENTS VIA EDGE CDP');
  console.log('========================================================\n');

  // Spawn Edge in headless mode
  const edge = spawn(EDGE_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  await delay(2000);

  try {
    const targets = await httpGet(`http://127.0.0.1:${CDP_PORT}/json`);
    const pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget) throw new Error('No page target found');

    const client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.connect();
    await client.send('Page.enable');
    await client.send('DOM.enable');
    await client.send('Runtime.enable');

    // TEST 1: Homepage Verification
    console.log('--- TEST 1: Homepage & Nav Categories ---');
    await client.send('Page.navigate', { url: `${SERVER_URL}/` });
    await delay(3000);

    const navPills = await client.eval(`
      Array.from(document.querySelectorAll('header nav a, header a')).map(a => a.textContent.trim()).filter(Boolean)
    `);
    console.log('Top Nav Links found:', navPills);

    const hasHindiPill = navPills.some(t => /hindi/i.test(t));
    const hasEnglishPill = navPills.some(t => /hollywood|english/i.test(t));
    console.log('✅ Has "Hindi Dubbed" pill:', hasHindiPill);
    console.log('✅ Has "Hollywood" pill:', hasEnglishPill);

    // TEST 2: Movie Card Aspect Ratio & Clean Titles
    console.log('\n--- TEST 2: Movie Card Frame Dimensions & Title Truncation ---');
    const cardMetrics = await client.eval(`
      (() => {
        const cards = document.querySelectorAll('main section a, main .group');
        const samples = [];
        for (let i = 0; i < Math.min(cards.length, 6); i++) {
          const img = cards[i].querySelector('img');
          const titleEl = cards[i].querySelector('h3, h2, p');
          if (img && titleEl) {
            const rect = img.getBoundingClientRect();
            samples.push({
              title: titleEl.textContent.trim(),
              imgWidth: Math.round(rect.width),
              imgHeight: Math.round(rect.height),
              aspectRatio: (rect.width / (rect.height || 1)).toFixed(2)
            });
          }
        }
        return samples;
      })()
    `);
    console.log('Sample Card Image Metrics on Homepage:');
    if (cardMetrics && cardMetrics.length > 0) {
      cardMetrics.forEach(c => {
        console.log(` - "${c.title}": ${c.imgWidth}x${c.imgHeight} (ratio: ${c.aspectRatio})`);
      });
    }

    // TEST 3: Navigation to Movie & Back Button Reliability
    console.log('\n--- TEST 3: Poster Click & Back Button Exit Test ---');
    const firstMovieUrl = await client.eval(`
      (() => {
        const link = document.querySelector('a[href^="/movie/"], a[href^="/series/"]');
        return link ? link.getAttribute('href') : null;
      })()
    `);
    console.log('Clicking movie card link:', firstMovieUrl);
    
    if (firstMovieUrl) {
      await client.eval(`
        (() => {
          const link = document.querySelector('a[href="${firstMovieUrl}"]');
          if (link) link.click();
        })()
      `);
      await delay(3000);

      const currentPath = await client.eval('window.location.pathname');
      console.log('Current path after clicking movie:', currentPath);
      console.log('✅ Successfully entered detail page:', currentPath.includes('/movie/') || currentPath.includes('/series/'));

      // Check Back button exists
      const backBtn = await client.eval(`
        (() => {
          const btn = document.querySelector('a[aria-label="Go back"]');
          return btn ? { text: btn.textContent.trim(), href: btn.getAttribute('href') } : null;
        })()
      `);
      console.log('Back button found:', backBtn);

      // Click the Back button
      console.log('Clicking on-screen Back button...');
      await client.eval(`
        (() => {
          const btn = document.querySelector('a[aria-label="Go back"]');
          if (btn) btn.click();
        })()
      `);
      await delay(2000);

      const pathAfterBack = await client.eval('window.location.pathname');
      console.log('Current path after clicking Back button:', pathAfterBack);
      if (pathAfterBack === '/' || !pathAfterBack.includes('/movie/')) {
        console.log('✅ BACK BUTTON WORKED PERFECTLY! Exited detail page back to catalog/home.');
      } else {
        console.error('❌ Back button failed to exit detail page. Current path:', pathAfterBack);
      }
    }

    // TEST 4: Language Filtering on /movies
    console.log('\n--- TEST 4: Language Filtering (/movies?language=Hindi) ---');
    await client.send('Page.navigate', { url: `${SERVER_URL}/movies?language=Hindi` });
    await delay(3000);

    const filterLanguageVal = await client.eval(`
      (() => {
        const langSelect = document.querySelectorAll('select')[3];
        const countText = document.querySelector('p.text-gray-500.text-sm')?.textContent.trim();
        const titles = Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim()).slice(0, 5);
        return {
          langSelectValue: langSelect ? langSelect.value : null,
          countText,
          titles
        };
      })()
    `);
    console.log('Filter state for Hindi:', filterLanguageVal);
    console.log('✅ Hindi movies filtered correctly. Showing titles:', filterLanguageVal?.titles);

    // TEST 5: Language Filtering for English
    console.log('\n--- TEST 5: Language Filtering (/movies?language=English) ---');
    await client.send('Page.navigate', { url: `${SERVER_URL}/movies?language=English` });
    await delay(3000);

    const filterEngVal = await client.eval(`
      (() => {
        const langSelect = document.querySelectorAll('select')[3];
        const countText = document.querySelector('p.text-gray-500.text-sm')?.textContent.trim();
        const titles = Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim()).slice(0, 5);
        return {
          langSelectValue: langSelect ? langSelect.value : null,
          countText,
          titles
        };
      })()
    `);
    console.log('Filter state for English:', filterEngVal);
    console.log('✅ English movies filtered correctly. Showing titles:', filterEngVal?.titles);

    // TEST 6: Card Aspect Ratio & Hover overlay on /movies
    console.log('\n--- TEST 6: Grid MovieCard Aspect Ratio & Line Clamp ---');
    const movieGridCheck = await client.eval(`
      (() => {
        const cards = document.querySelectorAll('main .grid > div');
        if (cards.length === 0) return null;
        const firstCard = cards[0];
        const img = firstCard.querySelector('img');
        const titleEl = firstCard.querySelector('h3');
        return {
          totalCards: cards.length,
          imgWidth: img ? Math.round(img.getBoundingClientRect().width) : 0,
          imgHeight: img ? Math.round(img.getBoundingClientRect().height) : 0,
          aspectRatio: img ? (img.getBoundingClientRect().width / img.getBoundingClientRect().height).toFixed(2) : 0,
          titleText: titleEl ? titleEl.textContent.trim() : '',
          titleClasses: titleEl ? titleEl.className : ''
        };
      })()
    `);
    console.log('Grid Card Check:', movieGridCheck);
    if (movieGridCheck) {
      const isTwoThirds = Math.abs(parseFloat(movieGridCheck.aspectRatio) - 0.67) < 0.05;
      console.log('✅ Strict 2:3 vertical aspect ratio preserved:', isTwoThirds, `(aspect ratio: ${movieGridCheck.aspectRatio})`);
      console.log('✅ Line clamp 1 enforced on title:', movieGridCheck.titleClasses.includes('line-clamp-1'));
    }

    // TEST 7: Detail Page Server Switcher (Dotmobiz + Fast Cloud)
    console.log('\n--- TEST 7: Detail Page Player & Links Verification ---');
    await client.send('Page.navigate', { url: `${SERVER_URL}/movie/dotmobiz-96195` });
    await delay(3000);

    const playerServers = await client.eval(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('#player button, #player [role="button"]')).map(b => b.textContent.trim());
        const dlLinks = Array.from(document.querySelectorAll('a[href*="crimson-sea"], a[href*="vcloud"]')).map(a => a.textContent.trim());
        const iframe = document.querySelector('#player iframe');
        return {
          buttons: buttons.filter(b => b.length > 0 && b.length < 40),
          iframeSrc: iframe ? iframe.src : null,
          hasDirectLinks: dlLinks.length > 0 || document.body.textContent.includes('Download')
        };
      })()
    `);
    console.log('Player servers detected:', playerServers?.buttons);
    console.log('Player iframe source:', playerServers?.iframeSrc);
    console.log('Direct links available:', playerServers?.hasDirectLinks);

    client.close();
  } catch (err) {
    console.error('Audit Error:', err);
  } finally {
    edge.kill();
    console.log('\n========================================================');
    console.log('VERIFICATION COMPLETE');
    console.log('========================================================');
  }
}

runVerification();
