const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.resolve(__dirname, '../js/index-CQL8lqua.js'),
  path.resolve(__dirname, '../assets/index-CQL8lqua.js')
];

for (const file of targetFiles) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');

  // 1. Update cleanMovieTitle
  const cleanTitleStart = code.indexOf('function cleanMovieTitle(raw) {');
  const cleanTitleEnd = code.indexOf('function mapHicineItem(item, defaultType = "movie") {');
  if (cleanTitleStart !== -1 && cleanTitleEnd !== -1) {
    const newCleanTitle = `function cleanMovieTitle(raw) {
  if (!raw) return 'Untitled';
  let t = raw.replace(/&#039;/g, "'").replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  t = t.replace(/(\\d{4})([a-zA-Z]+)/g, '$1 $2').replace(/([a-zA-Z]+)(\\d{4})/g, '$1 $2');
  t = t.replace(/\\[[^\\]]*\\]/gi, ' ').replace(/\\([^\\)]*\\)/gi, ' ').replace(/\\{[^\\}]*\\}/gi, ' ');
  
  // Cut off everything from Season / Ep / Episode / S01 / E01
  t = t.replace(/\\b(?:Season\\s*\\d+|S\\d{1,2}|Ep(?:isode)?\\s*\\d+|All\\s*Episodes?|Complete\\s*Season).*$/gi, '');
  
  // Cut off from Year onwards if followed by metadata/resolution/audio
  t = t.replace(/\\b(19\\d{2}|20\\d{2}|29\\d{2})\\b\\s*(?:[A-Za-z]+)?\\s*(?:Audio|Dubbed|Web|Rip|720p|1080p|480p|576p|2160p|Season|Ep|Bengali|Hoichoi|Hulu|Netflix|Prime|Hotstar|Zee5|SonyLiv|Aha|All|$).*$/gi, '');
  t = t.replace(/\\b(19\\d{2}|20\\d{2})\\s*$/gi, '');
  
  // Clean platform/OTT names
  t = t.replace(/\\b(?:JioHotstar|Hotstar|Netflix|Prime(?:\\s*Video)?|Zee5|SonyLiv|Disney\\+?|Hulu|Hoichoi|Aha|Voot|MX\\s*Player|Apple(?:\\s*TV)?)\\s*(?:Original)?\\b/gi, '');
  
  // Clean audio / language tags
  t = t.replace(/\\b(?:Hindi|English|Tamil|Telugu|Malayalam|Kannada|Bengali|Korean|Japanese|Chinese|Marathi|Punjabi|Multi|Dual|Line|Portuguese|Indonesian|Spanish|French|German|Russian|Italian|Turkish|Arabic|Gujarati)\\s*(?:-|–|—)?\\s*(?:Audio|Dubbed)?\\b/gi, '');
  t = t.replace(/\\b(?:Audio|Dubbed|Subbed|Original Audio|Clean Audio|Line Audio|With\\s*(?:English\\s*)?Subtitles?)\\b/gi, '');
  
  // Clean resolutions and formats (including separated '1080 p')
  t = t.replace(/\\b(?:\\d{3,4}\\s*p|2160p|1080p|720p|480p|576p|4K|FHD|UHD|HD|SD|HQ)\\b/gi, '');
  t = t.replace(/\\b(?:WEB[- ]?DL|WEB[- ]?Rip|HQ[- ]?HDTC|HDTC|HDRip|BluRay|Blu[- ]?Ray|BRRip|DVDRip|DVD|Pre[- ]?DVD|HEVC|x264|x265|CamRip|CAM|Rip|Line)\\b/gi, '');
  t = t.replace(/\\b(?:Web|Original|Grand Premiere|Premiere|Special Task Force|Uncut|Extended Cut|Directors Cut)\\b/gi, '');

  t = t.replace(/[-–—:|/\\\\]+\\s*$/g, '').replace(/^\\s*[-–—:|/\\\\]+/g, '').replace(/\\s{2,}/g, ' ').trim();
  t = t.replace(/[-–—:|/\\\\]+\\s*$/g, '').trim();
  return t || raw.trim();
}

`;
    code = code.substring(0, cleanTitleStart) + newCleanTitle + code.substring(cleanTitleEnd);
    console.log('✅ Updated cleanMovieTitle in:', path.basename(file));
  }

  // 2. Update pg() to store flix_last_catalog
  const oldPg = 'function pg(){const{pathname:s}=Af();return H.useEffect(()=>{window.scrollTo(0,0)},[s]),null}';
  const newPg = 'function pg(){const s=Af();return H.useEffect(()=>{window.scrollTo(0,0);if(s&&s.pathname&&!s.pathname.startsWith("/movie/")&&!s.pathname.startsWith("/series/")&&!s.pathname.startsWith("/anime/")&&!s.pathname.startsWith("/kdrama/")){try{sessionStorage.setItem("flix_last_catalog",s.pathname+(s.search||""))}catch(e){}}},[s]),null}';
  if (code.includes(oldPg)) {
    code = code.replace(oldPg, newPg);
    console.log('✅ Updated pg() with flix_last_catalog tracking in:', path.basename(file));
  }

  // 3. Update kg(s,v) filter function to support smart language matching
  const oldKg = 'function kg(s,v){let z=s.filter(r=>{if(v.query){const E=v.query.toLowerCase();if(!r.title.toLowerCase().includes(E)&&!r.description.toLowerCase().includes(E))return!1}if(v.genre&&v.genre!=="All"&&!r.genres.includes(v.genre)||v.year&&v.year!=="All"&&String(r.year)!==v.year)return!1;if(v.rating&&v.rating!=="All"){const E=parseFloat(v.rating.replace("+",""));if(r.rating<E)return!1}return!(v.language&&v.language!=="All"&&r.language!==v.language||v.quality&&v.quality!=="All"&&r.quality!==v.quality)});return v.sortBy&&v.sortBy!=="relevance"&&(z=[...z].sort((r,E)=>{switch(v.sortBy){case"rating-desc":return E.rating-r.rating;case"rating-asc":return r.rating-E.rating;case"year-desc":return E.year-r.year;case"year-asc":return r.year-E.year;case"title-asc":return r.title.localeCompare(E.title);case"title-desc":return E.title.localeCompare(r.title);default:return 0}})),z}';
  
  const newKg = `function kg(s,v){function mL(item,target){if(!target||target==="All")return true;const t=target.toLowerCase();const hay=((item.language||"")+" "+(item.originalTitle||"")+" "+(item.title||"")+" "+(Array.isArray(item.genres)?item.genres.join(" "):"")+" "+(item.type||"")+" "+(Array.isArray(item.links)?item.links.map(l=>l.quality+" "+l.label).join(" "):"")).toLowerCase();if(t==="hindi")return hay.includes("hindi")||hay.includes("dual audio")||hay.includes("dual")||hay.includes("bollywood");if(t==="english")return hay.includes("english")||hay.includes("hollywood")||hay.includes("dual audio")||hay.includes("dual");if(t==="korean")return item.type==="kdrama"||hay.includes("korean")||hay.includes("kdrama");if(t==="japanese")return item.type==="anime"||hay.includes("japanese")||hay.includes("anime");if(t==="tamil")return hay.includes("tamil");if(t==="telugu")return hay.includes("telugu");return hay.includes(t)}let z=s.filter(r=>{if(v.query){const E=v.query.toLowerCase();if(!r.title.toLowerCase().includes(E)&&!r.description.toLowerCase().includes(E))return!1}if(v.genre&&v.genre!=="All"&&!r.genres.includes(v.genre)||v.year&&v.year!=="All"&&String(r.year)!==v.year)return!1;if(v.rating&&v.rating!=="All"){const E=parseFloat(v.rating.replace("+",""));if(r.rating<E)return!1}if(v.language&&v.language!=="All"&&!mL(r,v.language))return!1;return!(v.quality&&v.quality!=="All"&&r.quality!==v.quality)});return v.sortBy&&v.sortBy!=="relevance"&&(z=[...z].sort((r,E)=>{switch(v.sortBy){case"rating-desc":return E.rating-r.rating;case"rating-asc":return r.rating-E.rating;case"year-desc":return E.year-r.year;case"year-asc":return r.year-E.year;case"title-asc":return r.title.localeCompare(E.title);case"title-desc":return E.title.localeCompare(r.title);default:return 0}})),z}`;

  if (code.includes(oldKg)) {
    code = code.replace(oldKg, newKg);
    console.log('✅ Updated kg(s,v) filter function with smart language matching in:', path.basename(file));
  }

  // 4. Update eg top category pills
  const oldEg = 'const eg=[{label:"Trending",href:"/trending",emoji:"🔥"},{label:"Latest Release",href:"/movies",emoji:"🚀"},{label:"Movies",href:"/movies",emoji:"🎬"},{label:"Web Series",href:"/series",emoji:"📺"},{label:"Anime",href:"/anime",emoji:"⚔️"},{label:"K-Drama",href:"/kdrama",emoji:"💖"},{label:"Top Rated",href:"/genres",emoji:"⭐"},{label:"Genres",href:"/genres",emoji:"🎭"}]';
  const newEg = 'const eg=[{label:"Trending",href:"/trending",emoji:"🔥"},{label:"Hindi Dubbed",href:"/movies?language=Hindi",emoji:"🇮🇳"},{label:"Hollywood",href:"/movies?language=English",emoji:"🍿"},{label:"Movies",href:"/movies",emoji:"🎬"},{label:"Web Series",href:"/series",emoji:"📺"},{label:"K-Drama",href:"/kdrama",emoji:"💖"},{label:"Anime",href:"/anime",emoji:"⚔️"},{label:"Top Rated",href:"/genres",emoji:"⭐"},{label:"Genres",href:"/genres",emoji:"🎭"}]';

  if (code.includes(oldEg)) {
    code = code.replace(oldEg, newEg);
    console.log('✅ Updated top nav categories eg with language shortcuts in:', path.basename(file));
  }

  fs.writeFileSync(file, code, 'utf8');
}
