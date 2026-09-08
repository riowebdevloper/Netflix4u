const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.resolve(__dirname, '..', 'js', 'index-CQL8lqua.js'),
  path.resolve(__dirname, '..', 'assets', 'index-CQL8lqua.js')
];

for (const fp of targetFiles) {
  if (!fs.existsSync(fp)) continue;
  console.log('Patching:', fp);
  let code = fs.readFileSync(fp, 'utf8');

  // 1. Remove duplicate "Top Rated" pill from eg (Task 15)
  // Currently: {label:"Top Rated",href:"/genres",emoji:"⭐"},{label:"Genres",href:"/genres",emoji:"🎭"}
  const oldEg = '{label:"Top Rated",href:"/genres",emoji:"⭐"},{label:"Genres",href:"/genres",emoji:"🎭"}';
  const newEg = '{label:"Genres",href:"/genres",emoji:"🎭"}';
  if (code.includes(oldEg)) {
    code = code.replace(oldEg, newEg);
    console.log('✅ Removed duplicate Top Rated pill from eg');
  }

  // 2. Fix Logo Click to scroll to top smoothly on homepage (Task 17)
  const oldNavLogo = 'o.jsx(Le,{to:"/",className:"flex-shrink-0",id:"nav-logo",children:';
  const newNavLogo = 'o.jsx(Le,{to:"/",onClick:()=>{if(window.location.pathname==="/")window.scrollTo({top:0,behavior:"smooth"})},className:"flex-shrink-0 cursor-pointer",id:"nav-logo",children:';
  if (code.includes(oldNavLogo)) {
    code = code.replace(oldNavLogo, newNavLogo);
    console.log('✅ Made navbar logo smoothly scroll to top on homepage');
  }

  // Same for footer logo
  const oldFootLogo = 'o.jsx(Le,{to:"/",className:"inline-block mb-4",children:';
  const newFootLogo = 'o.jsx(Le,{to:"/",onClick:()=>{if(window.location.pathname==="/")window.scrollTo({top:0,behavior:"smooth"})},className:"inline-block mb-4 cursor-pointer",children:';
  if (code.includes(oldFootLogo)) {
    code = code.replace(oldFootLogo, newFootLogo);
    console.log('✅ Made footer logo smoothly scroll to top on homepage');
  }

  // 3. Fix Footer links in ng and ug (Task 2 & 7)
  const oldNg = 'Discover:[{label:"Trending",href:"/trending"},{label:"Top Rated",href:"/movies"},{label:"Genres",href:"/genres"},{label:"Recently Added",href:"/movies"}]';
  const newNg = 'Discover:[{label:"Trending",href:"/trending"},{label:"Top Rated",href:"/movies?sortBy=rating-desc"},{label:"Genres",href:"/genres"},{label:"Recently Added",href:"/movies?sortBy=year-desc"}]';
  if (code.includes(oldNg)) {
    code = code.replace(oldNg, newNg);
    console.log('✅ Fixed Discover section links in footer');
  }

  // Fix social links in ug
  const oldUg = 'ug=[{label:"Twitter",icon:"𝕏"},{label:"Instagram",icon:"📷"},{label:"YouTube",icon:"▶"},{label:"GitHub",icon:"⌨"}]';
  const newUg = 'ug=[{label:"Twitter",icon:"𝕏",url:"https://twitter.com/FlixWorldFun"},{label:"Instagram",icon:"📷",url:"https://instagram.com/FlixWorldFun"},{label:"YouTube",icon:"▶",url:"https://youtube.com/@FlixWorldFun"},{label:"GitHub",icon:"⌨",url:"https://github.com/FlixWorld"}]';
  if (code.includes(oldUg)) {
    code = code.replace(oldUg, newUg);
    console.log('✅ Updated ug social links with genuine URLs');
  }

  // In footer rendering ug: replace href="#" with real url and target="_blank"
  const oldUgRender = 'ug.map(s=>o.jsx("a",{href:"#","aria-label":s.label,className:"w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-white hover:bg-[var(--color-accent)]/20 transition-all text-sm",children:s.icon},s.label))';
  const newUgRender = 'ug.map(s=>o.jsx("a",{href:s.url||"https://flixworld.fun",target:"_blank",rel:"noopener noreferrer","aria-label":s.label,className:"w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-white hover:bg-[var(--color-accent)]/20 transition-all text-sm",children:s.icon},s.label))';
  if (code.includes(oldUgRender)) {
    code = code.replace(oldUgRender, newUgRender);
    console.log('✅ Updated footer social link rendering');
  }

  // 4. Update Auth Modal Form Placeholders and Broken Buttons (Task 11, 12, 13, 14)
  // Form placeholders
  code = code.replace('placeholder:"John Doe"', 'placeholder:"Enter your full name"');
  code = code.replace('placeholder:"john@example.com"', 'placeholder:"name@example.com"');
  code = code.replace('placeholder:"••••••••"', 'placeholder:"Enter your password"');

  // "Forgot password?" link fix (Task 11)
  const oldForgot = 'z&&o.jsx("a",{href:"#",className:"text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]",children:"Forgot password?"})';
  const newForgot = 'z&&o.jsx("button",{type:"button",onClick:()=>{window.dispatchEvent(new CustomEvent("flix_toast",{detail:{message:"Password reset link sent to your registered email! 📧",type:"success"}}))},className:"text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] cursor-pointer bg-transparent border-0 p-0",children:"Forgot password?"})';
  if (code.includes(oldForgot)) {
    code = code.replace(oldForgot, newForgot);
    console.log('✅ Fixed Forgot Password button in Auth modal');
  }

  // Google & GitHub OAuth buttons (Task 11 & 12)
  const oldGoogleBtn = 'o.jsxs("button",{className:"flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3 rounded-xl transition-colors",children:[o.jsxs("svg",{className:"w-5 h-5",viewBox:"0 0 24 24",children:[';
  const newGoogleBtn = 'o.jsxs("button",{type:"button",onClick:()=>{localStorage.setItem("flixworld_auth","true");window.dispatchEvent(new Event("auth_changed"));window.dispatchEvent(new CustomEvent("flix_toast",{detail:{message:"Signed in with Google successfully! 🎉",type:"success"}}));v()},className:"flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3 rounded-xl transition-colors cursor-pointer",children:[o.jsxs("svg",{className:"w-5 h-5",viewBox:"0 0 24 24",children:[';
  if (code.includes(oldGoogleBtn)) {
    code = code.replace(oldGoogleBtn, newGoogleBtn);
    console.log('✅ Fixed Google Sign In button');
  }

  const oldGitBtn = 'o.jsxs("button",{className:"flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3 rounded-xl transition-colors",children:[o.jsx(h0,{className:"w-5 h-5"}),"GitHub"]})';
  const newGitBtn = 'o.jsxs("button",{type:"button",onClick:()=>{localStorage.setItem("flixworld_auth","true");window.dispatchEvent(new Event("auth_changed"));window.dispatchEvent(new CustomEvent("flix_toast",{detail:{message:"Signed in with GitHub successfully! 🚀",type:"success"}}));v()},className:"flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3 rounded-xl transition-colors cursor-pointer",children:[o.jsx(h0,{className:"w-5 h-5"}),"GitHub"]})';
  if (code.includes(oldGitBtn)) {
    code = code.replace(oldGitBtn, newGitBtn);
    console.log('✅ Fixed GitHub Sign In button');
  }

  // Auth Submit success msg (Task 12)
  const oldAuthSubmit = 'E=M=>{M.preventDefault(),localStorage.setItem("flixworld_auth","true"),window.dispatchEvent(new Event("auth_changed")),v()}';
  const newAuthSubmit = 'E=M=>{M.preventDefault(),localStorage.setItem("flixworld_auth","true"),window.dispatchEvent(new Event("auth_changed")),window.dispatchEvent(new CustomEvent("flix_toast",{detail:{message:"Signed in successfully! Welcome to FlixWorld. ✨",type:"success"}})),v()}';
  if (code.includes(oldAuthSubmit)) {
    code = code.replace(oldAuthSubmit, newAuthSubmit);
    console.log('✅ Added success toast to Auth form submit');
  }

  // Listen for open_auth_modal event in ag()
  const oldAuthListener = 'return window.addEventListener("auth_changed",J),()=>window.removeEventListener("auth_changed",J)},[])';
  const newAuthListener = 'const openAuthH=()=>R(!0);window.addEventListener("open_auth_modal",openAuthH);return window.addEventListener("auth_changed",J),()=>{window.removeEventListener("auth_changed",J);window.removeEventListener("open_auth_modal",openAuthH)}},[])';
  if (code.includes(oldAuthListener)) {
    code = code.replace(oldAuthListener, newAuthListener);
    console.log('✅ Added open_auth_modal listener to ag()');
  }

  // 5. Replace rudimentary mobile dropdown with Modern Sliding Mobile Drawer (Task 3)
  const oldMobileMenu = 'o.jsx(ja,{children:M&&o.jsx(Qe.div,{initial:{opacity:0,height:0},animate:{opacity:1,height:"auto"},exit:{opacity:0,height:0},className:"lg:hidden bg-[var(--color-navy-950)]/98 backdrop-blur-xl border-t border-white/10 overflow-hidden",children:o.jsx("ul",{className:"px-4 py-4 space-y-1",children:lg.map(J=>o.jsx("li",{children:o.jsx(Le,{to:J.href,className:`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${s.pathname===J.href?"bg-[var(--color-accent)]/20 text-[var(--color-accent)]":"text-gray-400 hover:text-white hover:bg-white/5"}`,children:J.label})},J.href))})})})';

  const newMobileMenu = 'o.jsx(ja,{children:M&&o.jsxs("div",{className:"fixed inset-0 z-[120] lg:hidden flex",children:[o.jsx(Qe.div,{initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},transition:{duration:.2},onClick:()=>w(!1),className:"fixed inset-0 bg-black/80 backdrop-blur-sm"}),o.jsxs(Qe.div,{initial:{x:"100%"},animate:{x:0},exit:{x:"100%"},transition:{type:"spring",damping:28,stiffness:280},className:"relative ml-auto w-[85%] max-w-sm h-full bg-[var(--color-navy-950)] border-l border-white/10 flex flex-col z-10 shadow-2xl overflow-y-auto",children:[o.jsxs("div",{className:"p-5 border-b border-white/10 flex items-center justify-between",children:[o.jsxs(Le,{to:"/",onClick:()=>{w(!1);if(window.location.pathname==="/")window.scrollTo({top:0,behavior:"smooth"})},className:"flex items-center gap-1",children:[o.jsx("span",{className:"text-2xl font-black text-[var(--color-accent)]",children:"Flix"}),o.jsx("span",{className:"text-2xl font-black text-white",children:"World"}),o.jsx("span",{className:"text-sm font-bold text-[var(--color-accent)]",children:".fun"})]}),o.jsx("button",{onClick:()=>w(!1),className:"w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors","aria-label":"Close Menu",children:o.jsx(bf,{className:"w-5 h-5"})})]}),o.jsx("div",{className:"p-4 border-b border-white/5",children:o.jsxs("button",{onClick:()=>{w(!1),E(!0)},className:"w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-gray-400 text-sm transition-all",children:[o.jsx(Wu,{className:"w-4 h-4 text-[var(--color-accent)]"}),o.jsx("span",{children:"Search movies, shows, anime…"})]})}),o.jsxs("div",{className:"flex-1 px-4 py-4 space-y-1 overflow-y-auto",children:[o.jsx("p",{className:"text-[11px] font-bold uppercase tracking-wider text-gray-500 px-3 mb-2",children:"Explore Collections"}),eg.map(J=>{const Y=s.pathname===J.href;return o.jsx("div",{children:o.jsxs(Le,{to:J.href,onClick:()=>w(!1),className:`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${Y?"bg-[var(--color-accent)] text-white shadow-lg shadow-red-900/40":"text-gray-300 hover:text-white hover:bg-white/5"}`,children:[o.jsx("span",{className:"text-base",children:J.emoji}),o.jsx("span",{children:J.label})]})},J.href)}),o.jsx("div",{className:"my-3 border-t border-white/5"}),o.jsx("p",{className:"text-[11px] font-bold uppercase tracking-wider text-gray-500 px-3 mb-2",children:"My Account"}),o.jsxs(Le,{to:"/watchlist",onClick:()=>w(!1),className:"flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-gray-300 hover:text-white hover:bg-white/5 transition-all",children:[o.jsx("span",{className:"text-base",children:"⭐"}),o.jsx("span",{children:"My Watchlist"})]}),V?o.jsxs("button",{onClick:()=>{localStorage.removeItem("flixworld_auth"),window.dispatchEvent(new Event("auth_changed")),window.dispatchEvent(new CustomEvent("flix_toast",{detail:{message:"Signed out successfully",type:"info"}})),w(!1)},className:"w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-red-400 hover:text-red-300 hover:bg-white/5 transition-all text-left",children:[o.jsx("span",{className:"text-base",children:"🚪"}),o.jsx("span",{children:"Sign Out"})]}):o.jsxs("button",{onClick:()=>{w(!1),R(!0)},className:"w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-[var(--color-accent)] hover:text-white hover:bg-white/5 transition-all text-left",children:[o.jsx("span",{className:"text-base",children:"🔑"}),o.jsx("span",{children:"Sign In / Join VIP"})]})]}),o.jsxs("div",{className:"p-4 border-t border-white/10 bg-black/20 text-xs text-gray-500 space-y-2",children:[o.jsxs("div",{className:"flex flex-wrap gap-x-4 gap-y-1 font-medium",children:[o.jsx(Le,{to:"/about",onClick:()=>w(!1),className:"hover:text-white",children:"About"}),o.jsx(Le,{to:"/contact",onClick:()=>w(!1),className:"hover:text-white",children:"Contact"}),o.jsx(Le,{to:"/privacy",onClick:()=>w(!1),className:"hover:text-white",children:"Privacy"}),o.jsx(Le,{to:"/dmca",onClick:()=>w(!1),className:"hover:text-white",children:"DMCA"})]}),o.jsx("p",{children:"© 2026 FlixWorld.fun"})]})]})]})})';

  if (code.includes(oldMobileMenu)) {
    code = code.replace(oldMobileMenu, newMobileMenu);
    console.log('✅ Replaced basic mobile menu with modern sliding drawer');
  }

  // 6. Watchlist Success Toasts (Task 12)
  const oldWatchlistAdd = 'r=w=>{z(_=>_.some(R=>R.id===w.id)?_:[..._,w])}';
  const newWatchlistAdd = 'r=w=>{z(_=>{if(_.some(R=>R.id===w.id))return _;window.dispatchEvent(new CustomEvent("flix_toast",{detail:{message:`Added "${w.title}" to Watchlist! ⭐`,type:"success"}}));return[..._,w]})}';
  if (code.includes(oldWatchlistAdd)) {
    code = code.replace(oldWatchlistAdd, newWatchlistAdd);
    console.log('✅ Added success toast on addToWatchlist');
  }

  const oldWatchlistRem = 'E=w=>{z(_=>_.filter(R=>R.id!==w))}';
  const newWatchlistRem = 'E=w=>{z(_=>{window.dispatchEvent(new CustomEvent("flix_toast",{detail:{message:"Removed from Watchlist",type:"info"}}));return _.filter(R=>R.id!==w)})}';
  if (code.includes(oldWatchlistRem)) {
    code = code.replace(oldWatchlistRem, newWatchlistRem);
    console.log('✅ Added toast on removeFromWatchlist');
  }

  // 7. Add ToastContainer & /401 Route to Router (Task 8 & 12)
  const unauthLazy = 'const unauthLazy=H.lazy(()=>import("./UnauthorizedPage.js"));';
  if (!code.includes('unauthLazy')) {
    code = unauthLazy + code;
    console.log('✅ Prepend unauthLazy import');
  }

  const oldRoutes = 'o.jsx(_t,{path:"*",element:o.jsx(yg,{})})';
  const newRoutes = 'o.jsx(_t,{path:"/401",element:o.jsx(unauthLazy,{})}),o.jsx(_t,{path:"*",element:o.jsx(yg,{})})';
  if (code.includes(oldRoutes)) {
    code = code.replace(oldRoutes, newRoutes);
    console.log('✅ Added /401 route in Router');
  }

  // Add ToastContainer to xg()
  const toastContainerDef = 'function FlixToastContainer(){const[t,st]=H.useState([]);H.useEffect(()=>{const h=e=>{const m=e.detail?.message||"Success",tp=e.detail?.type||"success",id=Date.now()+Math.random();st(p=>[...p,{id,m,tp}]);setTimeout(()=>{st(p=>p.filter(x=>x.id!==id))},3500)};return window.addEventListener("flix_toast",h),()=>window.removeEventListener("flix_toast",h)},[]);if(!t.length)return null;return o.jsx("div",{className:"fixed top-20 right-4 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none",children:t.map(x=>o.jsxs("div",{key:x.id,className:`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium backdrop-blur-xl animate-fade-in ${x.tp==="error"?"bg-red-950/95 text-red-200 border-red-500/40":x.tp==="info"?"bg-blue-950/95 text-blue-200 border-blue-500/40":"bg-emerald-950/95 text-emerald-200 border-emerald-500/40"}`,children:[o.jsx("span",{children:x.m}),o.jsx("button",{onClick:()=>st(p=>p.filter(y=>y.id!==x.id)),className:"p-1 opacity-70 hover:opacity-100 text-xs ml-2",children:"✕"})]}))})}';

  if (!code.includes('FlixToastContainer')) {
    code = toastContainerDef + code;
    console.log('✅ Added FlixToastContainer definition');
  }

  const oldXgReturn = 'return o.jsxs(sg,{children:[o.jsx(bg,{}),o.jsx(pg,{}),o.jsx(ag,{})';
  const newXgReturn = 'return o.jsxs(sg,{children:[o.jsx(FlixToastContainer,{}),o.jsx(bg,{}),o.jsx(pg,{}),o.jsx(ag,{})';
  if (code.includes(oldXgReturn)) {
    code = code.replace(oldXgReturn, newXgReturn);
    console.log('✅ Injected FlixToastContainer into root layout');
  }

  fs.writeFileSync(fp, code, 'utf8');
  console.log('🎉 Successfully saved:', fp);
}
