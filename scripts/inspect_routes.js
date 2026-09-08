const fs = require('fs');
const c = fs.readFileSync('js/index-CQL8lqua.js', 'utf8');

const matches = c.match(/Te=async\s*\([^)]*\)\s*=>\s*\{[^}]+\}/);
if (matches) {
  console.log('Te function:', matches[0]);
} else {
  const idx = c.indexOf('Te=');
  console.log('Te snippet:', c.slice(idx, idx + 400));
}
