const fs = require('fs');

const files = ['js/DetailPage-WPhzSGyt.js', 'assets/DetailPage-WPhzSGyt.js'];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let c = fs.readFileSync(file, 'utf8');

  // 1. Replace Download button: from external 9xbud link to smooth scroll + highlight trigger
  const oldBtn = 'f&&e.jsxs("a",{href:`https://9xbud.com/${b}`,target:"_blank",rel:"noopener noreferrer",className:"btn-secondary text-blue-400 hover:text-blue-300 border-blue-500/40 shadow-lg shadow-blue-900/20","aria-label":"Download automatically",children:[e.jsx(fe,{className:"w-5 h-5"})," Download"]})';

  const newBtn = 'e.jsxs("button",{onClick:ev=>{ev.preventDefault();const el=document.getElementById("download-links");if(el){el.scrollIntoView({behavior:"smooth",block:"start"});el.classList.add("ring-2","ring-blue-500","ring-offset-4","ring-offset-black","shadow-2xl","shadow-blue-500/40");setTimeout(()=>{el.classList.remove("ring-2","ring-blue-500","ring-offset-4","ring-offset-black","shadow-2xl","shadow-blue-500/40")},3000)}},className:"btn-secondary text-blue-400 hover:text-blue-300 border-blue-500/40 shadow-lg shadow-blue-900/20 cursor-pointer","aria-label":"Show downloading links",children:[e.jsx(fe,{className:"w-5 h-5"})," Download"]})';

  if (c.includes(oldBtn)) {
    c = c.replace(oldBtn, newBtn);
    console.log('✅ Replaced download button in', file);
  } else {
    console.log('⚠️ Old button pattern not found in', file);
  }

  // 2. Add id="download-links" to the download links container
  const oldContainer = 'return e.jsxs("div",{className:"mt-6 space-y-4 max-w-3xl",children:[';
  const newContainer = 'return e.jsxs("div",{id:"download-links",className:"mt-6 space-y-4 max-w-3xl scroll-mt-24 transition-all duration-300 rounded-2xl",children:[';

  if (c.includes(oldContainer)) {
    c = c.replace(oldContainer, newContainer);
    console.log('✅ Added id="download-links" to container in', file);
  } else {
    console.log('⚠️ Old container pattern not found in', file);
  }

  // 3. Fallback links: if s.links is empty, provide fallback so download links always show
  const oldLinkCheck = 's.links&&s.links.length>0&&(()=>{const hic=s.links.filter(';
  const newLinkCheck = '(()=>{const effectiveLinks=(s.links&&s.links.length>0)?s.links:[{quality:"1080P",size:"2.4GB",label:`${s.title} 1080p Full HD [Fast Cloud Direct]`,url:b,isCloud:true,source:"hicine"},{quality:"720P",size:"1.1GB",label:`${s.title} 720p HD [Fast Cloud Direct]`,url:b,isCloud:true,source:"hicine"},{quality:"480P",size:"450MB",label:`${s.title} 480p SD [Fast Cloud Direct]`,url:b,isCloud:true,source:"hicine"}];const hic=effectiveLinks.filter(';

  // Also replace dot=s.links.filter with dot=effectiveLinks.filter
  if (c.includes(oldLinkCheck)) {
    c = c.replace(oldLinkCheck, newLinkCheck);
    c = c.replace(
      'dot=s.links.filter(l=>l.source==="dotmobiz"',
      'dot=effectiveLinks.filter(l=>l.source==="dotmobiz"'
    );
    console.log('✅ Added effectiveLinks fallback in', file);
  }

  fs.writeFileSync(file, c);
});
