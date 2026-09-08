const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '..', 'js', 'DetailPage-WPhzSGyt.js'),
  path.join(__dirname, '..', 'assets', 'DetailPage-WPhzSGyt.js')
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');

  // 1. Broaden hic filter to include isCloud and download/hicine
  const oldFilter = 'const hic=effectiveLinks.filter(l=>l&&l.url&&(l.source==="hicine"||l.url.includes("vcloud")||l.url.includes("workers.dev")));';
  const newFilter = 'const hic=effectiveLinks.filter(l=>l&&l.url&&(l.source==="hicine"||l.isCloud||l.url.includes("vcloud")||l.url.includes("workers.dev")||l.url.includes("download/hicine")));';

  if (code.includes(oldFilter)) {
    code = code.replace(oldFilter, newFilter);
    console.log(`✅ Patched hic link filter in ${path.basename(file)}`);
  }

  // 2. Add scrollable max-height to grid containers
  const oldGrid = 'e.jsx("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-2.5",children:hic.map';
  const newGrid = 'e.jsx("div",{className:"grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin",children:hic.map';

  if (code.includes(oldGrid)) {
    code = code.replace(oldGrid, newGrid);
    console.log(`✅ Patched scrollable grid container in ${path.basename(file)}`);
  }

  // 3. Enhance Download button label to show link count
  const oldBtnLabel = 'showDl?" Hide Downloads":" Download"';
  const newBtnLabel = 'showDl?" Hide Downloads":((Array.isArray(s.links)&&s.links.length>0)?` ⚡ Download (${s.links.length})`:" ⚡ Download Links")';

  if (code.includes(oldBtnLabel)) {
    code = code.replace(oldBtnLabel, newBtnLabel);
    console.log(`✅ Patched download button badge in ${path.basename(file)}`);
  }

  // 4. Auto-open downloads when hash contains download
  const oldUseEffect = 'c=x(s.id),o=()=>{c?d(s.id):n(s)};l.useEffect(()=>{setPUrl(s.poster);setBUrl(s.backdrop);';
  const newUseEffect = 'c=x(s.id),o=()=>{c?d(s.id):n(s)};l.useEffect(()=>{if(typeof window!=="undefined"&&(window.location.hash.includes("download")||window.location.search.includes("download"))){setShowDl(!0);setTimeout(()=>{document.getElementById("download-links")?.scrollIntoView({behavior:"smooth",block:"start"})},250);}},[s.id]);l.useEffect(()=>{setPUrl(s.poster);setBUrl(s.backdrop);';

  if (code.includes(oldUseEffect)) {
    code = code.replace(oldUseEffect, newUseEffect);
    console.log(`✅ Patched auto-open download hash trigger in ${path.basename(file)}`);
  }

  fs.writeFileSync(file, code);
}

console.log('🎉 DetailPage download links successfully patched in both js/ and assets/!');
