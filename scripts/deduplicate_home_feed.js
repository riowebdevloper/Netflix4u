const fs = require('fs');
const path = require('path');

function cleanMovieTitle(raw) {
  if (!raw) return 'Untitled';
  let t = raw.replace(/&#039;/g, "'").replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  t = t.replace(/(\d{4})([a-zA-Z]+)/g, '$1 $2').replace(/([a-zA-Z]+)(\d{4})/g, '$1 $2');
  t = t.replace(/\[[^\]]*\]/gi, ' ').replace(/\([^\)]*\)/gi, ' ').replace(/\{[^\}]*\}/gi, ' ');
  
  // Cut off everything from Season / Ep / Episode / S01 / E01
  t = t.replace(/\b(?:Season\s*\d+|S\d{1,2}|Ep(?:isode)?\s*\d+|All\s*Episodes?|Complete\s*Season).*$/gi, '');
  
  // Cut off from Year onwards if followed by metadata/resolution/audio
  t = t.replace(/\b(19\d{2}|20\d{2}|29\d{2})\b\s*(?:[A-Za-z]+)?\s*(?:Audio|Dubbed|Web|Rip|720p|1080p|480p|576p|2160p|Season|Ep|Bengali|Hoichoi|Hulu|Netflix|Prime|Hotstar|Zee5|SonyLiv|Aha|All|$).*$/gi, '');
  t = t.replace(/\b(19\d{2}|20\d{2})\s*$/gi, '');
  
  // Clean platform/OTT names
  t = t.replace(/\b(?:JioHotstar|Hotstar|Netflix|Prime(?:\s*Video)?|Zee5|SonyLiv|Disney\+?|Hulu|Hoichoi|Aha|Voot|MX\s*Player|Apple(?:\s*TV)?)\s*(?:Original)?\b/gi, '');
  
  // Clean audio / language tags
  t = t.replace(/\b(?:Hindi|English|Tamil|Telugu|Malayalam|Kannada|Bengali|Korean|Japanese|Chinese|Marathi|Punjabi|Multi|Dual|Line|Portuguese|Indonesian|Spanish|French|German|Russian|Italian|Turkish|Arabic|Gujarati)\s*(?:-|–|—)?\s*(?:Audio|Dubbed)?\b/gi, '');
  t = t.replace(/\b(?:Audio|Dubbed|Subbed|Original Audio|Clean Audio|Line Audio|With\s*(?:English\s*)?Subtitles?)\b/gi, '');
  
  // Clean resolutions and formats (including separated '1080 p')
  t = t.replace(/\b(?:\d{3,4}\s*p|2160p|1080p|720p|480p|576p|4K|FHD|UHD|HD|SD|HQ)\b/gi, '');
  t = t.replace(/\b(?:WEB[- ]?DL|WEB[- ]?Rip|HQ[- ]?HDTC|HDTC|HDRip|BluRay|Blu[- ]?Ray|BRRip|DVDRip|DVD|Pre[- ]?DVD|HEVC|x264|x265|CamRip|CAM|Rip|Line)\b/gi, '');
  t = t.replace(/\b(?:Web|Original|Grand Premiere|Premiere|Special Task Force|Uncut|Extended Cut|Directors Cut)\b/gi, '');

  t = t.replace(/[-–—:|/\\]+\s*$/g, '').replace(/^\s*[-–—:|/\\]+/g, '').replace(/\s{2,}/g, ' ').trim();
  t = t.replace(/[-–—:|/\\]+\s*$/g, '').trim();
  return t || raw.trim();
}

const feedPath = path.resolve(__dirname, '../data/home_feed.json');
const feed = JSON.parse(fs.readFileSync(feedPath, 'utf8'));

const movies = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/movies.json'), 'utf8'));
const series = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/series.json'), 'utf8'));
const dotmobiz = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/dotmobiz_complete_catalog.json'), 'utf8'));

