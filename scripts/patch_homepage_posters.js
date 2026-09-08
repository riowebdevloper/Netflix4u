const fs = require('fs');
const path = require('path');

const files = [
  path.resolve(__dirname, '../js/HomePage-mNJ_gjp9.js'),
  path.resolve(__dirname, '../assets/HomePage-mNJ_gjp9.js')
];

const replacement = `function be({content:t,index:l=0}){const m=\`/\${t.type}/\${t.id}\`;return e.jsxs(N.div,{initial:{opacity:0,y:20},whileInView:{opacity:1,y:0},viewport:{once:!0},transition:{duration:.4,delay:Math.min(l*.04,.3)},className:"group relative flex-shrink-0 w-[155px] xs:w-[170px] sm:w-[185px] md:w-[195px] cursor-pointer select-none",children:[e.jsxs(y,{to:m,className:"block relative overflow-hidden rounded-xl bg-[var(--color-card)] aspect-[2/3] shadow-md group-hover:shadow-2xl transition-all duration-300",children:[e.jsx("img",{src:t.poster||t.backdrop,alt:t.title,className:"w-full h-full object-cover transition-transform duration-500 group-hover:scale-105",loading:"lazy",decoding:"async",onError:d=>{d.currentTarget.src="https://placehold.co/400x600/1a1a2e/8b8b99?text=No+Image"}}),e.jsx("div",{className:"absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-80 transition-opacity duration-300"}),t.quality&&e.jsx("span",{className:"absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded text-white bg-black/60 backdrop-blur-sm border border-white/10",children:t.quality}),e.jsxs("div",{className:"absolute top-2 right-2 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm rounded px-1.5 py-0.5",children:[e.jsx(W,{className:"w-3 h-3 text-yellow-400 fill-yellow-400"}),e.jsx("span",{className:"text-yellow-400 text-[11px] font-bold",children:I(t.rating)})]}),e.jsx("div",{className:"absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300",children:e.jsx("div",{className:"w-11 h-11 rounded-full bg-[var(--color-accent)] flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform",children:e.jsx(C,{className:"w-4 h-4 text-white fill-white ml-0.5"})})})]}),e.jsxs("div",{className:"mt-2 px-0.5",children:[e.jsx(y,{to:m,children:e.jsx("h3",{className:"text-white text-xs sm:text-sm font-semibold leading-tight line-clamp-1 group-hover:text-[var(--color-accent)] transition-colors",children:t.title})}),e.jsxs("div",{className:"flex items-center gap-2 mt-1 text-[11px] text-gray-500",children:[t.year&&e.jsx("span",{children:t.year}),t.duration&&e.jsx("span",{children:t.duration}),e.jsx("span",{className:"ml-auto capitalize text-gray-400 text-[10px]",children:t.type==="series"?"Series":t.type==="kdrama"?"K-Drama":t.type==="anime"?"Anime":"Movie"})]})]})]})}`;

for (const fp of files) {
  if (!fs.existsSync(fp)) continue;
  let code = fs.readFileSync(fp, 'utf8');
  const start = code.indexOf('function be({content:t');
  const end = code.indexOf('function u({title:t');

  if (start !== -1 && end !== -1 && end > start) {
    const before = code.slice(0, start);
    const after = code.slice(end);
    const newCode = before + replacement + after;
    fs.writeFileSync(fp, newCode, 'utf8');
    console.log(`✅ Successfully patched ${path.basename(fp)} with portrait aspect ratio!`);
  } else {
    console.warn(`⚠️ Boundaries not found in ${path.basename(fp)}`);
  }
}
