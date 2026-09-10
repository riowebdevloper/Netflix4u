const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function testLiveUserFlows() {
  const port = 9470;
  console.log('--- Testing Live User Flows on https://www.netflix4u.in/ ---');
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--window-size=1280,800',
    'https://www.netflix4u.in/'
  ]);
  await new Promise(r => setTimeout(r, 4000));
  const pages = await new Promise((res, rej) => {
    http.get('http://localhost:' + port + '/json/list', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });
  const page = pages.find(p => p.url && p.url.includes('netflix4u.in')) || pages[0];
  const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
  let id = 1;
  const send = (method, params) => new Promise(res => {
    const cur = id++;
    const handler = evt => {
      const m = JSON.parse(evt.data);
      if (m.id === cur) {
        ws.removeEventListener('message', handler);
        res(m.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: cur, method, params }));
  });
  await new Promise(r => { ws.onopen = r; });
  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise(r => setTimeout(r, 4000));

  // Test 1: Search Flow for "Toxic"
  console.log('Testing Search for "Toxic"...');
  await send('Page.navigate', { url: 'https://www.netflix4u.in/search?q=Toxic' });
  await new Promise(r => setTimeout(r, 4000));

  const searchResults = await send('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('.group, a[href*=\"/movie/\"], a[href*=\"/series/\"]')).map(a => ({
        href: a.href,
        text: a.innerText.trim().replace(/\\n+/g, ' '),
        img: a.querySelector('img')?.src || ''
      }));
      return {
        url: window.location.href,
        resultCount: cards.length,
        firstResults: cards.slice(0, 5)
      };
    })()`,
    returnByValue: true
  });
  console.log('Search Results for Toxic:', JSON.stringify(searchResults.result?.value, null, 2));

  // Take screenshot of search page
  const searchShot = await send('Page.captureScreenshot', { format: 'png' });
  if (searchShot?.data) {
    fs.writeFileSync('audit_artifacts/live_search_toxic.png', Buffer.from(searchShot.data, 'base64'));
  }

  // Click on the first result if available
  const firstHref = searchResults.result?.value?.firstResults?.[0]?.href;
  if (firstHref) {
    console.log('Navigating to first search result:', firstHref);
    await send('Page.navigate', { url: firstHref });
    await new Promise(r => setTimeout(r, 4000));

    const detailState = await send('Runtime.evaluate', {
      expression: `(() => {
        return {
          url: window.location.href,
          title: document.title,
          h1: document.querySelector('h1')?.innerText || '',
          playerSrc: document.querySelector('iframe')?.src || '',
          posterSrc: document.querySelector('img[alt]')?.src || '',
          downloadLinksCount: document.querySelectorAll('a[href*=\"vcloud\"], a[href*=\"download\"], a[href*=\"workers.dev\"]').length,
          bodySample: document.body.innerText.slice(0, 400).replace(/\\n+/g, ' ')
        };
      })()`,
      returnByValue: true
    });
    console.log('Detail page state from search result:', JSON.stringify(detailState.result?.value, null, 2));

    const clickShot = await send('Page.captureScreenshot', { format: 'png' });
    if (clickShot?.data) {
      fs.writeFileSync('audit_artifacts/live_search_click_detail.png', Buffer.from(clickShot.data, 'base64'));
    }
  }

  // Test 2: Search Flow for "Sandman"
  console.log('Testing Search for "Sandman"...');
  await send('Page.navigate', { url: 'https://www.netflix4u.in/search?q=Sandman' });
  await new Promise(r => setTimeout(r, 4000));

  const sandmanResults = await send('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('.group, a[href*=\"/movie/\"], a[href*=\"/series/\"]')).map(a => ({
        href: a.href,
        text: a.innerText.trim().replace(/\\n+/g, ' '),
        img: a.querySelector('img')?.src || ''
      }));
      return {
        url: window.location.href,
        resultCount: cards.length,
        firstResults: cards.slice(0, 5)
      };
    })()`,
    returnByValue: true
  });
  console.log('Search Results for Sandman:', JSON.stringify(sandmanResults.result?.value, null, 2));

  // Test 3: Test Bollywood Category
  console.log('Testing Bollywood Category page...');
  await send('Page.navigate', { url: 'https://www.netflix4u.in/bollywood' });
  await new Promise(r => setTimeout(r, 4000));

  const bollywoodState = await send('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('.group, a[href*=\"/movie/\"]')).map(a => ({
        href: a.href,
        text: a.innerText.trim().replace(/\\n+/g, ' '),
        img: a.querySelector('img')?.src || ''
      }));
      return {
        url: window.location.href,
        heading: document.querySelector('h1, h2')?.innerText || '',
        count: cards.length,
        firstCards: cards.slice(0, 5)
      };
    })()`,
    returnByValue: true
  });
  console.log('Bollywood page state:', JSON.stringify(bollywoodState.result?.value, null, 2));

  edge.kill();
  console.log('--- Test live user flows finished ---');
}

testLiveUserFlows().catch(console.error);