function formatItem(raw, type = "movie") {
  const id = String(raw.record_id || raw.id || raw._id);
  const title = cleanMovieTitle(raw.title || raw.rawTitle || "Untitled");
  const poster = raw.poster || raw.featured_image || "https://placehold.co/500x750/111427/ffffff?text=No+Poster";
  const backdrop = raw.backdrop || raw.featured_image || poster;
  const cats = Array.isArray(raw.categories) ? raw.categories : (typeof raw.categories === "string" ? raw.categories.split(",").map(c => c.trim()).filter(Boolean) : []);
  
  return {
    id,
    imdbId: raw.imdbId || "",
    tmdbId: raw.tmdbId || "",
    type: raw.type || type,
    title,
    originalTitle: raw.rawTitle || raw.title || title,
    poster,
    backdrop,
    description: raw.overview || raw.description || raw.content || ("Watch " + title + " in full HD on FlixWorld."),
    shortDescription: (raw.overview || raw.description || raw.content || "").slice(0, 120),
    year: raw.year || parseInt((String(raw.title || '').match(/\b(19\d{2}|20\d{2})\b/) || [0, 2026])[1]),
    rating: raw.rating ? parseFloat(raw.rating) : 8.4,
    votes: raw.votes || "15.4K",
    quality: raw.quality || "FHD",
    duration: raw.duration || (type === "movie" ? "2h 05m" : "~45m/ep"),
    genres: (raw.genres && raw.genres.length > 0) ? raw.genres : cats.filter(c => !/^\d+p$/i.test(c) && !/^\d{4}$/.test(c)).slice(0, 3),
    language: raw.language || "Hindi / Dual Audio",
    country: raw.country || "Global",
    director: raw.director || "Director",
    cast: raw.cast || [],
    links: raw.links || raw.downloadOptions || []
  };
}

// Ensure titles in every category are properly cleaned and deduplicated
const seenIds = new Set();

// 1. Curated Featured Hero Banners (8 top blockbusters with stunning backdrops)
const featuredPool = [
  ...dotmobiz.filter(d => d.backdrop && d.backdrop.includes('image.tmdb.org') && d.rating >= 7.5),
  ...movies.filter(m => m.rating >= 8.0 && m.backdrop)
];

const featuredItems = [];
const featuredTitles = new Set();
for (const item of featuredPool) {
  const clean = cleanMovieTitle(item.title || item.rawTitle);
  if (featuredTitles.has(clean) || clean.length < 3) continue;
  featuredTitles.add(clean);
  featuredItems.push(formatItem(item, item.type || "movie"));
  if (featuredItems.length >= 8) break;
}

// 2. Curated Trending Titles (20 items, distinct from featured)
const trendingPool = [
  ...dotmobiz.slice(10, 80),
  ...movies.slice(5, 50)
];
const trendingItems = [];
const trendingTitles = new Set([...featuredTitles]);
for (const item of trendingPool) {
  const clean = cleanMovieTitle(item.title || item.rawTitle);
  if (trendingTitles.has(clean) || clean.length < 3) continue;
  trendingTitles.add(clean);
  trendingItems.push(formatItem(item, item.type || "movie"));
  if (trendingItems.length >= 20) break;
}

// 3. Curated Recent Releases (2026/2025 releases, distinct from trending)
const recentPool = [
  ...movies.filter(m => m.year === 2026 || m.year === 2025),
  ...dotmobiz.filter(d => d.year === 2026 || d.year === 2025)
];
const recentItems = [];
const recentTitles = new Set([...featuredTitles, ...trendingTitles]);
for (const item of recentPool) {
  const clean = cleanMovieTitle(item.title || item.rawTitle);
  if (recentTitles.has(clean) || clean.length < 3) continue;
  recentTitles.add(clean);
  recentItems.push(formatItem(item, item.type || "movie"));
  if (recentItems.length >= 20) break;
}

// 4. Clean up titles in popularMovies, popularSeries, anime, kdrama, topRated, nowPlaying
function cleanList(list, defaultType) {
  const seen = new Set();
  const res = [];
  for (const item of list) {
    const clean = cleanMovieTitle(item.title || item.rawTitle);
    if (seen.has(clean) || clean.length < 2) continue;
    seen.add(clean);
    item.title = clean;
    if (item.poster && item.poster.includes('storage.hicine.sbs/images') && item.poster.includes('WEB-DL2')) {
      // replace screenshot with fallback if available
      item.poster = "https://image.tmdb.org/t/p/w500/wAwyhGDOdeqeWW9OGVQfRULiSzj.jpg";
    }
    res.push(formatItem(item, item.type || defaultType));
  }
  return res;
}

feed.featured = featuredItems.length >= 6 ? featuredItems : feed.featured.map(x => formatItem(x));
feed.trending = trendingItems.length >= 15 ? trendingItems : feed.trending.map(x => formatItem(x));
feed.recent = recentItems.length >= 15 ? recentItems : feed.recent.map(x => formatItem(x));
feed.popularMovies = cleanList(feed.popularMovies, "movie");
feed.popularSeries = cleanList(feed.popularSeries, "series");
feed.anime = cleanList(feed.anime, "anime");
feed.kdrama = cleanList(feed.kdrama, "kdrama");
feed.topRated = cleanList(feed.topRated, "movie");
feed.nowPlaying = cleanList(feed.nowPlaying, "movie");

fs.writeFileSync(feedPath, JSON.stringify(feed, null, 2), 'utf8');
console.log('✅ Deduplicated and enriched data/home_feed.json successfully!');
console.log('Featured:', feed.featured.length, 'Trending:', feed.trending.length, 'Recent:', feed.recent.length);
