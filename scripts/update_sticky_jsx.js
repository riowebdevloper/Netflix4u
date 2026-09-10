const fs = require('fs');

for (const p of ['js/DetailPage-WPhzSGyt.js', 'assets/DetailPage-WPhzSGyt.js']) {
  let c = fs.readFileSync(p, 'utf8');
  const target = 'isStickyVisible&&!p&&e.jsxs("div",{className:"sticky-server-bar flex items-center justify-between gap-2",';
  const repl = 'isStickyVisible&&!p&&e.jsxs("div",{className:"sticky-server-bar",';

  if (c.includes(target)) {
    c = c.replace(target, repl);
    fs.writeFileSync(p, c, 'utf8');
    console.log('Updated sticky-server-bar className in', p);
  } else {
    console.log('Target not found in', p);
  }
}
