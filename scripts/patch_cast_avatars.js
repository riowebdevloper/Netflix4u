const fs = require('fs');
const path = require('path');

const files = [
  path.resolve(__dirname, '../js/DetailPage-WPhzSGyt.js'),
  path.resolve(__dirname, '../assets/DetailPage-WPhzSGyt.js')
];

const avatarFuncDef = `const _getCastSvg=n=>{const ini=(n||'Actor').trim().split(/\\s+/).map(x=>x[0]).filter(Boolean).slice(0,2).join('').toUpperCase()||'A';return'data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\" width=\"100\" height=\"100\"><defs><linearGradient id=\"g\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\"><stop offset=\"0%\" stop-color=\"#1e293b\"/><stop offset=\"100%\" stop-color=\"#0f172a\"/></linearGradient></defs><rect width=\"100\" height=\"100\" fill=\"url(#g)\"/><circle cx=\"50\" cy=\"50\" r=\"46\" stroke=\"rgba(255,255,255,0.1)\" stroke-width=\"2\" fill=\"none\"/><text x=\"50\" y=\"58\" font-family=\"system-ui,-apple-system,sans-serif\" font-size=\"34\" font-weight=\"700\" fill=\"#cbd5e1\" text-anchor=\"middle\">'+ini+'</text></svg>')};`;

for (const fp of files) {
  if (!fs.existsSync(fp)) {
    console.log('Skipping missing file:', fp);
    continue;
  }
  let code = fs.readFileSync(fp, 'utf8');

  // Insert _getCastSvg helper before function De
  if (!code.includes('_getCastSvg')) {
    code = code.replace(/function De\(\{cast:s\}\)/, `${avatarFuncDef}function De({cast:s})`);
  }

  // Replace i.photo fallback and onError
  code = code.replace(
    /src:i\.photo,alt:i\.name,className:\"w-full h-full object-cover\",loading:\"lazy\",onError:n=>\{n\.currentTarget\.src=`https:\/\/ui-avatars\.com\/api\/\?name=\$\{encodeURIComponent\(i\.name\)\}&background=random`\}/g,
    'src:i.photo||_getCastSvg(i.name),alt:i.name,className:"w-full h-full object-cover",loading:"lazy",onError:n=>{n.currentTarget.onerror=null;n.currentTarget.src=_getCastSvg(i.name);}'
  );

  fs.writeFileSync(fp, code, 'utf8');
  console.log('✅ Patched cast avatars in:', path.basename(fp));
}
