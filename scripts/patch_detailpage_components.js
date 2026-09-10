const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const filesToPatch = [
  path.join(ROOT, 'js', 'DetailPage-WPhzSGyt.js'),
  path.join(ROOT, 'assets', 'DetailPage-WPhzSGyt.js')
];

for (const fPath of filesToPatch) {
  if (!fs.existsSync(fPath)) continue;
  console.log('Patching DetailPage file:', fPath);
  let content = fs.readFileSync(fPath, 'utf8');

  // ========================================================================
  // 1. UPDATE ze (Player Component):
  // - URL season & episode persistence (?season=X&episode=Y)
  // - Dedicated player section
  // - Server failure state: "This server is currently unavailable." + in-place alternatives
  // - Sticky streaming controls bar when scrolled past player
  // ========================================================================
  const oldZeIdx = content.indexOf('function ze({');
  const oldPeIdx = content.indexOf('function Pe({');

  if (oldZeIdx !== -1 && oldPeIdx !== -1) {
    const newZeCode = `function ze({id:s,imdbId:i,tmdbId:tmdb,type:a,title:n,poster:d,backdrop:x,links:Y_links}){
  const hasCloud=!!(Y_links&&Y_links.length>0);
  const activeG=[
    {id:"allmovieland",name:"Server 1 (AllMovieLand)",label:"Server 1"},
    ...(hasCloud?[{id:"hicine",name:"Server 2 (Fast Cloud)",label:"Fast Cloud"}]:[]),
    {id:"vidlink",name:"Server 3 (VidLink)",label:"Server 2"},
    {id:"vidsrcme",name:"Server 4 (VidSrc)",label:"Server 3"}
  ];
  const[c,f]=l.useState("allmovieland");
  // Read season and episode from URL query params (Requirement 14)
  const[o,b]=l.useState(()=>{
    if(typeof window!=="undefined"){
      const sp=new URLSearchParams(window.location.search);
      const sv=parseInt(sp.get("season")||sp.get("s"));
      if(!isNaN(sv)&&sv>0) return sv;
    }
    return 1;
  });
  const[r,g]=l.useState(()=>{
    if(typeof window!=="undefined"){
      const sp=new URLSearchParams(window.location.search);
      const ev=parseInt(sp.get("episode")||sp.get("ep")||sp.get("e"));
      if(!isNaN(ev)&&ev>0) return ev;
    }
    return 1;
  });
  const[v,w]=l.useState([]);
  const[u,j]=l.useState([]);
  const[k,y]=l.useState(!1);
  const[p,_]=l.useState(!1);
  const[$,R]=l.useState(!1);
  const[L,N]=l.useState(!0);
  const[I,E]=l.useState(!1);
  const[resolvedTmdb,setResolvedTmdb]=l.useState(tmdb||"");
  const[resolvedImdb,setResolvedImdb]=l.useState(i||"");
  const[isStickyVisible,setIsStickyVisible]=l.useState(!1);
  const S=l.useRef(null);
  const z=l.useRef(null);
  const{updateProgress:P,getProgress:se}=ye();
  const h=Ie(a);

  l.useEffect(()=>{f("allmovieland");},[s]);
  l.useEffect(()=>{
    N(!0);E(!1);
    const t=setTimeout(()=>{N(m=>(m&&E(!0),!1));},1e4);
    return()=>clearTimeout(t);
  },[c,o,r]);

  // Sync season and episode state to URL without full reload (Requirement 14)
  l.useEffect(()=>{
    if(!h||typeof window==="undefined") return;
    try{
      const url=new URL(window.location.href);
      if(url.searchParams.get("season")!==String(o)||url.searchParams.get("episode")!==String(r)){
        url.searchParams.set("season",String(o));
        url.searchParams.set("episode",String(r));
        window.history.replaceState(window.history.state,"",url.toString());
      }
    }catch(e){}
  },[o,r,h]);

  // Listen to external episode selection (e.g. from Download Section)
  l.useEffect(()=>{
    const onSelectEp=ev=>{
      if(ev.detail){
        if(ev.detail.season) b(ev.detail.season);
        if(ev.detail.episode) g(ev.detail.episode);
      }
    };
    window.addEventListener("flix_select_episode",onSelectEp);
    return ()=>window.removeEventListener("flix_select_episode",onSelectEp);
  },[]);

  l.useEffect(()=>{
    if(!h) return;
    const t=se(s);
    if(t?.season&&!window.location.search.includes("season")) b(t.season);
    if(t?.episode&&!window.location.search.includes("episode")) g(t.episode);
  },[s]);

  l.useEffect(()=>{h&&Ne(s).then(t=>w(t));},[s,h]);
  const D=l.useCallback(async t=>{
    if(!h) return;
    y(!0);
    const m=await ke(s,t);
    j(m);
    y(!1);
  },[s,h]);
  l.useEffect(()=>{D(o);},[o,D]);

  l.useEffect(()=>{
    if(!h){P({id:s,type:a,title:n,poster:d,backdrop:x});return;}
    const t=u.find(m=>m.episode_number===r);
    P({id:s,type:a,title:n,poster:d,backdrop:x,season:o,episode:r,episodeName:t?.name});
  },[s,o,r]);

  // Fullscreen keyboard shortcut
  l.useEffect(()=>{
    const t=m=>{
      if(!["INPUT","TEXTAREA","SELECT"].includes(m.target.tagName)&&(m.key==="f"||m.key==="F")) U();
    };
    window.addEventListener("keydown",t);
    return ()=>window.removeEventListener("keydown",t);
  },[]);

  // TMDB resolution
  l.useEffect(()=>{
    if(tmdb||!n) return;
    const _cKey="fw_tmdb_"+s;
    try{
      const _c=sessionStorage.getItem(_cKey);
      if(_c){const _cd=JSON.parse(_c);if(_cd.tmdb)setResolvedTmdb(_cd.tmdb);if(_cd.imdb)setResolvedImdb(_cd.imdb);return;}
    }catch(e){}
    const _ep=(a==="series"||a==="anime"||a==="kdrama")?"tv":"movie";
    fetch("/api/tmdb-lookup?type="+_ep+"&query="+encodeURIComponent(n.replace(/\\(\\d{4}\\)/g,"").trim()))
      .then(r=>(r.ok?r.json():null))
      .then(d=>{
        if(!d||!d.tmdbId) return;
        const _tid=String(d.tmdbId);
        setResolvedTmdb(_tid);
        const _iid=i||"";
        if(_iid) setResolvedImdb(_iid);
        try{sessionStorage.setItem(_cKey,JSON.stringify({tmdb:_tid,imdb:_iid}));}catch(e){}
      }).catch(()=>{});
  },[s,n,a,tmdb]);

  // Sticky controls visibility tracker (Requirement 5)
  l.useEffect(()=>{
    const onScroll=()=>{
      if(!z.current) return;
      const rect=z.current.getBoundingClientRect();
      setIsStickyVisible(rect.bottom<60);
    };
    window.addEventListener("scroll",onScroll,{passive:!0});
    return ()=>window.removeEventListener("scroll",onScroll);
  },[]);

  const U=()=>{document.fullscreenElement?document.exitFullscreen?.():z.current?.requestFullscreen?.();};

  const V=()=>{
    const _rTmdb=resolvedTmdb||tmdb||"";
    const _rImdb=resolvedImdb||i||"";
    const t=_rTmdb||_rImdb||s;
    const m=!_rTmdb&&!!_rImdb;

    if(c==="allmovieland"){
      if(_rImdb&&_rImdb.startsWith("tt")) return "https://slast430did.com/play/"+_rImdb;
      return H(h,_rTmdb||s,o,r);
    }
    if(c==="hicine"){
      const cl=(Y_links||[]).find(l=>/1080/i.test(l.quality))||(Y_links||[]).find(l=>/720|HD/i.test(l.quality))||(Y_links||[]).find(l=>l.isCloud)||(Y_links||[])[0];
      if(cl) return cl.url;
      return H(h,_rTmdb||s,o,r);
    }
    switch(c){
      case"vidlink":return H(h,_rTmdb||s,o,r);
      case"vidsrcme":return h?(m?\`https://vidsrc.me/embed/tv?imdb=\${t}&season=\${o}&episode=\${r}\`:\`https://vidsrc.me/embed/tv?tmdb=\${t}&season=\${o}&episode=\${r}\`):(m?\`https://vidsrc.me/embed/movie?imdb=\${t}\`:\`https://vidsrc.me/embed/movie?tmdb=\${t}\`);
      case"vidsrcxyz":return h?(m?\`https://vidsrc.xyz/embed/tv?imdb=\${t}&season=\${o}&episode=\${r}\`:\`https://vidsrc.xyz/embed/tv?tmdb=\${t}&season=\${o}&episode=\${r}\`):(m?\`https://vidsrc.me/embed/movie?imdb=\${t}\`:\`https://vidsrc.me/embed/movie?tmdb=\${t}\`);
      default:return H(h,_rTmdb||s,o,r);
    }
  };

  const W=u.find(t=>t.episode_number===r);
  const te=v.find(t=>t.season_number===o);
  const A=u.find(t=>t.episode_number===r-1);
  const F=u.find(t=>t.episode_number===r+1);

  return e.jsxs("section",{id:"player",className:\`scroll-mt-24 transition-all duration-300 \${p?"fixed inset-0 z-[90] bg-black flex flex-col":""}\`,children:[
    // Requirement 5: Compact Sticky Streaming Controls Bar
    isStickyVisible&&!p&&e.jsxs("div",{className:"sticky-server-bar flex items-center justify-between gap-2",children:[
      e.jsxs("div",{className:"flex items-center gap-2 min-w-0 flex-1",children:[
        e.jsx(q,{className:"w-4 h-4 text-[var(--color-accent)] flex-shrink-0"}),
        e.jsx("span",{className:"text-xs font-bold text-white truncate",children:h?\`WATCH — S\${o} E\${r}\`:\`WATCH — \${n}\`})
      ]}),
      e.jsx("div",{className:"flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5",children:activeG.map(t=>e.jsx("button",{key:t.id,onClick:()=>{f(t.id);N(!0);E(!1);},className:\`btn-pill text-[11px] px-2.5 py-1 whitespace-nowrap \${c===t.id?"active bg-[var(--color-accent)] text-white shadow":"bg-white/5 hover:bg-white/10 text-gray-300"}\`,children:t.label}))}),
      e.jsx("button",{onClick:()=>{document.getElementById("player")?.scrollIntoView({behavior:"smooth",block:"center"});},className:"flex-shrink-0 ml-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition-all",children:"⤊ Player"})
    ]}),

    // Dedicated Header & Server Selector (Requirement 4)
    e.jsxs("div",{className:\`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 \${p?"px-4 pt-4":""}\`,children:[
      e.jsxs("div",{className:"flex items-center gap-2 min-w-0",children:[
        e.jsx(q,{className:"w-5 h-5 text-[var(--color-accent)] flex-shrink-0"}),
        e.jsxs("div",{className:"min-w-0",children:[
          e.jsx("h2",{className:"text-white text-lg font-bold truncate",children:h?\`WATCH — S\${o} E\${r}\`:\`Watch \${n}\`}),
          h&&W&&e.jsx("p",{className:"text-gray-500 text-xs truncate",children:W.name})
        ]})
      ]}),
      // Dedicated Streaming Server Selector (Server 1, Fast Cloud, Server 2, Server 3)
      e.jsxs("div",{className:"flex items-center gap-1.5 sm:gap-2 flex-shrink-0 overflow-x-auto scrollbar-hide max-w-full pb-1",children:[
        e.jsx("div",{className:"flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1",children:activeG.map(t=>e.jsxs("button",{key:t.id,onClick:()=>f(t.id),className:\`btn-pill \${c===t.id?"active shadow-lg shadow-red-900/40":"opacity-80 hover:opacity-100"}\`,"aria-pressed":c===t.id,children:[e.jsx(O,{className:"w-3 h-3"}),t.label]}))}),
        e.jsx("button",{onClick:()=>_(t=>!t),className:"btn-icon",title:p?"Exit theater mode":"Theater mode","aria-label":p?"Exit theater mode":"Enter theater mode",children:p?e.jsx(B,{className:"w-4 h-4"}):e.jsx(ie,{className:"w-4 h-4"})}),
        e.jsx("button",{onClick:U,className:"btn-icon",title:"Fullscreen (F)","aria-label":"Toggle fullscreen",children:e.jsx(oe,{className:"w-4 h-4"})})
      ]})
    ]}),

    // Video Player Frame
    e.jsx("div",{ref:z,className:\`bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/5 relative \${p?"flex-1 rounded-none border-0":""}\`,children:e.jsxs("div",{className:\`relative w-full \${p?"h-full":"aspect-video"}\`,children:[
      L&&!I&&e.jsxs("div",{className:"absolute inset-0 flex flex-col items-center justify-center text-gray-400 z-20 bg-black/80 backdrop-blur-sm animate-fade-in",children:[
        e.jsx("div",{className:"w-10 h-10 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mb-3"}),
        e.jsx("p",{className:"text-sm font-medium",children:"Loading secure player…"})
      ]}),
      // Requirement 4: Server failure state with in-place alternative server selector
      I&&e.jsxs("div",{className:"absolute inset-0 flex flex-col items-center justify-center text-white z-20 bg-[var(--color-navy-900)] border border-white/5 p-6 text-center animate-fade-in",children:[
        e.jsx(O,{className:"w-10 h-10 mb-3 text-red-500/80"}),
        e.jsx("h3",{className:"text-base font-bold mb-1 text-white",children:"This server is currently unavailable."}),
        e.jsx("p",{className:"text-xs mb-4 text-gray-400 max-w-sm",children:"Please select another authorized server below to continue playback:"}),
        e.jsx("div",{className:"flex flex-wrap items-center justify-center gap-2 mb-4",children:activeG.map(srv=>e.jsx("button",{key:srv.id,onClick:()=>{f(srv.id);N(!0);E(!1);},className:\`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all \${c===srv.id?"bg-[var(--color-accent)] border-[var(--color-accent)] text-white":"bg-white/10 hover:bg-white/20 border-white/15 text-gray-200"}\`,children:srv.label}))}),
        e.jsx("button",{onClick:()=>{N(!0);E(!1);S.current&&(S.current.src=V());},className:"text-xs text-gray-400 hover:text-white underline underline-offset-4",children:"Retry connection"})
      ]}),
      e.jsx("iframe",{ref:S,src:V(),title:\`Watch \${n}\`,allowFullScreen:!0,allow:"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",className:"w-full h-full border-0",onLoad:()=>N(!1)})
    ]})}),

    // Series Episode Navigator below player
    h&&e.jsxs("div",{className:"mt-6 space-y-4",children:[
      e.jsxs("div",{className:"flex items-center justify-between",children:[
        e.jsx("h3",{className:"text-white font-bold text-base",children:"Episodes"}),
        v.length>1&&e.jsx("div",{className:"flex items-center gap-1 overflow-x-auto scrollbar-hide py-1",children:v.map(t=>e.jsxs("button",{key:t.season_number,onClick:()=>b(t.season_number),className:\`btn-pill text-xs \${o===t.season_number?"active":""}\`,children:["Season ",t.season_number]}))})
      ]}),
      k?e.jsx("div",{className:"grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3",children:Array.from({length:12}).map((t,m)=>e.jsx("div",{className:"skeleton aspect-video rounded-xl"},m))}):
      e.jsx("div",{className:"grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin",children:u.map(t=>{
        const m=r===t.episode_number;
        return e.jsxs("button",{key:t.id||t.episode_number,onClick:()=>{g(t.episode_number);document.getElementById("player")?.scrollIntoView({behavior:"smooth",block:"center"});},className:\`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all group/ep \${m?"bg-[var(--color-accent)]/15 border-[var(--color-accent)]/50 text-white":"bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10"}\`,children:[
          e.jsxs("div",{className:"relative flex-shrink-0 w-20 aspect-video rounded-lg overflow-hidden bg-black/40",children:[
            t.still_path?e.jsx("img",{src:\`https://image.tmdb.org/t/p/w300\${t.still_path}\`,alt:t.name,className:"w-full h-full object-cover",loading:"lazy"}):e.jsx("div",{className:"w-full h-full flex items-center justify-center text-xs font-bold text-gray-600",children:\`E\${t.episode_number}\`}),
            m&&e.jsx("div",{className:"absolute inset-0 bg-[var(--color-accent)]/40 flex items-center justify-center",children:e.jsx(pe,{className:"w-5 h-5 text-white fill-white"})})
          ]}),
          e.jsxs("div",{className:"min-w-0 flex-1",children:[
            e.jsxs("div",{className:"flex items-center gap-1.5",children:[
              e.jsxs("span",{className:\`text-xs font-bold \${m?"text-[var(--color-accent)]":"text-white"}\`,children:["E",t.episode_number]}),
              t.vote_average>0&&e.jsxs("span",{className:"text-[10px] text-yellow-400 flex items-center gap-0.5",children:[e.jsx(Z,{className:"w-2.5 h-2.5 fill-yellow-400"}),t.vote_average.toFixed(1)]})
            ]}),
            e.jsx("p",{className:"text-xs truncate font-medium mt-0.5 text-gray-300 group-hover/ep:text-white",children:t.name||\`Episode \${t.episode_number}\`}),
            t.runtime&&e.jsxs("span",{className:"text-[10px] text-gray-500",children:[t.runtime,"m"]})
          ]})
        ]});
      })})
    ]})
  ]});
}\n`;

    content = content.substring(0, oldZeIdx) + newZeCode + content.substring(oldPeIdx);
    console.log('✓ Successfully patched function ze with dedicated server controls & sticky bar');
  }

  // ========================================================================
  // 2. UPDATE Pe (Downloads Section):
  // - Hierarchical reorganization (Requirement 3)
  //   Series: Season (Accordion) -> Episode -> Quality (480p, 720p, 1080p, 1440p, 2160p / 4K) -> Authorized Source
  //   Movies: Download Options -> 480p, 720p, 1080p, 1440p, 2160p / 4K -> Sources
  // - Strict data integrity
  // - Performance: default collapsed seasons
  // ========================================================================
  const pIdx = content.indexOf('function Pe({');
  const dlsStartIdx = content.indexOf('showDl&&(()=>{', pIdx);
  const dlsEndIdx = content.indexOf('})()', dlsStartIdx);

  if (dlsStartIdx !== -1 && dlsEndIdx !== -1) {
    const newDownloadRenderer = `showDl&&(()=>{
      const isSeries = s.type === "series" || s.type === "anime" || s.type === "kdrama";
      let rawLinks = [];
      if (Array.isArray(s.links)) rawLinks = s.links;
      else if (Array.isArray(s.downloadOptions)) rawLinks = s.downloadOptions;
      else if (typeof s.links === "string" && s.links.trim()) {
        rawLinks = s.links.split("\\n").map(l => l.trim()).filter(Boolean).map((line, idx) => {
          const parts = line.split(",").map(p => p.trim());
          return { url: parts[0] || "", label: parts[parts.length - 2] || \`Mirror \${idx + 1}\`, size: parts[parts.length - 1] || "" };
        });
      }

      // Parse & normalize links with strict data integrity
      const parsed = [];
      for (const l of rawLinks) {
        if (!l || !l.url) continue;
        const label = l.label || "";

        // Season detection
        let season = 1;
        const sMatch = label.match(/(?:season|s)\\s*(\\d+)/i);
        if (sMatch) season = parseInt(sMatch[1], 10);

        // Episode & Pack detection
        let episode = null;
        let isPack = false;
        const epMatch = label.match(/(?:episode|ep|e)\\s*(\\d+)/i);
        if (epMatch) {
          episode = parseInt(epMatch[1], 10);
        } else if (/complete|pack|zip|batch|full\\s*season/i.test(label)) {
          isPack = true;
        }

        // Quality normalization: 480p, 720p, 1080p, 1440p, 2160p / 4K (Never 2140p)
        let quality = "720p";
        if (/2160p|2140p|4k|uhd/i.test(label) || /2160p|2140p|4k/i.test(l.quality || "")) quality = "2160p / 4K";
        else if (/1440p|2k/i.test(label) || /1440p/i.test(l.quality || "")) quality = "1440p";
        else if (/1080p|fhd|full\\s*hd/i.test(label) || /1080p/i.test(l.quality || "")) quality = "1080p";
        else if (/720p|hd/i.test(label) || /720p/i.test(l.quality || "")) quality = "720p";
        else if (/480p|sd/i.test(label) || /480p/i.test(l.quality || "")) quality = "480p";

        // Multi-audio variant detection
        let audio = null;
        if (/dual\\s*audio/i.test(label)) audio = "Dual Audio";
        else if (/hindi/i.test(label)) audio = "Hindi";
        else if (/english/i.test(label)) audio = "English";
        else if (/tamil/i.test(label)) audio = "Tamil";
        else if (/telugu/i.test(label)) audio = "Telugu";
        else if (/korean/i.test(label)) audio = "Korean";
        else if (/japanese/i.test(label)) audio = "Japanese";

        const isCloud = l.isCloud || l.source === "hicine" || l.url.includes("vcloud") || l.url.includes("workers.dev");
        const source = isCloud ? "Fast Cloud" : (l.source === "dotmobiz" ? "AllMovieLand" : "Direct Mirror");

        parsed.push({
          url: l.url,
          label,
          size: l.size || "",
          quality,
          audio,
          season,
          episode,
          isPack,
          source,
          isCloud
        });
      }

      if (parsed.length === 0) {
        return e.jsxs("div", {
          id: "download-links",
          className: "mt-6 p-5 rounded-2xl bg-white/[0.04] border border-white/10 text-center max-w-3xl",
          children: [
            e.jsx("p", { className: "text-sm text-gray-300 font-semibold", children: "Direct High-Speed Download Links" }),
            e.jsx("p", { className: "text-xs text-gray-400 mt-1", children: "Cloud download mirrors for this specific title are currently syncing. You can stream it in full HD without buffering using the player." })
          ]
        });
      }

      // -------------------------------------------------------------
      // HIERARCHICAL RENDERER: SERIES VS MOVIE
      // -------------------------------------------------------------
      if (isSeries) {
        const seasons = [...new Set(parsed.map(p => p.season))].sort((a, b) => a - b);

        return e.jsxs("div", {
          id: "download-links",
          className: "mt-6 space-y-3 max-w-3xl scroll-mt-24 transition-all duration-300",
          children: [
            e.jsxs("div", {
              className: "flex items-center justify-between pb-2 border-b border-white/10",
              children: [
                e.jsxs("div", {
                  className: "flex items-center gap-2",
                  children: [
                    e.jsx(fe, { className: "w-5 h-5 text-[var(--color-accent)]" }),
                    e.jsx("h2", { className: "text-white text-base font-bold", children: "Hierarchical Series Downloads" })
                  ]
                }),
                e.jsx("span", { className: "text-xs text-gray-400", children: \`\${seasons.length} Season\${seasons.length > 1 ? "s" : ""}\` })
              ]
            }),

            seasons.map(seasonNum => {
              const sLinks = parsed.filter(p => p.season === seasonNum);
              const packs = sLinks.filter(p => p.isPack);
              const episodes = [...new Set(sLinks.filter(p => p.episode !== null).map(p => p.episode))].sort((a, b) => a - b);
              const totalCount = episodes.length + packs.length;

              return e.jsxs("details", {
                key: seasonNum,
                open: seasonNum === 1 || seasonNum === seasons[0],
                className: "download-season-accordion group",
                children: [
                  e.jsxs("summary", {
                    className: "download-season-header list-none",
                    children: [
                      e.jsxs("span", {
                        className: "flex items-center gap-2",
                        children: [
                          e.jsx("span", { className: "w-2 h-2 rounded-full bg-[var(--color-accent)]" }),
                          \`Season \${seasonNum} — \${totalCount} Option\${totalCount !== 1 ? "s" : ""}\`
                        ]
                      }),
                      e.jsx("span", { className: "text-gray-400 group-open:rotate-180 transition-transform duration-200 text-xs", children: "▼" })
                    ]
                  }),

                  e.jsxs("div", {
                    className: "p-3 sm:p-4 space-y-3 bg-black/20",
                    children: [
                      // Complete Season Packs
                      packs.length > 0 && e.jsxs("div", {
                        className: "p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2",
                        children: [
                          e.jsx("p", { className: "text-xs font-bold text-gray-300 uppercase tracking-wider", children: "Complete Season Packs" }),
                          e.jsx("div", {
                            className: "flex flex-wrap gap-2",
                            children: packs.map((lnk, idx) => e.jsxs("a", {
                              key: idx,
                              href: window.getFastCloudDownloadHref ? window.getFastCloudDownloadHref(lnk.url) : lnk.url,
                              onClick: ev => window.handleFastCloudDownload ? window.handleFastCloudDownload(ev, lnk.url) : null,
                              target: "_blank",
                              rel: "noopener noreferrer",
                              className: "inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-[var(--color-accent)] text-white border border-white/10 hover:border-transparent transition-all shadow hover:scale-105 active:scale-95",
                              children: [
                                e.jsx("span", { className: "text-[var(--color-accent)] group-hover:text-white", children: lnk.quality }),
                                lnk.size && e.jsx("span", { className: "text-gray-400 text-[10px]", children: lnk.size }),
                                e.jsx(fe, { className: "w-3.5 h-3.5 opacity-70" })
                              ]
                            }))
                          })
                        ]
                      }),

                      // Episode Rows
                      episodes.length > 0 && e.jsx("div", {
                        className: "space-y-2 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin",
                        children: episodes.map(epNum => {
                          const epLinks = sLinks.filter(p => p.episode === epNum);
                          const epAudio = epLinks.find(p => p.audio)?.audio;

                          return e.jsxs("div", {
                            key: epNum,
                            className: "download-episode-row rounded-xl bg-white/[0.04] border border-white/5 hover:border-white/15 transition-colors",
                            children: [
                              e.jsxs("div", {
                                className: "flex items-center gap-2 min-w-0",
                                children: [
                                  e.jsx("span", { className: "font-bold text-xs text-white", children: \`Episode \${epNum}\` }),
                                  epAudio && e.jsx("span", { className: "text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30", children: epAudio })
                                ]
                              }),
                              e.jsx("div", {
                                className: "flex flex-wrap items-center gap-1.5",
                                children: epLinks.map((lnk, idx) => e.jsxs("a", {
                                  key: idx,
                                  href: window.getFastCloudDownloadHref ? window.getFastCloudDownloadHref(lnk.url) : lnk.url,
                                  onClick: ev => window.handleFastCloudDownload ? window.handleFastCloudDownload(ev, lnk.url) : null,
                                  target: "_blank",
                                  rel: "noopener noreferrer",
                                  className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-[var(--color-accent)] text-white border border-white/10 hover:border-transparent transition-all active:scale-95 shadow-sm",
                                  title: \`Download Episode \${epNum} in \${lnk.quality} (\${lnk.source})\`,
                                  children: [
                                    e.jsx("span", { children: lnk.quality }),
                                    lnk.size && e.jsx("span", { className: "text-[10px] opacity-75 font-normal", children: \`(\${lnk.size})\` }),
                                    e.jsx(fe, { className: "w-3 h-3 opacity-80" })
                                  ]
                                }))
                              })
                            ]
                          });
                        })
                      })
                    ]
                  })
                ]
              });
            })
          ]
        });
      }

      // -------------------------------------------------------------
      // MOVIE DOWNLOAD UI: GROUPED BY QUALITY TIER
      // -------------------------------------------------------------
      const QUALITY_ORDER = ["480p", "720p", "1080p", "1440p", "2160p / 4K"];
      const byQuality = {};
      for (const l of parsed) {
        if (!byQuality[l.quality]) byQuality[l.quality] = [];
        byQuality[l.quality].push(l);
      }
      const existingQualities = QUALITY_ORDER.filter(q => byQuality[q] && byQuality[q].length > 0);

      return e.jsxs("div", {
        id: "download-links",
        className: "mt-6 space-y-4 max-w-3xl scroll-mt-24 transition-all duration-300",
        children: [
          e.jsxs("div", {
            className: "flex items-center justify-between pb-2 border-b border-white/10",
            children: [
              e.jsxs("div", {
                className: "flex items-center gap-2",
                children: [
                  e.jsx(fe, { className: "w-5 h-5 text-[var(--color-accent)]" }),
                  e.jsx("h2", { className: "text-white text-base font-bold", children: "DOWNLOAD OPTIONS" })
                ]
              }),
              e.jsx("span", { className: "text-xs text-gray-400", children: "Direct High-Speed Mirrors" })
            ]
          }),

          e.jsx("div", {
            className: "grid grid-cols-1 sm:grid-cols-2 gap-3",
            children: existingQualities.map(qTier => {
              const qLinks = byQuality[qTier];
              return e.jsxs("div", {
                key: qTier,
                className: "p-4 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between shadow-lg",
                children: [
                  e.jsxs("div", {
                    className: "flex items-center justify-between mb-3",
                    children: [
                      e.jsx("span", { className: "px-2.5 py-1 rounded-lg bg-[var(--color-accent)]/20 text-white font-black text-xs border border-[var(--color-accent)]/40", children: qTier }),
                      e.jsx("span", { className: "text-[11px] text-gray-400", children: \`\${qLinks.length} Authorized Mirror\${qLinks.length > 1 ? "s" : ""}\` })
                    ]
                  }),
                  e.jsx("div", {
                    className: "space-y-2",
                    children: qLinks.map((lnk, idx) => e.jsxs("a", {
                      key: idx,
                      href: window.getFastCloudDownloadHref ? window.getFastCloudDownloadHref(lnk.url) : lnk.url,
                      onClick: ev => window.handleFastCloudDownload ? window.handleFastCloudDownload(ev, lnk.url) : null,
                      target: "_blank",
                      rel: "noopener noreferrer",
                      className: "flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.06] hover:bg-[var(--color-accent)] text-white border border-white/10 hover:border-transparent transition-all shadow-sm active:scale-95 group/btn",
                      children: [
                        e.jsxs("div", {
                          className: "flex items-center gap-2 min-w-0",
                          children: [
                            e.jsx("span", { className: "text-xs font-bold truncate", children: lnk.source }),
                            lnk.audio && e.jsx("span", { className: "text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-gray-300", children: lnk.audio })
                          ]
                        }),
                        e.jsxs("div", {
                          className: "flex items-center gap-1.5 flex-shrink-0",
                          children: [
                            lnk.size && e.jsx("span", { className: "text-xs font-semibold text-gray-400 group-hover/btn:text-white", children: lnk.size }),
                            e.jsx(fe, { className: "w-4 h-4 text-gray-400 group-hover/btn:text-white" })
                          ]
                        })
                      ]
                    }))
                  })
                ]
              });
            })
          })
        ]
      });
    })()`;

    content = content.substring(0, dlsStartIdx) + newDownloadRenderer + content.substring(dlsEndIdx + 4);
    console.log('✓ Successfully replaced download section with hierarchical accordion');
  }

  fs.writeFileSync(fPath, content, 'utf8');
  console.log('✓ Successfully saved:', fPath);
}

console.log('DetailPage patches complete!');
