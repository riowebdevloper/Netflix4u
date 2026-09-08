const fs = require('fs');
const c = fs.readFileSync('js/index-CQL8lqua.js', 'utf8');

const lastExport = c.lastIndexOf('export');
console.log(c.slice(lastExport));
