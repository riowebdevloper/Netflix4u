const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '../audit_artifacts/netmirror.center/assets/index-5ab46ee6.js');
const code = fs.readFileSync(jsPath, 'utf8');

// Find where mediaType and id are used to fetch detail
const target = 'const{mediaType:I,id:N}=Mu()';
const idx = code.indexOf(target);
console.log('=== CONTEXT OF DETAIL COMPONENT ===');
console.log(code.substring(idx - 1000, idx + 5000));
