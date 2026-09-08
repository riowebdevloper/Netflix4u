const fs = require('fs');
const path = require('path');

function patchDetail(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  
  // 1. Replace De
  const oldDe = 'function De({cast:s}){return e.jsxs("section",{children:[e.jsxs("div",{className:"flex items-center gap-2 mb-5",children:[e.jsx(be,{className:"w-5 h-5 text-[var(--color-accent)]"}),e.jsx("h2",{className:"text-white text-xl font-bold",children:"Cast"})]}),e.jsx("div",{className:"grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4",children:s.map((i,a)=>e.jsxs(C.div,{initial:{opacity:0,y:20},whileInView:{opacity:1,y:0},viewport:{once:!0},transition:{delay:a*.05},className:"bg-[var(--color-card)] rounded-xl p-3 flex flex-col items-center text-center hover:bg-[var(--color-card-hover)] transition-colors group cursor-pointer",children:[e.jsx("div",{className:"relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden mb-3 ring-2 ring-white/10 group-hover:ring-[var(--color-accent)]/50 transition-all",children:e.jsx("img",{src:i.photo||_getCastSvg(i.name),alt:i.name,className:"w-full h-full object-cover",loading:"lazy",onError:n=>{n.currentTarget.onerror=null;n.currentTarget.src=_getCastSvg(i.name);}})}),e.jsx("p",{className:"text-white text-sm font-medium line-clamp-1",children:i.name}),e.jsx("p",{className:"text-gray-500 text-xs mt-0.5 line-clamp-1",children:i.character})]},i.id))})]})}';

  const newDe = 'function De({cast:s}){if(!Array.isArray(s)||s.length===0)return null;return e.jsxs("section",{children:[e.jsxs("div",{className:"flex items-center gap-2 mb-5",children:[e.jsx(be,{className:"w-5 h-5 text-[var(--color-accent)]"}),e.jsx("h2",{className:"text-white text-xl font-bold",children:"Cast"})]}),e.jsx("div",{className:"grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4",children:s.map((i,a)=>{const cName=typeof i==="string"?i:(i?.name||"Actor");const cChar=typeof i==="object"?(i?.character||""):"";const cPhoto=typeof i==="object"?(i?.photo||i?.image||i?.profile_path||null):null;const cKey=(typeof i==="object"&&i?.id)?i.id:String(a);return e.jsxs(C.div,{initial:{opacity:0,y:20},whileInView:{opacity:1,y:0},viewport:{once:!0},transition:{delay:a*.05},className:"bg-[var(--color-card)] rounded-xl p-3 flex flex-col items-center text-center hover:bg-[var(--color-card-hover)] transition-colors group cursor-pointer",children:[e.jsx("div",{className:"relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden mb-3 ring-2 ring-white/10 group-hover:ring-[var(--color-accent)]/50 transition-all",children:e.jsx("img",{src:cPhoto||_getCastSvg(cName),alt:cName,className:"w-full h-full object-cover",loading:"lazy",onError:n=>{n.currentTarget.onerror=null;n.currentTarget.src=_getCastSvg(cName);}})}),e.jsx("p",{className:"text-white text-sm font-medium line-clamp-1",children:cName}),cChar?e.jsx("p",{className:"text-gray-500 text-xs mt-0.5 line-clamp-1",children:cChar}):null]},cKey);})})]})}';

  if (!code.includes(oldDe)) {
    console.error('oldDe not found in', filePath);
    return false;
  }
  code = code.replace(oldDe, newDe);

  // 2. Add cast photo background fetcher inside Ye()
  const oldYeStart = 'function Ye(){const{type:s,id:i}=re(),[a,n]=l.useState(null),[d,x]=l.useState([]),[c,f]=l.useState(!0),o=le(),b=`${We}${o.pathname}`;';
  const newYeStart = 'function Ye(){const{type:s,id:i}=re(),[a,n]=l.useState(null),[d,x]=l.useState([]),[c,f]=l.useState(!0),o=le(),b=`${We}${o.pathname}`;l.useEffect(()=>{if(!a||!a.title)return;const hasPhotos=Array.isArray(a.cast)&&a.cast.some(m=>m&&typeof m==="object"&&m.photo);if(!hasPhotos){const ep=(s==="series"||s==="anime"||s==="kdrama")?"series":"movie";fetch(`/api/cast?title=${encodeURIComponent(a.title)}&tmdbId=${a.tmdbId||""}&type=${ep}&imdbId=${a.imdbId||""}&year=${a.year||""}`).then(r=>r.ok?r.json():null).then(res=>{if(res&&res.cast&&res.cast.length>0){n(prev=>prev?{...prev,cast:res.cast}:prev);}}).catch(()=>{});}},[a?.id,a?.title,a?.tmdbId,a?.imdbId,s]);';

  if (!code.includes(oldYeStart)) {
    console.error('oldYeStart not found in', filePath);
    return false;
  }
  code = code.replace(oldYeStart, newYeStart);

  fs.writeFileSync(filePath, code, 'utf8');
  console.log('Successfully patched', filePath);
  return true;
}

function patchIndex(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // 1. In mapHicineItem: cast: item.cast || [] -> map plain strings to objects
  const oldMapCast = 'cast: item.cast || [],';
  const newMapCast = 'cast: Array.isArray(item.cast) ? item.cast.map((c, idx) => typeof c === "string" ? { id: "c_" + idx, name: c, character: "", photo: null } : c) : [],';

  if (!code.includes(oldMapCast)) {
    console.error('oldMapCast not found in', filePath);
    return false;
  }
  code = code.replace(oldMapCast, newMapCast);

  // 2. In Kg: after mapped is built, enrich cast if missing photos
  const oldKgAfterTrailer = 'if (!mapped.trailerUrl) {\n        mapped.trailerUrl = await getTrailerForTitle(mapped.title, mapped.year, mapped.type);\n      }\n      HICINE_DATA.cache.set(s, mapped);';
  const newKgAfterTrailer = 'if (!mapped.trailerUrl) {\n        mapped.trailerUrl = await getTrailerForTitle(mapped.title, mapped.year, mapped.type);\n      }\n      if (!mapped.cast || !mapped.cast.some(c => c && c.photo)) {\n        try {\n          const castRes = await fetch("/api/cast?title=" + encodeURIComponent(mapped.title) + "&tmdbId=" + (mapped.tmdbId || "") + "&type=" + (v || mapped.type || "movie") + "&imdbId=" + (mapped.imdbId || "") + "&year=" + (mapped.year || ""));\n          if (castRes.ok) {\n            const cJson = await castRes.json();\n            if (cJson && cJson.cast && cJson.cast.length > 0) {\n              mapped.cast = cJson.cast;\n            }\n          }\n        } catch(e) {}\n      }\n      HICINE_DATA.cache.set(s, mapped);';

  if (!code.includes(oldKgAfterTrailer)) {
    console.error('oldKgAfterTrailer not found in', filePath);
    return false;
  }
  code = code.replace(oldKgAfterTrailer, newKgAfterTrailer);

  fs.writeFileSync(filePath, code, 'utf8');
  console.log('Successfully patched', filePath);
  return true;
}

console.log('=== Patching DetailPage files ===');
patchDetail(path.join(__dirname, '../js/DetailPage-WPhzSGyt.js'));
patchDetail(path.join(__dirname, '../assets/DetailPage-WPhzSGyt.js'));

console.log('=== Patching Index files ===');
patchIndex(path.join(__dirname, '../js/index-CQL8lqua.js'));
patchIndex(path.join(__dirname, '../assets/index-CQL8lqua.js'));
