const https = require('https');
const fs = require('fs');
const path = require('path');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, data: d, headers: res.headers }));
    }).on('error', reject);
  });
}

async function analyze() {
  console.log('🌐 Fetching and analyzing https://www.hicine.sbs/ ...');
  const home = await fetchUrl('https://www.hicine.sbs/');
  console.log('Homepage Status:', home.status);

  // Find all script tags
  const scripts = [...home.data.matchAll(/src="([^"]+)"/g)].map(m => m[1]);
  console.log('Scripts:', scripts);

  const jsUrl = scripts.find(s => s.includes('.js') && s.startsWith('/assets/'));
  if (jsUrl) {
    const fullJsUrl = 'https://www.hicine.sbs' + jsUrl;
    console.log('Fetching main bundle:', fullJsUrl);
    const bundle = await fetchUrl(fullJsUrl);
    console.log('Bundle size:', (bundle.data.length / 1024).toFixed(1), 'KB');

    // Extract API base URLs
    const apis = [...bundle.data.matchAll(/https?:\/\/[a-zA-Z0-9.-]+(?::\d+)?(?:\/[a-zA-Z0-9._~:/?#\[\]@!$&'()*+,;=-]*)?/g)].map(m => m[0]);
    const uniqueApis = [...new Set(apis)].filter(u => !u.includes('w3.org') && !u.includes('schema.org'));
    console.log('\n--- Discovered Endpoints & Services in Bundle ---');
    uniqueApis.forEach(u => console.log(' •', u));

    // Look for API keys / authorization tokens
    const secrets = bundle.data.match(/(?:key|token|auth|secret|bearer)[a-zA-Z0-9_-]{10,}/gi) || [];
    console.log('\nPotential tokens/keys:', [...new Set(secrets)].slice(0, 10));

    // Analyze Router routes
    const routes = [...bundle.data.matchAll(/path:\s*["']([^"']+)["']/g)].map(m => m[1]);
    console.log('\n--- Frontend Routes ---');
    console.log([...new Set(routes)]);

    // Check features
    console.log('\n--- Feature Highlights ---');
    console.log('Includes Player:', bundle.data.includes('iframe') || bundle.data.includes('player'));
    console.log('Includes Download:', bundle.data.includes('download') || bundle.data.includes('vcloud'));
    console.log('Includes Categories:', bundle.data.includes('bollywood') || bundle.data.includes('hollywood'));
    console.log('Ad networks detected:', scripts.filter(s => s.includes('nowherecueantique') || s.includes('histats')));
  }
}

analyze().catch(console.error);
