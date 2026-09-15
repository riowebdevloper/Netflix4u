const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '../audit_artifacts/netmirror.center/assets/index-5ab46ee6.js');
const code = fs.readFileSync(jsPath, 'utf8');

const regex = /so\(([^)]+)\)/g;
let m;
const calls = [];
while ((m = regex.exec(code)) !== null) {
  calls.push(m[1]);
}
console.log('--- ALL CALLS TO so(...) ---');
console.log([...new Set(calls)].slice(0, 30));
