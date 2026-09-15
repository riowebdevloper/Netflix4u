const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '../audit_artifacts/netmirror.center/assets/index-5ab46ee6.js');
const code = fs.readFileSync(jsPath, 'utf8');

let idx = 0;
while ((idx = code.indexOf('sm,', idx)) !== -1 || (idx = code.indexOf('sm}', idx)) !== -1) {
  console.log('--- USAGE OF sm AT', idx, '---');
  console.log(code.substring(idx - 300, idx + 400));
  idx += 10;
}
