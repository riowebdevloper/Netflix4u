const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.join(__dirname, '..', 'js', 'index-CQL8lqua.js'),
  path.join(__dirname, '..', 'assets', 'index-CQL8lqua.js')
];

const newAdapterCode = `// --- FlixWorld Hicine Database Adapter & Secret Key Config ---
const HICINE_CONFIG = {
  apiBase: 'https://api.hicine.sbs',
  apiKey: '',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'x-client': 'flixworld-web'
  }
};

const HICINE_DATA = {
  homeFeed: null,
  trending: null,
  recent: null,
  summary: null,
  anime: null,
  cache: new Map()
};

let homeFeedPromise = null;
let summaryPromise = null;

async function getLocalJson(name) {
  try {
    const res = await fetch('/data/' + name);
    if (res.ok) return await res.json();
  } catch(e) {}
  return null;
}

async function getHomeFeed() {
  if (HICINE_DATA.homeFeed) return HICINE_DATA.homeFeed;
  if (!homeFeedPromise) {
    homeFeedPromise = (async () => {
      try {
        const feed = await getLocalJson("home_feed.json");
        if (feed && Object.keys(feed).length > 0) {
          HICINE_DATA.homeFeed = feed;
          return feed;
        }
      } catch(e) {}
      homeFeedPromise = null;
      return null;
    })();
  }
  return homeFeedPromise;
}

async function getSummaryCatalog() {
  if (HICINE_DATA.summary && HICINE_DATA.summary.length > 0) {
    return HICINE_DATA.summary;
  }
  if (!summaryPromise) {
    summaryPromise = (async () => {
      try {
        const data = await getLocalJson("catalog_summary.json");
        HICINE_DATA.summary = data || [];
        return HICINE_DATA.summary;
      } catch(e) {
        summaryPromise = null;
        return [];
      }
    })();
  }
  return summaryPromise;
}

async function getTrailerForTitle(title, year, type = "movie") {
  try {
    const res = await fetch("/api/trailer?title=" + encodeURIComponent(title) + "&year=" + encodeURIComponent(year || "") + "&type=" + encodeURIComponent(type || "movie"));
    if (res.ok) {
      const data = await res.json();
      if (data && data.trailerUrl) return data.trailerUrl;
    }
  } catch(e) {}
  const clean = title.replace(/\\(\\d{4}\\)/g, "").replace(/^(NetFlix|Prime|Disney\\+|Hotstar|SonyLIV|ZEE5)\\s+/i, "").trim();
  return "https://www.youtube.com/embed?listType=search&list=" + encodeURIComponent(clean + " official trailer");
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

// 1. Og -> Trending
const Og=async()=>{
  try {
    const feed = await getHomeFeed();
    if (feed && feed.trending && feed.trending.length > 0) {
      return feed.trending.map(t => mapHicineItem(t, "movie"));
    }
    if (!HICINE_DATA.trending) HICINE_DATA.trending = await getLocalJson("trending.json");
    if (HICINE_DATA.trending && HICINE_DATA.trending.length > 0) {
      return HICINE_DATA.trending.map(t => mapHicineItem(t, "movie"));
    }
  } catch(e) {}
  const s=await Ht("/trending/all/day");return s?s?.results?s.results.map(v=>Pt(v)).filter(v=>v.backdrop&&!v.backdrop.includes("No+Backdrop")):[]:R0();
};

// 2. wg -> Featured (Hero banner)
const wg=async()=>{
  try {
    const feed = await getHomeFeed();
    if (feed && feed.featured && feed.featured.length > 0) {
      return feed.featured.slice(0, 8).map(t => mapHicineItem(t, "movie"));
    }
    if (!HICINE_DATA.trending) HICINE_DATA.trending = await getLocalJson("trending.json");
    if (HICINE_DATA.trending && HICINE_DATA.trending.length > 0) {
      return HICINE_DATA.trending.slice(0, 8).map(t => mapHicineItem(t, "movie"));
    }
  } catch(e) {}
  const s=await Ht("/movie/now_playing");return s?s?.results?s.results.slice(0,8).map(v=>Pt(v,"movie")).filter(v=>v.backdrop&&!v.backdrop.includes("No+Backdrop")):[]:Y0();
};

// 3. Hg -> Top Rated / 4K
const Hg=async()=>{
  try {
    const feed = await getHomeFeed();
    if (feed && feed.topRated && feed.topRated.length > 0) {
      return feed.topRated.map(t => mapHicineItem(t, "movie"));
    }
    const summary = await getSummaryCatalog();
    if (summary.length > 0) {
      return summary.filter(s => s.type === "movie" && s.quality === "4K").slice(0, 18).map(t => mapHicineItem(t, "movie"));
    }
  } catch(e) {}
  const s=await Ht("/movie/top_rated");return s?s?.results?s.results.map(v=>Pt(v,"movie")):[]:G0();
};

// 4. Cg -> Recently Added
const Cg=async()=>{
  try {
    const feed = await getHomeFeed();
    if (feed && feed.recent && feed.recent.length > 0) {
      return feed.recent.map(t => mapHicineItem(t, "movie"));
    }
    if (!HICINE_DATA.recent) HICINE_DATA.recent = await getLocalJson("recent.json");
    if (HICINE_DATA.recent && HICINE_DATA.recent.length > 0) {
      return HICINE_DATA.recent.map(t => mapHicineItem(t, "movie"));
    }
  } catch(e) {}
  const s=await Ht("/movie/now_playing");return s?s?.results?s.results.map(v=>Pt(v,"movie")):[]:X0();
};

// 5. qg -> Popular Movies
const qg=async()=>{
  try {
    const feed = await getHomeFeed();
    if (feed && feed.popularMovies && feed.popularMovies.length > 0) {
      return feed.popularMovies.map(t => mapHicineItem(t, "movie"));
    }
    const summary = await getSummaryCatalog();
    if (summary.length > 0) {
      return summary.filter(s => s.type === "movie").slice(0, 20).map(t => mapHicineItem(t, "movie"));
    }
  } catch(e) {}
  const s=await Ht("/movie/popular");return s?s?.results?s.results.map(v=>Pt(v,"movie")):[]:Cd();
};

// 6. Bg -> Popular Series
const Bg=async()=>{
  try {
    const feed = await getHomeFeed();
    if (feed && feed.popularSeries && feed.popularSeries.length > 0) {
      return feed.popularSeries.map(t => mapHicineItem(t, "series"));
    }
    const summary = await getSummaryCatalog();
    if (summary.length > 0) {
      return summary.filter(s => s.type === "series").slice(0, 20).map(t => mapHicineItem(t, "series"));
    }
  } catch(e) {}
  const s=await Ht("/tv/popular");return s?s?.results?s.results.map(v=>Pt(v,"series")):[]:qd();
};

// 7. Rg -> Movies Explorer
const Rg=async(s=1)=>{
  try {
    if (s === 1) {
      const feed = await getHomeFeed();
      if (feed && feed.popularMovies && feed.popularMovies.length > 0) {
        return feed.popularMovies.map(t => mapHicineItem(t, "movie"));
      }
    }
    const summary = await getSummaryCatalog();
    if (summary.length > 0) {
      const movies = summary.filter(x => x.type === "movie");
      const start = (s - 1) * 20;
      return movies.slice(start, start + 20).map(t => mapHicineItem(t, "movie"));
    }
  } catch(e) {}
  const v=await Ht("/discover/movie",{page:s,sort_by:"popularity.desc"});return v?v?.results?v.results.map(z=>Pt(z,"movie")):[]:Cd();
};

// 8. Yg -> TV Shows Explorer
const Yg=async(s=1)=>{
  try {
    if (s === 1) {
      const feed = await getHomeFeed();
      if (feed && feed.popularSeries && feed.popularSeries.length > 0) {
        return feed.popularSeries.map(t => mapHicineItem(t, "series"));
      }
    }
    const summary = await getSummaryCatalog();
    if (summary.length > 0) {
      const shows = summary.filter(x => x.type === "series");
      const start = (s - 1) * 20;
      return shows.slice(start, start + 20).map(t => mapHicineItem(t, "series"));
    }
  } catch(e) {}
  const v=await Ht("/discover/tv",{page:s,sort_by:"popularity.desc",without_genres:"16"});return v?v?.results?v.results.map(z=>Pt(z,"series")):[]:qd();
};

// 9. Gg -> Anime
const Gg=async(s=1)=>{
  try {
    if (s === 1) {
      const feed = await getHomeFeed();
      if (feed && feed.anime && feed.anime.length > 0) {
        return feed.anime.map(t => mapHicineItem(t, "anime"));
      }
    }
    if (!HICINE_DATA.anime) HICINE_DATA.anime = await getLocalJson("anime.json");
    if (HICINE_DATA.anime && HICINE_DATA.anime.length > 0) {
      const start = (s - 1) * 20;
      return HICINE_DATA.anime.slice(start, start + 20).map(t => mapHicineItem(t, "anime"));
    }
  } catch(e) {}
  const v=await Ht("/discover/tv",{page:s,sort_by:"popularity.desc",with_genres:"16",with_original_language:"ja"});return v?v?.results?v.results.map(z=>Pt(z,"anime")):[]:q0();
};

// 10. Xg -> KDrama
const Xg=async(s=1)=>{
  try {
    if (s === 1) {
      const feed = await getHomeFeed();
      if (feed && feed.kdrama && feed.kdrama.length > 0) {
        return feed.kdrama.map(t => mapHicineItem(t, "kdrama"));
      }
    }
    const summary = await getSummaryCatalog();
    if (summary.length > 0) {
      const kdrama = summary.filter(x => x.categories && x.categories.some(c => /korean|kdrama|k-drama/i.test(c)));
      const start = (s - 1) * 20;
      return kdrama.slice(start, start + 20).map(t => mapHicineItem(t, "kdrama"));
    }
  } catch(e) {}
  const v=await Ht("/discover/tv",{page:s,sort_by:"popularity.desc",with_original_language:"ko"});return v?v?.results?v.results.map(z=>Pt(z,"kdrama")):[]:B0();
};
`;

for (const filePath of targetFiles) {
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    continue;
  }

  let code = fs.readFileSync(filePath, 'utf8');
  const startMarker = '// --- FlixWorld Hicine Database Adapter & Secret Key Config ---';
  const endMarker = 'const $0=async s=>{';

  const startIndex = code.indexOf(startMarker);
  const endIndex = code.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    console.error('Markers not found in', filePath, { startIndex, endIndex });
    continue;
  }

  const updatedCode = code.slice(0, startIndex) + newAdapterCode + code.slice(endIndex);
  fs.writeFileSync(filePath, updatedCode, 'utf8');
  console.log('Successfully updated:', filePath);
}
