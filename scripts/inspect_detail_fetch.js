const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '../audit_artifacts/netmirror.center/assets/index-5ab46ee6.js');
const code = fs.readFileSync(jsPath, 'utf8');

// Find all fetch or axios calls to api2.imdb3.shop or api2.imdb4.shop
const regex = /(https:\/\/api2\.imdb[34]\.shop[^\s"'`]+)/g;
const matches = [...new Set(code.match(regex) || [])];
console.log('--- ALL IMDB SHOP URLS FOUND ---');
matches.forEach(m => console.log(m));

// Search for where detail or id is used with api2.imdb3.shop
const detailPatterns = code.match(/imdb[34]\.shop\/api\/[a-zA-Z0-9_\-\/]+/g) || [];
console.log('\n--- DETAIL / API PATTERNS ---');
console.log([...new Set(detailPatterns)]);
