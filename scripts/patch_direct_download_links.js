const fs = require('fs');

['js/DetailPage-WPhzSGyt.js', 'assets/DetailPage-WPhzSGyt.js'].forEach(fp => {
  let s = fs.readFileSync(fp, 'utf8');
  const target = 'hic.map((lnk,idx)=>e.jsxs("a",{key:idx,href:lnk.url';
  const replacement = 'hic.map((lnk,idx)=>{const dUrl=(lnk.url.startsWith("/api/download")||(!lnk.url.includes("vcloud")&&!lnk.url.includes("workers.dev")))?lnk.url:("/api/download/hicine?vcloud="+encodeURIComponent(lnk.url));return e.jsxs("a",{key:idx,href:dUrl';

  if (s.includes(target)) {
    s = s.split(target).join(replacement);
    fs.writeFileSync(fp, s, 'utf8');
    console.log('✅ Patched direct download router in', fp);
  } else {
    console.warn('⚠️ Target not found in', fp);
  }
});
