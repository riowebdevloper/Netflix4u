const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '../audit_artifacts/netmirror.center/assets/index-5ab46ee6.js');
const code = fs.readFileSync(jsPath, 'utf8');

const targetIdx = code.indexOf('Multi-Lang Server');
console.log('=== AROUND Multi-Lang Server (length 3000) ===');
console.log(code.substring(targetIdx - 500, targetIdx + 3000));
