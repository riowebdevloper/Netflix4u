const fs = require('fs');

function patchHomePage(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Hero Title clamp to 48px
  content = content.replace(
    'fontSize:"clamp(2rem, 5vw, 4.5rem)"',
    'fontSize:"48px"'
  );

  // 2. Top-10 numbers to standard 120px
  content = content.replace(
    'text-[120px] sm:text-[140px] md:text-[160px]',
    'top-number text-[120px]'
  );

  // 3. Hero Watch Now button to btn-primary
  content = content.replace(
    'flex items-center gap-2.5 bg-white hover:bg-gray-100 text-black font-bold py-3 sm:py-3.5 px-5 sm:px-8 rounded-xl transition-all hover:scale-[1.03] active:scale-95 shadow-2xl text-sm sm:text-base',
    'btn-primary shadow-2xl'
  );

  // 4. Hero More Info to btn-secondary
  content = content.replace(
    'flex items-center gap-2.5 bg-white/15 hover:bg-white/25 text-white font-semibold py-3 sm:py-3.5 px-4 sm:px-6 rounded-xl backdrop-blur-md transition-all border border-white/20 hover:scale-[1.03] active:scale-95 text-sm sm:text-base',
    'btn-secondary'
  );

  // 5. Hero Watchlist to btn-secondary
  content = content.replace(
    /flex items-center gap-2 py-3 sm:py-3\.5 px-3 sm:px-4 rounded-xl font-semibold transition-all border text-sm sm:text-base \$\{b\?"bg-\[var\(--color-accent\)\]\/20 border-\[var\(--color-accent\)\]\/50 text-\[var\(--color-accent\)\]":"bg-white\/10 border-white\/20 text-white hover:bg-white\/20"\}/g,
    'btn-secondary'
  );

  // 6. Hero Prev/Next arrows to btn-icon
  content = content.replace(
    'absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center transition-all hover:scale-110 active:scale-95 opacity-0 sm:opacity-60 hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100',
    'btn-icon absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 opacity-0 sm:opacity-60 hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100'
  );
  content = content.replace(
    'absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center transition-all hover:scale-110 active:scale-95 opacity-0 sm:opacity-60 hover:opacity-100 focus-visible:opacity-100',
    'btn-icon absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 opacity-0 sm:opacity-60 hover:opacity-100 focus-visible:opacity-100'
  );

  // 7. Row scroll buttons: change outer <button> wrapper to <div> and give inner button .btn-icon
  // Left:
  content = content.replace(
    /e\.jsx\("button",\{onClick:\(\)=>[a-z]\("left"\),className:"absolute left-0 top-1\/2 -translate-y-1\/2 z-10 w-10 h-full bg-gradient-to-r from-\[var\(--color-navy-950\)\] to-transparent flex items-center justify-start pl-1 opacity-0 group-hover\/section:opacity-100 transition-opacity",children:e\.jsx\("span",\{className:"w-9 h-9 bg-\[var\(--color-navy-800\)\] hover:bg-\[var\(--color-navy-700\)\] rounded-full flex items-center justify-center text-white border border-white\/10 shadow-xl",children:e\.jsx\(A,\{className:"w-5 h-5"\}\)\}\)\}\)/g,
    (match) => {
      const fnName = match.includes('m("left")') ? 'm' : (match.includes('d("left")') ? 'd' : 'h');
      return `e.jsx("div",{className:"absolute left-0 top-1/2 -translate-y-1/2 z-10 w-12 h-full bg-gradient-to-r from-[var(--color-navy-950)] to-transparent flex items-center justify-start pl-1 opacity-0 group-hover/section:opacity-100 transition-opacity pointer-events-none",children:e.jsx("button",{onClick:()=>${fnName}("left"),className:"btn-icon pointer-events-auto","aria-label":"Scroll left",children:e.jsx(A,{className:"w-5 h-5"})})})`;
    }
  );

  // Right:
  content = content.replace(
    /e\.jsx\("button",\{onClick:\(\)=>[a-z]\("right"\),className:"absolute right-0 top-1\/2 -translate-y-1\/2 z-10 w-10 h-full bg-gradient-to-l from-\[var\(--color-navy-950\)\] to-transparent flex items-center justify-end pr-1 opacity-0 group-hover\/section:opacity-100 transition-opacity",children:e\.jsx\("span",\{className:"w-9 h-9 bg-\[var\(--color-navy-800\)\] hover:bg-\[var\(--color-navy-700\)\] rounded-full flex items-center justify-center text-white border border-white\/10 shadow-xl",children:e\.jsx\(k,\{className:"w-5 h-5"\}\)\}\)\}\)/g,
    (match) => {
      const fnName = match.includes('m("right")') ? 'm' : (match.includes('d("right")') ? 'd' : 'h');
      return `e.jsx("div",{className:"absolute right-0 top-1/2 -translate-y-1/2 z-10 w-12 h-full bg-gradient-to-l from-[var(--color-navy-950)] to-transparent flex items-center justify-end pr-1 opacity-0 group-hover/section:opacity-100 transition-opacity pointer-events-none",children:e.jsx("button",{onClick:()=>${fnName}("right"),className:"btn-icon pointer-events-auto","aria-label":"Scroll right",children:e.jsx(k,{className:"w-5 h-5"})})})`;
    }
  );

  fs.writeFileSync(filePath, content);
  console.log('✅ Patched', filePath);
}

patchHomePage('js/HomePage-mNJ_gjp9.js');
patchHomePage('assets/HomePage-mNJ_gjp9.js');
