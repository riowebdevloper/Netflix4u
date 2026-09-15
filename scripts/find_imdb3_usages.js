const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '../audit_artifacts/netmirror.center/assets/index-5ab46ee6.js');
const code = fs.readFileSync(jsPath, 'utf8');

let idx = 0;
while ((idx = code.indexOf('https://api2.imdb3.shop/api', idx)) !== -1) {
  console.log('--- MATCH AT', idx, '---');
  console.log(code.substring(idx - 100, idx + 400));
  console.log('\n');
  idx += 20;
}
