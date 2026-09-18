/**
 * Netflix4U Base Provider Adapter Factory
 * Standardized Canonical Identity & URL Construction
 */

const { cleanTmdbId, cleanImdbId, validatePlaybackInput } = require('../types');

function createAdapter(config) {
  const {
    id,
    name,
    label,
    baseUrl,
    priority = 50,
    enabled = true,
    providerGroup = id,
    supportedTypes = ['movie', 'tv'],
    requiredIdentifier = 'tmdb',
    moviePath = '/movie/',
    tvPath = '/tv/',
    notes = '',
    customMovieBuilder,
    customTvBuilder
  } = config;

  return {
    id,
    name,
    label: label || name,
    baseUrl,
    priority,
    enabled,
    providerGroup,
    supportedTypes,
    requiredIdentifier,
    supportsMovie: supportedTypes.includes('movie'),
    supportsTV: supportedTypes.includes('tv'),
    notes,

    validateInput(input) {
      const baseVal = validatePlaybackInput(input);
      if (!baseVal.valid) return baseVal;

      const cType = (input.contentType || input.type || '').toLowerCase();
      if (!supportedTypes.includes(cType)) {
        return { valid: false, error: `Provider ${name} does not support ${cType}` };
      }

      if (requiredIdentifier === 'tmdb' && !cleanTmdbId(input.tmdbId)) {
        return { valid: false, error: `Provider ${name} requires numeric TMDB ID` };
      }
      if (requiredIdentifier === 'imdb' && !cleanImdbId(input.imdbId)) {
        return { valid: false, error: `Provider ${name} requires valid IMDb ID` };
      }

      return { valid: true };
    },

    buildMovieUrl(input, options = {}) {
      if (!this.supportsMovie) return null;
      const val = this.validateInput({ ...input, contentType: 'movie' });
      if (!val.valid) return null;

      if (typeof customMovieBuilder === 'function') {
        return customMovieBuilder(baseUrl, input, options);
      }

      const mediaId = (requiredIdentifier === 'imdb') ? cleanImdbId(input.imdbId) : cleanTmdbId(input.tmdbId);
      return `${baseUrl}${moviePath}${encodeURIComponent(mediaId)}`;
    },

    buildTvUrl(input, options = {}) {
      if (!this.supportsTV) return null;
      const val = this.validateInput({ ...input, contentType: 'tv' });
      if (!val.valid) return null;

      if (typeof customTvBuilder === 'function') {
        return customTvBuilder(baseUrl, input, options);
      }

      const mediaId = (requiredIdentifier === 'imdb') ? cleanImdbId(input.imdbId) : cleanTmdbId(input.tmdbId);
      const s = parseInt(input.season, 10);
      const e = parseInt(input.episode, 10);
      return `${baseUrl}${tvPath}${encodeURIComponent(mediaId)}/${s}/${e}`;
    }
  };
}

module.exports = {
  createAdapter,
  cleanTmdbId,
  cleanImdbId,
  validatePlaybackInput
};
