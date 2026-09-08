const fs = require('fs');
const c = fs.readFileSync('js/index-CQL8lqua.js', 'utf8');

const idx = c.indexOf('const Kg=');
console.log(c.slice(idx, idx + 500));
