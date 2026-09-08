const fs = require('fs');

const files = ['js/DetailPage-WPhzSGyt.js', 'assets/DetailPage-WPhzSGyt.js'];

for (const filePath of files) {
  let content = fs.readFileSync(filePath, 'utf8');

  const target = 'hic.map((lnk,idx)=>e.jsxs("a",{key:idx,href:(lnk.url.startsWith("/api/download")||(!lnk.url.includes("vcloud")&&!lnk.url.includes("workers.dev")))?lnk.url:("/api/download/hicine?vcloud="+encodeURIComponent(lnk.url)),target:"_blank",rel:"noopener noreferrer",className:"flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.06] hover:bg-blue-600 border border-white/10 hover:border-transparent text-white transition-all hover:scale-[1.02] active:scale-98 group/btn shadow-md",';

  const replacement = 'hic.map((lnk,idx)=>e.jsxs("a",{key:idx,onClick:ev=>window.handleFastCloudDownload?window.handleFastCloudDownload(ev,lnk.url):null,href:window.getFastCloudDownloadHref?window.getFastCloudDownloadHref(lnk.url):((lnk.url.startsWith("/api/download")||(!lnk.url.includes("vcloud")&&!lnk.url.includes("workers.dev")))?lnk.url:("https://wild-sun-9376.oriue.workers.dev/?vcloud="+encodeURIComponent(lnk.url))),target:"_blank",rel:"noopener noreferrer",className:"flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.06] hover:bg-blue-600 border border-white/10 hover:border-transparent text-white transition-all hover:scale-[1.02] active:scale-98 group/btn shadow-md",';

  if (!content.includes(target)) {
    console.error('Target substring not found in:', filePath);
    process.exit(1);
  }

  content = content.replace(target, replacement);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully patched download handling in:', filePath);
}
