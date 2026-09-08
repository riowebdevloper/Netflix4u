/**
 * Netflix4U Dotmobiz Adapter
 * Transforms raw Dotmobiz (DLE) article data into the normalized Netflix4U data model.
 */

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&nbsp;/g, ' ');
}

function cleanMovieTitle(raw) {
  if (!raw) return 'Untitled';
  let t = decodeHtmlEntities(raw);

  // 0. Separate attached 4-digit years and words (e.g. "2021bengali" -> "2021 bengali")
  t = t.replace(/(\d{4})([a-zA-Z]+)/g, '$1 $2');
  t = t.replace(/([a-zA-Z]+)(\d{4})/g, '$1 $2');

  // 1. Remove bracketed or parenthesized information e.g. [EP-06 Added], [ALL EPISODES], (2026), (2024)
  t = t.replace(/\[[^\]]*\]/gi, ' ');
  t = t.replace(/\([^\)]*\)/gi, ' ');

  // 2. Remove Season / Episode / Series tags
  t = t.replace(/\bSeason\s*\d+\b/gi, '');
  t = t.replace(/\bS\d{1,2}(?:E\d{1,2})?\b/gi, '');
  t = t.replace(/\b(?:Ep(?:isode)?\s*\d+(?:\s*(?:Added|New))?)\b/gi, '');
  t = t.replace(/\bAll\s*Episodes?\b/gi, '');
  t = t.replace(/\bWeb[- ]?Series\b/gi, '');

  // 3. Cut off year and anything after it if year is followed by audio/quality/etc. or end of string
  t = t.replace(/\b(19\d{2}|20\d{2}|29\d{2})\b\s*(?:Hindi|English|Tamil|Telugu|Dual|Multi|Audio|Dubbed|WEB|HQ|HDTC|720p|1080p|Season|Ep|All|$).*$/gi, '');
  t = t.replace(/\b(19\d{2}|20\d{2})\s*$/gi, '');

  // 4. Remove Audio & Language tags anywhere at the end or standalone
  t = t.replace(/\b(?:Hindi|English|Tamil|Telugu|Malayalam|Kannada|Bengali|Korean|Japanese|Chinese|Marathi|Punjabi|Multi|Dual|Line)\s*(?:-|–|—)?\s*(?:Audio|Dubbed)?\b/gi, '');
  t = t.replace(/\b(?:Audio|Dubbed|Subbed|Original Audio|Clean Audio|Line Audio)\b/gi, '');

  // 5. Remove video quality & release tags
  t = t.replace(/\b(?:WEB[- ]?DL|HQ[- ]?HDTC|HDTC|HDRip|BluRay|BRRip|DVDRip|DVD|Pre[- ]?DVD|HEVC|x264|x265|2160p|1080p|720p|480p|4K|FHD|UHD|HD|SD|HQ|CamRip|CAM|Rip|Line)\b/gi, '');

  // 6. Remove platform names
  t = t.replace(/\b(?:JioHotstar|Hotstar|Netflix|Amazon|Prime|Zee5|SonyLiv|Disney\+?)\b/gi, '');

  // 7. Clean up trailing/leading punctuation, dangling hyphens/colons, and whitespace
  t = t.replace(/[-–—:|/\\]+\s*$/g, '');
  t = t.replace(/^\s*[-–—:|/\\]+/g, '');
  t = t.replace(/\s{2,}/g, ' ').trim();
  t = t.replace(/[-–—:|/\\]+\s*$/g, '').trim();

  return t || raw.trim();
}

const cleanDotmobizTitle = cleanMovieTitle;

function extractYear(title, dateStr) {
  const match = (title || '').match(/\b(19\d{2}|20\d{2})\b/);
  if (match) return parseInt(match[1], 10);
  if (dateStr) {
    const y = new Date(dateStr).getFullYear();
    if (!isNaN(y)) return y;
  }
  return 2026;
}

function extractQuality(title, downloads = []) {
  const text = `${title || ''} ${(downloads || []).map(d => d.quality).join(' ')}`;
  if (/2160p|4K/i.test(text)) return '4K';
  if (/1080p|FHD/i.test(text)) return 'FHD';
  if (/720p|HD/i.test(text)) return 'HD';
  if (/480p|SD/i.test(text)) return '480p';
  return 'FHD';
}

function extractAudioLanguage(title, rawLang) {
  const t = `${title || ''} ${rawLang || ''}`.toLowerCase();
  if (t.includes('dual') || (t.includes('hindi') && t.includes('english'))) return 'Hindi / Dual Audio';
  if (t.includes('hindi') && t.includes('tamil')) return 'Hindi - Tamil';
  if (t.includes('hindi') && t.includes('telugu')) return 'Hindi - Telugu';
  if (t.includes('hindi') && t.includes('malayalam')) return 'Hindi - Malayalam';
  if (t.includes('hindi') && t.includes('korean')) return 'Hindi - Korean';
  if (t.includes('hindi')) return 'Hindi';
  if (t.includes('english') || rawLang === 'en') return 'English';
  if (t.includes('telugu')) return 'Telugu';
  if (t.includes('tamil')) return 'Tamil';
  if (t.includes('malayalam') || rawLang === 'ml') return 'Malayalam';
  return 'Hindi / Dual Audio';
}

