const fs = require('fs');

['js/DetailPage-WPhzSGyt.js', 'assets/DetailPage-WPhzSGyt.js'].forEach(fp => {
  let s = fs.readFileSync(fp, 'utf8');
  
  // Replace the previous broken block or old code with clean expression
  const brokenTarget = 'hic.map((lnk,idx)=>{const dUrl=(lnk.url.startsWith("/api/download")||(!lnk.url.includes("vcloud")&&!lnk.url.includes("workers.dev")))?lnk.url:("/api/download/hicine?vcloud="+encodeURIComponent(lnk.url));return e.jsxs("a",{key:idx,href:dUrl,';
  const cleanReplacement = 'hic.map((lnk,idx)=>e.jsxs("a",{key:idx,href:(lnk.url.startsWith("/api/download")||(!lnk.url.includes("vcloud")&&!lnk.url.includes("workers.dev")))?lnk.url:("/api/download/hicine?vcloud="+encodeURIComponent(lnk.url)),';

  if (s.includes(brokenTarget)) {
    s = s.split(brokenTarget).join(cleanReplacement);
    fs.writeFileSync(fp, s, 'utf8');
    console.log('✅ Clean expression restored in', fp);
  } else {
    console.warn('⚠️ brokenTarget not found in', fp);
  }
});
