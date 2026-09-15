const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '../audit_artifacts/netmirror.center/assets/index-5ab46ee6.js');
const htmlPath = path.join(__dirname, '../audit_artifacts/netmirror.center/index.html');

console.log('--- INDEX.HTML ---');
if (fs.existsSync(htmlPath)) {
  console.log(fs.readFileSync(htmlPath, 'utf8'));
}

if (fs.existsSync(jsPath)) {
  const code = fs.readFileSync(jsPath, 'utf8');
  console.log('\n--- SCRIPT STATS ---');
  console.log('Size:', code.length);

  // URLs
  const urlRegex = /https?:\/\/[a-zA-Z0-9\.\-_:\/%\?=&;#+]+/g;
  const urls = [...new Set(code.match(urlRegex) || [])];
  console.log('\n--- INTERESTING URLS ---');
  urls.filter(u => /player|embed|stream|api|vidsrc|server|peach|net|video|m3u8|hls|cloud|cdn/i.test(u))
      .forEach(u => console.log(u));

  // Search for server arrays or objects
  console.log('\n--- SEARCHING FOR SERVER DEFINITIONS ---');
  const serverMatches = code.match(/server[s]?\s*[:=]\s*(\[[^\]]+\]|\{[^\}]+\})/gi) || [];
  serverMatches.slice(0, 10).forEach(m => console.log(m.slice(0, 200)));

  // Search for player iframe keywords
  console.log('\n--- SEARCHING FOR IFRAME / EMBED / STREAM LOGIC ---');
  const iframeMatches = code.match(/.{0,60}iframe.{0,100}/gi) || [];
  iframeMatches.slice(0, 10).forEach(m => console.log(m));

  // Search for API paths or routes
  console.log('\n--- SEARCHING FOR API PATHS ---');
  const apiPaths = [...new Set(code.match(/['"](\/api\/[a-zA-Z0-9_\-\/]+)['"]/g) || [])];
  console.log(apiPaths);
}
