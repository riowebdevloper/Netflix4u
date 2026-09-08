const fs = require('fs');

function patchIndex(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Mobile search button to btn-icon
  content = content.replace(
    'className:"md:hidden p-2 text-gray-300 hover:text-white hover:bg-white/10 rounded-full transition-all"',
    'className:"btn-icon md:hidden"'
  );

  // 2. Mobile menu burger to btn-icon
  content = content.replace(
    'className:"lg:hidden p-2 text-gray-300 hover:text-white"',
    'className:"btn-icon lg:hidden"'
  );

  // 3. Category nav pills to btn-pill
  content = content.replace(
    'className:`flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${Y?"bg-[var(--color-accent)]/15 text-white border border-[var(--color-accent)]/50":"bg-white/[0.06] text-gray-400 border border-white/[0.08] hover:bg-white/10 hover:text-white hover:border-white/15"}`',
    'className:`btn-pill flex-shrink-0 whitespace-nowrap ${Y?"bg-[var(--color-accent)]/20 text-white border-[var(--color-accent)]/50":""}`'
  );

  fs.writeFileSync(filePath, content);
  console.log('✅ Patched', filePath);
}

patchIndex('js/index-CQL8lqua.js');
patchIndex('assets/index-CQL8lqua.js');
