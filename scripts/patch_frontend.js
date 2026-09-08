const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.resolve(__dirname, '..', 'js', 'index-CQL8lqua.js'),
  path.resolve(__dirname, '..', 'assets', 'index-CQL8lqua.js')
];

const hicineAdapterCode = `
// --- FlixWorld Hicine Local Database Adapter ---
const HICINE_DATA = {
  trending: null,
  recent: null,
  summary: null,
  anime: null,
  cache: new Map()
};

async function getLocalJson(name) {
  try {
    const res = await fetch('/data/' + name);
    if (res.ok) return await res.json();
  } catch(e) {}
  return null;
}

function mapHicineItem(item, defaultType = "movie") {
  if (!item) return null;
  const id = String(item.record_id || item.id || item._id);
  const rawTitle = item.rawTitle || item.title || "Untitled";
  const cleanTitle = rawTitle.replace(/^(NetFlix|Prime|Disney\\+|Hotstar|SonyLIV|ZEE5)\\s+/i, "").trim();
  const poster = item.poster || item.featured_image || "https://placehold.co/500x750/111427/ffffff?text=No+Poster";
  const backdrop = item.backdrop || item.featured_image || poster;
  const cats = Array.isArray(item.categories) ? item.categories : (typeof item.categories === "string" ? item.categories.split(",").map(c => c.trim()).filter(Boolean) : []);
  
  const isSeries = item.type === "series" || (item.contentType && item.contentType.includes("series")) || cats.some(c => /series/i.test(c));
  const isAnime = item.type === "anime" || cats.some(c => /anime/i.test(c));
  const isKdrama = cats.some(c => /korean|kdrama|k-drama/i.test(c));
  const type = isAnime ? "anime" : (isKdrama ? "kdrama" : (isSeries ? "series" : (item.type || defaultType)));

  return {
    id,
    type,
    title: cleanTitle,
    originalTitle: rawTitle,
    poster,
    backdrop,
    description: item.content || item.description || ("Watch " + rawTitle + " in high quality with multiple servers and fast download options on FlixWorld."),
    shortDescription: (item.content || item.description || "").slice(0, 120),
    year: item.year || parseInt((rawTitle.match(/\\b(19\\d{2}|20\\d{2})\\b/) || [0, 2026])[1]),
    rating: 8.5,
    votes: "14.2K",
    quality: item.quality || "FHD",
    duration: type === "movie" ? "2h 10m" : "~45m/ep",
    genres: cats.filter(c => !/^\\d+p$/i.test(c) && !/^\\d{4}$/.test(c)).slice(0, 4),
    language: cats.find(c => /hindi|dual|english|tamil|telugu/i.test(c)) || "Hindi / Dual Audio",
    country: cats.some(c => /bollywood/i.test(c)) ? "India" : "Global",
    director: "Director",
    cast: [],
    trailerUrl: "",
    trending: true,
    featured: true,
    topRated: true,
    recentlyAdded: true,
    links: item.links || [],
    rawLinks: item.rawLinks || item.links || ""
  };
}

async function getSummaryCatalog() {
  if (!HICINE_DATA.summary) {
    HICINE_DATA.summary = await getLocalJson("catalog_summary.json") || [];
  }
  return HICINE_DATA.summary;
}
`;

