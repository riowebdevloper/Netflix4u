const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, '..', 'data', 'details');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const mapPath = path.resolve(__dirname, '..', 'data', 'details_map.json');
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

const start = Date.now();
const keys = Object.keys(map);
let count = 0;

for (const k of keys) {
  const safeName = k.replace(/[/\\?%*:|"<>]/g, '_');
  try {
    fs.writeFileSync(path.join(dir, safeName + '.json'), JSON.stringify(map[k]));
    count++;
  } catch (err) {}
}

console.log(`✅ Generated ${count} static detail files in ${((Date.now() - start) / 1000).toFixed(1)}s`);
