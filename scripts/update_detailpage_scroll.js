const fs = require('fs');

for (const p of ['js/DetailPage-WPhzSGyt.js', 'assets/DetailPage-WPhzSGyt.js']) {
  let c = fs.readFileSync(p, 'utf8');
  const target = 'setIsStickyVisible(rect.bottom<60);';
  const repl = 'const sy=window.pageYOffset||document.documentElement.scrollTop||0; setIsStickyVisible(rect.bottom<80||sy>550);';

  if (c.includes(target)) {
    c = c.replace(target, repl);
    fs.writeFileSync(p, c, 'utf8');
    console.log('Updated sticky onScroll in', p);
  } else {
    console.log('Target not found in', p);
  }
}