const newServices = `
Og=async()=>{
  try {
    if (!HICINE_DATA.trending) HICINE_DATA.trending = await getLocalJson("trending.json");
    if (HICINE_DATA.trending && HICINE_DATA.trending.length > 0) {
      return HICINE_DATA.trending.map(t => mapHicineItem(t, "movie"));
    }
  } catch(e) {}
  const s=await Ht("/trending/all/day");return s?s?.results?s.results.map(v=>Pt(v)).filter(v=>v.backdrop&&!v.backdrop.includes("No+Backdrop")):[]:R0();
},
wg=async()=>{
  try {
    if (!HICINE_DATA.trending) HICINE_DATA.trending = await getLocalJson("trending.json");
    if (HICINE_DATA.trending && HICINE_DATA.trending.length > 0) {
      return HICINE_DATA.trending.slice(0, 8).map(t => mapHicineItem(t, "movie"));
    }
  } catch(e) {}
  const s=await Ht("/movie/now_playing");return s?s?.results?s.results.slice(0,8).map(v=>Pt(v,"movie")).filter(v=>v.backdrop&&!v.backdrop.includes("No+Backdrop")):[]:Y0();
},
Hg=async()=>{
  try {
    const summary = await getSummaryCatalog();
    if (summary.length > 0) {
      return summary.filter(s => s.type === "movie" && s.quality === "4K").slice(0, 18).map(t => mapHicineItem(t, "movie"));
    }
  } catch(e) {}
  const s=await Ht("/movie/top_rated");return s?s?.results?s.results.map(v=>Pt(v,"movie")):[]:G0();
},
Cg=async()=>{
  try {
    if (!HICINE_DATA.recent) HICINE_DATA.recent = await getLocalJson("recent.json");
    if (HICINE_DATA.recent && HICINE_DATA.recent.length > 0) {
      return HICINE_DATA.recent.map(t => mapHicineItem(t, "movie"));
    }
  } catch(e) {}
  const s=await Ht("/movie/now_playing");return s?s?.results?s.results.map(v=>Pt(v,"movie")):[]:X0();
},
qg=async()=>{
  try {
    const summary = await getSummaryCatalog();
    if (summary.length > 0) {
      return summary.filter(s => s.type === "movie").slice(0, 20).map(t => mapHicineItem(t, "movie"));
    }
  } catch(e) {}
  const s=await Ht("/movie/popular");return s?s?.results?s.results.map(v=>Pt(v,"movie")):[]:Cd();
},
Bg=async()=>{
  try {
    const summary = await getSummaryCatalog();
    if (summary.length > 0) {
      return summary.filter(s => s.type === "series").slice(0, 20).map(t => mapHicineItem(t, "series"));
    }
  } catch(e) {}
  const s=await Ht("/tv/popular");return s?s?.results?s.results.map(v=>Pt(v,"series")):[]:qd();
},
Rg=async(s=1)=>{
  try {
    const summary = await getSummaryCatalog();
    if (summary.length > 0) {
      const movies = summary.filter(x => x.type === "movie");
      const start = (s - 1) * 20;
      return movies.slice(start, start + 20).map(t => mapHicineItem(t, "movie"));
    }
  } catch(e) {}
  const v=await Ht("/discover/movie",{page:s,sort_by:"popularity.desc"});return v?v?.results?v.results.map(z=>Pt(z,"movie")):[]:Cd();
},
Yg=async(s=1)=>{
  try {
    const summary = await getSummaryCatalog();
    if (summary.length > 0) {
      const shows = summary.filter(x => x.type === "series");
      const start = (s - 1) * 20;
      return shows.slice(start, start + 20).map(t => mapHicineItem(t, "series"));
    }
  } catch(e) {}
  const v=await Ht("/discover/tv",{page:s,sort_by:"popularity.desc",without_genres:"16"});return v?v?.results?v.results.map(z=>Pt(z,"series")):[]:qd();
},
Gg=async(s=1)=>{
  try {
    if (!HICINE_DATA.anime) HICINE_DATA.anime = await getLocalJson("anime.json");
    if (HICINE_DATA.anime && HICINE_DATA.anime.length > 0) {
      const start = (s - 1) * 20;
      return HICINE_DATA.anime.slice(start, start + 20).map(t => mapHicineItem(t, "anime"));
    }
  } catch(e) {}
  const v=await Ht("/discover/tv",{page:s,sort_by:"popularity.desc",with_genres:"16",with_original_language:"ja"});return v?v?.results?v.results.map(z=>Pt(z,"anime")):[]:q0();
},
Xg=async(s=1)=>{
  try {
    const summary = await getSummaryCatalog();
    if (summary.length > 0) {
      const kdrama = summary.filter(x => x.categories && x.categories.some(c => /korean|kdrama|k-drama/i.test(c)));
      const start = (s - 1) * 20;
      return kdrama.slice(start, start + 20).map(t => mapHicineItem(t, "kdrama"));
    }
  } catch(e) {}
  const v=await Ht("/discover/tv",{page:s,sort_by:"popularity.desc",with_original_language:"ko"});return v?v?.results?v.results.map(z=>Pt(z,"kdrama")):[]:B0();
},
$0=async s=>{
  if(!s)return[];
  try {
    const res = await fetch('/api/search?q=' + encodeURIComponent(s));
    if (res.ok) {
      const json = await res.json();
      if (json && json.results && json.results.length > 0) {
        return json.results.map(t => mapHicineItem(t));
      }
    }
    const summary = await getSummaryCatalog();
    if (summary.length > 0) {
      const q = s.toLowerCase();
      const matched = summary.filter(x => (x.title && x.title.toLowerCase().includes(q)) || (x.rawTitle && x.rawTitle.toLowerCase().includes(q)) || (x.categories && x.categories.some(c => c.toLowerCase().includes(q))));
      if (matched.length > 0) return matched.slice(0, 30).map(t => mapHicineItem(t));
    }
  } catch(e) {}
  const v=await Ht("/search/multi",{query:s});return v?v?.results?v.results.filter(z=>z.media_type==="movie"||z.media_type==="tv").map(z=>Pt(z)):[]:ye.filter(z=>z.title.toLowerCase().includes(s.toLowerCase()));
},
Kg=async(s,v)=>{
  try {
    if (HICINE_DATA.cache.has(s)) return HICINE_DATA.cache.get(s);
    // 1. Try /api/details/:id
    let item = null;
    try {
      const res = await fetch('/api/details/' + encodeURIComponent(s));
      if (res.ok) {
        const json = await res.json();
        if (json && json.data) item = json.data;
      }
    } catch(e) {}

    // 2. Try static /data/details/:id.json
    if (!item) {
      try {
        const res = await fetch('/data/details/' + encodeURIComponent(s) + '.json');
        if (res.ok) item = await res.json();
      } catch(e) {}
    }

    if (item) {
      const mapped = mapHicineItem(item, v);
      HICINE_DATA.cache.set(s, mapped);
      return mapped;
    }
  } catch(e) {}

  // Fallback to TMDB
  const z=v==="series"||v==="anime"||v==="kdrama"?"tv":"movie",r=await Ht(\`/\${z}/\${s}\`,{append_to_response:"credits,videos,external_ids"});if(!r)return Bd(s)||null;const E=Pt(r,v);if(E.imdbId=r.imdb_id||r.external_ids?.imdb_id,E.duration=z==="movie"?\`\${Math.floor(r.runtime/60)}h \${r.runtime%60}m\`:\`\${r.episode_run_time?.[0]||45}m/ep\`,E.genres=r.genres?.map(M=>M.name)||[],z==="tv"?(E.seasons=r.number_of_seasons,E.episodes=r.number_of_episodes,E.status=r.status==="Ended"?"Completed":"Ongoing",E.network=r.networks?.[0]?.name):E.studio=r.production_companies?.[0]?.name,r.credits?.cast&&(E.cast=r.credits.cast.slice(0,10).map(M=>({id:String(M.id),name:M.name,character:M.character,photo:M.profile_path?\`\${En}/w185\${M.profile_path}\`:\`https://ui-avatars.com/api/?name=\${encodeURIComponent(M.name)}&background=random\`}))),r.videos?.results){const M=r.videos.results;let w=M.find(_=>_.type==="Trailer"&&_.site==="YouTube");w||(w=M.find(_=>(_.type==="Teaser"||_.type==="Clip"||_.type==="Featurette")&&_.site==="YouTube")),!w&&M.length>0&&(w=M.find(_=>_.site==="YouTube")),w&&(E.trailerUrl=\`https://www.youtube.com/embed/\${w.key}\`)}return E;
}
`;

targetFiles.forEach(file => {
  if (!fs.existsSync(file)) return;
  console.log('Processing:', file);
  let content = fs.readFileSync(file, 'utf8');

  // Find start of Og=async()
  const startIdx = content.indexOf('Og=async()');
  const endIdx = content.indexOf('return E},Qg=', startIdx);

  if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find target function range in', file);
    return;
  }

  // Backup file
  fs.writeFileSync(file + '.bak', content);

  const prefix = content.substring(0, startIdx);
  const suffix = content.substring(endIdx + 'return E}'.length);

  const updatedContent = prefix + hicineAdapterCode + newServices + suffix;
  fs.writeFileSync(file, updatedContent, 'utf8');
  console.log('✅ Successfully patched', file);
});
