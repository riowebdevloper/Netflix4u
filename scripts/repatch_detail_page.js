const fs = require('fs');
const path = require('path');

const files = [
  path.resolve(__dirname, '..', 'js', 'DetailPage-WPhzSGyt.js'),
  path.resolve(__dirname, '..', 'assets', 'DetailPage-WPhzSGyt.js')
];

for (const file of files) {
  const bak2 = file + '.bak2';
  if (!fs.existsSync(bak2)) continue;
  let code = fs.readFileSync(bak2, 'utf8');

  // 1. Back button
  const oldBack = 'e.jsx("div",{className:"absolute top-20 left-4 lg:left-8 z-30",children:e.jsxs("button",{onClick:()=>window.history.back(),className:"inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-black/70 hover:bg-black/90 backdrop-blur-md text-gray-200 hover:text-white transition-all text-sm font-medium border border-white/15 shadow-xl hover:scale-105 active:scale-95 cursor-pointer","aria-label":"Go back",children:[e.jsx(T,{className:"w-4 h-4"})," Back"]})})';
  const newBack = 'e.jsx("div",{className:"absolute top-20 left-4 lg:left-8 z-30",children:e.jsxs("a",{href:"/",onClick:ev=>{ev.preventDefault();if(window.history.state&&typeof window.history.state.idx==="number"&&window.history.state.idx>0){window.history.back()}else if(document.referrer&&document.referrer.includes(window.location.host)&&window.history.length>1){window.history.back()}else{window.location.href="/"}},className:"inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-black/70 hover:bg-black/90 backdrop-blur-md text-gray-200 hover:text-white transition-all text-sm font-medium border border-white/15 shadow-xl hover:scale-105 active:scale-95 cursor-pointer no-underline","aria-label":"Go back",children:[e.jsx(T,{className:"w-4 h-4"})," Back"]})})';
  if (code.includes(oldBack)) {
    code = code.replace(oldBack, newBack);
    console.log('Patched back button in', path.basename(file));
  }

  // 2. ze call in Ye
  const oldZeCall = 'e.jsx(ze,{id:a.id,imdbId:a.imdbId,type:s,title:a.title,poster:a.poster,backdrop:a.backdrop,links:a.links})';
  const newZeCall = 'e.jsx(ze,{id:a.id,imdbId:a.imdbId,tmdbId:a.tmdbId,type:s,title:a.title,poster:a.poster,backdrop:a.backdrop,links:a.links})';
  if (code.includes(oldZeCall)) {
    code = code.replace(oldZeCall, newZeCall);
    console.log('Passed tmdbId to ze in', path.basename(file));
  }

  // 3. ze signature
  const oldZeSig = 'function ze({id:s,imdbId:i,type:a,title:n,poster:d,backdrop:x,links:Y_links}){';
  const newZeSig = 'function ze({id:s,imdbId:i,tmdbId:tmdb,type:a,title:n,poster:d,backdrop:x,links:Y_links}){const hasCloud=!!(Y_links&&Y_links.length>0),activeG=hasCloud?[{id:"hicine",name:"Fast Cloud",label:"⚡ Fast Cloud"},{id:"vidlink",name:"Server 1",label:"VidLink"},{id:"vidsrcme",name:"Server 2",label:"VidSrc (me)"},{id:"vidsrcxyz",name:"Server 3",label:"VidSrc (xyz)"}]:[{id:"vidlink",name:"Server 1",label:"VidLink"},{id:"vidsrcme",name:"Server 2",label:"VidSrc (me)"},{id:"vidsrcxyz",name:"Server 3",label:"VidSrc (xyz)"}];';
  if (code.includes(oldZeSig)) {
    code = code.replace(oldZeSig, newZeSig);
    console.log('Updated ze signature in', path.basename(file));
  }

  // 4. Default server state in single chained const
  const oldState = 'const[c,f]=l.useState(G[0].id),';
  const newState = 'const[c,f]=l.useState(hasCloud?"hicine":"vidlink"),';
  if (code.includes(oldState)) {
    code = code.replace(oldState, newState);
    console.log('Updated server state default in', path.basename(file));
  }

  // 5. Add useEffect to keep server in sync
  const oldH = 'h=Ie(a);';
  const newH = 'h=Ie(a);l.useEffect(()=>{hasCloud&&f("hicine")},[hasCloud]);';
  if (code.includes(oldH)) {
    code = code.replace(oldH, newH);
    console.log('Added useEffect sync in', path.basename(file));
  }

  // 6. G.map to activeG.map
  const oldGMap = 'G.map(t=>e.jsxs("button",{onClick:()=>f(t.id)';
  const newGMap = 'activeG.map(t=>e.jsxs("button",{onClick:()=>f(t.id)';
  if (code.includes(oldGMap)) {
    code = code.replace(oldGMap, newGMap);
    console.log('Updated G.map to activeG.map in', path.basename(file));
  }

  // 7. V() function
  const oldV = 'const t=i||s,m=!!i;if(c==="hicine"){const cl=(Y_links||[]).find(l=>l.isCloud)||(Y_links||[])[0];if(cl)return cl.url;}switch(c){case"vidlink":return H(h,s,o,r);case"vidsrcme":return h?m?`https://vidsrc.me/embed/tv?imdb=${t}&season=${o}&episode=${r}`:`https://vidsrc.me/embed/tv?tmdb=${t}&season=${o}&episode=${r}`:m?`https://vidsrc.me/embed/movie?imdb=${t}`:`https://vidsrc.me/embed/movie?tmdb=${t}`;case"vidsrcxyz":return h?m?`https://vidsrc.xyz/embed/tv?imdb=${t}&season=${o}&episode=${r}`:`https://vidsrc.xyz/embed/tv?tmdb=${t}&season=${o}&episode=${r}`:m?`https://vidsrc.xyz/embed/movie?imdb=${t}`:`https://vidsrc.xyz/embed/movie?tmdb=${t}`;default:return H(h,s,o,r)}';
  const newV = 'const t=tmdb||i||s,m=!tmdb&&!!i;if(c==="hicine"){const cl=(Y_links||[]).find(l=>/1080/i.test(l.quality))||(Y_links||[]).find(l=>/720|HD/i.test(l.quality))||(Y_links||[]).find(l=>l.isCloud)||(Y_links||[])[0];if(cl)return cl.url;}switch(c){case"vidlink":return H(h,tmdb||s,o,r);case"vidsrcme":return h?m?`https://vidsrc.me/embed/tv?imdb=${t}&season=${o}&episode=${r}`:`https://vidsrc.me/embed/tv?tmdb=${t}&season=${o}&episode=${r}`:m?`https://vidsrc.me/embed/movie?imdb=${t}`:`https://vidsrc.me/embed/movie?tmdb=${t}`;case"vidsrcxyz":return h?m?`https://vidsrc.xyz/embed/tv?imdb=${t}&season=${o}&episode=${r}`:`https://vidsrc.xyz/embed/tv?tmdb=${t}&season=${o}&episode=${r}`:m?`https://vidsrc.me/embed/movie?imdb=${t}`:`https://vidsrc.me/embed/movie?tmdb=${t}`;default:return H(h,tmdb||s,o,r)}';
  if (code.includes(oldV)) {
    code = code.replace(oldV, newV);
    console.log('Updated V() in', path.basename(file));
  } else {
    console.warn('Could not find oldV in', path.basename(file));
  }

  fs.writeFileSync(file, code, 'utf8');
}
console.log('DetailPage accurate patching complete.');
