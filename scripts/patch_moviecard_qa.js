const fs = require('fs');

const files = ['assets/MovieCard-DyC9jox1.js', 'js/MovieCard-DyC9jox1.js'];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');

  // 1. Fix body overflow reset from 'auto' to ''
  code = code.replace(/document\.body\.style\.overflow="auto"/g, 'document.body.style.overflow=""');

  // 2. Fix unmounted async leak in QuickView modal
  code = code.replace(
    /d\.useEffect\(\(\)=>\{if\(!s\)return;setMPoster\(s\.poster\);setMBackdrop\(s\.backdrop\);if\(!s\.poster\|\|s\.poster\.includes\("no-poster"\)\|\|s\.poster\.includes\("placehold"\)\)\{window\.resolveRealPoster&&window\.resolveRealPoster\(s\.title,s\.imdbId,s\.type,\(p,b\)=>\{p&&setMPoster\(p\);b&&setMBackdrop\(b\);\}\);\}\},\[s\?\.id,s\?\.poster,s\?\.backdrop,s\?\.title,s\?\.imdbId,s\?\.type\]\);/g,
    'd.useEffect(()=>{let a=true;if(!s)return;setMPoster(s.poster);setMBackdrop(s.backdrop);if(!s.poster||s.poster.includes("no-poster")||s.poster.includes("placehold")){window.resolveRealPoster&&window.resolveRealPoster(s.title,s.imdbId,s.type,(p,b)=>{if(!a)return;p&&setMPoster(p);b&&setMBackdrop(b);});}return()=>{a=false;};},[s?.id,s?.poster,s?.backdrop,s?.title,s?.imdbId,s?.type]);'
  );

  // 3. Fix unmounted async leak in MovieCard
  code = code.replace(
    /d\.useEffect\(\(\)=>\{setCPoster\(s\.poster\);if\(!s\.poster\|\|s\.poster\.includes\("no-poster"\)\|\|s\.poster\.includes\("placehold"\)\)\{window\.resolveRealPoster&&window\.resolveRealPoster\(s\.title,s\.imdbId,s\.type,p=>\{p&&setCPoster\(p\);\}\);\}\},\[s\.id,s\.poster,s\.title,s\.imdbId,s\.type\]\);/g,
    'd.useEffect(()=>{let a=true;setCPoster(s.poster);if(!s.poster||s.poster.includes("no-poster")||s.poster.includes("placehold")){window.resolveRealPoster&&window.resolveRealPoster(s.title,s.imdbId,s.type,p=>{if(a&&p)setCPoster(p);});}return()=>{a=false;};},[s.id,s.poster,s.title,s.imdbId,s.type]);'
  );

  // 4. Replace hardcoded /images/no-poster.svg in onError with terminal inline fallback to prevent loops
  code = code.replace(
    /"\/images\/no-poster\.svg"/g,
    '(window.FLIX_TERMINAL_POSTER||"/images/no-poster.svg")'
  );

  fs.writeFileSync(file, code, 'utf8');
  console.log('Successfully patched MovieCard:', file);
});
