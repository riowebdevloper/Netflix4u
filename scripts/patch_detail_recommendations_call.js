const fs = require('fs');
const path = require('path');

const files = [
  path.resolve(__dirname, '../js/DetailPage-WPhzSGyt.js'),
  path.resolve(__dirname, '../assets/DetailPage-WPhzSGyt.js')
];

const target = 'const[k,y]=await Promise.all([Te(i,s),_e(i,s)]);';
const replacement = 'const k=await Te(i,s);const y=await _e(k?.tmdbId||k?.title||i,s);';

for (const fp of files) {
  if (!fs.existsSync(fp)) continue;
  let code = fs.readFileSync(fp, 'utf8');
  if (code.includes(target)) {
    code = code.replace(target, replacement);
    fs.writeFileSync(fp, code, 'utf8');
    console.log(`✅ Patched detail page recommendations call in: ${path.basename(fp)}`);
  } else {
    console.warn(`⚠️ Target not found in: ${path.basename(fp)}`);
  }
}
