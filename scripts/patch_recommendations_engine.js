const fs = require('fs');
const path = require('path');

const files = [
  path.resolve(__dirname, '../js/index-CQL8lqua.js'),
  path.resolve(__dirname, '../assets/index-CQL8lqua.js')
];

const targetStr = 'Qg=async(s,v)=>{if(!/^\\d+$/.test(String(s)))return K0(s);let r=null;try{r=await Ht(`/${v==="series"||v==="anime"||v==="kdrama"?"tv":"movie"}/${s}/recommendations`)}catch(e){}return r?r?.results?r.results.slice(0,12).map(E=>Pt(E,v)):[]:K0(s)}';

const replacement = `Qg=async(s,v)=>{try{const cached=HICINE_DATA.cache.get(s);const targetId=(cached&&cached.tmdbId)?cached.tmdbId:(/^\\d+$/.test(String(s))&&String(s).length<=7?s:null);if(targetId){let r=null;try{r=await Ht(\`/\${v==="series"||v==="anime"||v==="kdrama"?"tv":"movie"}/\${targetId}/recommendations\`)}catch(e){}if(r&&r.results&&r.results.length>0){return r.results.slice(0,12).map(E=>Pt(E,v))}}const summary=await getSummaryCatalog();if(summary&&summary.length>0){const current=cached||summary.find(x=>String(x.id)===String(s));if(current){const related=summary.filter(x=>String(x.id)!==String(s)&&(x.type===current.type||(Array.isArray(x.categories)&&Array.isArray(current.categories)&&x.categories.some(c=>current.categories.includes(c)))));if(related.length>0)return related.slice(0,12).map(t=>mapHicineItem(t,v))}return summary.slice(0,12).map(t=>mapHicineItem(t,v))}}catch(e){}return K0(s)}`;

for (const fp of files) {
  if (!fs.existsSync(fp)) continue;
  let code = fs.readFileSync(fp, 'utf8');
  if (code.includes(targetStr)) {
    code = code.replace(targetStr, replacement);
    fs.writeFileSync(fp, code, 'utf8');
    console.log(`✅ Patched recommendations in ${path.basename(fp)}!`);
  } else {
    console.warn(`⚠️ Target string not found in ${path.basename(fp)}`);
  }
}
