/**
 * Netflix4U Playback Service
 * Normalizes multi-server playback sources for Movies and TV Series.
 */

const ALLMOVIELAND_STREAM_BASE = process.env.ALLMOVIELAND_STREAM_BASE || 'https://slast430did.com/play/';

function getPlaybackSources(item, season = 1, episode = 1) {
  if (!item) return [];

  const sources = [];
  const isTV = item.type === 'series' || item.type === 'anime' || item.type === 'kdrama';
  const imdbId = item.imdbId;
  const tmdbId = item.tmdbId;
  const id = item.record_id || item.id;

  // 1. Dotmobiz Authorized Player (AllMovieLand / IndStream)
  if (imdbId) {
    sources.push({
      id: 'dotmobiz-allmovieland',
      name: '⚡ AllMovieLand (Dotmobiz)',
      label: '⚡ AllMovieLand (Dotmobiz)',
      type: 'iframe',
      url: `${ALLMOVIELAND_STREAM_BASE}${imdbId}`,
      quality: item.quality || 'FHD',
      serverName: 'AllMovieLand'
    });
  }

  // 2. Fast Cloud Server (Hicine cloud storage)
  const links = item.links || [];
  const cloudLink = links.find(l => l.isCloud) || links[0];
  if (cloudLink && cloudLink.url) {
    sources.push({
      id: 'hicine',
      name: '⚡ Fast Cloud',
      label: '⚡ Fast Cloud',
      type: 'direct',
      url: cloudLink.url,
      quality: cloudLink.quality || 'HD',
      serverName: 'Fast Cloud'
    });
  }

  // 3. VidLink Server
  const vidlinkParam = tmdbId || id;
  const vidlinkUrl = isTV 
    ? `https://vidlink.pro/tv/${vidlinkParam}/${season}/${episode}`
    : `https://vidlink.pro/movie/${vidlinkParam}`;

  sources.push({
    id: 'vidlink',
    name: 'Server 1',
    label: 'VidLink',
    type: 'iframe',
    url: vidlinkUrl,
    quality: 'Auto',
    serverName: 'VidLink'
  });

  // 4. VidSrc (me) Server
  const vidsrcParam = tmdbId || imdbId || id;
  const isImdb = !tmdbId && !!imdbId;
  const vidsrcMeUrl = isTV
    ? (isImdb 
        ? `https://vidsrc.me/embed/tv?imdb=${vidsrcParam}&season=${season}&episode=${episode}` 
        : `https://vidsrc.me/embed/tv?tmdb=${vidsrcParam}&season=${season}&episode=${episode}`)
    : (isImdb 
        ? `https://vidsrc.me/embed/movie?imdb=${vidsrcParam}` 
        : `https://vidsrc.me/embed/movie?tmdb=${vidsrcParam}`);

  sources.push({
    id: 'vidsrcme',
    name: 'Server 2',
    label: 'VidSrc (me)',
    type: 'iframe',
    url: vidsrcMeUrl,
    quality: 'Auto',
    serverName: 'VidSrc (me)'
  });

  // 5. VidSrc (xyz) Server
  const vidsrcXyzUrl = isTV
    ? (isImdb 
        ? `https://vidsrc.xyz/embed/tv?imdb=${vidsrcParam}&season=${season}&episode=${episode}` 
        : `https://vidsrc.xyz/embed/tv?tmdb=${vidsrcParam}&season=${season}&episode=${episode}`)
    : (isImdb 
        ? `https://vidsrc.xyz/embed/movie?imdb=${vidsrcParam}` 
        : `https://vidsrc.xyz/embed/movie?tmdb=${vidsrcParam}`);

  sources.push({
    id: 'vidsrcxyz',
    name: 'Server 3',
    label: 'VidSrc (xyz)',
    type: 'iframe',
    url: vidsrcXyzUrl,
    quality: 'Auto',
    serverName: 'VidSrc (xyz)'
  });

  return sources;
}

module.exports = {
  getPlaybackSources
};
