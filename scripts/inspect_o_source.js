const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '../audit_artifacts/netmirror.center/assets/index-5ab46ee6.js');
const code = fs.readFileSync(jsPath, 'utf8');

console.log(code.substring(561000, 563853));
