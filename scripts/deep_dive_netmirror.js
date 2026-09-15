const fs = require('fs');
const path = require('path');

const jsPath = path.join(__dirname, '../audit_artifacts/netmirror.center/assets/index-5ab46ee6.js');
const code = fs.readFileSync(jsPath, 'utf8');

// Let's find context around "bet.watch21.shop" or "dv.watch22.shop" or "spedostream2" or "watch-download.shop"
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

printContext('watch21.shop', 600);
printContext('spedostream2', 600);
printContext('imdb3.shop', 600);
printContext('Server', 200);
