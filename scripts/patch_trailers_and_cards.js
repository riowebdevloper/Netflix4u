const fs = require('fs');
const path = require('path');

// ----------------------------------------------------
// 1. Patch MovieCard-DyC9jox1.js in js/ and assets/
// ----------------------------------------------------
const movieCardFiles = [
  path.resolve(__dirname, '..', 'js', 'MovieCard-DyC9jox1.js'),
  path.resolve(__dirname, '..', 'assets', 'MovieCard-DyC9jox1.js')
];

for (const file of movieCardFiles) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file + '.bak', code);

  // Replace function q: Make entire card a direct Link to the movie page, remove slide-up Watch button and modal
  const qStart = code.indexOf('function q({content:s,index:l=0}){');
  const qEnd = code.indexOf('export{q as M};');

  if (qStart !== -1 && qEnd !== -1) {
    const newQ = `function q({content:s,index:l=0}){
  const r=\`/\${s.type}/\${s.id}\`;
  return e.jsx(x.div,{
    initial:{opacity:0,y:20},
    whileInView:{opacity:1,y:0},
    viewport:{once:!0},
    transition:{duration:.4,delay:Math.min(l*.05,.3)},
    className:"group relative flex-shrink-0 w-[160px] sm:w-[185px] md:w-[200px]",
    children:e.jsxs(c,{
      to:r,
      className:"block w-full h-full select-none cursor-pointer",
      children:[
        e.jsxs("div",{
          className:"relative overflow-hidden rounded-xl bg-[var(--color-card)] aspect-[2/3] shadow-lg group-hover:shadow-2xl transition-all duration-300 group-hover:-translate-y-1 ring-1 ring-white/5 group-hover:ring-[var(--color-accent)]/40",
          children:[
            e.jsx("img",{
              src:s.poster,
              alt:s.title,
              className:"w-full h-full object-cover transition-transform duration-500 group-hover:scale-105",
              loading:"lazy",
              decoding:"async",
              onError:a=>{a.currentTarget.src="https://placehold.co/400x600/1a1a2e/8b8b99?text=No+Image"}
            }),
            e.jsx("div",{className:"absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"}),
            e.jsx("div",{className:"absolute top-2 left-2 flex flex-col gap-1",children:e.jsx("span",{className:\`text-[10px] font-bold px-1.5 py-0.5 rounded text-white \${n(s.quality)}\`,children:s.quality})}),
            e.jsxs("div",{className:"absolute top-2 right-2 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm rounded px-1.5 py-0.5",children:[e.jsx(p,{className:"w-3 h-3 text-yellow-400 fill-yellow-400"}),e.jsx("span",{className:\`text-[11px] font-bold \${h(s.rating)}\`,children:m(s.rating)})]}),
            e.jsx("div",{className:"absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300",children:e.jsx("div",{className:"w-11 h-11 rounded-full bg-[var(--color-accent)]/90 backdrop-blur-sm flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform",children:e.jsx(g,{className:"w-5 h-5 text-white fill-white ml-0.5"})})})
          ]
        }),
        e.jsxs("div",{
          className:"mt-2 px-0.5",
          children:[
            e.jsx("h3",{className:"text-white text-xs sm:text-sm font-semibold leading-tight group-hover:text-[var(--color-accent)] transition-colors line-clamp-1",children:s.title}),
            e.jsxs("div",{className:"flex items-center gap-2 mt-1",children:[
              e.jsxs("span",{className:"text-gray-500 text-[11px] flex items-center gap-0.5",children:[e.jsx(f,{className:"w-3 h-3"}),s.year]}),
              s.seasons&&e.jsxs("span",{className:"text-gray-500 text-[11px]",children:["S",s.seasons]}),
              e.jsx("span",{className:"text-gray-600 text-[11px] ml-auto capitalize",children:s.type})
            ]})
          ]
        })
      ]
    })
  });
}
`;
    code = code.substring(0, qStart) + newQ + code.substring(qEnd);
    fs.writeFileSync(file, code, 'utf8');
    console.log('✅ Patched MovieCard in:', path.basename(file));
  } else {
    console.warn('Could not locate function q in:', path.basename(file));
  }
}

