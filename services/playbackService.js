/**
 * Licensed playback admission gate. URLs are never constructed from title,
 * IMDb/TMDB IDs, or third-party aggregators. A source must arrive from a
 * licensed integration with explicit verification evidence.
 */
function getPlaybackSources(item, season = 1, episode = 1) {
  if (!item || !Array.isArray(item.licensedPlaybackSources)) return [];
  return item.licensedPlaybackSources
    .filter(source => source && source.licenseStatus === 'VERIFIED' &&
      typeof source.provider === 'string' && typeof source.url === 'string' && /^https:\/\//.test(source.url))
    .map(source => ({ ...source, season, episode }));
}
module.exports = { getPlaybackSources };
