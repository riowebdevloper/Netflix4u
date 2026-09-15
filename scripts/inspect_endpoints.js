const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '../audit_artifacts/netmirror.center/assets/index-5ab46ee6.js');
const code = fs.readFileSync(jsPath, 'utf8');

// Find all endpoints used with api2.imdb3.shop
const matches = code.match(/["'](\/[a-zA-Z0-9_\-\/\?=&]+)["']/g) || [];
const apiEndpoints = [...new Set(matches)].filter(m => 
  m.includes('tranding') || 
  m.includes('movie') || 
  m.includes('tv') || 
  m.includes('filter') || 
  m.includes('list') || 
  m.includes('category') || 
  m.includes('detail') ||
  m.includes('season') ||
  m.includes('home')
);

console.log('--- FOUND API ENDPOINTS IN NETMIRROR ---');
console.log(apiEndpoints);
