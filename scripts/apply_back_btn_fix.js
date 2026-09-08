const fs = require('fs');
const path = require('path');

const files = [
  path.resolve(__dirname, '..', 'js', 'DetailPage-WPhzSGyt.js'),
  path.resolve(__dirname, '..', 'assets', 'DetailPage-WPhzSGyt.js')
];

for (const file of files) {
  let code = fs.readFileSync(file, 'utf8');

  // Find the back button section
  // It starts around e.jsx("div",{className:"absolute top-20 left-4 lg:left-8 z-30" or z-50
  const oldBackRegex = /e\.jsx\("div",\{className:"absolute top-20 left-4 lg:left-8[^"]*",children:e\.jsxs\((?:"a"|"button"),\{[^}]*aria-label":"Go back",children:\[e\.jsx\(T,\{className:"w-4 h-4"\}\)," Back"\]\}\)\}\)/;

  const newBack = 'e.jsx("div",{className:"absolute top-20 left-4 lg:left-8 z-50",style:{zIndex:100},children:e.jsxs(ae,{to:"/",onClick:ev=>{if(window.history.state&&typeof window.history.state.idx==="number"&&window.history.state.idx>0){ev.preventDefault();window.history.back()}},style:{zIndex:100,pointerEvents:"auto"},className:"inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-black/70 hover:bg-black/90 backdrop-blur-md text-gray-200 hover:text-white transition-all text-sm font-medium border border-white/15 shadow-xl hover:scale-105 active:scale-95 cursor-pointer no-underline","aria-label":"Go back",children:[e.jsx(T,{className:"w-4 h-4"})," Back"]})})';

  if (oldBackRegex.test(code)) {
    code = code.replace(oldBackRegex, newBack);
    fs.writeFileSync(file, code, 'utf8');
    console.log('Successfully replaced Back button with z-index:100 Link in', path.basename(file));
  } else {
    console.error('Could not match oldBackRegex in', path.basename(file));
  }
}
