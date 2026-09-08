const fs = require('fs');
const path = require('path');

function patchFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // 1. Patch mapHicineItem
  const targetMap = `function mapHicineItem(item, defaultType = "movie") {
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
}`;

  const replacementMap = `function cleanMovieTitle(raw) {
  if (!raw) return 'Untitled';
  let t = raw.replace(/&#039;/g, "'").replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  t = t.replace(/(\\d{4})([a-zA-Z]+)/g, '$1 $2').replace(/([a-zA-Z]+)(\\d{4})/g, '$1 $2');
  t = t.replace(/\\[[^\\]]*\\]/gi, ' ').replace(/\\([^\\)]*\\)/gi, ' ');
  t = t.replace(/\\bSeason\\s*\\d+\\b/gi, '').replace(/\\bS\\d{1,2}(?:E\\d{1,2})?\\b/gi, '').replace(/\\b(?:Ep(?:isode)?\\s*\\d+(?:\\s*(?:Added|New))?)\\b/gi, '').replace(/\\bAll\\s*Episodes?\\b/gi, '').replace(/\\bWeb[- ]?Series\\b/gi, '');
  t = t.replace(/\\b(19\\d{2}|20\\d{2}|29\\d{2})\\b\\s*(?:Hindi|English|Tamil|Telugu|Dual|Multi|Audio|Dubbed|WEB|HQ|HDTC|720p|1080p|Season|Ep|All|$).*$/gi, '');
  t = t.replace(/\\b(19\\d{2}|20\\d{2})\\s*$/gi, '');
  t = t.replace(/\\b(?:Hindi|English|Tamil|Telugu|Malayalam|Kannada|Bengali|Korean|Japanese|Chinese|Marathi|Punjabi|Multi|Dual|Line)\\s*(?:-|–|—)?\\s*(?:Audio|Dubbed)?\\b/gi, '');
  t = t.replace(/\\b(?:Audio|Dubbed|Subbed|Original Audio|Clean Audio|Line Audio)\\b/gi, '');
  t = t.replace(/\\b(?:WEB[- ]?DL|HQ[- ]?HDTC|HDTC|HDRip|BluRay|BRRip|DVDRip|DVD|Pre[- ]?DVD|HEVC|x264|x265|2160p|1080p|720p|480p|4K|FHD|UHD|HD|SD|HQ|CamRip|CAM|Rip|Line)\\b/gi, '');
  t = t.replace(/\\b(?:JioHotstar|Hotstar|Netflix|Prime|Zee5|SonyLiv|Disney\\+?)\\b/gi, '');
  t = t.replace(/[-–—:|/\\\\]+\\s*$/g, '').replace(/^\\s*[-–—:|/\\\\]+/g, '').replace(/\\s{2,}/g, ' ').trim();
  t = t.replace(/[-–—:|/\\\\]+\\s*$/g, '').trim();
  return t || raw.trim();
}

function mapHicineItem(item, defaultType = "movie") {
  if (!item) return null;
  const id = String(item.record_id || item.id || item._id);
  const rawTitle = item.rawTitle || item.title || "Untitled";
  const cleanTitle = cleanMovieTitle(item.title || item.rawTitle || "Untitled");
  const poster = item.poster || item.featured_image || "https://placehold.co/500x750/111427/ffffff?text=No+Poster";
  const backdrop = item.backdrop || item.featured_image || poster;
  const cats = Array.isArray(item.categories) ? item.categories : (typeof item.categories === "string" ? item.categories.split(",").map(c => c.trim()).filter(Boolean) : []);
  
  const isSeries = item.type === "series" || (item.contentType && item.contentType.includes("series")) || cats.some(c => /series/i.test(c));
  const isAnime = item.type === "anime" || cats.some(c => /anime/i.test(c));
  const isKdrama = cats.some(c => /korean|kdrama|k-drama/i.test(c));
  const type = isAnime ? "anime" : (isKdrama ? "kdrama" : (isSeries ? "series" : (item.type || defaultType)));

  return {
    id,
    imdbId: item.imdbId || "",
    tmdbId: item.tmdbId || "",
    type,
    title: cleanTitle,
    originalTitle: rawTitle,
    poster,
    backdrop,
    description: item.overview || item.description || item.content || ("Watch " + cleanTitle + " in high quality with multiple servers and fast download options on FlixWorld."),
    shortDescription: (item.overview || item.description || item.content || "").slice(0, 120),
    year: item.year || parseInt((rawTitle.match(/\\b(19\\d{2}|20\\d{2})\\b/) || [0, 2026])[1]),
    rating: item.rating ? parseFloat(item.rating) : 8.5,
    votes: item.votes || "14.2K",
    quality: item.quality || "FHD",
    duration: item.duration || item.runtime || (type === "movie" ? "2h 10m" : "~45m/ep"),
    genres: (item.genres && item.genres.length > 0) ? item.genres : cats.filter(c => !/^\\d+p$/i.test(c) && !/^\\d{4}$/.test(c)).slice(0, 4),
    language: item.language || cats.find(c => /hindi|dual|english|tamil|telugu/i.test(c)) || "Hindi / Dual Audio",
    country: item.country || (cats.some(c => /bollywood/i.test(c)) ? "India" : "Global"),
    director: item.director || "Director",
    cast: item.cast || [],
    screenshots: item.screenshots || [],
    trailerUrl: item.trailerUrl || "",
    trending: true,
    featured: true,
    topRated: true,
    recentlyAdded: true,
    links: item.links || item.downloadOptions || item.downloads || [],
    rawLinks: item.rawLinks || item.links || ""
  };
}`;

  if (code.includes(targetMap)) {
    code = code.replace(targetMap, replacementMap);
    console.log(`✅ Patched mapHicineItem in ${filePath}`);
  } else {
    console.error(`❌ Could not match targetMap in ${filePath}`);
  }

  // 2. Patch TMDB detail fallback
  const targetHtDetail = `const z=v==="series"||v==="anime"||v==="kdrama"?"tv":"movie",r=await Ht(\`/\${z}/\${s}\`,{append_to_response:"credits,videos,external_ids"});if(!r)return Bd(s)||null;`;
  const replHtDetail = `if(!/^\\d+$/.test(String(s)))return Bd(s)||null;const z=v==="series"||v==="anime"||v==="kdrama"?"tv":"movie",r=await Ht(\`/\${z}/\${s}\`,{append_to_response:"credits,videos,external_ids"});if(!r)return Bd(s)||null;`;
  if (code.includes(targetHtDetail)) {
    code = code.replace(targetHtDetail, replHtDetail);
    console.log(`✅ Patched TMDB detail fallback in ${filePath}`);
  }

  // 3. Patch Qg recommendations
  const targetQg = `Qg=async(s,v)=>{const r=await Ht(\`/\${v==="series"||v==="anime"||v==="kdrama"?"tv":"movie"}/\${s}/recommendations\`);return r?r?.results?r.results.slice(0,12).map(E=>Pt(E,v)):[]:K0(s)}`;
  const replQg = `Qg=async(s,v)=>{if(!/^\\d+$/.test(String(s)))return K0(s);let r=null;try{r=await Ht(\`/\${v==="series"||v==="anime"||v==="kdrama"?"tv":"movie"}/\${s}/recommendations\`)}catch(e){}return r?r?.results?r.results.slice(0,12).map(E=>Pt(E,v)):[]:K0(s)}`;
  if (code.includes(targetQg)) {
    code = code.replace(targetQg, replQg);
    console.log(`✅ Patched Qg recommendations in ${filePath}`);
  }

  // 4. Patch Lg seasons
  const targetLg = `Lg=async s=>{const v=await Ht(\`/tv/\${s}\`);return!v||!v.seasons?[]:v.seasons.filter(z=>z.season_number>0).map(z=>({id:z.id,season_number:z.season_number,name:z.name,episode_count:z.episode_count,poster_path:z.poster_path?\`\${En}/w300\${z.poster_path}\`:null,air_date:z.air_date||"",overview:z.overview||""}))}`;
  const replLg = `Lg=async s=>{if(!/^\\d+$/.test(String(s)))return[];let v=null;try{v=await Ht(\`/tv/\${s}\`)}catch(e){}return!v||!v.seasons?[]:v.seasons.filter(z=>z.season_number>0).map(z=>({id:z.id,season_number:z.season_number,name:z.name,episode_count:z.episode_count,poster_path:z.poster_path?\`\${En}/w300\${z.poster_path}\`:null,air_date:z.air_date||"",overview:z.overview||""}))}`;
  if (code.includes(targetLg)) {
    code = code.replace(targetLg, replLg);
    console.log(`✅ Patched Lg seasons in ${filePath}`);
  }

  // 5. Patch Vg episodes
  const targetVg = `Vg=async(s,v)=>{const z=await Ht(\`/tv/\${s}/season/\${v}\`);return!z||!z.episodes?[]:z.episodes.map(r=>({id:r.id,name:r.name,episode_number:r.episode_number,season_number:r.season_number,overview:r.overview||"",still_path:r.still_path?\`\${En}/w300\${r.still_path}\`:null,runtime:r.runtime||null,air_date:r.air_date||"",vote_average:r.vote_average||0}))};`;
  const replVg = `Vg=async(s,v)=>{if(!/^\\d+$/.test(String(s)))return[];let z=null;try{z=await Ht(\`/tv/\${s}/season/\${v}\`)}catch(e){}return!z||!z.episodes?[]:z.episodes.map(r=>({id:r.id,name:r.name,episode_number:r.episode_number,season_number:r.season_number,overview:r.overview||"",still_path:r.still_path?\`\${En}/w300\${r.still_path}\`:null,runtime:r.runtime||null,air_date:r.air_date||"",vote_average:r.vote_average||0}))};`;
  if (code.includes(targetVg)) {
    code = code.replace(targetVg, replVg);
    console.log(`✅ Patched Vg episodes in ${filePath}`);
  }

  fs.writeFileSync(filePath, code);
  console.log(`🎉 Successfully updated ${filePath}`);
}

patchFile('js/index-CQL8lqua.js');
patchFile('assets/index-CQL8lqua.js');
