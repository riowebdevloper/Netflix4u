/**
 * Netflix4U Hicine Adapter
 * Normalizes Hicine records into the standard Netflix4U data schema.
 */

function cleanTitle(raw) {
  if (!raw) return 'Untitled';
  return raw.replace(/^(NetFlix|Prime|Disney\+|Hotstar|SonyLIV|ZEE5)\s+/i, '').trim();
}

function normalizeHicineItem(item, defaultType = 'movie') {
  if (!item) return null;
  const id = String(item.record_id || item.id || item._id);
  const rawTitle = item.rawTitle || item.title || 'Untitled';
  const displayTitle = cleanTitle(rawTitle);
  const poster = item.poster || item.featured_image || 'https://placehold.co/500x750/111427/ffffff?text=No+Poster';
  const backdrop = item.backdrop || item.featured_image || poster;
  const cats = Array.isArray(item.categories) 
    ? item.categories 
    : (typeof item.categories === 'string' ? item.categories.split(',').map(c => c.trim()).filter(Boolean) : []);

  const isSeries = item.type === 'series' || (item.contentType && item.contentType.includes('series')) || cats.some(c => /series/i.test(c));
  const isAnime = item.type === 'anime' || cats.some(c => /anime/i.test(c));
  const isKdrama = cats.some(c => /korean|kdrama|k-drama/i.test(c));
  const type = isAnime ? 'anime' : (isKdrama ? 'kdrama' : (isSeries ? 'series' : (item.type || defaultType)));

  const links = Array.isArray(item.links) ? item.links : [];

  return {
    id,
    record_id: item.record_id || id,
    provider: 'hicine',
    type,
    contentType: type,
    title: displayTitle,
    rawTitle,
    originalTitle: rawTitle,
    poster,
    backdrop,
    overview: item.content || item.description || `Watch ${displayTitle} in high quality on Netflix4U.`,
    description: item.content || item.description || `Watch ${displayTitle} in high quality on Netflix4U.`,
    shortDescription: (item.content || item.description || '').slice(0, 120),
    year: item.year || parseInt((rawTitle.match(/\b(19\d{2}|20\d{2})\b/) || [0, 2026])[1], 10),
    rating: item.rating || 8.5,
    votes: item.votes || '14.2K',
    quality: item.quality || 'FHD',
    duration: type === 'movie' ? '2h 10m' : '~45m/ep',
    runtime: type === 'movie' ? '2h 10m' : '~45m/ep',
    genres: cats.filter(c => !/^\d+p$/i.test(c) && !/^\d{4}$/.test(c)).slice(0, 4),
    categories: cats,
    language: cats.find(c => /hindi|dual|english|tamil|telugu/i.test(c)) || 'Hindi / Dual Audio',
    country: cats.some(c => /bollywood/i.test(c)) ? 'India' : 'Global',
    director: item.director || 'Director',
    cast: Array.isArray(item.cast) ? item.cast : [],
    trailerUrl: item.trailerUrl || '',
    trailer: item.trailerUrl || '',
    trending: true,
    featured: true,
    topRated: true,
    recentlyAdded: true,
    links,
    rawLinks: item.rawLinks || item.links || '',
    downloadOptions: links.map((l, i) => ({
      id: `hicine-dl-${i}`,
      quality: l.quality || 'HD',
      size: l.size || '',
      url: l.url,
      label: l.label || `Server Stream (${l.quality || 'HD'})`
    })),
    playbackSources: links.map((l, i) => ({
      serverName: l.label || `Server ${i + 1}`,
      serverId: `hicine-${i}`,
      type: 'direct',
      url: l.url,
      quality: l.quality || 'HD',
      language: 'Original'
    }))
  };
}

module.exports = {
  cleanTitle,
  normalizeHicineItem
};
