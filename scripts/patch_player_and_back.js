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
  fs.writeFileSync(file + '.bak2', code);

  // 1. Back button patch
  const oldBack = 'e.jsx("div",{className:"absolute top-20 left-4 lg:left-8 z-30",children:e.jsxs("button",{onClick:()=>window.history.back(),className:"inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-black/70 hover:bg-black/90 backdrop-blur-md text-gray-200 hover:text-white transition-all text-sm font-medium border border-white/15 shadow-xl hover:scale-105 active:scale-95 cursor-pointer","aria-label":"Go back",children:[e.jsx(T,{className:"w-4 h-4"})," Back"]})})';
  const newBack = 'e.jsx("div",{className:"absolute top-20 left-4 lg:left-8 z-30",children:e.jsxs("a",{href:"/",onClick:ev=>{ev.preventDefault();if(window.history.state&&typeof window.history.state.idx==="number"&&window.history.state.idx>0){window.history.back()}else if(document.referrer&&document.referrer.includes(window.location.host)&&window.history.length>1){window.history.back()}else{window.location.href="/"}},className:"inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-black/70 hover:bg-black/90 backdrop-blur-md text-gray-200 hover:text-white transition-all text-sm font-medium border border-white/15 shadow-xl hover:scale-105 active:scale-95 cursor-pointer no-underline","aria-label":"Go back",children:[e.jsx(T,{className:"w-4 h-4"})," Back"]})})';

  if (code.includes(oldBack)) {
    code = code.replace(oldBack, newBack);
    console.log('Patched Back button in', path.basename(file));
  } else {
    console.warn('Could not find oldBack in', path.basename(file));
  }

  // 2. Pass tmdbId to ze in Ye
  const oldZeYe = 'e.jsx(ze,{id:a.id,imdbId:a.imdbId,type:s,title:a.title,poster:a.poster,backdrop:a.backdrop,links:a.links})';
  const newZeYe = 'e.jsx(ze,{id:a.id,imdbId:a.imdbId,tmdbId:a.tmdbId,type:s,title:a.title,poster:a.poster,backdrop:a.backdrop,links:a.links})';
  if (code.includes(oldZeYe)) {
    code = code.replace(oldZeYe, newZeYe);
    console.log('Passed tmdbId to ze in', path.basename(file));
  }

  // 3. Update ze function signature to accept tmdbId
  const oldZeSig = 'function ze({id:s,imdbId:i,type:a,title:n,poster:d,backdrop:x,links:Y_links}){';
  const newZeSig = 'function ze({id:s,imdbId:i,tmdbId:tmdb,type:a,title:n,poster:d,backdrop:x,links:Y_links}){const hasCloud=!!(Y_links&&Y_links.length>0);const activeG=hasCloud?[{id:"hicine",name:"Fast Cloud",label:"⚡ Fast Cloud"},{id:"vidlink",name:"Server 1",label:"VidLink"},{id:"vidsrcme",name:"Server 2",label:"VidSrc (me)"},{id:"vidsrcxyz",name:"Server 3",label:"VidSrc (xyz)"}]:[{id:"vidlink",name:"Server 1",label:"VidLink"},{id:"vidsrcme",name:"Server 2",label:"VidSrc (me)"},{id:"vidsrcxyz",name:"Server 3",label:"VidSrc (xyz)"}];';
  if (code.includes(oldZeSig)) {
    code = code.replace(oldZeSig, newZeSig);
    console.log('Updated ze signature in', path.basename(file));
  }

  // 4. Default server initialization
  const oldServerState = 'const[c,f]=l.useState(G[0].id),';
  const newServerState = 'const[c,f]=l.useState(hasCloud?"hicine":"vidlink");l.useEffect(()=>{hasCloud&&f("hicine")},[hasCloud]);';
  if (code.includes(oldServerState)) {
    code = code.replace(oldServerState, newServerState);
    console.log('Updated server state initialization in', path.basename(file));
  }

  // 5. Update G.map to activeG.map
  const oldGMap = 'G.map(t=>e.jsxs("button",{onClick:()=>f(t.id)';
  const newGMap = 'activeG.map(t=>e.jsxs("button",{onClick:()=>f(t.id)';
  if (code.includes(oldGMap)) {
    code = code.replace(oldGMap, newGMap);
    console.log('Updated G.map to activeG.map in', path.basename(file));
  }

  // 6. Update V() in ze to pick best cloud quality and pass tmdbId to VidLink/VidSrc
  const oldVFunc = 'const V=()=>{const t=i||s,m=!!i;if(c==="hicine"){const cl=(Y_links||[]).find(l=>l.isCloud)||(Y_links||[])[0];if(cl)return cl.url;}switch(c){case"vidlink":return H(h,s,o,r);case"vidsrcme":return h?m?`https://vidsrc.me/embed/tv?imdb=${t}&season=${o}&episode=${r}`:`https://vidsrc.me/embed/tv?tmdb=${t}&season=${o}&episode=${r}`:m?`https://vidsrc.me/embed/movie?imdb=${t}`:`https://vidsrc.me/embed/movie?tmdb=${t}`;case"vidsrcxyz":return h?m?`https://vidsrc.xyz/embed/tv?imdb=${t}&season=${o}&episode=${r}`:`https://vidsrc.xyz/embed/tv?tmdb=${t}&season=${o}&episode=${r}`:m?`https://vidsrc.xyz/embed/movie?imdb=${t}`:`https://vidsrc.xyz/embed/movie?tmdb=${t}`;default:return H(h,s,o,r)}}';
  const newVFunc = 'const V=()=>{const t=tmdb||i||s,m=!tmdb&&!!i;if(c==="hicine"){const cl=(Y_links||[]).find(l=>/1080/i.test(l.quality))||(Y_links||[]).find(l=>/720|HD/i.test(l.quality))||(Y_links||[]).find(l=>l.isCloud)||(Y_links||[])[0];if(cl)return cl.url;}switch(c){case"vidlink":return H(h,tmdb||s,o,r);case"vidsrcme":return h?m?`https://vidsrc.me/embed/tv?imdb=${t}&season=${o}&episode=${r}`:`https://vidsrc.me/embed/tv?tmdb=${t}&season=${o}&episode=${r}`:m?`https://vidsrc.me/embed/movie?imdb=${t}`:`https://vidsrc.me/embed/movie?tmdb=${t}`;case"vidsrcxyz":return h?m?`https://vidsrc.xyz/embed/tv?imdb=${t}&season=${o}&episode=${r}`:`https://vidsrc.xyz/embed/tv?tmdb=${t}&season=${o}&episode=${r}`:m?`https://vidsrc.xyz/embed/movie?imdb=${t}`:`https://vidsrc.xyz/embed/movie?tmdb=${t}`;default:return H(h,tmdb||s,o,r)}}';
  if (code.includes(oldVFunc)) {
    code = code.replace(oldVFunc, newVFunc);
    console.log('Updated V() function in', path.basename(file));
  } else {
    console.warn('Could not find oldVFunc in', path.basename(file));
  }

  fs.writeFileSync(file, code, 'utf8');
}
console.log('✅ DetailPage patches applied successfully.');
