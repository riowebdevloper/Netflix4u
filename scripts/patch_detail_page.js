const fs = require('fs');
const path = require('path');

const files = [
  path.resolve(__dirname, '..', 'js', 'DetailPage-WPhzSGyt.js'),
  path.resolve(__dirname, '..', 'assets', 'DetailPage-WPhzSGyt.js')
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');

  // Backup file
  fs.writeFileSync(file + '.bak', code);

  // 1. Pass links to ze in Ye:
  // e.jsx(ze,{id:a.id,imdbId:a.imdbId,type:s,title:a.title,poster:a.poster,backdrop:a.backdrop})
  const oldZeCall = 'e.jsx(ze,{id:a.id,imdbId:a.imdbId,type:s,title:a.title,poster:a.poster,backdrop:a.backdrop})';
  const newZeCall = 'e.jsx(ze,{id:a.id,imdbId:a.imdbId,type:s,title:a.title,poster:a.poster,backdrop:a.backdrop,links:a.links})';
  if (code.includes(oldZeCall)) {
    code = code.replace(oldZeCall, newZeCall);
    console.log('Passed links to ze in', path.basename(file));
  }

  // 2. Accept links in ze and add Fast Cloud server:
  // function ze({id:s,imdbId:i,type:a,title:n,poster:d,backdrop:x}){
  const oldZeSig = 'function ze({id:s,imdbId:i,type:a,title:n,poster:d,backdrop:x}){';
  const newZeSig = 'function ze({id:s,imdbId:i,type:a,title:n,poster:d,backdrop:x,links:Y_links}){';
  if (code.includes(oldZeSig)) {
    code = code.replace(oldZeSig, newZeSig);
  }

  // 3. Update V() in ze to support Hicine Cloud if selected:
  const oldV = 'switch(c){case"vidlink":return H(h,s,o,r);';
  const newV = 'if(c==="hicine"){const cl=(Y_links||[]).find(l=>l.isCloud)||(Y_links||[])[0];if(cl)return cl.url;}switch(c){case"vidlink":return H(h,s,o,r);';
  if (code.includes(oldV)) {
    code = code.replace(oldV, newV);
  }

  // 4. Update G in DetailPage to include Fast Cloud option if links exist:
  const oldG = 'const G=[{id:"vidlink",name:"Server 1",label:"VidLink"},{id:"vidsrcme",name:"Server 2",label:"VidSrc (me)"},{id:"vidsrcxyz",name:"Server 3",label:"VidSrc (xyz)"}]';
  const newG = 'const G=[{id:"vidlink",name:"Server 1",label:"VidLink"},{id:"hicine",name:"Fast Cloud",label:"⚡ Fast Cloud"},{id:"vidsrcme",name:"Server 2",label:"VidSrc (me)"},{id:"vidsrcxyz",name:"Server 3",label:"VidSrc (xyz)"}]';
  if (code.includes(oldG)) {
    code = code.replace(oldG, newG);
  }

  // 5. In Pe: Add Direct Download & Quality Links:
  const targetEndPe = 'f&&e.jsxs("a",{href:`https://9xbud.com/${b}`,target:"_blank",rel:"noopener noreferrer",className:"flex items-center gap-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-400 hover:text-blue-300 font-semibold px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-900/20","aria-label":"Download automatically",children:[e.jsx(fe,{className:"w-5 h-5"})," Download"]})]})]})]})})]})}';
  
  const replacementPe = 'f&&e.jsxs("a",{href:`https://9xbud.com/${b}`,target:"_blank",rel:"noopener noreferrer",className:"flex items-center gap-2.5 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-400 hover:text-blue-300 font-semibold px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-900/20","aria-label":"Download automatically",children:[e.jsx(fe,{className:"w-5 h-5"})," Download"]})]})' +
    ',s.links&&s.links.length>0&&e.jsxs("div",{className:"mt-6 p-4 sm:p-5 rounded-2xl bg-white/[0.05] border border-white/15 max-w-3xl shadow-xl backdrop-blur-sm",children:[' +
    'e.jsxs("div",{className:"flex items-center gap-2 mb-3.5",children:[e.jsx(fe,{className:"w-5 h-5 text-[var(--color-accent)]"}),e.jsx("h3",{className:"text-white text-sm sm:text-base font-bold",children:"⚡ Direct High-Speed Download & Stream Links:"}),e.jsx("span",{className:"text-[10px] uppercase font-bold bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full ml-auto",children:"Verified"})]}),' +
    'e.jsx("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-2.5",children:s.links.map((lnk,idx)=>e.jsxs("a",{key:idx,href:lnk.url,target:"_blank",rel:"noopener noreferrer",className:"flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.06] hover:bg-[var(--color-accent)] border border-white/10 hover:border-transparent text-white transition-all hover:scale-[1.02] active:scale-98 group/btn shadow-md",children:[' +
    'e.jsxs("div",{className:"flex items-center gap-2 min-w-0",children:[e.jsx("span",{className:"px-2 py-1 rounded bg-black/40 text-xs font-black text-yellow-400 border border-yellow-400/20",children:lnk.quality}),e.jsx("span",{className:"text-xs font-semibold truncate group-hover/btn:text-white text-gray-200",children:lnk.label})]}),' +
    'e.jsxs("div",{className:"flex items-center gap-1.5 flex-shrink-0",children:[lnk.size&&e.jsx("span",{className:"text-xs font-bold text-gray-400 group-hover/btn:text-white/90",children:lnk.size}),e.jsx(fe,{className:"w-4 h-4 text-gray-400 group-hover/btn:text-white transition-transform group-hover/btn:translate-y-0.5"})]})' +
    ']}))})' +
    ']})' +
    ']})]})})]})}';

  if (code.includes(targetEndPe)) {
    code = code.replace(targetEndPe, replacementPe);
    console.log('Added high-speed downloads section to', path.basename(file));
  } else {
    console.warn('Could not find targetEndPe in', path.basename(file));
  }

  fs.writeFileSync(file, code, 'utf8');
}
console.log('✅ DetailPage patching complete.');
