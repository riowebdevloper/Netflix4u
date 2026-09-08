const fs = require('fs');

function cleanMovieTitle(raw) {
  if (!raw) return 'Untitled';
  let t = raw.replace(/&#039;/g, "'").replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  t = t.replace(/(\d{4})([a-zA-Z]+)/g, '$1 $2').replace(/([a-zA-Z]+)(\d{4})/g, '$1 $2');
  t = t.replace(/\[[^\]]*\]/gi, ' ').replace(/\([^\)]*\)/gi, ' ').replace(/\{[^\}]*\}/gi, ' ');
  
  // Cut off everything from Season / Ep / Episode / S01 / E01
  t = t.replace(/\b(?:Season\s*\d+|S\d{1,2}|Ep(?:isode)?\s*\d+|All\s*Episodes?|Complete\s*Season).*$/gi, '');
  
  // Cut off from Year onwards if followed by metadata/resolution/audio
  t = t.replace(/\b(19\d{2}|20\d{2}|29\d{2})\b\s*(?:Hindi|English|Tamil|Telugu|Dual|Multi|Audio|Dubbed|WEB|HQ|HDTC|720p|1080p|480p|2160p|Season|Ep|Bengali|Hoichoi|Hulu|Netflix|Prime|Hotstar|Zee5|SonyLiv|Aha|All|$).*$/gi, '');
  t = t.replace(/\b(19\d{2}|20\d{2})\s*$/gi, '');
  
  // Clean platform/OTT names
  t = t.replace(/\b(?:JioHotstar|Hotstar|Netflix|Prime(?:\s*Video)?|Zee5|SonyLiv|Disney\+?|Hulu|Hoichoi|Aha|Voot|MX\s*Player|Apple(?:\s*TV)?)\s*(?:Original)?\b/gi, '');
  
  // Clean audio / language tags
  t = t.replace(/\b(?:Hindi|English|Tamil|Telugu|Malayalam|Kannada|Bengali|Korean|Japanese|Chinese|Marathi|Punjabi|Multi|Dual|Line|Portuguese|Indonesian|Spanish|French|German|Russian|Italian|Turkish|Arabic)\s*(?:-|–|—)?\s*(?:Audio|Dubbed)?\b/gi, '');
  t = t.replace(/\b(?:Audio|Dubbed|Subbed|Original Audio|Clean Audio|Line Audio|With\s*(?:English\s*)?Subtitles?)\b/gi, '');
  
  // Clean resolutions and formats (including separated '1080 p')
  t = t.replace(/\b(?:\d{3,4}\s*p|2160p|1080p|720p|480p|576p|4K|FHD|UHD|HD|SD|HQ)\b/gi, '');
  t = t.replace(/\b(?:WEB[- ]?DL|WEB[- ]?Rip|HQ[- ]?HDTC|HDTC|HDRip|BluRay|Blu[- ]?Ray|BRRip|DVDRip|DVD|Pre[- ]?DVD|HEVC|x264|x265|CamRip|CAM|Rip|Line)\b/gi, '');
  t = t.replace(/\b(?:Web|Original|Grand Premiere|Premiere|Special Task Force|Uncut|Extended Cut|Directors Cut)\b/gi, '');

  t = t.replace(/[-–—:|/\\]+\s*$/g, '').replace(/^\s*[-–—:|/\\]+/g, '').replace(/\s{2,}/g, ' ').trim();
  t = t.replace(/[-–—:|/\\]+\s*$/g, '').trim();
  return t || raw.trim();
}

const dotmobiz = JSON.parse(fs.readFileSync('data/dotmobiz_complete_catalog.json', 'utf8'));
const longDot = dotmobiz.map(m => ({ orig: m.rawTitle || m.title, clean: cleanMovieTitle(m.rawTitle || m.title) })).filter(x => x.clean.length > 20).slice(0, 20);
console.log('Sample cleaned titles in dotmobiz:');
longDot.forEach(x => console.log(x.clean, '  <==  ', x.orig));