// ----------------------------------------------------
// 2. Patch YouTube trailer integration in index-CQL8lqua.js
// ----------------------------------------------------
const indexFiles = [
  path.resolve(__dirname, '..', 'js', 'index-CQL8lqua.js'),
  path.resolve(__dirname, '..', 'assets', 'index-CQL8lqua.js')
];

for (const file of indexFiles) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');

  // Find mapHicineItem function and add trailer lookup helper
  const trailerHelperMarker = 'async function getTrailerForTitle(title, year, type) {';
  if (!code.includes(trailerHelperMarker)) {
    const helperCode = `
async function getTrailerForTitle(title, year, type = "movie") {
  try {
    const clean = title.replace(/\\(\\d{4}\\)/g, "").replace(/^(NetFlix|Prime|Disney\\+|Hotstar|SonyLIV|ZEE5)\\s+/i, "").trim();
    const endpoint = (type === "series" || type === "kdrama" || type === "anime") ? "tv" : "movie";
    const searchRes = await fetch("https://api.tmdb.org/3/search/" + endpoint + "?api_key=445f2b5a8941c1d4bd5a869761a916e3&query=" + encodeURIComponent(clean));
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const first = searchData.results && searchData.results[0];
      if (first && first.id) {
        const vidRes = await fetch("https://api.tmdb.org/3/" + endpoint + "/" + first.id + "/videos?api_key=445f2b5a8941c1d4bd5a869761a916e3");
        if (vidRes.ok) {
          const vidData = await vidRes.json();
          const tr = (vidData.results && vidData.results.find(x => x.type === "Trailer" && x.site === "YouTube"))
            || (vidData.results && vidData.results.find(x => x.site === "YouTube"));
          if (tr && tr.key) return "https://www.youtube.com/embed/" + tr.key;
        }
      }
    }
  } catch(e) {}
  const clean = title.replace(/\\(\\d{4}\\)/g, "").replace(/^(NetFlix|Prime|Disney\\+|Hotstar|SonyLIV|ZEE5)\\s+/i, "").trim();
  return "https://www.youtube.com/embed?listType=search&list=" + encodeURIComponent(clean + " official trailer");
}
`;
    // Insert helper right before mapHicineItem
    code = code.replace('function mapHicineItem(', helperCode + '\nfunction mapHicineItem(');
  }

  // In Kg: ensure mapped gets trailerUrl populated
  const targetKgReturn = 'const mapped = mapHicineItem(item, v);\n      HICINE_DATA.cache.set(s, mapped);\n      return mapped;';
  const newKgReturn = `const mapped = mapHicineItem(item, v);
      if (!mapped.trailerUrl) {
        mapped.trailerUrl = await getTrailerForTitle(mapped.title, mapped.year, mapped.type);
      }
      HICINE_DATA.cache.set(s, mapped);
      return mapped;`;

  if (code.includes(targetKgReturn)) {
    code = code.replace(targetKgReturn, newKgReturn);
    console.log('✅ Integrated YouTube trailer lookup into Kg in:', path.basename(file));
  } else {
    // Try matching with different whitespace
    const altMarker = 'HICINE_DATA.cache.set(s, mapped);';
    if (code.includes(altMarker) && !code.includes('await getTrailerForTitle(mapped.title')) {
      code = code.replace(altMarker, `if (!mapped.trailerUrl) { mapped.trailerUrl = await getTrailerForTitle(mapped.title, mapped.year, mapped.type); }\n      HICINE_DATA.cache.set(s, mapped);`);
      console.log('✅ Integrated YouTube trailer lookup (alt) into Kg in:', path.basename(file));
    }
  }

  fs.writeFileSync(file, code, 'utf8');
}

console.log('🚀 Trailers & MovieCard updates completed successfully!');
