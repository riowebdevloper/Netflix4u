/**
 * Netflix4U Server-Side Canonical Player Resolver
 * Bridges Universal API Core and Centralized Player Resolver
 */

const playerResolver = require('../js/player-resolver');

module.exports = {
  cleanTmdbId: playerResolver.cleanTmdbId,
  validatePlaybackRequest: playerResolver.validatePlaybackRequest,
  getCanonicalCacheKey: playerResolver.getCanonicalCacheKey,
  resolvePlayerUrl: playerResolver.resolvePlayerUrl,
  isAllowedOrigin: playerResolver.isAllowedOrigin,
  ALLOWED_ORIGINS: playerResolver.ALLOWED_ORIGINS
};
