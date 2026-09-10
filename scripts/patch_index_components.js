const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const filesToPatch = [
  path.join(ROOT, 'js', 'index-CQL8lqua.js'),
  path.join(ROOT, 'assets', 'index-CQL8lqua.js')
];

for (const fPath of filesToPatch) {
  if (!fs.existsSync(fPath)) continue;
  console.log('Patching file:', fPath);
  let content = fs.readFileSync(fPath, 'utf8');

  // 1. Footer Data & Layout
  // Replace const ng = {...} with comprehensive collections
  const oldNgIdx = content.indexOf('const ng={Navigation:');
  if (oldNgIdx !== -1) {
    const endNgIdx = content.indexOf('ug=[{label:"Twitter"', oldNgIdx);
    if (endNgIdx !== -1) {
      const newFooterData = `const FOOTER_BROWSE=[{label:"Home",href:"/"},{label:"Bollywood",href:"/bollywood"},{label:"South Indian",href:"/south-indian"},{label:"Hindi Dubbed",href:"/hindi-dubbed"},{label:"Hollywood",href:"/hollywood"},{label:"Movies",href:"/movies"},{label:"Web Series",href:"/series"},{label:"Anime",href:"/anime"},{label:"K-Drama",href:"/kdrama"}],FOOTER_DISCOVER=[{label:"Trending",href:"/trending"},{label:"Top Rated",href:"/movies?sortBy=rating-desc"},{label:"Genres",href:"/genres"},{label:"Recently Added",href:"/movies?sortBy=year-desc"}],FOOTER_INFO=[{label:"About",href:"/about"},{label:"Contact",href:"/contact"},{label:"Privacy Policy",href:"/privacy"},{label:"Terms of Service",href:"/terms"},{label:"DMCA",href:"/dmca"}];\n`;
      content = content.substring(0, oldNgIdx) + newFooterData + content.substring(endNgIdx);
      console.log('✓ Replaced footer data objects');
    }
  }

  // 2. Replace function ig() with 2-column mobile and responsive desktop footer
  const oldIgIdx = content.indexOf('function ig(){');
  if (oldIgIdx !== -1) {
    const endIgIdx = content.indexOf('const cg=[', oldIgIdx);
    if (endIgIdx !== -1) {
      const newIgCode = `function ig(){return o.jsx("footer",{className:"bg-[var(--color-navy-950)] border-t border-white/5 mt-20 pb-24 lg:pb-0 relative z-10",children:o.jsxs("div",{className:"max-w-[1600px] mx-auto px-4 lg:px-8 py-16",children:[
        // Desktop Multi-column Grid (md and up)
        o.jsxs("div",{className:"hidden md:grid md:grid-cols-2 lg:grid-cols-5 gap-10",children:[
          o.jsxs("div",{className:"lg:col-span-2",children:[
            o.jsx(Le,{to:"/",onClick:()=>{if(window.location.pathname==="/")window.scrollTo({top:0,behavior:"smooth"})},className:"inline-block mb-4 cursor-pointer",children:o.jsx("img",{src:"/images/netflix4u-logo.svg",alt:"Netflix4U",className:"h-10 md:h-12 w-auto object-contain"})}),
            o.jsx("p",{className:"text-gray-400 text-sm leading-relaxed max-w-sm mb-4",children:"Your ultimate entertainment destination. Discover movies, web series, anime, and K-dramas with cast details and trailers."}),
            o.jsx("div",{className:"flex gap-3",children:ug.map(s=>o.jsx("a",{href:s.url||"https://netflix4u.in",target:"_blank",rel:"noopener noreferrer","aria-label":s.label,className:"w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-white hover:bg-[var(--color-accent)]/20 transition-all text-sm",children:s.icon},s.label))})
          ]}),
          o.jsxs("div",{children:[
            o.jsx("h3",{className:"text-white font-semibold mb-4 text-sm uppercase tracking-wider",children:"Browse"}),
            o.jsx("ul",{className:"space-y-2",children:FOOTER_BROWSE.map(item=>o.jsx("li",{children:o.jsx(Le,{to:item.href,className:"text-gray-400 hover:text-white text-sm transition-colors block py-0.5",children:item.label})},item.label))})
          ]}),
          o.jsxs("div",{children:[
            o.jsx("h3",{className:"text-white font-semibold mb-4 text-sm uppercase tracking-wider",children:"Discover"}),
            o.jsx("ul",{className:"space-y-2",children:FOOTER_DISCOVER.map(item=>o.jsx("li",{children:o.jsx(Le,{to:item.href,className:"text-gray-400 hover:text-white text-sm transition-colors block py-0.5",children:item.label})},item.label))})
          ]}),
          o.jsxs("div",{children:[
            o.jsx("h3",{className:"text-white font-semibold mb-4 text-sm uppercase tracking-wider",children:"Info"}),
            o.jsx("ul",{className:"space-y-2",children:FOOTER_INFO.map(item=>o.jsx("li",{children:o.jsx(Le,{to:item.href,className:"text-gray-400 hover:text-white text-sm transition-colors block py-0.5",children:item.label})},item.label))})
          ]})
        ]}),

        // Mobile Two-Column Layout (< md): Left is Browse, Right is Discover then Info directly underneath
        o.jsxs("div",{className:"md:hidden flex flex-col gap-8",children:[
          o.jsxs("div",{children:[
            o.jsx(Le,{to:"/",onClick:()=>{if(window.location.pathname==="/")window.scrollTo({top:0,behavior:"smooth"})},className:"inline-block mb-3 cursor-pointer",children:o.jsx("img",{src:"/images/netflix4u-logo.svg",alt:"Netflix4U",className:"h-8 w-auto object-contain"})}),
            o.jsx("p",{className:"text-gray-400 text-xs leading-relaxed max-w-sm mb-3",children:"Your ultimate entertainment catalog for movies, series, anime, and K-dramas."}),
            o.jsx("div",{className:"flex gap-2.5",children:ug.map(s=>o.jsx("a",{href:s.url||"https://netflix4u.in",target:"_blank",rel:"noopener noreferrer","aria-label":s.label,className:"w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-white hover:bg-[var(--color-accent)]/20 transition-all text-xs",children:s.icon},s.label))})
          ]}),
          o.jsxs("div",{className:"footer-mobile-columns",children:[
            // LEFT COLUMN: BROWSE
            o.jsxs("div",{className:"footer-column-left",children:[
              o.jsx("h3",{className:"text-white font-bold mb-3.5 text-xs uppercase tracking-wider",children:"BROWSE"}),
              o.jsx("ul",{className:"space-y-2",children:FOOTER_BROWSE.map(item=>o.jsx("li",{children:o.jsx(Le,{to:item.href,className:"text-gray-400 hover:text-white text-xs transition-colors block py-1",children:item.label})},item.label))})
            ]}),
            // RIGHT COLUMN: DISCOVER + INFO directly underneath
            o.jsxs("div",{className:"footer-column-right",children:[
              o.jsxs("div",{children:[
                o.jsx("h3",{className:"text-white font-bold mb-3.5 text-xs uppercase tracking-wider",children:"DISCOVER"}),
                o.jsx("ul",{className:"space-y-2",children:FOOTER_DISCOVER.map(item=>o.jsx("li",{children:o.jsx(Le,{to:item.href,className:"text-gray-400 hover:text-white text-xs transition-colors block py-1",children:item.label})},item.label))})
              ]}),
              o.jsxs("div",{className:"footer-info-section",children:[
                o.jsx("h3",{className:"text-white font-bold mb-3.5 text-xs uppercase tracking-wider",children:"INFO"}),
                o.jsx("ul",{className:"space-y-2",children:FOOTER_INFO.map(item=>o.jsx("li",{children:o.jsx(Le,{to:item.href,className:"text-gray-400 hover:text-white text-xs transition-colors block py-1",children:item.label})},item.label))})
              ]})
            ]})
          ]})
        ]}),

        // Bottom Copyright & Badge
        o.jsxs("div",{className:"border-t border-white/5 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4",children:[
          o.jsxs("p",{className:"text-gray-500 text-xs",children:["© ",new Date().getFullYear()," Netflix4U — All rights reserved."]}),
          o.jsxs("div",{className:"flex items-center gap-2 text-gray-500 text-xs",children:[
            o.jsx(v0,{className:"w-3.5 h-3.5 text-[var(--color-accent)]"}),
            o.jsx("span",{children:"Built for entertainment lovers worldwide"})
          ]})
        ]})
      ]})})}\n`;
      content = content.substring(0, oldIgIdx) + newIgCode + content.substring(endIgIdx);
      console.log('✓ Replaced function ig with 2-column mobile structure');
    }
  }

  // 3. Mobile Bottom Nav optimization (320px safe)
  const oldFgIdx = content.indexOf('function fg(){');
  if (oldFgIdx !== -1) {
    const endFgIdx = content.indexOf('class sg extends', oldFgIdx);
    if (endFgIdx !== -1) {
      const newFgCode = `function fg(){const s=Af();return o.jsx("nav",{className:"fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-[var(--color-navy-950)]/96 backdrop-blur-xl border-t border-white/10 safe-area-pb","aria-label":"Mobile navigation",children:o.jsx("ul",{className:"flex items-center justify-around px-0.5 py-1",children:cg.map(({label:v,href:z,icon:r})=>{const E=s.pathname===z;return o.jsx("li",{className:"flex-1 text-center min-w-0",children:o.jsxs(Le,{to:z,className:"relative flex flex-col items-center gap-0.5 px-0.5 py-1 group mobile-nav-item","aria-label":v,"aria-current":E?"page":void 0,children:[E&&o.jsx(Qe.span,{layoutId:"mobile-nav-pill",className:"absolute inset-0 rounded-xl bg-[var(--color-accent)]/15",transition:{type:"spring",stiffness:400,damping:30}}),o.jsx("span",{className:\`relative flex items-center justify-center w-8 h-6 rounded-xl transition-all z-10 \${E?"":"group-hover:bg-white/5"}\`,children:o.jsx(r,{className:\`w-4 h-4 sm:w-5 sm:h-5 relative z-10 transition-colors \${E?"text-[var(--color-accent)]":"text-gray-500 group-hover:text-gray-300"}\`})}),o.jsx("span",{className:\`text-[9px] sm:text-[10px] font-semibold transition-colors z-10 truncate max-w-full block \${E?"text-[var(--color-accent)]":"text-gray-500 group-hover:text-gray-400"}\`,children:v})]})},z)})})})}\n`;
      content = content.substring(0, oldFgIdx) + newFgCode + content.substring(endFgIdx);
      console.log('✓ Updated function fg for 320px mobile bottom navigation');
    }
  }

  // 4. Update Header ag():
  // - Remove profile and sign in from mobile top header row
  // - Add Account section inside hamburger menu (Logged out Sign In, Logged in Profile, Watchlist, Continue Watching, Settings, Sign Out)
  // - Category row smooth swipe and wrap
  // - Escape key and body lock for hamburger drawer
  const oldAgIdx = content.indexOf('function ag(){');
  if (oldAgIdx !== -1) {
    const endAgIdx = content.indexOf('const FOOTER_BROWSE=', oldAgIdx);
    if (endAgIdx !== -1) {
      const newAgCode = `function ag(){
  const s=Af();
  Ud();
  const[v,z]=H.useState(!1);
  const[r,E]=H.useState(!1);
  const[M,w]=H.useState(!1);
  const[_,R]=H.useState(!1);
  const[V,gt]=H.useState(!1);
  const[U,Z]=H.useState(!1);
  const[profOpen,setProfOpen]=H.useState(!1);
  const[setOpen,setSetOpen]=H.useState(!1);
  const Ut=H.useRef(null);
  const St=H.useRef(null);

  H.useEffect(()=>{
    const checkAuth=()=>gt(localStorage.getItem("netflix4u_auth")==="true");
    checkAuth();
    const openAuthH=()=>R(!0);
    window.addEventListener("open_auth_modal",openAuthH);
    window.addEventListener("auth_changed",checkAuth);
    return ()=>{
      window.removeEventListener("auth_changed",checkAuth);
      window.removeEventListener("open_auth_modal",openAuthH);
    };
  },[]);

  H.useEffect(()=>{
    const onMouseDown=Y=>{
      if(St.current&&!St.current.contains(Y.target)) Z(!1);
    };
    document.addEventListener("mousedown",onMouseDown);
    return ()=>document.removeEventListener("mousedown",onMouseDown);
  },[]);

  H.useEffect(()=>{
    const onScroll=()=>z(window.scrollY>20);
    window.addEventListener("scroll",onScroll,{passive:!0});
    return ()=>window.removeEventListener("scroll",onScroll);
  },[]);

  H.useEffect(()=>{
    w(!1);
    // Smooth scroll active category into view
    if(Ut.current){
      const act = Ut.current.querySelector('[data-active="true"]');
      if(act) act.scrollIntoView({behavior:"smooth",inline:"center",block:"nearest"});
    }
  },[s.pathname]);

  // Drawer accessibility: Escape key and background scroll lock
  H.useEffect(()=>{
    if(!M) return;
    const onKey=e=>{ if(e.key==="Escape") w(!1); };
    window.addEventListener("keydown",onKey);
    const orig=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return ()=>{
      window.removeEventListener("keydown",onKey);
      document.body.style.overflow=orig;
    };
  },[M]);

  return o.jsxs(o.Fragment,{children:[
    o.jsxs("header",{className:\`fixed top-0 left-0 right-0 z-50 transition-all duration-300 \${v?"bg-[var(--color-navy-950)]/95 backdrop-blur-xl border-b border-white/5 shadow-2xl":"bg-gradient-to-b from-[var(--color-navy-950)] via-[var(--color-navy-950)]/80 to-transparent"}\`,children:[
      // Top row: [ NETFLIX4U Logo ]  [ Search ]  [ Menu ☰ ] (strictly no Sign In or Profile on mobile)
      o.jsxs("nav",{className:"max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-8 h-14 sm:h-16 flex items-center justify-between gap-2",children:[
        o.jsx(Le,{to:"/",onClick:()=>{if(window.location.pathname==="/")window.scrollTo({top:0,behavior:"smooth"})},className:"flex-shrink-0 cursor-pointer",id:"nav-logo",children:o.jsx("img",{src:"/images/netflix4u-logo-nav.svg",alt:"Netflix4U",className:"h-7 sm:h-8 md:h-9 w-auto object-contain transition-transform duration-200 hover:scale-105"})}),
        o.jsx("div",{className:"hidden md:flex flex-1 max-w-xl mx-auto",children:o.jsxs("button",{onClick:()=>E(!0),className:"w-full flex items-center gap-3 bg-white/[0.06] border border-white/10 rounded-full px-5 py-2.5 text-gray-500 hover:border-white/20 hover:bg-white/[0.08] transition-all cursor-text",id:"nav-search-trigger",children:[o.jsx(Wu,{className:"w-4 h-4"}),o.jsx("span",{className:"text-sm",children:"Search movies, shows, anime..."})]})}),
        o.jsxs("div",{className:"flex items-center gap-1.5 sm:gap-2",children:[
          o.jsx("button",{onClick:()=>E(!0),className:"btn-icon md:hidden w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-gray-300 hover:text-white","aria-label":"Search",children:o.jsx(Wu,{className:"w-4 h-4 sm:w-5 sm:h-5"})}),
          V?o.jsxs("div",{className:"relative hidden md:block",ref:St,children:[
            o.jsx("button",{onClick:()=>Z(!U),className:"w-9 h-9 rounded-full bg-gradient-to-tr from-[var(--color-accent)] to-orange-500 p-0.5",children:o.jsx("div",{className:"w-full h-full rounded-full border-2 border-white/20 overflow-hidden bg-[var(--color-navy-900)] flex items-center justify-center",children:o.jsx(Sf,{className:"w-5 h-5 text-white/80"})})}),
            o.jsx(ja,{children:U&&o.jsxs(Qe.div,{initial:{opacity:0,y:10,scale:.95},animate:{opacity:1,y:0,scale:1},exit:{opacity:0,y:10,scale:.95},className:"absolute right-0 top-full mt-2 w-48 bg-[var(--color-navy-900)] border border-white/10 rounded-xl shadow-2xl overflow-hidden py-2",children:[
              o.jsx(Le,{to:"/watchlist",onClick:()=>Z(!1),className:"block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5",children:"My Watchlist"}),
              o.jsxs("button",{onClick:()=>{localStorage.removeItem("netflix4u_auth"),window.dispatchEvent(new Event("auth_changed")),Z(!1)},className:"w-full text-left px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 flex items-center gap-2 mt-1 border-t border-white/5 pt-3",children:[o.jsx(g0,{className:"w-4 h-4"})," Sign Out"]})
            ]})})
          ]}):o.jsx("button",{onClick:()=>R(!0),className:"hidden md:flex items-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-semibold px-5 py-2 rounded-lg transition-all hover:scale-[1.02] active:scale-95",id:"nav-sign-in",children:"Sign In"}),
          o.jsx("button",{onClick:()=>w(!M),className:"btn-icon lg:hidden w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-gray-300 hover:text-white","aria-label":"Menu",children:o.jsx(y0,{className:"w-5 h-5"})})
        ]})
      ]}),

      // Second Row: Categories Circular / Carousel with Isolated State
      (s.pathname.startsWith("/movie/")||s.pathname.startsWith("/series/")||s.pathname.startsWith("/anime/")||s.pathname.startsWith("/kdrama/"))?null:
      o.jsxs("div",{className:"category-carousel-container select-none",children:[
        o.jsx("button",{onClick:()=>{if(Ut.current)Ut.current.scrollBy({left:-220,behavior:"smooth"})},className:"category-arrow-btn hidden sm:flex mr-1","aria-label":"Scroll categories left",children:"‹"}),
        o.jsx("div",{ref:Ut,className:"category-carousel-track flex-1",children:eg.map(J=>{
          const Y=s.pathname===J.href;
          return o.jsx(Le,{to:J.href,"data-active":Y?"true":"false",className:\`btn-pill flex-shrink-0 whitespace-nowrap text-xs sm:text-sm px-3.5 py-1.5 \${Y?"bg-[var(--color-accent)] text-white border-[var(--color-accent)] shadow-md shadow-red-900/40":"hover:text-white"}\`,children:o.jsx("span",{children:J.label})},J.label);
        })}),
        o.jsx("button",{onClick:()=>{if(Ut.current)Ut.current.scrollBy({left:220,behavior:"smooth"})},className:"category-arrow-btn hidden sm:flex ml-1","aria-label":"Scroll categories right",children:"›"})
      ]}),

      // Hamburger Drawer Menu
      o.jsx(ja,{children:M&&o.jsxs("div",{className:"fixed inset-0 z-[120] lg:hidden flex",children:[
        o.jsx(Qe.div,{initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},transition:{duration:.2},onClick:()=>w(!1),className:"fixed inset-0 bg-black/80 backdrop-blur-sm"}),
        o.jsxs(Qe.div,{initial:{x:"100%"},animate:{x:0},exit:{x:"100%"},transition:{type:"spring",damping:28,stiffness:280},className:"relative ml-auto w-[85%] max-w-sm h-full bg-[var(--color-navy-950)] border-l border-white/10 flex flex-col z-10 shadow-2xl overflow-y-auto",children:[
          // Drawer Header
          o.jsxs("div",{className:"p-4 border-b border-white/10 flex items-center justify-between",children:[
            o.jsxs(Le,{to:"/",onClick:()=>{w(!1);if(window.location.pathname==="/")window.scrollTo({top:0,behavior:"smooth"})},className:"flex items-center gap-1",children:o.jsx("img",{src:"/images/netflix4u-logo-nav.svg",alt:"Netflix4U",className:"h-7 w-auto object-contain"})}),
            o.jsx("button",{onClick:()=>w(!1),className:"w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors","aria-label":"Close Menu",children:o.jsx(bf,{className:"w-5 h-5"})})
          ]}),
          // Search in Drawer
          o.jsx("div",{className:"p-3.5 border-b border-white/5",children:o.jsxs("button",{onClick:()=>{w(!1);E(!0);},className:"w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3.5 py-2.5 text-gray-400 text-xs transition-all",children:[o.jsx(Wu,{className:"w-4 h-4 text-[var(--color-accent)]"}),o.jsx("span",{children:"Search movies, shows, anime…"})]})}),
          // Nav Links
          o.jsxs("div",{className:"flex-1 px-3 py-3 space-y-1 overflow-y-auto",children:[
            o.jsx("p",{className:"text-[11px] font-bold uppercase tracking-wider text-gray-400 px-3 mb-1.5",children:"Explore Collections"}),
            eg.map(J=>{
              const Y=s.pathname===J.href;
              return o.jsx("div",{children:o.jsxs(Le,{to:J.href,onClick:()=>w(!1),className:\`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all \${Y?"bg-[var(--color-accent)] text-white shadow-lg shadow-red-900/40":"text-gray-300 hover:text-white hover:bg-white/5"}\`,children:[o.jsx("span",{children:J.label})]})},J.href);
            }),
            o.jsx("div",{className:"my-3 border-t border-white/10"}),
            // Account Section
            o.jsx("p",{className:"text-[11px] font-bold uppercase tracking-wider text-gray-400 px-3 mb-2",children:"Account"}),
            V?o.jsxs("div",{className:"space-y-1",children:[
              o.jsxs("button",{onClick:()=>{setProfOpen(!0);w(!1);},className:"w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5 transition-all text-left",children:[o.jsx(Sf,{className:"w-4 h-4 text-[var(--color-accent)]"}),o.jsx("span",{children:"Profile"})]}),
              o.jsxs(Le,{to:"/watchlist",onClick:()=>w(!1),className:"flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5 transition-all",children:[o.jsx("span",{className:"text-sm",children:"⭐"}),o.jsx("span",{children:"Watchlist"})]}),
              o.jsxs("a",{href:"/#continue-watching",onClick:ev=>{w(!1);const el=document.getElementById("continue-watching")||document.getElementById("top-10-section");if(el){ev.preventDefault();el.scrollIntoView({behavior:"smooth"});}},className:"flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5 transition-all",children:[o.jsx("span",{className:"text-sm",children:"🕒"}),o.jsx("span",{children:"Continue Watching"})]}),
              o.jsxs("button",{onClick:()=>{setSetOpen(!0);w(!1);},className:"w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5 transition-all text-left",children:[o.jsx("span",{className:"text-sm",children:"⚙️"}),o.jsx("span",{children:"Settings"})]}),
              o.jsxs("button",{onClick:()=>{localStorage.removeItem("netflix4u_auth");window.dispatchEvent(new Event("auth_changed"));window.dispatchEvent(new CustomEvent("flix_toast",{detail:{message:"Signed out successfully",type:"info"}}));w(!1);},className:"w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-white/5 transition-all text-left mt-1 border-t border-white/5 pt-2.5",children:[o.jsx(g0,{className:"w-4 h-4"}),o.jsx("span",{children:"Sign Out"})]})
            ]}):o.jsx("button",{onClick:()=>{w(!1);R(!0);},className:"w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white shadow-lg shadow-red-900/30 transition-all",children:"Sign In"})
          ]}),
          // Drawer Footer Links
          o.jsxs("div",{className:"p-3.5 border-t border-white/10 bg-black/20 text-[11px] text-gray-500 space-y-1.5",children:[
            o.jsxs("div",{className:"flex flex-wrap gap-x-3 gap-y-1 font-medium",children:[
              o.jsx(Le,{to:"/about",onClick:()=>w(!1),className:"hover:text-white",children:"About"}),
              o.jsx(Le,{to:"/contact",onClick:()=>w(!1),className:"hover:text-white",children:"Contact"}),
              o.jsx(Le,{to:"/privacy",onClick:()=>w(!1),className:"hover:text-white",children:"Privacy"}),
              o.jsx(Le,{to:"/terms",onClick:()=>w(!1),className:"hover:text-white",children:"Terms"}),
              o.jsx(Le,{to:"/dmca",onClick:()=>w(!1),className:"hover:text-white",children:"DMCA"})
            ]}),
            o.jsx("p",{children:"© 2026 netflix4u.in"})
          ]})
        ]})
      ]})})
    ]}),
    o.jsx(P0,{isOpen:r,onClose:()=>E(!1)}),
    o.jsx(tg,{isOpen:_,onClose:()=>R(!1)}),
    // Profile Modal
    profOpen&&o.jsxs("div",{className:"fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in",children:[
      o.jsxs("div",{className:"bg-[var(--color-navy-900)] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative",children:[
        o.jsx("button",{onClick:()=>setProfOpen(!1),className:"absolute top-4 right-4 text-gray-400 hover:text-white text-lg",children:"✕"}),
        o.jsxs("div",{className:"flex items-center gap-3 mb-4",children:[
          o.jsx("div",{className:"w-12 h-12 rounded-full bg-gradient-to-tr from-[var(--color-accent)] to-orange-500 flex items-center justify-center text-white",children:o.jsx(Sf,{className:"w-6 h-6"})}),
          o.jsxs("div",{children:[
            o.jsx("h3",{className:"text-white font-bold text-base",children:"VIP Member"}),
            o.jsx("p",{className:"text-gray-400 text-xs",children:"member@netflix4u.in"})
          ]})
        ]}),
        o.jsxs("div",{className:"space-y-2 py-3 border-y border-white/5 text-xs text-gray-300",children:[
          o.jsxs("div",{className:"flex justify-between",children:[o.jsx("span",{className:"text-gray-500",children:"Membership"}),o.jsx("span",{className:"text-emerald-400 font-semibold",children:"Active (Ad-Free)"})]}),
          o.jsxs("div",{className:"flex justify-between",children:[o.jsx("span",{className:"text-gray-500",children:"Fast Cloud Server"}),o.jsx("span",{className:"text-white font-semibold",children:"Enabled"})]}),
          o.jsxs("div",{className:"flex justify-between",children:[o.jsx("span",{className:"text-gray-500",children:"Streaming Quality"}),o.jsx("span",{className:"text-white font-semibold",children:"Up to 4K UHD"})]})
        ]}),
        o.jsx("button",{onClick:()=>setProfOpen(!1),className:"w-full mt-4 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold py-2.5 rounded-xl text-xs transition-all",children:"Close"})
      ]})
    ]}),
    // Settings Modal
    setOpen&&o.jsxs("div",{className:"fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in",children:[
      o.jsxs("div",{className:"bg-[var(--color-navy-900)] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative",children:[
        o.jsx("button",{onClick:()=>setSetOpen(!1),className:"absolute top-4 right-4 text-gray-400 hover:text-white text-lg",children:"✕"}),
        o.jsx("h3",{className:"text-white font-bold text-base mb-4",children:"Preferences & Settings"}),
        o.jsxs("div",{className:"space-y-3 text-xs text-gray-300 mb-6",children:[
          o.jsxs("label",{className:"flex items-center justify-between cursor-pointer",children:[
            o.jsx("span",{children:"Autoplay Next Episode"}),
            o.jsx("input",{type:"checkbox",defaultChecked:!0,className:"rounded text-[var(--color-accent)] focus:ring-0"})
          ]}),
          o.jsxs("label",{className:"flex items-center justify-between cursor-pointer",children:[
            o.jsx("span",{children:"High Quality Video (1080p+)"}),
            o.jsx("input",{type:"checkbox",defaultChecked:!0,className:"rounded text-[var(--color-accent)] focus:ring-0"})
          ]}),
          o.jsxs("label",{className:"flex items-center justify-between cursor-pointer",children:[
            o.jsx("span",{children:"Multi-Audio Preferred"}),
            o.jsx("input",{type:"checkbox",defaultChecked:!0,className:"rounded text-[var(--color-accent)] focus:ring-0"})
          ]})
        ]}),
        o.jsx("button",{onClick:()=>{setSetOpen(!1);window.dispatchEvent(new CustomEvent("flix_toast",{detail:{message:"Preferences saved",type:"success"}}));},className:"w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-bold py-2.5 rounded-xl text-xs transition-all",children:"Save Preferences"})
      ]})
    ]})
  ]})
}\n`;
      content = content.substring(0, oldAgIdx) + newAgCode + content.substring(endAgIdx);
      console.log('✓ Replaced function ag with mobile header, isolated carousel & hamburger account');
    }
  }

  fs.writeFileSync(fPath, content, 'utf8');
  console.log('✓ Successfully saved:', fPath);
}

console.log('Header, Navigation, and Footer patches complete!');
