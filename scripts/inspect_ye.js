const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '../audit_artifacts/netmirror.center/assets/index-5ab46ee6.js');
const code = fs.readFileSync(jsPath, 'utf8');

const targetIdx = code.indexOf('function ye(ve,rt,bt,Lt,Xe,ht,_t="",be="",Ke=[],Zt,un)');
console.log('=== FUNCTION ye (length 6000) ===');
console.log(code.substring(targetIdx, targetIdx + 6000));
