const fs = require('fs');

const targets = ['js/index-CQL8lqua.js', 'assets/index-CQL8lqua.js'];
for (const t of targets) {
  let code = fs.readFileSync(t, 'utf8');
  // Find FOOTER_INFO and following ug=
  const idx = code.indexOf('ug=[{label:"Twitter"');
  if (idx !== -1) {
    code = code.substring(0, idx) + 'const ' + code.substring(idx);
    fs.writeFileSync(t, code, 'utf8');
    console.log('Fixed ug in', t);
  } else {
    console.log('ug already has const or not found in', t);
  }
}
