const fs = require('fs');

['assets/index-CQL8lqua.js', 'js/index-CQL8lqua.js'].forEach(fp => {
  if (!fs.existsSync(fp)) return;
  let s = fs.readFileSync(fp, 'utf8');
  s = s.replace(/emoji:\s*"[^"]*"/g, 'emoji:""');
  fs.writeFileSync(fp, s, 'utf8');
  console.log('Processed', fp);
});
