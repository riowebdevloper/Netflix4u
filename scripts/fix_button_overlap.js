const fs = require('fs');
const path = require('path');

// 1. Update DetailPage-WPhzSGyt.js in js/ and assets/
const detailPageFiles = [
  path.join(__dirname, '..', 'js', 'DetailPage-WPhzSGyt.js'),
  path.join(__dirname, '..', 'assets', 'DetailPage-WPhzSGyt.js')
];

const oldBackBtn = 'e.jsx("div",{className:"absolute top-20 left-4 lg:left-8 z-10",children:e.jsxs("button",{onClick:()=>window.history.back(),className:"flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors text-sm","aria-label":"Go back",children:[e.jsx(T,{className:"w-4 h-4"})," Back"]})})';

const newBackBtn = 'e.jsx("div",{className:"absolute top-20 left-4 lg:left-8 z-30",children:e.jsxs("button",{onClick:()=>window.history.back(),className:"inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-black/70 hover:bg-black/90 backdrop-blur-md text-gray-200 hover:text-white transition-all text-sm font-medium border border-white/15 shadow-xl hover:scale-105 active:scale-95 cursor-pointer","aria-label":"Go back",children:[e.jsx(T,{className:"w-4 h-4"})," Back"]})})';

for (const f of detailPageFiles) {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    if (content.includes(oldBackBtn)) {
      content = content.replace(oldBackBtn, newBackBtn);
      fs.writeFileSync(f, content, 'utf8');
      console.log('✅ Updated DetailPage Back button in:', f);
    } else {
      console.log('⚠️ Old Back button pattern not found in:', f);
    }
  }
}

// 2. Update index-CQL8lqua.js in js/ and assets/ to hide category pills on detail pages
const indexFiles = [
  path.join(__dirname, '..', 'js', 'index-CQL8lqua.js'),
  path.join(__dirname, '..', 'assets', 'index-CQL8lqua.js')
];

const oldCategoryBar = 'o.jsx("div",{ref:Ut,className:"flex items-center gap-2 overflow-x-auto scrollbar-hide px-4 lg:px-8 pb-3 max-w-[1600px] mx-auto",children:eg.map(';

const newCategoryBar = '(s.pathname.startsWith("/movie/")||s.pathname.startsWith("/series/")||s.pathname.startsWith("/anime/")||s.pathname.startsWith("/kdrama/"))?null:o.jsx("div",{ref:Ut,className:"flex items-center gap-2 overflow-x-auto scrollbar-hide px-4 lg:px-8 pb-3 max-w-[1600px] mx-auto",children:eg.map(';

for (const f of indexFiles) {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    if (content.includes(oldCategoryBar)) {
      content = content.replace(oldCategoryBar, newCategoryBar);
      fs.writeFileSync(f, content, 'utf8');
      console.log('✅ Updated index navbar to hide category bar on detail pages in:', f);
    } else {
      console.log('⚠️ Category bar pattern not found in:', f);
    }
  }
}
