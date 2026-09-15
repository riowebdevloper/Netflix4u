const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '../audit_artifacts/netmirror.center/assets/index-5ab46ee6.js');
const code = fs.readFileSync(jsPath, 'utf8');

function printContext(keyword, radius = 500) {
  let idx = 0;
  console.log(`\n================ CONTEXT FOR "${keyword}" ================`);
  while ((idx = code.indexOf(keyword, idx)) !== -1) {
    const start = Math.max(0, idx - radius);
    const end = Math.min(code.length, idx + radius);
    console.log(code.substring(start, end));
    console.log('\n------------------------------------------------------------\n');
    idx += keyword.length;
  }
}

printContext('api2.imdb3.shop', 500);
printContext('api2.imdb4.shop', 500);
