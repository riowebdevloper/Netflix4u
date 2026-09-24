/**
 * Netflix4U Server-Side Canonical Player Resolver
 * Bridges Universal API Core and Centralized Player Resolver
 */

const playerResolver = require('../js/player-resolver');

const { providerManager } = require('../src/player/providers/provider-manager');
const { getProviders, getProvider } = require('../src/player/providers/registry');

module.exports = {
  cleanTmdbId: playerResolver.cleanTmdbId,
  validatePlaybackRequest: playerResolver.validatePlaybackRequest,
  getCanonicalCacheKey: playerResolver.getCanonicalCacheKey,
  getAllmovielandCacheKey: playerResolver.getAllmovielandCacheKey,
  resolvePlayerUrl: playerResolver.resolvePlayerUrl,
  isAllowedOrigin: playerResolver.isAllowedOrigin,
  ALLOWED_ORIGINS: playerResolver.ALLOWED_ORIGINS,
  providerManager,
  getProviders,
  getProvider
};
