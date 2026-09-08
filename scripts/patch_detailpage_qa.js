const fs = require('fs');

const files = ['assets/DetailPage-WPhzSGyt.js', 'js/DetailPage-WPhzSGyt.js'];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');

  // 1. Fix download scroll timer cleanup
  code = code.replace(
    /l\.useEffect\(\(\)=>\{if\(typeof window!==\"undefined\"&&\(window\.location\.hash\.includes\(\"download\"\)\|\|window\.location\.search\.includes\(\"download\"\)\)\)\{setShowDl\(!0\);setTimeout\(\(\)=>\{document\.getElementById\(\"download-links\"\)\?\.scrollIntoView\(\{behavior:\"smooth\",block:\"start\"\}\)\},250\);\}\},\[s\.id\]\);/g,
    'l.useEffect(()=>{let t=null;if(typeof window!=="undefined"&&(window.location.hash.includes("download")||window.location.search.includes("download"))){setShowDl(!0);t=setTimeout(()=>{document.getElementById("download-links")?.scrollIntoView({behavior:"smooth",block:"start"})},250);}return()=>{t&&clearTimeout(t);};},[s.id]);'
  );

  // 2. Fix unmounted poster resolution in Pe
  code = code.replace(
    /l\.useEffect\(\(\)=>\{setPUrl\(s\.poster\);setBUrl\(s\.backdrop\);if\(!s\.poster\|\|s\.poster\.includes\(\"no-poster\"\)\|\|s\.poster\.includes\(\"placehold\"\)\|\|!s\.backdrop\|\|s\.backdrop\.includes\(\"no-poster\"\)\)\{window\.resolveRealPoster&&window\.resolveRealPoster\(s\.title,s\.imdbId,s\.type,\(p,b\)=>\{p&&setPUrl\(p\);b&&setBUrl\(b\);\}\);\}\},\[s\.id,s\.poster,s\.backdrop,s\.title,s\.imdbId,s\.type\]\);/g,
    'l.useEffect(()=>{let a=true;setPUrl(s.poster);setBUrl(s.backdrop);if(!s.poster||s.poster.includes("no-poster")||s.poster.includes("placehold")||!s.backdrop||s.backdrop.includes("no-poster")){window.resolveRealPoster&&window.resolveRealPoster(s.title,s.imdbId,s.type,(p,b)=>{if(!a)return;p&&setPUrl(p);b&&setBUrl(b);});}return()=>{a=false;};},[s.id,s.poster,s.backdrop,s.title,s.imdbId,s.type]);'
  );

  // 3. Fix DetailPage main poster onError infinite recursion bug
  code = code.replace(
    /onError:\(\)=>\{if\(window\.resolveRealPoster\)\{window\.resolveRealPoster\(s\.title,s\.imdbId,s\.type,p=>\{if\(p\)setPUrl\(p\);else a\(!0\);\}\);\}else a\(!0\);\}/g,
    'onError:ev=>{ev.currentTarget.onerror=null;const tm=window.FLIX_TERMINAL_POSTER||"/images/no-poster.svg";if(window.resolveRealPoster){window.resolveRealPoster(s.title,s.imdbId,s.type,p=>{if(p){setPUrl(p);ev.currentTarget.src=p;}else{a(!0);ev.currentTarget.src=tm;}});}else{a(!0);ev.currentTarget.src=tm;}}'
  );

  // 4. Replace hardcoded /images/no-poster.svg with terminal fallback
  code = code.replace(
    /\"\/images\/no-poster\.svg\"/g,
    '(window.FLIX_TERMINAL_POSTER||"/images/no-poster.svg")'
  );

  fs.writeFileSync(file, code, 'utf8');
  console.log('Successfully patched DetailPage:', file);
});
