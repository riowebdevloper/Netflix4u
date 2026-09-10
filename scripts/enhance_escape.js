const fs = require('fs');

for (const p of ['js/index-CQL8lqua.js', 'assets/index-CQL8lqua.js']) {
  let c = fs.readFileSync(p, 'utf8');
  const target = 'const onKey=e=>{ if(e.key==="Escape") w(!1); };\n    window.addEventListener("keydown",onKey);';
  const repl = 'const onKey=e=>{ if(e.key==="Escape"||e.code==="Escape") w(!1); };\n    window.addEventListener("keydown",onKey);\n    document.addEventListener("keydown",onKey);';

  if (c.includes(target)) {
    c = c.replace(target, repl);
    const endTarget = 'window.removeEventListener("keydown",onKey);\n      document.body.style.overflow=orig;';
    const endRepl = 'window.removeEventListener("keydown",onKey);\n      document.removeEventListener("keydown",onKey);\n      document.body.style.overflow=orig;';
    c = c.replace(endTarget, endRepl);
    fs.writeFileSync(p, c, 'utf8');
    console.log('Enhanced Escape listener in', p);
  } else {
    console.log('Target not found in', p);
  }
}
