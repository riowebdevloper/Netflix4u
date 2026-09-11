const H="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 300'><rect fill='%23222' width='200' height='300'/><text x='100' y='150' text-anchor='middle' fill='%23555' font-family='sans-serif' font-size='14'>No image</text></svg>",Ve=e=>{try{return new Set(JSON.parse(localStorage.getItem(e)||"[]"))}catch{return new Set}},Oe=Ve("nmMyList"),Ue=Ve("nmLiked");document.addEventListener("click",e=>{const t=e.target.closest(".nm-btn-add, .nm-btn-like");if(!t)return;e.preventDefault(),e.stopPropagation();const a=t.classList.contains("nm-btn-add"),s=a?Oe:Ue,n=Number(t.dataset.tmdbid);s.has(n)?s.delete(n):s.add(n);const i=a?"nm-btn-add":"nm-btn-like";document.querySelectorAll(`.${i}[data-tmdbid="${n}"]`).forEach(o=>o.classList.toggle("nm-on",s.has(n)));try{localStorage.setItem(a?"nmMyList":"nmLiked",JSON.stringify([...s]))}catch{}},!0);const R=document.getElementById("progress-bar");let z=0,ge;function wt(){if(z++,z===1){R.style.opacity="1",R.style.width="0";let e=0;clearInterval(ge),ge=setInterval(()=>{e=Math.min(85,e+(85-e)*.08),R.style.width=e+"%"},100)}}function bt(){z=Math.max(0,z-1),z===0&&(clearInterval(ge),R.style.width="100%",setTimeout(()=>{R.style.opacity="0",setTimeout(()=>{R.style.width="0"},250)},200))}async function X(e,t){wt();try{return await fetch(e,{cache:"no-store",...t})}finally{bt()}}function ve(e){const t=e.source;if((t==="aoneroom"||t==="aoneroom-direct")&&e.subjectId){const a=String(e.title||"").replace(/"/g,"&quot;"),s=String(e.year||""),n=String(e.poster||"");return`href="#" data-modal="watch" data-subject="${e.subjectId}" data-type="${e.type}" data-title="${a}" data-year="${s}" data-poster="${n}"`}return`href="#" data-modal="title" data-tmdbid="${e.tmdbId}" data-type="${e.type}"`}function te(e,t={}){const a=e.poster||H,s=(e.title||"").replace(/"/g,"&quot;"),n=e.type==="tv",i=e.rating?Math.round(e.rating*10):null,o=e.rating?`<div class="absolute top-1.5 right-1.5 z-10 bg-black/70 backdrop-blur px-1.5 py-0.5 rounded text-[10px] font-bold text-yellow-300 flex items-center gap-0.5"><svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>${e.rating.toFixed(1)}</div>`:"",r=n?'<div class="absolute top-1.5 left-1.5 z-10 bg-black/70 backdrop-blur px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-semibold text-white/90">Series</div>':"",u=`
      <div class="nm-hover absolute inset-x-0 bottom-0 px-2 pt-10 pb-2 bg-gradient-to-t from-black via-black/85 to-transparent opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 pointer-events-none">
        <div class="flex items-center gap-1.5 mb-1.5">
          <button type="button" aria-label="Play" data-modal="watch" data-tmdbid="${e.tmdbId}" data-type="${e.type}" class="nm-btn nm-btn-play w-7 h-7 rounded-full bg-white flex items-center justify-center pointer-events-auto"><svg class="w-3.5 h-3.5 ml-0.5 text-black" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>
          <button type="button" aria-label="Add to My List" data-tmdbid="${e.tmdbId}" class="nm-btn nm-btn-add w-6 h-6 rounded-full border-[1.5px] border-white/70 flex items-center justify-center pointer-events-auto${Oe.has(e.tmdbId)?" nm-on":""}"><svg class="ic-plus w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg><svg class="ic-check w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg></button>
          <button type="button" aria-label="Like" data-tmdbid="${e.tmdbId}" class="nm-btn nm-btn-like w-6 h-6 rounded-full border-[1.5px] border-white/70 flex items-center justify-center pointer-events-auto${Ue.has(e.tmdbId)?" nm-on":""}"><svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 11v9M2 12v7a2 2 0 002 2h11.5a2 2 0 002-1.6l1.4-7A1.5 1.5 0 0018.9 9H14V4a2 2 0 00-4 0c0 2-3 5-3 7z"/></svg></button>
        </div>
        <div class="flex items-center gap-1.5 text-[10px] font-medium leading-tight">
          ${i?`<span class="text-green-400 shrink-0">${i}% match</span>`:""}
          <span class="nm-cert hidden shrink-0 px-1 py-px rounded border border-white/45 text-[9px] tracking-wide text-white/90" data-cert-id="${e.tmdbId}" data-cert-type="${e.type}"></span>
          <span class="text-white/70 truncate">${e.year?e.year+" · ":""}${n?"Series":"Movie"}</span>
        </div>
      </div>`;return t.rank?`
        <a ${ve(e)} class="nm-card card group block">
          <div class="flex items-stretch gap-1">
            <div class="rank-num shrink-0 self-end leading-none">${t.rank}</div>
            <div class="nm-card-inner flex-1 relative aspect-[2/3] rounded-md overflow-hidden bg-white/5 ring-1 ring-white/10">
              <img src="${a}" loading="lazy" decoding="async" alt="${s}" class="w-full h-full object-cover" onerror="this.src='${H}'" />
              ${o}${r}${u}
            </div>
          </div>
        </a>
      `:`
      <a ${ve(e)} class="nm-card card group block">
        <div class="nm-card-inner relative aspect-[2/3] rounded-lg overflow-hidden bg-white/5 ring-1 ring-white/10">
          <img src="${a}" loading="lazy" decoding="async" alt="${s}"
               class="w-full h-full object-cover" onerror="this.src='${H}'" />
          ${o}${r}${u}
        </div>
        <div class="mt-1.5 px-0.5 text-[12px] sm:text-[13px] text-white/85 font-medium truncate">${e.title}</div>
      </a>
    `}function Je(){return Array.from({length:8}).map(()=>`
      <div class="shrink-0 w-[150px] sm:w-[200px] lg:w-[200px]">
        <div class="aspect-[2/3] rounded-lg shimmer"></div>
      </div>
    `).join("")}function Xe(e,t={}){const a=e.filter(i=>i.poster);if(!a.length)return'<div class="text-white/40 text-xs py-6 px-1">No titles here right now.</div>';const s=t.ranked?10:20,n=t.ranked?"w-40 sm:w-48":"w-[150px] sm:w-[200px] lg:w-[200px]";return a.slice(0,s).map((i,o)=>`
      <div class="shrink-0 ${n}">
        ${te(i,t.ranked?{rank:o+1}:{})}
      </div>
    `).join("")}const p={Action:28,Adventure:12,Comedy:35,Crime:80,Drama:18,Family:10751,Fantasy:14,Horror:27,Mystery:9648,Romance:10749,"Sci-Fi":878,Thriller:53,Animation:16},S={Netflix:"/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg",PrimeVideo:"/pvske1MyAoymrs5bguRfVqYiM9a.jpg",Crunchyroll:"/fzN5Jok5Ig1eJ7gyNGoMhnLSCfh.jpg"},l="&region=IN",xt=[{key:"trending-day",title:"Top 10 Today",url:"/api/catalog/trending?window=day",ranked:!0},{key:"new-releases",title:"New Releases",url:`/api/catalog/discover?type=movie&sort=release&year_from=2025&year_to=2026${l}`},{key:"netflix-popular",title:"Popular on Netflix",url:`/api/catalog/discover?platform=Netflix&type=movie${l}`,logo:S.Netflix},{key:"prime-popular",title:"Popular on Prime Video",url:`/api/catalog/discover?platform=PrimeVideo&type=movie${l}`,logo:S.PrimeVideo},{key:"kdrama",title:"Korean Dramas",url:`/api/catalog/discover?platform=Netflix&type=tv${l}`},{key:"anime",title:"Anime",url:`/api/catalog/discover?platform=Crunchyroll&type=tv${l}`,logo:S.Crunchyroll},{key:"action",title:"Action Blockbusters",url:`/api/catalog/discover?type=movie&genre=${p.Action}${l}`},{key:"comedy",title:"Comedies",url:`/api/catalog/discover?type=movie&genre=${p.Comedy}${l}`},{key:"top-rated",title:"Critically Acclaimed",url:`/api/catalog/discover?type=movie&sort=rating${l}`}],$t=[{key:"kdrama-popular",title:"Popular K-Dramas",url:`/api/catalog/discover?type=tv&country=KR&sort=popularity${l}`},{key:"kdrama-new",title:"Latest K-Dramas",url:`/api/catalog/discover?type=tv&country=KR&sort=release${l}`},{key:"kdrama-top-rated",title:"Top-Rated K-Dramas",url:`/api/catalog/discover?type=tv&country=KR&sort=rating${l}`},{key:"kdrama-netflix",title:"K-Dramas on Netflix",url:`/api/catalog/discover?type=tv&country=KR&platform=Netflix&sort=popularity${l}`,logo:S.Netflix},{key:"kdrama-prime",title:"K-Dramas on Prime Video",url:`/api/catalog/discover?type=tv&country=KR&platform=PrimeVideo&sort=popularity${l}`,logo:S.PrimeVideo},{key:"kdrama-romance",title:"Romance K-Dramas",url:`/api/catalog/discover?type=tv&country=KR&genre=${p.Romance}&sort=popularity${l}`},{key:"kdrama-thriller",title:"Thriller K-Dramas",url:`/api/catalog/discover?type=tv&country=KR&genre=${p.Crime}&sort=popularity${l}`},{key:"kdrama-mystery",title:"Mystery K-Dramas",url:`/api/catalog/discover?type=tv&country=KR&genre=${p.Mystery}&sort=popularity${l}`}],kt=[{key:"lr-trending",title:"Trending This Week",url:"/api/catalog/trending?window=week"},{key:"lr-new-movies",title:"New Movies (2026)",url:`/api/catalog/discover?type=movie&sort=release&year_from=2026&year_to=2026${l}`},{key:"lr-2025-movies",title:"Latest Movies (2025)",url:`/api/catalog/discover?type=movie&sort=release&year_from=2025&year_to=2025${l}`},{key:"lr-new-series",title:"New Series",url:`/api/catalog/discover?type=tv&sort=release&year_from=2025&year_to=2026${l}`},{key:"lr-netflix",title:"New on Netflix",url:`/api/catalog/discover?platform=Netflix&type=movie&sort=release${l}`,logo:S.Netflix},{key:"lr-prime",title:"New on Prime Video",url:`/api/catalog/discover?platform=PrimeVideo&type=movie&sort=release${l}`,logo:S.PrimeVideo},{key:"lr-action",title:"Latest Action",url:`/api/catalog/discover?type=movie&genre=${p.Action}&sort=release&year_from=2024${l}`}],Lt=[{key:"kids-animation",title:"Animated Movies",url:`/api/catalog/discover?type=movie&genre=${p.Animation}&sort=popularity${l}`},{key:"kids-family",title:"Family Movies",url:`/api/catalog/discover?type=movie&genre=${p.Family}&sort=popularity${l}`},{key:"kids-new",title:"New for Kids",url:`/api/catalog/discover?type=movie&genre=${p.Family}&sort=release&year_from=2023${l}`},{key:"kids-adventure",title:"Adventure",url:`/api/catalog/discover?type=movie&genre=${p.Adventure}&sort=popularity${l}`},{key:"kids-fantasy",title:"Fantasy",url:`/api/catalog/discover?type=movie&genre=${p.Fantasy}&sort=popularity${l}`},{key:"kids-anim-tv",title:"Animated Series",url:`/api/catalog/discover?type=tv&genre=${p.Animation}&sort=popularity${l}`},{key:"kids-comedy",title:"Funny Movies",url:`/api/catalog/discover?type=movie&genre=${p.Comedy}&sort=popularity${l}`}];function Et(e){const t=`/api/catalog/discover?platform=${e}`;return[{key:`${e}-popular-m`,title:"Popular Movies",url:`${t}&type=movie&sort=popularity${l}`},{key:`${e}-popular-s`,title:"Popular Series",url:`${t}&type=tv&sort=popularity${l}`},{key:`${e}-new`,title:"New Releases",url:`${t}&type=movie&sort=release${l}`},{key:`${e}-top-rated`,title:"Critically Acclaimed",url:`${t}&type=movie&sort=rating${l}`},{key:`${e}-action`,title:"Action Movies",url:`${t}&type=movie&genre=${p.Action}${l}`},{key:`${e}-comedy`,title:"Comedies",url:`${t}&type=movie&genre=${p.Comedy}${l}`},{key:`${e}-drama`,title:"Dramas",url:`${t}&type=movie&genre=${p.Drama}${l}`},{key:`${e}-thriller`,title:"Thrillers",url:`${t}&type=movie&genre=${p.Thriller}${l}`},{key:`${e}-romance`,title:"Romance",url:`${t}&type=movie&genre=${p.Romance}${l}`},{key:`${e}-horror`,title:"Horror Films",url:`${t}&type=movie&genre=${p.Horror}${l}`},{key:`${e}-scifi`,title:"Sci-Fi & Fantasy",url:`${t}&type=movie&genre=${p["Sci-Fi"]}${l}`},{key:`${e}-animation`,title:"Animated Movies",url:`${t}&type=movie&genre=${p.Animation}${l}`}]}async function It(e,t){e.innerHTML=`
      <div class="flex items-center gap-3 mb-3 px-1" data-rail-header>
        <div class="w-1 h-5 rounded-full" style="background: var(--accent, #ff6b00);"></div>
        ${t.logo?`<img src="https://image.tmdb.org/t/p/w92${t.logo}" class="w-8 h-8 rounded-md bg-white object-cover shadow-sm" alt="" />`:""}
        <h2 class="text-base sm:text-lg font-bold tracking-tight text-white">${t.title}</h2>
      </div>
      <div class="relative rail-wrap" data-rail-wrap>
        <button type="button" data-rail-prev aria-label="Scroll left" class="rail-arrow rail-arrow-left rail-arrow-hidden">
          <span class="rail-arrow-btn"><svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></span>
        </button>
        <div class="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-none rail-scroll" data-rail-content>
          ${Je()}
        </div>
        <button type="button" data-rail-next aria-label="Scroll right" class="rail-arrow rail-arrow-right rail-arrow-hidden">
          <span class="rail-arrow-btn"><svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></span>
        </button>
      </div>
    `;const a=e.querySelector("[data-rail-content]");Ye(a),Ge(e.querySelector("[data-rail-wrap]"),a);try{const s=await X(t.url);if(!s.ok)return console.warn(`[rail ${t.key}] HTTP ${s.status}`,t.url),e.style.display="none",!1;const n=await s.json();if(!n.ok)return console.warn(`[rail ${t.key}] API error`,n.error||"unknown"),e.style.display="none",!1;const i=n.items||[],o=i.filter(r=>r.poster);return o.length?(a.innerHTML=Xe(o,{ranked:t.ranked}),!0):(console.warn(`[rail ${t.key}] empty`,{url:t.url,rawCount:i.length,sample:i[0]}),e.style.display="none",!1)}catch(s){return console.warn(`[rail ${t.key}] fetch threw`,s),e.style.display="none",!1}}let fe=0,N=null;function St(){N&&clearTimeout(N),N=window.setTimeout(()=>{document.body.classList.add("rails-loading-active")},600)}function Ae(){N&&(clearTimeout(N),N=null),document.body.classList.remove("rails-loading-active")}async function Mt(e){const t=++fe,a=document.getElementById("rails-view"),s=e==="trending"?xt:e==="KDrama"?$t:e==="LatestRelease"?kt:e==="Kids"?Lt:Et(e);console.info(`[buildRails] platform=${e} reqId=${t} rails=${s.length}`),a.innerHTML=s.map(r=>`
      <section data-rail-key="${r.key}">
        <div class="flex items-center gap-3 mb-3 px-1">
          <div class="w-1 h-5 rounded-full" style="background: var(--accent, #ff6b00);"></div>
          <div class="h-4 w-40 bg-white/10 rounded animate-pulse"></div>
        </div>
        <div class="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-none rail-scroll">
          ${Je()}
        </div>
      </section>
    `).join("");const n=a.querySelectorAll("section[data-rail-key]");St();let i=!1;const o=()=>{i||(i=!0,Ae())};Array.from(n).forEach((r,u)=>{It(r,s[u]).then(o).catch(()=>{o()})}),window.setTimeout(()=>{fe===t&&Ae()},1e4),e==="trending"&&(mt(),aa(t))}function Ye(e){e.addEventListener("wheel",t=>{Math.abs(t.deltaX)>Math.abs(t.deltaY)&&Math.abs(t.deltaX)>1&&(e.scrollLeft+=t.deltaX,t.preventDefault())},{passive:!1})}function Ge(e,t){const a=e.querySelector("[data-rail-prev]"),s=e.querySelector("[data-rail-next]");if(!a||!s)return;const n=()=>{const o=t.scrollWidth-t.clientWidth;a.classList.toggle("rail-arrow-hidden",t.scrollLeft<=4),s.classList.toggle("rail-arrow-hidden",t.scrollLeft>=o-4||o<=0)},i=()=>Math.max(240,t.clientWidth*.8);a.addEventListener("click",()=>t.scrollBy({left:-i(),behavior:"smooth"})),s.addEventListener("click",()=>t.scrollBy({left:i(),behavior:"smooth"})),t.addEventListener("scroll",n,{passive:!0}),window.addEventListener("resize",n),setTimeout(n,60),setTimeout(n,400)}const w=document.getElementById("hero"),Qe=document.getElementById("hero-dots"),Z=document.getElementById("hero-loading"),U=document.getElementById("hero-title"),Tt=document.getElementById("hero-meta"),Bt=document.getElementById("hero-desc"),A=document.getElementById("hero-play"),W=document.getElementById("hero-cert"),k=document.getElementById("hero-logo");(function(){const t=document.getElementById("hero-hive");if(!t)return;const a=10,s=70,n=70,i=2;for(let o=-i;o<=i;o++)for(let r=Math.max(-i,-o-i);r<=Math.min(i,-o+i);r++){const u=s+a*Math.sqrt(3)*(o+r/2),x=n+a*1.5*r,$=(Math.abs(o)+Math.abs(r)+Math.abs(o+r))/2,f=document.createElement("div");f.className="hh",f.style.left=u+"px",f.style.top=x+"px",f.style.animationDelay=$*.16+"s",t.appendChild(f)}})();let h=JSON.parse(w.dataset.hero||"[]"),v=0,je;const Ct=document.getElementById("hero-prev"),At=document.getElementById("hero-next");function Ze(e){h.length<2||(M((v+e+h.length)%h.length),_())}Ct?.addEventListener("click",e=>{e.stopPropagation(),Ze(-1)});At?.addEventListener("click",e=>{e.stopPropagation(),Ze(1)});const V=new Map;function ue(){k&&k.classList.add("hidden"),U&&U.classList.remove("hidden")}async function et(e){if(!k||!U)return;const t=`${e.type}:${e.tmdbId}`;let a=V.get(t);if(a===void 0){ue();try{a=(await(await fetch(`/api/catalog/logo?type=${e.type}&id=${e.tmdbId}`)).json()).logo||null}catch{a=null}V.set(t,a)}const s=h[v];!s||`${s.type}:${s.tmdbId}`!==t||(a?(k.onload=()=>{const n=h[v];n&&`${n.type}:${n.tmdbId}`===t&&(k.classList.remove("hidden"),U.classList.add("hidden"))},k.onerror=()=>ue(),k.src=a,k.alt=e.title):ue())}async function tt(){for(const e of h){const t=`${e.type}:${e.tmdbId}`;if(!V.has(t))try{const s=await(await fetch(`/api/catalog/logo?type=${e.type}&id=${e.tmdbId}`)).json();V.set(t,s.logo||null)}catch{V.set(t,null)}}h[v]&&et(h[v])}const ae=new Map;function we(e){if(!e)return"";const t=e.toUpperCase().trim();return t==="A"?"A 18+":t==="UA"||t==="U/A"?"U/A 13+":t==="U"?"U":t==="S"?"A":e}async function jt(e){if(!W)return;const t=`${e.type}:${e.tmdbId}`;let a=ae.get(t);if(a===void 0){W.classList.add("hidden");try{a=(await(await fetch(`/api/catalog/cert?type=${e.type}&id=${e.tmdbId}`)).json()).cert||null}catch{a=null}ae.set(t,a)}const s=h[v];if(!s||`${s.type}:${s.tmdbId}`!==t)return;const n=we(a);n?(W.textContent=n,W.classList.remove("hidden")):W.classList.add("hidden")}async function Ht(e){if(!e||e.dataset.certDone)return;e.dataset.certDone="1";const t=e.getAttribute("data-cert-id"),a=e.getAttribute("data-cert-type");if(!t||!a)return;const s=`${a}:${t}`;let n=ae.get(s);if(n===void 0){try{n=(await(await fetch(`/api/catalog/cert?type=${a}&id=${t}`)).json()).cert||null}catch{n=null}ae.set(s,n)}const i=we(n);i&&(e.textContent=i,e.classList.remove("hidden"))}document.addEventListener("pointerover",e=>{const t=e.target.closest?.(".nm-card");if(!t)return;const a=t.querySelector(".nm-cert[data-cert-id]:not([data-cert-done])");a&&Ht(a)},{passive:!0});function Rt(){return w.querySelectorAll(".hero-bg")}function be(){return Qe.querySelectorAll(".hero-dot")}function M(e){if(!h[e])return;v=e,Rt().forEach((n,i)=>{n.style.opacity=i===e?"1":"0",n.style.zIndex=i===e?"2":"1"}),be().forEach((n,i)=>{n.classList.toggle("bg-white",i===e),n.classList.toggle("bg-white/30",i!==e),n.style.width=i===e?"16px":"8px"});const t=h[e];U.textContent=t.title,Tt.innerHTML=`
      ${t.rating?`<span class="px-1.5 py-0.5 rounded bg-yellow-400/90 text-black font-bold text-[11px]">⭐ ${t.rating.toFixed(1)}</span>`:""}
      <span>${t.year}</span>
      <span>·</span>
      <span class="uppercase tracking-wider">${t.type==="tv"?"Series":"Movie"}</span>
      <span class="px-1.5 py-0.5 rounded bg-white/15 text-[10px] tracking-wider">HD</span>
    `,Bt.textContent=t.overview,A&&(A.href="#",A.dataset.modal="watch",A.dataset.tmdbid=String(t.tmdbId),A.dataset.type=t.type,A.dataset.backdrop=t.backdrop);const a=document.getElementById("hero-info");a&&(a.dataset.modal="title",a.dataset.tmdbid=String(t.tmdbId),a.dataset.type=t.type);const s=document.getElementById("hero-click");s&&(s.dataset.tmdbid=String(t.tmdbId),s.dataset.type=t.type,s.setAttribute("aria-label",`More info for ${t.title}`)),et(t),jt(t)}function _(){h.length<2||(clearInterval(je),je=setInterval(()=>M((v+1)%h.length),6e3))}function at(e){if(!e.length)return;h=e,v=0,w.querySelectorAll(".hero-bg").forEach(s=>s.remove());const t=document.createDocumentFragment();e.forEach((s,n)=>{const i=document.createElement("div");i.className="hero-bg absolute inset-0 bg-cover bg-center transition-opacity duration-[1200ms]",i.style.backgroundImage=`url("${s.backdrop}")`,i.style.opacity=n===0?"1":"0",i.style.zIndex=String(10-n),t.appendChild(i)});const a=Array.from(w.children).find(s=>!(s instanceof HTMLElement)||!s.classList.contains("hero-bg"));a?w.insertBefore(t,a):w.appendChild(t),Qe.innerHTML=e.map((s,n)=>`<button data-hero-dot="${n}" aria-label="Show featured ${n+1}" class="hero-dot w-2 h-2 rounded-full bg-white/30 hover:bg-white/60 transition"></button>`).join(""),be().forEach((s,n)=>{s.addEventListener("click",()=>{M(n),_()})}),M(0),_(),tt()}async function Nt(e){Z.classList.remove("hidden"),Z.classList.add("flex");try{const t=e==="trending"||e==="LatestRelease"?"/api/catalog/hero":e==="KDrama"?"/api/catalog/hero?type=tv&country=KR":e==="Kids"?`/api/catalog/discover?type=movie&genre=10751&sort=popularity${l}`:`/api/catalog/hero?platform=${e}`,n=((await(await X(t)).json()).items||[]).slice(0,6).map(i=>({tmdbId:i.tmdbId,title:i.title,year:i.year,backdrop:i.backdrop,overview:i.overview,rating:i.rating,type:i.type||"movie"}));n.length&&at(n)}catch{}finally{Z.classList.add("hidden"),Z.classList.remove("flex")}}be().forEach((e,t)=>{e.addEventListener("click",()=>{M(t),_()})});M(0);_();tt();function Dt(){let t=null,a=null,s=!1;const n=(o,r)=>{t=o,a=r,s=!0},i=(o,r)=>{if(!s||t===null||a===null){s=!1,t=null,a=null;return}const u=o-t,x=r-a;if(s=!1,t=null,a=null,Math.abs(u)<50||Math.abs(x)>Math.abs(u)||!h.length)return;const $=u>0?(v-1+h.length)%h.length:(v+1)%h.length;M($),_()};w.addEventListener("touchstart",o=>{o.touches.length===1&&n(o.touches[0].clientX,o.touches[0].clientY)},{passive:!0}),w.addEventListener("touchend",o=>{const r=o.changedTouches[0];r&&i(r.clientX,r.clientY)},{passive:!0}),w.addEventListener("mousedown",o=>{o.target.closest("button, a, .hero-dot")||(n(o.clientX,o.clientY),o.preventDefault())}),window.addEventListener("mouseup",o=>{s&&i(o.clientX,o.clientY)})}Dt();const He=document.getElementById("home-header");if(He){const e=()=>He.classList.toggle("scrolled",window.scrollY>40);e(),window.addEventListener("scroll",e,{passive:!0})}const se=document.querySelectorAll(".platform-btn"),xe=document.getElementById("rails-view"),$e=document.getElementById("grid-view"),_t=document.getElementById("grid-title"),pe=document.getElementById("grid-meta"),ee=document.getElementById("grid-content");se.forEach(e=>{e.addEventListener("click",()=>{const t=e.dataset.platform,a=e.dataset.color;se.forEach(n=>{n.classList.remove("is-active","text-white"),n.classList.add("text-white/80")}),e.classList.add("is-active"),e.classList.remove("text-white/80");const s=a==="#000000"?"#3a3a3a":a;document.documentElement.style.setProperty("--accent",s),y.value&&(y.value="",J.classList.add("hidden")),$e.classList.add("hidden"),xe.classList.remove("hidden"),window.scrollTo({top:0,behavior:"smooth"}),Pt(t,Re),Re=!0})});let Re=!1;const Ne=new Map;async function Pt(e,t){let a=Ne.get(e);if(a===void 0){try{const n=await(await fetch(`/api/catalog/curated/${encodeURIComponent(e)}`,{cache:"no-store"})).json();a=n.hero?.length||n.rails?.length?n:null}catch{a=null}Ne.set(e,a)}a?.rails?.length?qt(a.rails):Mt(e),t&&(a?.hero?.length?at(a.hero.map(s=>({tmdbId:s.tmdbId,title:s.title,year:s.year,backdrop:s.backdrop,overview:s.overview||"",rating:s.rating,type:s.type||"movie"}))):Nt(e)),e==="trending"&&mt()}function qt(e){const t=document.getElementById("rails-view");t.innerHTML=e.map(a=>{const s=a.ranked?"w-40 sm:w-48":"w-[150px] sm:w-[200px] lg:w-[200px]",n=(a.items||[]).map((i,o)=>{const r=a.ranked?te(i,{rank:o+1}):te(i);return`<div class="shrink-0 ${s}">${r}</div>`}).join("");return`
        <section data-rail-key="${a.key}">
          <div class="flex items-center gap-3 mb-3 px-1">
            <div class="w-1 h-5 rounded-full" style="background: var(--accent, #ff6b00);"></div>
            ${a.logo?`<img src="https://image.tmdb.org/t/p/w92${a.logo}" class="w-8 h-8 rounded-md bg-white object-cover shadow-sm" alt="" />`:""}
            <h2 class="text-base sm:text-lg font-bold tracking-tight text-white">${a.title}</h2>
          </div>
          <div class="relative rail-wrap" data-rail-wrap>
            <button type="button" data-rail-prev aria-label="Scroll left" class="rail-arrow rail-arrow-left rail-arrow-hidden">
              <span class="rail-arrow-btn"><svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></span>
            </button>
            <div class="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-none rail-scroll" data-rail-content>
              ${n}
            </div>
            <button type="button" data-rail-next aria-label="Scroll right" class="rail-arrow rail-arrow-right rail-arrow-hidden">
              <span class="rail-arrow-btn"><svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg></span>
            </button>
          </div>
        </section>
      `}).join(""),t.querySelectorAll("[data-rail-wrap]").forEach(a=>{const s=a.querySelector("[data-rail-content]");s&&(Ye(s),Ge(a,s))})}const y=document.getElementById("search-input"),J=document.getElementById("search-clear"),ne=document.getElementById("hero"),ie=document.querySelector(".platform-btn")?.parentElement||null,oe=document.getElementById("app-cta-section"),re=document.getElementById("search-cta");function Ft(){ne&&ne.classList.add("hidden"),ie&&ie.classList.add("hidden"),oe&&oe.classList.add("hidden"),re&&re.classList.add("hidden"),xe.classList.add("hidden"),$e.classList.remove("hidden"),document.body.classList.add("nm-searching")}function st(){ne&&ne.classList.remove("hidden"),ie&&ie.classList.remove("hidden"),oe&&oe.classList.remove("hidden"),re&&re.classList.remove("hidden"),xe.classList.remove("hidden"),$e.classList.add("hidden"),document.body.classList.remove("nm-searching")}document.getElementById("search-cta-btn")?.addEventListener("click",()=>{window.scrollTo({top:0,behavior:"smooth"}),setTimeout(()=>y.focus(),300)});async function nt(e){if(e){Ft(),_t.textContent=`Search: "${e}"`,pe.textContent="Searching…",ee.innerHTML=Array.from({length:6}).map(()=>'<div class="aspect-[2/3] rounded-md bg-white/5 animate-pulse"></div>').join("");try{const s=(await(await X(`/api/catalog/search-hybrid?q=${encodeURIComponent(e)}`)).json()).items||[];if(!s.length){ee.innerHTML=`<div class="col-span-full text-white/50 text-sm p-8 text-center">No results for "${e}"</div>`,pe.textContent="0 results";return}ee.innerHTML=s.map(n=>te(n,{hideSoon:!0})).join(""),pe.textContent=`${s.length} results`}catch(t){ee.innerHTML=`<div class="col-span-full text-red-400 text-sm p-6 text-center">${t.message}</div>`}}}let De;y.addEventListener("input",()=>{clearTimeout(De);const e=y.value.trim();if(J.classList.toggle("hidden",!e),!e){st();return}De=setTimeout(()=>nt(e),300)});J.addEventListener("click",()=>{y.value="",J.classList.add("hidden"),st();const e=document.querySelector(".platform-btn.is-active");e?e.click():se[0].click()});const T=document.getElementById("search-overlay"),P=document.getElementById("so-input"),E=document.getElementById("so-results"),Wt=document.getElementById("so-go"),Kt=document.getElementById("so-close");let _e,me=0;function zt(e){const t=e.poster||H,a=e.backdrop&&e.backdrop.length>8?e.backdrop:t,s=(e.title||"").replace(/"/g,"&quot;"),n=e.type==="tv",i=e.rating?Math.round(e.rating*10):null;return`
      <a ${ve(e)} class="so-row group flex items-center gap-3 sm:gap-4 p-2 rounded-xl hover:bg-white/[0.07] transition">
        <div class="relative w-[104px] sm:w-[128px] aspect-video rounded-md overflow-hidden bg-white/5 shrink-0">
          <img src="${a}" loading="lazy" decoding="async" alt="${s}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='${t}'" />
          ${n?'<span class="absolute top-1 left-1 bg-black/70 backdrop-blur px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-semibold text-white/90">Series</span>':""}
          ${e.rating?`<span class="absolute bottom-1 right-1 bg-black/70 backdrop-blur px-1.5 py-0.5 rounded text-[9px] font-bold text-yellow-300 flex items-center gap-0.5"><svg class="w-2 h-2" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>${e.rating.toFixed(1)}</span>`:""}
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-[15px] sm:text-base font-semibold text-white line-clamp-1">${e.title}</div>
          <div class="text-xs mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            ${i?`<span class="text-green-400 font-medium">${i}% match</span>`:""}
            <span class="text-white/50">${e.year?e.year+" · ":""}${n?"Series":"Movie"}</span>
          </div>
        </div>
        <span class="shrink-0 w-9 h-9 rounded-full bg-white/[0.08] group-hover:bg-white flex items-center justify-center transition">
          <svg class="w-4 h-4 ml-0.5 text-white group-hover:text-black transition" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </span>
      </a>`}function Vt(e=""){T.classList.remove("hidden"),T.setAttribute("aria-hidden","false"),document.body.style.overflow="hidden",P.value=e,setTimeout(()=>P.focus(),30),e.trim()?it(e):E.innerHTML=""}function Y(){T.classList.add("hidden"),T.setAttribute("aria-hidden","true"),document.body.style.overflow="",y.blur()}async function it(e){if(e=e.trim(),!e){E.innerHTML="";return}const t=++me;E.innerHTML='<div class="text-white/50 text-sm p-4">Searching…</div>';try{const s=await(await fetch(`/api/catalog/search-hybrid?q=${encodeURIComponent(e)}`)).json();if(t!==me)return;const n=(s.items||[]).slice(0,16);if(!n.length){E.innerHTML=`<div class="text-white/50 text-sm p-8 text-center">No results for "${d(e)}"</div>`;return}E.innerHTML=`
        <div class="px-2 pt-1 pb-2 text-[11px] uppercase tracking-widest text-white/40 font-semibold">Top matches</div>
        ${n.slice(0,6).map(zt).join("")}
        <div class="text-center pt-3 pb-1">
          <button type="button" id="so-see-all" class="inline-flex items-center gap-1.5 text-sm font-medium text-white/85 bg-white/[0.06] border border-white/10 rounded-full px-5 py-2 hover:bg-white/10 active:scale-95 transition">
            See all results for &ldquo;${d(e)}&rdquo;
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </button>
        </div>`,document.getElementById("so-see-all")?.addEventListener("click",ke)}catch(a){t===me&&(E.innerHTML=`<div class="text-red-400 text-sm p-4">${a.message}</div>`)}}function ke(){const e=P.value.trim();e&&(y.value=e,J.classList.remove("hidden"),Y(),nt(e))}P.addEventListener("input",()=>{clearTimeout(_e),_e=setTimeout(()=>it(P.value),250)});P.addEventListener("keydown",e=>{e.key==="Enter"&&(e.preventDefault(),ke())});Wt.addEventListener("click",ke);Kt.addEventListener("click",Y);T.addEventListener("click",e=>{e.target===T&&Y()});E.addEventListener("click",e=>{e.target.closest(".so-row")&&Y()});document.addEventListener("keydown",e=>{e.key==="Escape"&&!T.classList.contains("hidden")&&Y()});y.addEventListener("focus",()=>Vt(y.value));se[0].click();const m=document.getElementById("title-modal"),D=document.getElementById("title-modal-body"),Ot=document.getElementById("title-modal-close"),b=document.getElementById("watch-modal"),le=document.getElementById("watch-modal-iframe"),Ut=document.getElementById("watch-modal-close"),B=document.getElementById("trailer-modal"),ot=document.getElementById("trailer-modal-iframe"),Jt=document.getElementById("trailer-modal-close"),I=[];let O=null;function ce(){document.body.style.overflow="hidden"}function Le(){document.body.style.overflow=""}function rt(e,t,a=!0){O&&(clearTimeout(O),O=null),a&&I.push({tmdbId:e,type:t}),m.classList.remove("hidden"),m.classList.add("flex"),m.setAttribute("aria-hidden","false"),requestAnimationFrame(()=>m.classList.add("nm-modal-in")),ce(),D.innerHTML=`
      <div class="aspect-video bg-white/5 animate-pulse"></div>
      <div class="p-6 space-y-3">
        <div class="h-8 w-3/4 bg-white/10 rounded animate-pulse"></div>
        <div class="h-4 w-1/2 bg-white/5 rounded animate-pulse"></div>
        <div class="h-3 w-full bg-white/5 rounded animate-pulse"></div>
        <div class="h-3 w-5/6 bg-white/5 rounded animate-pulse"></div>
      </div>
    `,m.scrollTop=0,ye(e,t),lt(e,t)}function lt(e,t){try{const n=`nm:embed:${e}:${t}:1:1`,i=sessionStorage.getItem(n);if(i)try{const o=JSON.parse(i);if(o&&Date.now()-o.at<6*6e4)return}catch{}fetch(`/api/embed-tmdb/${e}?type=${t}&se=1&ep=1`).then(o=>o.ok?o.json():null).then(o=>{if(o&&o.ok)try{sessionStorage.setItem(n,JSON.stringify({at:Date.now(),data:o}))}catch{}}).catch(()=>{})}catch{}}function G(){m.setAttribute("aria-hidden","true"),I.length=0,m.classList.remove("nm-modal-in"),O=window.setTimeout(()=>{O=null,m.classList.add("hidden"),m.classList.remove("flex"),D.innerHTML="";const e=document.getElementById("title-modal-header-title");e&&(e.textContent=""),Le()},300)}function Xt(){I.pop();const e=I[I.length-1];if(!e){G();return}I.pop(),rt(e.tmdbId,e.type)}const j=document.getElementById("watch-modal-backdrop");function ct(e){e?j.style.backgroundImage=`url("${e}")`:j.style.backgroundImage="",j.style.opacity="1",j.style.display="block"}function dt(){j.style.opacity="0",setTimeout(()=>{j.style.display="none"},500)}function Yt(e,t,a,s){let n=`#w=${e}-${t}`;return a&&(n+=`-${a}`),s&&(n+=`-${s}`),n}function Ee(){const e=location.hash.match(/^#w=(\d+)-(movie|tv)(?:-(\d+)(?:-(\d+))?)?$/);return e?{tmdbId:e[1],type:e[2],se:e[3]||void 0,ep:e[4]||void 0}:null}function Ie(e,t,a,s,n){const i=new URLSearchParams({type:t});a&&i.set("se",a),s&&i.set("ep",s),ct(n),le.src=`/watch-tmdb/${e}?${i.toString()}`,b.classList.remove("hidden"),b.setAttribute("aria-hidden","false"),ce()}function ut(){le.src="about:blank",b.classList.add("hidden"),b.setAttribute("aria-hidden","true"),dt(),m.classList.contains("hidden")&&Le()}function Gt(e,t,a,s){ct(a);const n=new URLSearchParams({type:t});s?.title&&n.set("title",s.title),s?.year&&n.set("year",s.year),s?.poster&&n.set("poster",s.poster),le.src=`/watch-direct/${e}?${n.toString()}`,b.classList.remove("hidden"),b.setAttribute("aria-hidden","false"),ce()}function Qt(e,t,a,s,n){Ie(e,t,a,s,n);const i=Yt(e,t,a,s);location.hash!==i&&history.pushState({watch:{tmdbId:e,type:t,se:a,ep:s}},"",i)}function Se(){if(Ee())try{history.replaceState(null,"",location.pathname+location.search)}catch{}ut()}window.addEventListener("popstate",()=>{const e=Ee(),t=!b.classList.contains("hidden");e&&!t?Ie(e.tmdbId,e.type,e.se,e.ep):!e&&t&&ut()});(function(){const t=Ee();t&&Ie(t.tmdbId,t.type,t.se,t.ep)})();le.addEventListener("load",()=>{setTimeout(dt,400)});function Zt(e){ot.src=`https://www.youtube.com/embed/${e}?autoplay=1&rel=0`,B.classList.remove("hidden"),B.classList.add("flex"),ce()}function Me(){ot.src="",B.classList.add("hidden"),B.classList.remove("flex"),m.classList.contains("hidden")&&b.classList.contains("hidden")&&Le()}async function ye(e,t,a=0){try{const s=await X(`/api/catalog/title/${t}/${e}`);if(!s.ok)throw new Error("status "+s.status);const n=await s.json();ea(n,e,t)}catch{if(a<8){const n=Math.min(1e3*Math.pow(1.5,a),3e4);setTimeout(()=>ye(e,t,a+1),n);return}D.innerHTML=`
        <div class="p-8 text-center">
          <div class="text-xl font-bold mb-2">Couldn't load details</div>
          <div class="text-sm text-white/60 mb-4">TMDB is having a moment. Try again in a bit.</div>
          <button id="title-retry" class="px-4 py-2 rounded-md bg-white text-black text-sm font-semibold">Retry</button>
        </div>
      `,document.getElementById("title-retry")?.addEventListener("click",()=>{ye(e,t,0)})}}function d(e){return(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function Pe(e,t,a,s){return e.map(n=>{const i=n.still?`<img src="${n.still}" alt="${d(n.name)}" class="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`:'<div class="absolute inset-0 flex items-center justify-center text-white/20 text-3xl">📺</div>',o=n.runtime>0?`<div class="absolute bottom-1.5 right-1.5 bg-black/85 px-1.5 py-0.5 rounded text-[10px] font-medium text-white/90">${n.runtime}m</div>`:"";return`
        <a href="#" data-modal="watch" data-tmdbid="${t}" data-type="tv"
          data-se="${a}" data-ep="${n.episode}"
          data-backdrop="${n.still||s||""}"
          class="episode group flex items-stretch gap-3 sm:gap-4 p-2 sm:p-3 rounded-lg hover:bg-white/5 transition cursor-pointer">

          <!-- Big bold episode number (Netflix-style) — visual anchor -->
          <div class="shrink-0 w-8 sm:w-10 flex items-start justify-center pt-1">
            <span class="text-2xl sm:text-3xl font-black text-white/40 group-hover:text-white transition leading-none tabular-nums">${n.episode}</span>
          </div>

          <!-- Thumbnail with play-on-hover overlay -->
          <div class="relative aspect-video w-32 sm:w-48 shrink-0 rounded-md overflow-hidden bg-white/5 ring-1 ring-white/5 group-hover:ring-white/20 transition">
            ${i}
            ${o}
            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-center justify-center">
              <div class="w-10 h-10 rounded-full bg-white/95 flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-2xl">
                <svg class="w-5 h-5 text-black" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </div>
            </div>
          </div>

          <!-- Title + description -->
          <div class="flex-1 min-w-0 py-1">
            <div class="flex items-baseline justify-between gap-2 mb-1">
              <h4 class="font-semibold text-sm sm:text-base text-white truncate">${d(n.name)}</h4>
              ${n.airDate?`<span class="shrink-0 text-[10px] sm:text-xs text-white/40 font-medium tabular-nums">${d(n.airDate)}</span>`:""}
            </div>
            <p class="text-xs sm:text-sm text-white/60 line-clamp-2 leading-snug">${d(n.overview||"No description available.")}</p>
          </div>
        </a>
      `}).join("")}function ea(e,t,a){const s=document.getElementById("title-modal-header-title");s&&(s.textContent=e.title||"");const n=e.type==="tv",i=e.runtime?`${Math.floor(e.runtime/60)}h ${e.runtime%60}m`:"",o=e.rating&&e.rating>0?`<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-yellow-400/90 text-black font-bold text-[11px]"><svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>${e.rating.toFixed(1)}</span>`:"",r=e.rating&&e.rating>0?Math.round(e.rating*10):null,u=we(e.certification?.rating||e.cert||null),x=u?`<span class="px-1.5 py-0.5 rounded border border-white/45 text-[10px] tracking-wide">${d(u)}</span>`:"",$=(e.cast||[]).slice(0,4).map(c=>d(c.name)).join(", ")+((e.cast||[]).length>4?", more":""),f=(e.genres||[]).map(c=>d(c.name)).join(", ");(e.genres||[]).map(c=>`<span class="px-2.5 py-0.5 rounded-full bg-white/10 text-[11px] text-white/80 border border-white/10">${d(c.name)}</span>`).join("");const q=(e.cast||[]).map(c=>`
      <div class="shrink-0 w-20 sm:w-24">
        <div class="aspect-square rounded-full overflow-hidden bg-white/5 mb-1.5">
          ${c.photo?`<img src="${c.photo}" alt="${d(c.name)}" class="w-full h-full object-cover" loading="lazy" decoding="async" />`:'<div class="w-full h-full flex items-center justify-center text-white/30 text-2xl">👤</div>'}
        </div>
        <div class="text-[11px] font-semibold line-clamp-1">${d(c.name)}</div>
        <div class="text-[10px] text-white/50 line-clamp-1">${d(c.character)}</div>
      </div>
    `).join(""),Te=(e.recommendations||[]).map(c=>`
      <a href="#" data-modal="title" data-tmdbid="${c.tmdbId}" data-type="${c.type}" class="shrink-0 w-24 sm:w-28 group">
        <div class="aspect-[2/3] rounded-md overflow-hidden bg-white/5 ring-1 ring-white/5 group-hover:ring-2 group-hover:ring-white transition">
          <img src="${c.poster}" alt="${d(c.title)}" class="w-full h-full object-cover" loading="lazy" decoding="async" />
        </div>
        <div class="mt-1.5 text-xs line-clamp-1">${d(c.title)}</div>
        <div class="text-[10px] text-white/50">${d(c.year)}</div>
      </a>
    `).join("");let Be="";if(n){const c=e.seasons||[],g=e.initialSeason||1,F=(e.initialEpisodes||[]).length,Ce=c.find(L=>L.season_number===g),vt=Ce?d(Ce.name)||`Season ${g}`:`Season ${g}`,ft=c.map(L=>`<option value="${L.season_number}" ${L.season_number===g?"selected":""}>${d(L.name)||`Season ${L.season_number}`} · ${L.episode_count} ep</option>`).join(""),yt=Pe(e.initialEpisodes||[],t,g,e.backdrop);Be=`
        <section class="mt-8">
          <!-- Section header with prominent season picker (Netflix style) -->
          <div class="flex items-baseline justify-between gap-3 mb-4">
            <div class="flex items-center gap-2.5">
              <div class="w-1 h-5 rounded-full bg-[color:var(--color-brand)]"></div>
              <h3 class="text-lg sm:text-xl font-bold tracking-tight">Episodes</h3>
              <span class="text-xs text-white/40 ml-1">${F} episodes</span>
            </div>
            ${c.length>1?`
              <div class="relative">
                <select id="modal-season-select" data-tmdbid="${t}"
                  class="appearance-none pl-3 pr-8 py-2 rounded-md bg-white/10 border border-white/15 text-sm font-semibold focus:outline-none focus:border-white/40 hover:bg-white/15 transition cursor-pointer">
                  ${ft}
                </select>
                <svg class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </div>
            `:`
              <span class="text-xs text-white/50 font-semibold">${d(vt)}</span>
            `}
          </div>
          <!-- Single-column episode list (matches Netflix's "Episodes" tab) -->
          <div id="modal-episode-list" data-current-season="${g}" class="space-y-2">
            ${yt}
          </div>
        </section>
      `}const gt=I.length>1,Q=e.catalog||null;D.innerHTML=`
      <!-- Hero backdrop -->
      <div class="relative">
        <div class="aspect-video sm:aspect-[21/9] overflow-hidden bg-zinc-900">
          ${e.backdrop?`<img src="${e.backdrop}" alt="" class="w-full h-full object-cover" referrerpolicy="no-referrer" />`:""}
          <div class="absolute inset-0 bg-gradient-to-t from-[#15151c] via-[#15151c]/40 to-transparent"></div>
        </div>
        ${gt?`
          <button id="title-modal-back" type="button"
            class="absolute top-3 left-3 z-20 w-9 h-9 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur flex items-center justify-center text-white transition"
            aria-label="Back">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>`:""}

        <!-- Title + CTAs (overlap into the hero gradient) -->
        <div class="absolute inset-x-0 bottom-0 p-4 sm:p-6">
          <div class="flex flex-col sm:flex-row gap-4 items-end">
            ${e.poster?`
              <img src="${e.poster}" alt="${d(e.title)}"
                class="hidden sm:block w-28 lg:w-32 aspect-[2/3] object-cover rounded-md shadow-2xl ring-1 ring-white/10 shrink-0"
                referrerpolicy="no-referrer" />
            `:""}
            <div class="flex-1 min-w-0">
              <h2 class="text-2xl sm:text-3xl md:text-4xl font-black leading-tight mb-2 tracking-tight"
                  style="text-shadow: 0 2px 16px rgba(0,0,0,0.7);">${d(e.title)}</h2>
              ${e.tagline?`<p class="text-xs sm:text-sm text-white/70 italic mb-2 line-clamp-1">${d(e.tagline)}</p>`:""}
              <div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-white/85 font-medium">
                ${r?`<span class="text-green-400 font-semibold">${r}% match</span>`:""}
                ${e.year?`<span>${d(e.year)}</span>`:""}
                ${x}
                ${n&&(e.seasons||[]).length?`<span>${e.seasons.length} season${e.seasons.length!==1?"s":""}</span>`:""}
                ${i?`<span>${i}</span>`:""}
                <span class="px-1.5 py-0.5 rounded bg-white/15 text-[10px] tracking-wider">HD</span>
                ${o}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Body content -->
      <div class="p-4 sm:p-6">
        <div class="flex flex-wrap gap-2 mb-4">
          <!-- Always a Watch Now CTA — even titles missing from Server 1's
               catalog (comingSoon) are playable via Server 2, so the watch
               flow (Server 1 → Server 2 fallback) handles them. -->
          <button type="button" data-modal="watch" data-tmdbid="${t}" data-type="${a}"
            data-backdrop="${e.backdrop||""}"
            ${n?`data-se="${e.initialSeason||1}" data-ep="1"`:""}
            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-white text-black font-bold hover:bg-white/90 active:scale-95 transition text-sm shadow-xl">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            ${n?`Play S${e.initialSeason||1} E1`:"Watch Now"}
          </button>
          <!-- Watchlist toggle — wired below; defaults to "+" then async-checks
               whether title is in user's list (only if signed in). -->
          <button type="button" id="watchlist-btn"
            data-tmdbid="${t}" data-type="${a}" data-title="${d(e.title)}"
            data-poster="${e.poster||""}" data-year="${d(e.year||"")}"
            class="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-white/15 backdrop-blur text-white font-semibold hover:bg-white/25 active:scale-95 transition text-sm border border-white/10">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span id="watchlist-btn-label">Watchlist</span>
          </button>
          ${e.trailerKey?`
            <button type="button" data-modal="trailer" data-yt="${e.trailerKey}"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-white/15 backdrop-blur text-white font-semibold hover:bg-white/25 active:scale-95 transition text-sm border border-white/10">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              Trailer
            </button>`:""}
        </div>

        <!-- Netflix-style two-column info: description + cast/genres sidebar -->
        ${e.overview||$||f?`
          <div class="flex flex-col sm:flex-row gap-4 sm:gap-8 mb-2">
            <div class="flex-1 min-w-0">
              ${e.overview?`<p class="text-sm text-white/90 leading-relaxed">${d(e.overview)}</p>`:""}
            </div>
            <div class="w-full sm:w-60 shrink-0 text-[13px] leading-relaxed space-y-2">
              ${$?`<div><span class="text-white/45">Cast: </span><span class="text-white/85">${$}</span></div>`:""}
              ${f?`<div><span class="text-white/45">Genres: </span><span class="text-white/85">${f}</span></div>`:""}
            </div>
          </div>
        `:""}

        <!-- Netflix-style audio-language bar — horizontal, slidable, active tab -->
        ${Q&&Array.isArray(Q.audioLangs)&&Q.audioLangs.length?`
          <div class="mt-1 mb-4">
            <div class="text-[11px] uppercase tracking-wider font-semibold text-white/40 mb-2">Audio</div>
            <div class="nm-audio-bar flex gap-6 overflow-x-auto scrollbar-none">
              ${Q.audioLangs.map((c,g)=>`
                <button type="button" class="nm-lang-tab shrink-0${g===0?" nm-lang-active":""}">${d(c)}</button>
              `).join("")}
            </div>
          </div>
        `:""}

        ${Be}

        ${q?`
          <section class="mt-8">
            <div class="flex items-center gap-2.5 mb-3">
              <div class="w-1 h-5 rounded-full bg-[color:var(--color-brand)]"></div>
              <h3 class="text-lg sm:text-xl font-bold tracking-tight">Cast</h3>
            </div>
            <div class="flex gap-3 overflow-x-auto scrollbar-none pb-2">${q}</div>
          </section>
        `:""}

        ${Te?`
          <section class="mt-8">
            <div class="flex items-center gap-2.5 mb-3">
              <div class="w-1 h-5 rounded-full bg-[color:var(--color-brand)]"></div>
              <h3 class="text-lg sm:text-xl font-bold tracking-tight">More Like This</h3>
            </div>
            <div class="flex gap-3 overflow-x-auto scrollbar-none pb-2">${Te}</div>
          </section>
        `:""}
      </div>
    `,m.scrollTop=0,requestAnimationFrame(()=>{m.scrollTop=0,requestAnimationFrame(()=>{m.scrollTop=0})}),console.info("[title-modal] scrolled to top, height=",m.scrollHeight),document.getElementById("title-modal-back")?.addEventListener("click",Xt),ta(),D.querySelectorAll(".nm-lang-tab").forEach(c=>{c.addEventListener("click",()=>{D.querySelectorAll(".nm-lang-tab").forEach(g=>g.classList.remove("nm-lang-active")),c.classList.add("nm-lang-active")})});const de=document.getElementById("modal-season-select"),C=document.getElementById("modal-episode-list");de&&C&&de.addEventListener("change",async()=>{const c=Number(de.value);C.innerHTML=Array.from({length:6}).map(()=>`
          <div class="flex items-stretch gap-3 sm:gap-4 p-2 sm:p-3">
            <div class="shrink-0 w-8 sm:w-10 h-8 bg-white/5 rounded animate-pulse"></div>
            <div class="aspect-video w-32 sm:w-48 shrink-0 rounded-md bg-white/5 animate-pulse"></div>
            <div class="flex-1 min-w-0 py-1 space-y-2">
              <div class="h-4 w-3/5 bg-white/5 rounded animate-pulse"></div>
              <div class="h-3 w-full bg-white/5 rounded animate-pulse"></div>
              <div class="h-3 w-4/5 bg-white/5 rounded animate-pulse"></div>
            </div>
          </div>
        `).join("");try{const F=await(await X(`/api/catalog/season/${t}/${c}`)).json();if(!F.ok||!F.episodes?.length){C.innerHTML='<div class="col-span-full text-white/50 text-sm p-6 text-center">No episodes found.</div>';return}C.dataset.currentSeason=String(c),C.innerHTML=Pe(F.episodes,t,c,e.backdrop)}catch{C.innerHTML='<div class="col-span-full text-red-400 text-sm p-6 text-center">Failed to load episodes.</div>'}})}let K=null;async function pt(){if(!window.__AUTH_ENABLED__)return!1;if(K)return K.signedIn;try{return K={signedIn:!!(await(await fetch("/api/auth/me",{cache:"no-store"})).json()).user},K.signedIn}catch{return K={signedIn:!1},!1}}async function ta(){const e=document.getElementById("watchlist-btn"),t=document.getElementById("watchlist-btn-label");if(!e||!t)return;const a=e.dataset.tmdbid,s=e.dataset.type||"movie",n=e.dataset.title||"",i=e.dataset.poster||"",o=e.dataset.year||"";if(!await pt()){window.__AUTH_ENABLED__?e.addEventListener("click",()=>{window.location.href="/login?next=/"}):e.style.display="none";return}let u=!1;try{u=((await(await fetch("/api/library/watchlist",{cache:"no-store"})).json()).items||[]).some(q=>q.tmdbId===Number(a)&&q.type===s)}catch{}const x=()=>{t.textContent=u?"Saved ✓":"Watchlist",u?(e.classList.remove("bg-white/15"),e.classList.add("bg-[color:var(--color-brand)]/30")):(e.classList.add("bg-white/15"),e.classList.remove("bg-[color:var(--color-brand)]/30"))};x(),e.addEventListener("click",async()=>{e.disabled=!0;try{u?(await fetch(`/api/library/watchlist?tmdbId=${a}&mediaType=${s}`,{method:"DELETE"}),u=!1):(await fetch("/api/library/watchlist",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({tmdbId:Number(a),mediaType:s,title:n,poster:i,year:o})}),u=!0),x()}catch{}finally{e.disabled=!1}})}async function aa(e){try{const t=await fetch("/api/catalog/aoneroom-home",{cache:"default"});if(!t.ok)return;const a=await t.json(),s=Array.isArray(a?.rails)?a.rails:[];if(!s.length||e!==fe)return;const n=document.getElementById("rails-view");if(!n)return;const i=r=>String(r??"").replace(/[<>&"]/g,u=>({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"})[u]||u),o=s.map((r,u)=>`
        <section data-rail-key="ao-${u}" data-ao-native="1">
          <div class="flex items-center gap-3 mb-3 px-1">
            <div class="w-1 h-5 rounded-full" style="background: var(--accent, #ff6b00);"></div>
            <h2 class="text-base sm:text-lg font-bold tracking-tight text-white">${i(r.title)}</h2>
          </div>
          <div class="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-none rail-scroll">
            ${Xe(r.items||[])}
          </div>
        </section>`).join("");n.insertAdjacentHTML("afterbegin",o)}catch{}}async function mt(){if(await pt())try{const s=((await(await fetch("/api/library/history?continueWatching=1",{cache:"no-store"})).json()).items||[]).slice(0,12);if(!s.length)return;const n=document.getElementById("rails-view");if(!n)return;const i=`
        <section data-rail-key="continue-watching">
          <div class="flex items-center gap-3 mb-3 px-1">
            <div class="w-1 h-5 rounded-full" style="background: var(--accent, #ff6b00);"></div>
            <h2 class="text-base sm:text-lg font-bold tracking-tight text-white">Continue Watching</h2>
          </div>
          <div class="flex gap-3 overflow-x-auto pb-3 scrollbar-none rail-scroll">
            ${s.map(o=>sa(o)).join("")}
          </div>
        </section>
      `;n.insertAdjacentHTML("afterbegin",i)}catch{}}function sa(e){const t=e.poster||H,a=(e.title||"").replace(/"/g,"&quot;"),s=e.season>0?`<div class="absolute top-1.5 left-1.5 z-10 bg-black/85 backdrop-blur px-1.5 py-0.5 rounded text-[10px] font-bold">S${e.season} E${e.episode||1}</div>`:"",n=e.progressPercent>0?`<div class="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
           <div class="h-full" style="width: ${e.progressPercent}%; background: var(--color-brand);"></div>
         </div>`:"";return e.season>0&&`${e.season}${e.episode||1}`,`
      <div class="shrink-0 w-32 sm:w-40 relative continue-card group/wrap">
        <a href="#" data-modal="watch" data-tmdbid="${e.tmdbId}" data-type="${e.type}"
          ${e.season>0?`data-se="${e.season}" data-ep="${e.episode||1}"`:""}
          data-backdrop="${e.backdrop||e.poster||""}"
          class="card group block" title="${a}">
          <div class="relative aspect-[2/3] rounded-md overflow-hidden bg-white/5 ring-1 ring-white/5 group-hover:ring-2 group-hover:ring-white transition-all duration-200 group-hover:scale-[1.04]">
            <img src="${t}" loading="lazy" decoding="async" alt="${a}" class="w-full h-full object-cover" referrerpolicy="no-referrer" onerror="this.src='${H}'" />
            ${s}
            <button
              data-cw-remove
              data-tmdbid="${e.tmdbId}"
              data-type="${e.type}"
              data-season="${e.season||0}"
              data-episode="${e.episode||0}"
              title="Remove from Continue Watching"
              aria-label="Remove from Continue Watching"
              class="absolute top-1.5 right-1.5 z-20 w-7 h-7 rounded-full bg-black/80 backdrop-blur flex items-center justify-center text-white/90 hover:bg-red-600 hover:text-white opacity-0 group-hover/wrap:opacity-100 focus:opacity-100 transition-opacity duration-150"
              style="-webkit-tap-highlight-color: transparent;"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
            <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <div class="w-10 h-10 rounded-full bg-white/95 flex items-center justify-center shadow-2xl">
                <svg class="w-5 h-5 text-black" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </div>
            </div>
            ${n}
          </div>
          <div class="mt-2 px-0.5">
            <div class="text-xs font-medium text-white/90 line-clamp-1">${a}</div>
            <div class="text-[10px] text-white/50">${e.season>0?`S${e.season}·E${e.episode||1}`:e.type==="tv"?"Series":"Movie"}</div>
          </div>
        </a>
      </div>
    `}document.addEventListener("click",async e=>{const a=e.target.closest("[data-cw-remove]");if(!a)return;e.preventDefault(),e.stopPropagation();const s=a.dataset.tmdbid,n=a.dataset.type||"movie",i=a.dataset.season||"0",o=a.dataset.episode||"0";if(!s)return;const r=a.closest(".continue-card");r&&(r.style.transition="opacity 150ms, transform 150ms",r.style.opacity="0",r.style.transform="scale(0.85)",setTimeout(()=>r.remove(),160));try{await fetch(`/api/library/history?tmdbId=${encodeURIComponent(s)}&mediaType=${encodeURIComponent(n)}&season=${i}&episode=${o}`,{method:"DELETE",cache:"no-store"})}catch{}});document.addEventListener("click",e=>{const a=e.target.closest("[data-modal]");if(!a)return;const s=a.dataset.modal;if(s){if(s==="title"){const n=a.dataset.tmdbid,i=a.dataset.type||"movie";if(!n)return;e.preventDefault(),rt(n,i)}else if(s==="watch"){const n=a.dataset.subject,i=a.dataset.tmdbid,o=a.dataset.type||"movie";e.preventDefault(),n?Gt(n,o,a.dataset.backdrop,{title:a.dataset.title,year:a.dataset.year,poster:a.dataset.poster}):i&&Qt(i,o,a.dataset.se,a.dataset.ep,a.dataset.backdrop)}else if(s==="trailer"){const n=a.dataset.yt;if(!n)return;e.preventDefault(),Zt(n)}}});let qe,Fe="";function ht(e){const t=e.target?.closest("[data-modal][data-tmdbid]"),a=t?.dataset.tmdbid;if(!a)return;const s=t.dataset.type||"movie",n=`${a}:${s}`;n!==Fe&&(window.clearTimeout(qe),qe=window.setTimeout(()=>{Fe=n,lt(a,s)},200))}document.addEventListener("pointerover",ht,{passive:!0});document.addEventListener("touchstart",ht,{passive:!0});Ot.addEventListener("click",G);const We=document.getElementById("title-modal-back");We&&We.addEventListener("click",G);Ut.addEventListener("click",Se);Jt.addEventListener("click",Me);m.addEventListener("click",e=>{e.target===m&&G()});B.addEventListener("click",e=>{e.target===B&&Me()});document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(!B.classList.contains("hidden")){Me();return}if(!b.classList.contains("hidden")){Se();return}if(!m.classList.contains("hidden")){G();return}}});window.addEventListener("message",e=>{e.data==="netmirror:close-watch"&&Se()});const Ke=document.getElementById("home-user-root"),ze=document.getElementById("home-user-btn"),he=document.getElementById("home-user-menu");Ke&&ze&&he&&(ze.addEventListener("click",e=>{e.stopPropagation(),he.classList.toggle("hidden")}),document.addEventListener("click",e=>{Ke.contains(e.target)||he.classList.add("hidden")}));
