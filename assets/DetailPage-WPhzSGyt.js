import{j as e,m as C}from"./vendor-framer-BGQgIPyw.js";import{r as l,L as ae,f as re,c as le,N as M}from"./vendor-react-h5WnBHGl.js";import{r as q,s as O,t as B,u as ie,v as oe,V as ne,T as Y,q as ce,l as T,m as Q,n as X,j as Z,w as de,G as me,d as xe,p as he,P as pe,x as ee,y as ue,k as ge,D as fe,z as be,A as ve,o as we,S as je}from"./vendor-ui-BbvII91P.js";import{a as ye,n as Ne,o as ke,u as $e,f as Ee,p as Se,q as Ce,r as Te,s as _e}from"./index-CQL8lqua.js";import{M as Re}from"./MovieCard-DyC9jox1.js";const Le="",Ie=s=>s==="series"||s==="anime"||s==="kdrama",H=(s,i,a,n)=>{const d=s?`https://vidlink.pro/tv/${i}/${a}/${n}`:`https://vidlink.pro/movie/${i}`,x=new URLSearchParams;x.set("apikey",Le),x.set("multiLang","true"),x.set("autoplay","false");const c=x.toString();return c?`${d}?${c}`:d};function ze({id:s,imdbId:i,tmdbId:tmdb,type:a,title:n,poster:d,backdrop:x,links:Y_links}){
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
    fetch("/api/tmdb-lookup?type="+_ep+"&query="+encodeURIComponent(n.replace(/\(\d{4}\)/g,"").trim()))
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
      const sy=window.pageYOffset||document.documentElement.scrollTop||0; setIsStickyVisible(rect.bottom<80||sy>550);
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
      case"vidsrcme":return h?(m?`https://vidsrc.me/embed/tv?imdb=${t}&season=${o}&episode=${r}`:`https://vidsrc.me/embed/tv?tmdb=${t}&season=${o}&episode=${r}`):(m?`https://vidsrc.me/embed/movie?imdb=${t}`:`https://vidsrc.me/embed/movie?tmdb=${t}`);
      case"vidsrcxyz":return h?(m?`https://vidsrc.xyz/embed/tv?imdb=${t}&season=${o}&episode=${r}`:`https://vidsrc.xyz/embed/tv?tmdb=${t}&season=${o}&episode=${r}`):(m?`https://vidsrc.me/embed/movie?imdb=${t}`:`https://vidsrc.me/embed/movie?tmdb=${t}`);
      default:return H(h,_rTmdb||s,o,r);
    }
  };

  const W=u.find(t=>t.episode_number===r);
  const te=v.find(t=>t.season_number===o);
  const A=u.find(t=>t.episode_number===r-1);
  const F=u.find(t=>t.episode_number===r+1);

  return e.jsxs("section",{id:"player",className:`scroll-mt-24 transition-all duration-300 ${p?"fixed inset-0 z-[90] bg-black flex flex-col":""}`,children:[
    // Requirement 5: Compact Sticky Streaming Controls Bar
    isStickyVisible&&!p&&e.jsxs("div",{className:"sticky-server-bar",children:[
      e.jsxs("div",{className:"flex items-center gap-2 min-w-0 flex-1",children:[
        e.jsx(q,{className:"w-4 h-4 text-[var(--color-accent)] flex-shrink-0"}),
        e.jsx("span",{className:"text-xs font-bold text-white truncate",children:h?`WATCH — S${o} E${r}`:`WATCH — ${n}`})
      ]}),
      e.jsx("div",{className:"flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-0.5",children:activeG.map(t=>e.jsx("button",{key:t.id,onClick:()=>{f(t.id);N(!0);E(!1);},className:`btn-pill text-[11px] px-2.5 py-1 whitespace-nowrap ${c===t.id?"active bg-[var(--color-accent)] text-white shadow":"bg-white/5 hover:bg-white/10 text-gray-300"}`,children:t.label}))}),
      e.jsx("button",{onClick:()=>{document.getElementById("player")?.scrollIntoView({behavior:"smooth",block:"center"});},className:"flex-shrink-0 ml-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition-all",children:"⤊ Player"})
    ]}),

    // Dedicated Header & Server Selector (Requirement 4)
    e.jsxs("div",{className:`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 ${p?"px-4 pt-4":""}`,children:[
      e.jsxs("div",{className:"flex items-center gap-2 min-w-0",children:[
        e.jsx(q,{className:"w-5 h-5 text-[var(--color-accent)] flex-shrink-0"}),
        e.jsxs("div",{className:"min-w-0",children:[
          e.jsx("h2",{className:"text-white text-lg font-bold truncate",children:h?`WATCH — S${o} E${r}`:`Watch ${n}`}),
          h&&W&&e.jsx("p",{className:"text-gray-500 text-xs truncate",children:W.name})
        ]})
      ]}),
      // Dedicated Streaming Server Selector (Server 1, Fast Cloud, Server 2, Server 3)
      e.jsxs("div",{className:"flex items-center gap-1.5 sm:gap-2 flex-shrink-0 overflow-x-auto scrollbar-hide max-w-full pb-1",children:[
        e.jsx("div",{className:"flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1",children:activeG.map(t=>e.jsxs("button",{key:t.id,onClick:()=>f(t.id),className:`btn-pill ${c===t.id?"active shadow-lg shadow-red-900/40":"opacity-80 hover:opacity-100"}`,"aria-pressed":c===t.id,children:[e.jsx(O,{className:"w-3 h-3"}),t.label]}))}),
        e.jsx("button",{onClick:()=>_(t=>!t),className:"btn-icon",title:p?"Exit theater mode":"Theater mode","aria-label":p?"Exit theater mode":"Enter theater mode",children:p?e.jsx(B,{className:"w-4 h-4"}):e.jsx(ie,{className:"w-4 h-4"})}),
        e.jsx("button",{onClick:U,className:"btn-icon",title:"Fullscreen (F)","aria-label":"Toggle fullscreen",children:e.jsx(oe,{className:"w-4 h-4"})})
      ]})
    ]}),

    // Video Player Frame
    e.jsx("div",{ref:z,className:`bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/5 relative ${p?"flex-1 rounded-none border-0":""}`,children:e.jsxs("div",{className:`relative w-full ${p?"h-full":"aspect-video"}`,children:[
      L&&!I&&e.jsxs("div",{className:"absolute inset-0 flex flex-col items-center justify-center text-gray-400 z-20 bg-black/80 backdrop-blur-sm animate-fade-in",children:[
        e.jsx("div",{className:"w-10 h-10 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mb-3"}),
        e.jsx("p",{className:"text-sm font-medium",children:"Loading secure player…"})
      ]}),
      // Requirement 4: Server failure state with in-place alternative server selector
      I&&e.jsxs("div",{className:"absolute inset-0 flex flex-col items-center justify-center text-white z-20 bg-[var(--color-navy-900)] border border-white/5 p-6 text-center animate-fade-in",children:[
        e.jsx(O,{className:"w-10 h-10 mb-3 text-red-500/80"}),
        e.jsx("h3",{className:"text-base font-bold mb-1 text-white",children:"This server is currently unavailable."}),
        e.jsx("p",{className:"text-xs mb-4 text-gray-400 max-w-sm",children:"Please select another authorized server below to continue playback:"}),
        e.jsx("div",{className:"flex flex-wrap items-center justify-center gap-2 mb-4",children:activeG.map(srv=>e.jsx("button",{key:srv.id,onClick:()=>{f(srv.id);N(!0);E(!1);},className:`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${c===srv.id?"bg-[var(--color-accent)] border-[var(--color-accent)] text-white":"bg-white/10 hover:bg-white/20 border-white/15 text-gray-200"}`,children:srv.label}))}),
        e.jsx("button",{onClick:()=>{N(!0);E(!1);S.current&&(S.current.src=V());},className:"text-xs text-gray-400 hover:text-white underline underline-offset-4",children:"Retry connection"})
      ]}),
      e.jsx("iframe",{ref:S,src:V(),title:`Watch ${n}`,allowFullScreen:!0,allow:"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",className:"w-full h-full border-0",onLoad:()=>N(!1)})
    ]})}),

    // Series Episode Navigator below player
    h&&e.jsxs("div",{className:"mt-6 space-y-4",children:[
      e.jsxs("div",{className:"flex items-center justify-between",children:[
        e.jsx("h3",{className:"text-white font-bold text-base",children:"Episodes"}),
        v.length>1&&e.jsx("div",{className:"flex items-center gap-1 overflow-x-auto scrollbar-hide py-1",children:v.map(t=>e.jsxs("button",{key:t.season_number,onClick:()=>b(t.season_number),className:`btn-pill text-xs ${o===t.season_number?"active":""}`,children:["Season ",t.season_number]}))})
      ]}),
      k?e.jsx("div",{className:"grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3",children:Array.from({length:12}).map((t,m)=>e.jsx("div",{className:"skeleton aspect-video rounded-xl"},m))}):
      e.jsx("div",{className:"grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin",children:u.map(t=>{
        const m=r===t.episode_number;
        return e.jsxs("button",{key:t.id||t.episode_number,onClick:()=>{g(t.episode_number);document.getElementById("player")?.scrollIntoView({behavior:"smooth",block:"center"});},className:`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all group/ep ${m?"bg-[var(--color-accent)]/15 border-[var(--color-accent)]/50 text-white":"bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10"}`,children:[
          e.jsxs("div",{className:"relative flex-shrink-0 w-20 aspect-video rounded-lg overflow-hidden bg-black/40",children:[
            t.still_path?e.jsx("img",{src:`https://image.tmdb.org/t/p/w300${t.still_path}`,alt:t.name,className:"w-full h-full object-cover",loading:"lazy"}):e.jsx("div",{className:"w-full h-full flex items-center justify-center text-xs font-bold text-gray-600",children:`E${t.episode_number}`}),
            m&&e.jsx("div",{className:"absolute inset-0 bg-[var(--color-accent)]/40 flex items-center justify-center",children:e.jsx(pe,{className:"w-5 h-5 text-white fill-white"})})
          ]}),
          e.jsxs("div",{className:"min-w-0 flex-1",children:[
            e.jsxs("div",{className:"flex items-center gap-1.5",children:[
              e.jsxs("span",{className:`text-xs font-bold ${m?"text-[var(--color-accent)]":"text-white"}`,children:["E",t.episode_number]}),
              t.vote_average>0&&e.jsxs("span",{className:"text-[10px] text-yellow-400 flex items-center gap-0.5",children:[e.jsx(Z,{className:"w-2.5 h-2.5 fill-yellow-400"}),t.vote_average.toFixed(1)]})
            ]}),
            e.jsx("p",{className:"text-xs truncate font-medium mt-0.5 text-gray-300 group-hover/ep:text-white",children:t.name||`Episode ${t.episode_number}`}),
            t.runtime&&e.jsxs("span",{className:"text-[10px] text-gray-500",children:[t.runtime,"m"]})
          ]})
        ]});
      })})
    ]})
  ]});
}
function Pe({content:s}){const[i,a]=l.useState(!1),[pUrl,setPUrl]=l.useState(s.poster),[bUrl,setBUrl]=l.useState(s.backdrop),[showDl,setShowDl]=l.useState(!1),{addToWatchlist:n,removeFromWatchlist:d,isInWatchlist:x}=$e(),c=x(s.id),o=()=>{c?d(s.id):n(s)};l.useEffect(()=>{let t=null;if(typeof window!=="undefined"&&(window.location.hash.includes("download")||window.location.search.includes("download"))){setShowDl(!0);t=setTimeout(()=>{document.getElementById("download-links")?.scrollIntoView({behavior:"smooth",block:"start"})},250);}return()=>{t&&clearTimeout(t);};},[s.id]);l.useEffect(()=>{let a=true;setPUrl(s.poster);setBUrl(s.backdrop);if(!s.poster||s.poster.includes("no-poster")||s.poster.includes("placehold")||!s.backdrop||s.backdrop.includes("no-poster")){window.resolveRealPoster&&window.resolveRealPoster(s.title,s.imdbId,s.type,(p,b)=>{if(!a)return;p&&setPUrl(p);b&&setBUrl(b);});}return()=>{a=false;};},[s.id,s.poster,s.backdrop,s.title,s.imdbId,s.type]);return e.jsxs("div",{className:"relative min-h-[80vh] flex items-end",children:[e.jsxs("div",{className:"absolute inset-0 overflow-hidden",children:[e.jsx("img",{src:bUrl||s.backdrop,alt:s.title,className:"w-full h-full object-cover object-top",loading:"eager",decoding:"async",onError:d=>{d.currentTarget.onerror=null;window.resolveRealPoster?window.resolveRealPoster(s.title,s.imdbId,s.type,(p,b)=>{d.currentTarget.src=b||p||(window.FLIX_TERMINAL_POSTER||"/images/no-poster.svg")}):d.currentTarget.src=(window.FLIX_TERMINAL_POSTER||"/images/no-poster.svg")}}),e.jsx("div",{className:"absolute inset-0 bg-gradient-to-t from-[var(--color-navy-950)] via-[var(--color-navy-950)]/60 to-[var(--color-navy-950)]/20"}),e.jsx("div",{className:"absolute inset-0 bg-gradient-to-r from-[var(--color-navy-950)] via-[var(--color-navy-950)]/50 to-transparent"})]}),e.jsx("div",{className:"absolute top-20 left-4 lg:left-8 back-btn-container",style:{zIndex:9999,position:"absolute"},children:e.jsxs("a",{href:"/",onClick:ev=>{ev.preventDefault();ev.stopPropagation();if(window.history.state&&typeof window.history.state.idx==="number"&&window.history.state.idx>0){window.history.back();}else if(window.history.length>2&&document.referrer&&document.referrer.includes(window.location.host)){window.history.back();}else{window.location.assign("/");}},className:"btn-secondary shadow-xl cursor-pointer no-underline back-btn-wrapper",style:{zIndex:9999,position:"relative",pointerEvents:"auto"},"aria-label":"Go back",children:[e.jsx(T,{className:"w-4 h-4"})," Back"]})}),e.jsx("div",{className:"relative z-10 max-w-[1600px] mx-auto px-4 lg:px-8 py-16 w-full",children:e.jsxs("div",{className:"flex flex-col md:flex-row gap-6 sm:gap-8 items-start md:items-end",children:[e.jsx(C.div,{initial:{opacity:0,y:30},animate:{opacity:1,y:0},transition:{duration:.5},className:"flex-shrink-0 w-28 xs:w-36 sm:w-44 md:w-52 lg:w-60 aspect-[2/3] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 block mb-4 sm:mb-0",children:e.jsx("img",{src:i?(window.FLIX_TERMINAL_POSTER||"/images/no-poster.svg"):(pUrl||s.poster),alt:s.title,className:"w-full h-full object-cover",onError:ev=>{ev.currentTarget.onerror=null;const tm=window.FLIX_TERMINAL_POSTER||(window.FLIX_TERMINAL_POSTER||"/images/no-poster.svg");if(window.resolveRealPoster){window.resolveRealPoster(s.title,s.imdbId,s.type,p=>{if(p){setPUrl(p);ev.currentTarget.src=p;}else{a(!0);ev.currentTarget.src=tm;}});}else{a(!0);ev.currentTarget.src=tm;}}})}),e.jsxs(C.div,{initial:{opacity:0,x:-20},animate:{opacity:1,x:0},transition:{duration:.5,delay:.1},className:"flex-1",children:[e.jsx("span",{className:"inline-block text-[var(--color-accent)] text-xs font-bold uppercase tracking-widest mb-3",children:s.type==="kdrama"?"K-Drama":s.type.charAt(0).toUpperCase()+s.type.slice(1)}),e.jsx("h1",{className:"text-3xl sm:text-5xl lg:text-6xl font-black text-white mb-2 leading-tight",children:s.title}),e.jsxs("div",{className:"flex flex-wrap items-center gap-3 sm:gap-4 mb-5",children:[e.jsxs("div",{className:"flex items-center gap-1.5",children:[e.jsx(Z,{className:"w-5 h-5 text-yellow-400 fill-yellow-400"}),e.jsx("span",{className:`text-lg font-bold ${Se(s.rating)}`,children:Ee(s.rating)}),e.jsxs("span",{className:"text-gray-500 text-sm",children:["/ 10 (",s.votes,")"]})]}),e.jsxs("div",{className:"flex items-center gap-1.5 text-gray-400",children:[e.jsx(de,{className:"w-4 h-4"}),e.jsx("span",{children:s.year})]}),e.jsxs("div",{className:"flex items-center gap-1.5 text-gray-400",children:[e.jsx(X,{className:"w-4 h-4"}),e.jsx("span",{children:s.duration})]}),e.jsxs("div",{className:"flex items-center gap-1.5 text-gray-400 hidden sm:flex",children:[e.jsx(me,{className:"w-4 h-4"}),e.jsx("span",{children:s.language})]}),e.jsxs("div",{className:"flex items-center gap-1.5 text-gray-400 hidden sm:flex",children:[e.jsx(xe,{className:"w-4 h-4"}),e.jsx("span",{children:s.country})]}),e.jsx("span",{className:`text-xs font-bold px-2.5 py-1 rounded text-white ${Ce(s.quality)}`,children:s.quality})]}),e.jsx("div",{className:"flex flex-wrap gap-2 mb-5",children:s.genres.map(r=>e.jsx(ae,{to:`/genres?genre=${encodeURIComponent(r)}`,className:"btn-pill",children:r},r))}),s.seasons&&e.jsxs("div",{className:"flex items-center gap-4 mb-5 text-gray-400 text-sm",children:[e.jsxs("span",{children:[s.seasons," Season",s.seasons>1?"s":""]}),s.episodes&&e.jsxs("span",{children:[s.episodes," Episodes"]}),s.status&&e.jsx("span",{className:`px-2 py-0.5 rounded-full text-xs font-medium ${s.status==="Ongoing"?"bg-green-500/20 text-green-400":"bg-gray-500/20 text-gray-400"}`,children:s.status}),(s.network||s.studio)&&e.jsxs("span",{className:"flex items-center gap-1",children:[e.jsx(he,{className:"w-3.5 h-3.5"}),s.network||s.studio]})]}),e.jsxs("p",{className:"text-gray-500 text-sm mb-4",children:[e.jsx("span",{className:"text-gray-300 font-medium",children:"Director: "}),s.director]}),e.jsx("p",{className:"text-gray-300 leading-relaxed mb-8 max-w-2xl",children:s.description}),e.jsxs("div",{className:"flex flex-wrap items-center gap-3 sm:gap-4",children:[e.jsxs("button",{onClick:()=>document.getElementById("player")?.scrollIntoView({behavior:"smooth"}),className:"btn-primary shadow-lg shadow-red-900/40",children:[e.jsx(pe,{className:"w-5 h-5 fill-white"}),s.type==="movie"?"Watch Movie":"Watch Now"]}),e.jsxs("button",{onClick:()=>document.getElementById("trailer")?.scrollIntoView({behavior:"smooth"}),className:"btn-secondary",children:[e.jsx(ee,{className:"w-5 h-5"})," Trailer"]}),e.jsxs("button",{onClick:o,className:"btn-secondary","aria-label":c?"Remove from watchlist":"Add to watchlist","aria-pressed":c,children:[c?e.jsx(ue,{className:"w-5 h-5 text-green-400"}):e.jsx(ge,{className:"w-5 h-5"}),c?"Saved":"Watchlist"]}),e.jsxs("button",{onClick:ev=>{ev.preventDefault();const next=!showDl;setShowDl(next);if(next)setTimeout(()=>{const el=document.getElementById("download-links");el&&el.scrollIntoView({behavior:"smooth",block:"start"})},120)},className:"btn-secondary text-blue-400 hover:text-blue-300 border-blue-500/40 shadow-lg shadow-blue-900/20 cursor-pointer","aria-label":showDl?"Hide download links":"Show download links","aria-expanded":showDl,children:[e.jsx(fe,{className:"w-5 h-5"}),showDl?" Hide Downloads":((Array.isArray(s.links)&&s.links.length>0)?` Download (${s.links.length})`:"Download Links")]})]}),showDl&&(()=>{
      const isSeries = s.type === "series" || s.type === "anime" || s.type === "kdrama";
      let rawLinks = [];
      if (Array.isArray(s.links)) rawLinks = s.links;
      else if (Array.isArray(s.downloadOptions)) rawLinks = s.downloadOptions;
      else if (typeof s.links === "string" && s.links.trim()) {
        rawLinks = s.links.split("\n").map(l => l.trim()).filter(Boolean).map((line, idx) => {
          const parts = line.split(",").map(p => p.trim());
          return { url: parts[0] || "", label: parts[parts.length - 2] || `Mirror ${idx + 1}`, size: parts[parts.length - 1] || "" };
        });
      }

      // Parse & normalize links with strict data integrity
      const parsed = [];
      for (const l of rawLinks) {
        if (!l || !l.url) continue;
        const label = l.label || "";

        // Season detection
        let season = 1;
        const sMatch = label.match(/(?:season|s)\s*(\d+)/i);
        if (sMatch) season = parseInt(sMatch[1], 10);

        // Episode & Pack detection
        let episode = null;
        let isPack = false;
        const epMatch = label.match(/(?:episode|ep|e)\s*(\d+)/i);
        if (epMatch) {
          episode = parseInt(epMatch[1], 10);
        } else if (/complete|pack|zip|batch|full\s*season/i.test(label)) {
          isPack = true;
        }

        // Quality normalization: 480p, 720p, 1080p, 1440p, 2160p / 4K (Never 2140p)
        let quality = "720p";
        if (/2160p|2140p|4k|uhd/i.test(label) || /2160p|2140p|4k/i.test(l.quality || "")) quality = "2160p / 4K";
        else if (/1440p|2k/i.test(label) || /1440p/i.test(l.quality || "")) quality = "1440p";
        else if (/1080p|fhd|full\s*hd/i.test(label) || /1080p/i.test(l.quality || "")) quality = "1080p";
        else if (/720p|hd/i.test(label) || /720p/i.test(l.quality || "")) quality = "720p";
        else if (/480p|sd/i.test(label) || /480p/i.test(l.quality || "")) quality = "480p";

        // Multi-audio variant detection
        let audio = null;
        if (/dual\s*audio/i.test(label)) audio = "Dual Audio";
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
                e.jsx("span", { className: "text-xs text-gray-400", children: `${seasons.length} Season${seasons.length > 1 ? "s" : ""}` })
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
                          `Season ${seasonNum} — ${totalCount} Option${totalCount !== 1 ? "s" : ""}`
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
                                  e.jsx("span", { className: "font-bold text-xs text-white", children: `Episode ${epNum}` }),
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
                                  title: `Download Episode ${epNum} in ${lnk.quality} (${lnk.source})`,
                                  children: [
                                    e.jsx("span", { children: lnk.quality }),
                                    lnk.size && e.jsx("span", { className: "text-[10px] opacity-75 font-normal", children: `(${lnk.size})` }),
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
                      e.jsx("span", { className: "text-[11px] text-gray-400", children: `${qLinks.length} Authorized Mirror${qLinks.length > 1 ? "s" : ""}` })
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
    })()]})]})})]})}const _getCastSvg=n=>{const ini=(n||'Actor').trim().split(/\s+/).map(x=>x[0]).filter(Boolean).slice(0,2).join('').toUpperCase()||'A';return'data:image/svg+xml;utf8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#0f172a"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><circle cx="50" cy="50" r="46" stroke="rgba(255,255,255,0.1)" stroke-width="2" fill="none"/><text x="50" y="58" font-family="system-ui,-apple-system,sans-serif" font-size="34" font-weight="700" fill="#cbd5e1" text-anchor="middle">'+ini+'</text></svg>')};function De({cast:s}){if(!Array.isArray(s)||s.length===0)return null;return e.jsxs("section",{children:[e.jsxs("div",{className:"flex items-center gap-2 mb-5",children:[e.jsx(be,{className:"w-5 h-5 text-[var(--color-accent)]"}),e.jsx("h2",{className:"text-white text-xl font-bold",children:"Cast"})]}),e.jsx("div",{className:"grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4",children:s.map((i,a)=>{const cName=typeof i==="string"?i:(i?.name||"Actor");const cChar=typeof i==="object"?(i?.character||""):"";const cPhoto=typeof i==="object"?(i?.photo||i?.image||i?.profile_path||null):null;const cKey=(typeof i==="object"&&i?.id)?i.id:String(a);return e.jsxs(C.div,{initial:{opacity:0,y:20},whileInView:{opacity:1,y:0},viewport:{once:!0},transition:{delay:a*.05},className:"bg-[var(--color-card)] rounded-xl p-3 flex flex-col items-center text-center hover:bg-[var(--color-card-hover)] transition-colors group cursor-pointer",children:[e.jsx("div",{className:"relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden mb-3 ring-2 ring-white/10 group-hover:ring-[var(--color-accent)]/50 transition-all",children:e.jsx("img",{src:cPhoto||_getCastSvg(cName),alt:cName,className:"w-full h-full object-cover",loading:"lazy",onError:n=>{n.currentTarget.onerror=null;n.currentTarget.src=_getCastSvg(cName);}})}),e.jsx("p",{className:"text-white text-sm font-medium line-clamp-1",children:cName}),cChar?e.jsx("p",{className:"text-gray-500 text-xs mt-0.5 line-clamp-1",children:cChar}):null]},cKey);})})]})}function Ue({items:s,title:i="More Like This"}){const a=l.useRef(null),n=d=>{a.current&&a.current.scrollBy({left:d==="left"?-600:600,behavior:"smooth"})};return s.length?e.jsxs("section",{children:[e.jsxs("div",{className:"flex items-center gap-2 mb-5",children:[e.jsx(ve,{className:"w-5 h-5 text-[var(--color-accent)]"}),e.jsx("h2",{className:"text-white text-xl font-bold",children:i})]}),e.jsxs("div",{className:"relative group/carousel",children:[e.jsx("button",{onClick:()=>n("left"),className:"absolute -left-4 top-1/2 -translate-y-8 z-10 w-9 h-9 bg-[var(--color-navy-800)] rounded-full flex items-center justify-center text-white border border-white/10 opacity-0 group-hover/carousel:opacity-100 transition-opacity shadow-xl",children:e.jsx(T,{className:"w-4 h-4"})}),e.jsx("div",{ref:a,className:"flex gap-4 overflow-x-auto scrollbar-hide pb-2",children:s.map((d,x)=>e.jsx(Re,{content:d,index:x},d.id))}),e.jsx("button",{onClick:()=>n("right"),className:"absolute -right-4 top-1/2 -translate-y-8 z-10 w-9 h-9 bg-[var(--color-navy-800)] rounded-full flex items-center justify-center text-white border border-white/10 opacity-0 group-hover/carousel:opacity-100 transition-opacity shadow-xl",children:e.jsx(Q,{className:"w-4 h-4"})})]})]}):null}function Ve({trailerUrl:s,title:i}){
  let embedUrl = null;
  if (typeof s === "string" && s.trim()) {
    try {
      const u = new URL(s.trim(), "https://www.youtube.com");
      const host = u.hostname.toLowerCase();
      if (host === "www.youtube.com" || host === "youtube.com" || host === "www.youtube-nocookie.com" || host === "youtube-nocookie.com") {
        if (u.pathname.startsWith("/embed/")) {
          embedUrl = "https://www.youtube-nocookie.com" + u.pathname + "?rel=0&modestbranding=1";
        } else if (u.searchParams.has("v")) {
          embedUrl = "https://www.youtube-nocookie.com/embed/" + u.searchParams.get("v") + "?rel=0&modestbranding=1";
        }
      } else if (host === "youtu.be") {
        const vidId = u.pathname.replace(/^\//, "");
        if (vidId) {
          embedUrl = "https://www.youtube-nocookie.com/embed/" + vidId + "?rel=0&modestbranding=1";
        }
      }
    } catch(e) {}
  }
  if (!embedUrl) {
    return e.jsxs("div",{id:"trailer",className:"scroll-mt-24 max-w-4xl bg-[var(--color-navy-900)] rounded-2xl p-8 border border-white/10 text-center",children:[e.jsx(ee,{className:"w-12 h-12 text-gray-500 mx-auto mb-3"}),e.jsx("h3",{className:"text-lg font-bold text-white mb-2",children:"Trailer Unavailable"}),e.jsx("p",{className:"text-gray-400 mb-6 max-w-lg mx-auto",children:"We couldn't find a verified official YouTube trailer for this title. You can search directly on YouTube."}),e.jsxs("a",{href:"https://www.youtube.com/results?search_query=" + encodeURIComponent(i + " official trailer"),target:"_blank",rel:"noopener noreferrer",className:"inline-flex items-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-semibold px-6 py-2.5 rounded-xl transition-all",children:[e.jsx(ee,{className:"w-4 h-4"})," Search Trailer on YouTube"]})]});
  }
  return e.jsxs("section",{className:"scroll-mt-24",children:[e.jsxs("div",{className:"flex items-center gap-2 mb-5",children:[e.jsx(ee,{className:"w-5 h-5 text-[var(--color-accent)]"}),e.jsx("h2",{className:"text-white text-xl font-bold",children:"Trailer"})]}),e.jsx("div",{className:"relative rounded-2xl overflow-hidden aspect-video max-w-4xl bg-[var(--color-card)] shadow-2xl ring-1 ring-white/10",children:e.jsx("iframe",{src:embedUrl,title:i + " Official Trailer",allow:"accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen",allowFullScreen:!0,loading:"lazy",className:"w-full h-full border-0 absolute inset-0"})})]})
}const K=["movie","series","anime","kdrama"],We="https://netflix4u.in",J="Netflix4U";function Ae(s){return s==="movie"?"Movie":"TVSeries"}function Ye(){const{type:s,id:i}=re(),[a,n]=l.useState(null),[d,x]=l.useState([]),[c,f]=l.useState(!0),o=le(),b=`${We}${o.pathname}`;l.useEffect(()=>{if(!a||!a.title)return;const hasPhotos=Array.isArray(a.cast)&&a.cast.some(m=>m&&typeof m==="object"&&m.photo);if(!hasPhotos){const ep=(s==="series"||s==="anime"||s==="kdrama")?"series":"movie";fetch(`/api/cast?title=${encodeURIComponent(a.title)}&tmdbId=${a.tmdbId||""}&type=${ep}&imdbId=${a.imdbId||""}&year=${a.year||""}`).then(r=>r.ok?r.json():null).then(res=>{if(res&&res.cast&&res.cast.length>0){n(prev=>prev?{...prev,cast:res.cast}:prev);}}).catch(()=>{});}},[a?.id,a?.title,a?.tmdbId,a?.imdbId,s]);if(l.useEffect(()=>{(async()=>{if(!s||!i||!K.includes(s)){f(!1);return}f(!0);const k=await Te(i,s);const y=await _e(k?.tmdbId||k?.title||i,s);n(k),x(y),f(!1),o.hash==="#trailer"&&setTimeout(()=>{document.getElementById("trailer")?.scrollIntoView({behavior:"smooth"})},500)})()},[s,i,o.hash]),!s||!i||!K.includes(s))return e.jsx(M,{to:"/",replace:!0});if(c)return e.jsx("div",{className:"min-h-screen flex items-center justify-center",children:e.jsx("div",{className:"w-10 h-10 border-4 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"})});if(!a)return e.jsx(M,{to:"/",replace:!0});const r=`${a.title} (${a.year}) | ${J}`,g=a.description.slice(0,160),v=a.backdrop||a.poster,w=Ae(s),u={"@context":"https://schema.org","@type":w,name:a.title,description:a.description,image:a.poster,datePublished:String(a.year),genre:a.genres,contentRating:a.quality,inLanguage:a.language,...a.director?{director:{"@type":"Person",name:a.director}}:{},...a.cast?.length?{actor:a.cast.slice(0,5).map(j=>({"@type":"Person",name:j.name}))}:{},...w==="TVSeries"&&a.seasons?{numberOfSeasons:a.seasons,numberOfEpisodes:a.episodes}:{},aggregateRating:{"@type":"AggregateRating",ratingValue:a.rating.toFixed(1),bestRating:"10",ratingCount:a.votes}};return e.jsxs("div",{className:"min-h-screen",children:[e.jsxs(we,{children:[e.jsx("title",{children:r}),e.jsx("meta",{name:"description",content:g}),e.jsx("link",{rel:"canonical",href:b}),e.jsx("meta",{property:"og:type",content:s==="movie"?"video.movie":"video.tv_show"}),e.jsx("meta",{property:"og:title",content:r}),e.jsx("meta",{property:"og:description",content:g}),e.jsx("meta",{property:"og:image",content:v}),e.jsx("meta",{property:"og:image:width",content:"1280"}),e.jsx("meta",{property:"og:image:height",content:"720"}),e.jsx("meta",{property:"og:url",content:b}),e.jsx("meta",{property:"og:site_name",content:J}),e.jsx("meta",{property:"og:locale",content:"en_US"}),e.jsx("meta",{name:"twitter:card",content:"summary_large_image"}),e.jsx("meta",{name:"twitter:title",content:r}),e.jsx("meta",{name:"twitter:description",content:g}),e.jsx("meta",{name:"twitter:image",content:v}),e.jsx("script",{type:"application/ld+json",children:JSON.stringify(u)})]}),e.jsx(Pe,{content:a}),e.jsxs("div",{className:"max-w-[1600px] mx-auto px-4 lg:px-8 py-12 space-y-14",children:[e.jsx(ze,{id:a.id,imdbId:a.imdbId,tmdbId:a.tmdbId,type:s,title:a.title,poster:a.poster,backdrop:a.backdrop,links:a.links}),a.trailerUrl?e.jsx("div",{id:"trailer",className:"scroll-mt-24",children:e.jsx(Ve,{trailerUrl:a.trailerUrl,title:a.title})}):e.jsxs("div",{id:"trailer",className:"scroll-mt-24 max-w-4xl bg-[var(--color-navy-900)] rounded-2xl p-8 border border-white/10 text-center",children:[e.jsx("h2",{className:"text-xl font-bold text-white mb-2",children:"Trailer Unavailable"}),e.jsx("p",{className:"text-gray-400 mb-6 max-w-lg mx-auto",children:"We couldn't find an official trailer for this title in our database. You can try searching for it directly on YouTube."}),e.jsxs("a",{href:`https://www.youtube.com/results?search_query=${encodeURIComponent(a.title+" official trailer")}`,target:"_blank",rel:"noopener noreferrer",className:"inline-flex items-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-semibold px-6 py-3 rounded-xl transition-all",children:[e.jsx(je,{className:"w-4 h-4"})," Search on YouTube"]})]}),a.cast&&a.cast.length>0&&e.jsx(De,{cast:a.cast}),d.length>0&&e.jsx(Ue,{items:d})]})]})}export{Ye as default};
