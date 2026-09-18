/**
 * Netflix4U Universal Multi-Server Streaming Architecture
 * Runtime Helper for Identity & Input Validation
 */

function cleanTmdbId(val) {
  if (val === null || val === undefined) return '';
  var s = String(val).trim();
  s = s.replace(/^(?:dotmobiz|tmdb(?:-movie|-series|-tv)?)-/i, '');
  return /^\d+$/.test(s) ? s : '';
}

function cleanImdbId(val) {
  if (!val) return '';
  var s = String(val).trim();
  return /^tt\d+$/i.test(s) ? s : '';
}

function validatePlaybackInput(input) {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Playback input must be a valid object' };
  }

  var cType = (input.contentType || input.type || '').toLowerCase();
  if (cType !== 'movie' && cType !== 'tv' && cType !== 'series') {
    return { valid: false, error: 'Invalid contentType: must be movie or tv' };
  }

  var tmdb = cleanTmdbId(input.tmdbId);
  var imdb = cleanImdbId(input.imdbId);

  if (!tmdb && !imdb) {
    return { valid: false, error: 'Missing valid canonical TMDB ID or IMDb ID' };
  }

  if (cType === 'tv' || cType === 'series') {
    var season = parseInt(input.season, 10);
    var episode = parseInt(input.episode, 10);
    if (isNaN(season) || season < 1) {
      return { valid: false, error: 'TV season must be integer >= 1' };
    }
    if (isNaN(episode) || episode < 1) {
      return { valid: false, error: 'TV episode must be integer >= 1' };
    }
  }

  return { valid: true };
}

module.exports = {
  cleanTmdbId,
  cleanImdbId,
  validatePlaybackInput
};
