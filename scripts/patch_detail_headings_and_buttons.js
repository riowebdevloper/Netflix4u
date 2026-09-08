const fs = require('fs');

function patchDetail(filePath) {
  let c = fs.readFileSync(filePath, 'utf8');

  // 1. Change H3 download headings to H2 (Issue 2)
  c = c.replace(
    'e.jsx("h3",{className:"text-white text-sm sm:text-base font-bold",children:"⚡ Hicine Fast Cloud Direct Links:"})',
    'e.jsx("h2",{className:"text-white text-sm sm:text-base font-bold",children:"⚡ Hicine Fast Cloud Direct Links:"})'
  );
  c = c.replace(
    'e.jsx("h3",{className:"text-white text-sm sm:text-base font-bold",children:"📥 Dotmovies Multi-Quality Downloads:"})',
    'e.jsx("h2",{className:"text-white text-sm sm:text-base font-bold",children:"📥 Dotmovies Multi-Quality Downloads:"})'
  );

  // 2. Harmonize buttons (Issue 1)
  // Back button -> btn-secondary
  c = c.replace(
    'className:"inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-black/70 hover:bg-black/90 backdrop-blur-md text-gray-200 hover:text-white transition-all text-sm font-medium border border-white/15 shadow-xl hover:scale-105 active:scale-95 cursor-pointer no-underline"',
    'className:"btn-secondary shadow-xl cursor-pointer no-underline"'
  );

  // Genre pills -> btn-pill
  c = c.replace(
    'className:"text-sm px-3 sm:px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-gray-300 hover:bg-[var(--color-accent)]/20 hover:border-[var(--color-accent)]/40 hover:text-white transition-all"',
    'className:"btn-pill"'
  );

  // Watch Movie -> btn-primary
  c = c.replace(
    'className:"flex items-center gap-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-900/40"',
    'className:"btn-primary shadow-lg shadow-red-900/40"'
  );

  // Trailer -> btn-secondary
  c = c.replace(
    'className:"flex items-center gap-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl transition-all hover:scale-105 active:scale-95"',
    'className:"btn-secondary"'
  );

  // Watchlist -> btn-secondary
  c = c.replace(
    'className:"flex items-center gap-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl transition-all"',
    'className:"btn-secondary"'
  );

  // Download quick button -> btn-secondary
  c = c.replace(
    'className:"flex items-center gap-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-400 hover:text-blue-300 font-semibold px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-900/20"',
    'className:"btn-secondary text-blue-400 hover:text-blue-300 border-blue-500/40 shadow-lg shadow-blue-900/20"'
  );

  // Theater mode & Fullscreen buttons -> btn-icon
  c = c.replace(
    'className:"p-2 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all",title:p?"Exit theater mode":"Theater mode"',
    'className:"btn-icon",title:p?"Exit theater mode":"Theater mode"'
  );
  c = c.replace(
    'className:"p-2 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all",title:"Fullscreen (F)"',
    'className:"btn-icon",title:"Fullscreen (F)"'
  );

  fs.writeFileSync(filePath, c);
  console.log('✅ Patched', filePath);
}

function patchIndex(filePath) {
  let c = fs.readFileSync(filePath, 'utf8');

  // Footer headings H4 to H3 (Issue 3)
  c = c.replace(
    'o.jsx("h4",{className:"text-white font-semibold mb-4 text-sm uppercase tracking-wider",children:s})',
    'o.jsx("h3",{className:"text-white font-semibold mb-4 text-sm uppercase tracking-wider",children:s})'
  );

  fs.writeFileSync(filePath, c);
  console.log('✅ Patched footer in', filePath);
}

patchDetail('js/DetailPage-WPhzSGyt.js');
patchDetail('assets/DetailPage-WPhzSGyt.js');
patchIndex('js/index-CQL8lqua.js');
patchIndex('assets/index-CQL8lqua.js');
