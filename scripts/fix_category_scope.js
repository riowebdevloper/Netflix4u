const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.resolve(__dirname, '../js/CategoryPage-BfDZg_n3.js'),
  path.resolve(__dirname, '../assets/CategoryPage-BfDZg_n3.js')
];

for (const file of targetFiles) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');

  // Find function O({type:i}){ ... }
  const fnStart = code.indexOf('function O({type:i}){');
  const fnEnd = code.indexOf('export{O as default};');

  if (fnStart !== -1 && fnEnd !== -1) {
    const fixedFunction = `function O({type:i}){const l=I[i],[d,m]=s.useState([]),[f,x]=s.useState(!0),[r,g]=s.useState(!1),[j,u]=s.useState(1),[v,N]=s.useState(!0),[o,w]=s.useState(()=>{const p=new URLSearchParams(typeof window!=="undefined"?window.location.search:"");return{genre:p.get("genre")||"All",year:"All",rating:"All",language:p.get("language")||"All",quality:"All",sortBy:"relevance"}}),h=s.useCallback(async(t,a=!1)=>{a?(x(!0),m([])):g(!0);const n=await K[i](t);m(b=>a?n:[...b,...n]),N(n.length>=20),u(t),a?x(!1):g(!1)},[i]);s.useEffect(()=>{const p=new URLSearchParams(window.location.search);const lang=p.get("language")||"All",gnr=p.get("genre")||"All";w(prev=>({...prev,language:lang,genre:gnr}))},[window.location.search]);s.useEffect(()=>{h(1,!0)},[i]);const c=s.useMemo(()=>D(d,o),[d,o]);return e.jsxs("div",{className:"min-h-screen pt-28 pb-16",children:[e.jsxs(y,{children:[e.jsxs("title",{children:[l.title," | FlixWorld.fun"]}),e.jsx("meta",{name:"description",content:l.description})]}),e.jsxs("div",{className:"max-w-[1600px] mx-auto px-4 lg:px-8 mb-8",children:[e.jsxs("div",{className:"flex items-center gap-3 mb-2",children:[l.icon,e.jsx("h1",{className:"text-3xl font-black text-white",children:l.title})]}),e.jsx("p",{className:"text-gray-500",children:l.description})]}),e.jsx("div",{className:"max-w-[1600px] mx-auto px-4 lg:px-8 mb-8",children:e.jsx(H,{filters:o,onChange:w})}),f?e.jsx("div",{className:"max-w-[1600px] mx-auto px-4 lg:px-8",children:e.jsx("div",{className:"grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 sm:gap-5",children:Array.from({length:21}).map((t,a)=>e.jsx("div",{className:"skeleton aspect-[2/3] rounded-xl"},a))})}):e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"max-w-[1600px] mx-auto px-4 lg:px-8 mb-5",children:e.jsxs("p",{className:"text-gray-500 text-sm",children:["Showing ",e.jsx("span",{className:"text-white font-semibold",children:c.length})," titles"]})}),e.jsx("div",{className:"max-w-[1600px] mx-auto px-4 lg:px-8",children:c.length>0?e.jsxs(e.Fragment,{children:[e.jsx("div",{className:"grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 sm:gap-5",children:c.map((t,a)=>e.jsx(P,{content:t,index:a},t.id))}),v&&e.jsx("div",{className:"flex justify-center mt-12",children:e.jsxs("button",{onClick:()=>h(j+1),disabled:r,className:"flex items-center gap-2.5 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold px-10 py-3.5 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-red-900/30",children:[r?e.jsx(M,{className:"w-5 h-5 animate-spin"}):e.jsx(S,{className:"w-5 h-5"}),r?"Loading…":"Load More"]})})]}):e.jsxs("div",{className:"flex flex-col items-center justify-center py-24 text-center",children:[e.jsx(p,{className:"w-16 h-16 text-gray-700 mb-4"}),e.jsx("h3",{className:"text-xl font-bold text-gray-400 mb-2",children:"No titles found"}),e.jsx("p",{className:"text-gray-600",children:"Try adjusting your filters"})]})})]})]})} `;
    code = code.substring(0, fnStart) + fixedFunction + code.substring(fnEnd);
    fs.writeFileSync(file, code, 'utf8');
    console.log('✅ Fixed const scope of h in CategoryPage for:', path.basename(file));
  }
}
