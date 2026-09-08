const fs = require('fs');

['js/DetailPage-WPhzSGyt.js', 'assets/DetailPage-WPhzSGyt.js'].forEach(filePath => {
  let c = fs.readFileSync(filePath, 'utf8');
  
  const target = 'activeG.map(t=>e.jsxs("button",{onClick:()=>f(t.id),className:`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${c===t.id?"bg-[var(--color-accent)] text-white shadow-lg":"text-gray-400 hover:text-white hover:bg-white/5"}`,"aria-pressed":c===t.id';
  
  const replacement = 'activeG.map(t=>e.jsxs("button",{onClick:()=>f(t.id),className:`btn-pill ${c===t.id?"active shadow-lg shadow-red-900/40":"opacity-80 hover:opacity-100"}`,"aria-pressed":c===t.id';

  if (c.includes(target)) {
    c = c.replace(target, replacement);
    fs.writeFileSync(filePath, c);
    console.log('✅ Replaced server buttons in', filePath);
  } else {
    console.log('⚠️ Target not found in', filePath);
  }
});
