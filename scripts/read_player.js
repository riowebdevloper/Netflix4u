const fs = require('fs');
const s = fs.readFileSync('js/DetailPage-WPhzSGyt.js', 'utf8');
const gIdx = s.indexOf('const G=');
if (gIdx !== -1) {
  console.log(s.slice(gIdx, gIdx + 400));
} else {
  console.log('const G= not found, looking for G=');
  const idx = s.indexOf('G=[');
  if (idx !== -1) console.log(s.slice(idx, idx + 400));
}