function extractGenres(rawGenres, title, overview) {
  if (Array.isArray(rawGenres) && rawGenres.length > 0) {
    return rawGenres;
  }
  const text = `${title || ''} ${overview || ''}`.toLowerCase();
  const found = [];
  const candidates = [
    'Action', 'Crime', 'Drama', 'Thriller', 'Comedy', 'Adventure', 
    'Animation', 'Sci-Fi', 'Horror', 'Mystery', 'Romance', 'Family'
  ];
  for (const c of candidates) {
    if (text.includes(c.toLowerCase())) found.push(c);
  }
  return found.length > 0 ? found.slice(0, 4) : ['Action', 'Drama'];
}

function normalizeDotmobizPost(raw) {
  if (!raw) return null;

  const rawTitle = raw.title || 'Untitled';
  const cleanTitle = cleanDotmobizTitle(rawTitle);
  const year = extractYear(rawTitle, raw.date);
  const quality = extractQuality(rawTitle, raw.downloads);
  const language = extractAudioLanguage(rawTitle, raw.language);
  const genres = extractGenres(raw.genres, rawTitle, raw.overview);

  // Check if series
  const isSeries = ((/season|web-series|\[ep|\bseries\b/i.test(rawTitle) || 
                    /season/i.test(raw.url || '') || 
                    raw.type === 'series' || 
                    raw.isSeries === true)) && !/the movie/i.test(rawTitle);
  
  const contentType = isSeries ? 'series' : 'movie';
  const id = `dotmobiz-${raw.postId}`;

  // Image handling: prioritize high-res TMDB artwork, fallback to local webp cover
  let poster = raw.poster || raw.image || '';
  if (poster && !poster.startsWith('http') && !poster.startsWith('/')) {
    poster = '/' + poster;
  }
  let backdrop = raw.backdrop || poster;
  if (backdrop && !backdrop.startsWith('http') && !backdrop.startsWith('/')) {
    backdrop = '/' + backdrop;
  }

  // Normalized Playback Servers
  const playbackSources = [];
  if (raw.imdbId) {
    playbackSources.push({
      serverName: '⚡ AllMovieLand / IndStream (Dotmobiz)',
      serverId: 'dotmobiz-allmovieland',
      type: 'iframe',
      url: `https://slast430did.com/play/${raw.imdbId}`,
      quality: quality,
      language: language
    });
  }

  // Normalized Downloads
  const downloadOptions = (raw.downloads || []).map((dl, idx) => ({
    id: `dl-${idx}`,
    quality: dl.quality || 'HD',
    size: dl.size || '',
    url: dl.url,
    label: dl.label || `Download [${dl.quality}]`
  }));

  return {
    id,
    record_id: raw.postId,
    provider: 'dotmobiz',
    type: contentType,
    contentType,
    title: cleanTitle,
    rawTitle: rawTitle,
    originalTitle: rawTitle,
    slug: (raw.url ? raw.url.split('/').pop().replace('.html', '') : cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')),
    poster,
    backdrop,
    year,
    rating: raw.rating && raw.rating > 0 ? raw.rating : 8.4,
    votes: raw.votes || '12.5K',
    quality,
    runtime: raw.runtime ? raw.runtime.replace(/\s+minutes$/, '') : (contentType === 'movie' ? '2h 15m' : '~45m/ep'),
    duration: raw.runtime ? raw.runtime.replace(/\s+minutes$/, '') : (contentType === 'movie' ? '2h 15m' : '~45m/ep'),
    genres,
    categories: genres,
    language,
    country: language.includes('Hindi') || language.includes('Tamil') || language.includes('Telugu') || language.includes('Malayalam') ? 'India' : 'International',
    cast: Array.isArray(raw.cast) ? raw.cast : [],
    director: raw.director || 'Director',
    overview: raw.overview || `Watch ${cleanTitle} (${year}) in high definition with multi-audio and high-speed streaming on Netflix4U.`,
    description: raw.overview || `Watch ${cleanTitle} (${year}) in high definition with multi-audio and high-speed streaming on Netflix4U.`,
    shortDescription: (raw.overview || '').slice(0, 140),
    imdbId: raw.imdbId || '',
    screenshots: Array.isArray(raw.screenshots) ? raw.screenshots : [],
    downloadOptions,
    playbackSources,
    links: downloadOptions.map(d => ({
      url: d.url,
      quality: d.quality,
      size: d.size,
      label: d.label,
      isCloud: true
    })),
    trending: true,
    featured: true,
    topRated: true,
    recentlyAdded: true,
    sourceUrl: raw.url || ''
  };
}

module.exports = {
  cleanDotmobizTitle,
  cleanMovieTitle,
  extractYear,
  extractQuality,
  extractAudioLanguage,
  extractGenres,
  normalizeDotmobizPost
};
