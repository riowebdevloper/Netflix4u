/**
 * Netflix4U Universal Multi-Server Streaming Architecture
 * Core Provider Manager
 */

const { getProvider, getProviders } = require('./registry');
const { healthTracker } = require('./provider-health');
const { cleanTmdbId, cleanImdbId, validatePlaybackInput } = require('./types');

class ProviderManager {
  constructor() {
    this.defaultProviderId = 'vidsrc_sbs';
  }

  /**
   * Validate canonical playback identity
   */
  validateInput(input) {
    return validatePlaybackInput(input);
  }

  /**
   * Resolve player URL for a specified provider and playback input
   */
  resolvePlayerUrl(input, providerIdOrName = null, options = {}) {
    // Rivestream exclusion guard
    if (providerIdOrName && /rivestream|fade/i.test(String(providerIdOrName))) {
      console.warn('[Netflix4U Security] Blocked attempt to resolve excluded Rivestream provider');
      return null;
    }

    const validation = this.validateInput(input);
    if (!validation.valid) {
      return null;
    }

    const targetId = providerIdOrName || this.defaultProviderId;
    const provider = getProvider(targetId);
    if (!provider || !provider.enabled) {
      return null;
    }

    const cType = (input.contentType || input.type || '').toLowerCase();
    if (cType === 'movie') {
      return provider.buildMovieUrl(input, options);
    } else if (cType === 'tv' || cType === 'series') {
      return provider.buildTvUrl(input, options);
    }

    return null;
  }

  /**
   * Get active failover sequence for content type
   */
  getFailoverSequence(contentType = 'movie') {
    return getProviders({ enabledOnly: true, contentType })
      .filter(p => healthTracker.isProviderHealthy(p.id))
      .map(p => p.id);
  }

  /**
   * Get all active providers formatted for UI server selector
   */
  getServerSelectorList(contentType = 'movie') {
    return getProviders({ enabledOnly: true, contentType }).map((p, idx) => ({
      id: p.id,
      name: p.name,
      label: `Server ${idx + 1} (${p.label})`,
      shortName: `S${idx + 1} • ${p.name}`,
      priority: p.priority,
      providerGroup: p.providerGroup,
      notes: p.notes
    }));
  }
}

const providerManager = new ProviderManager();

module.exports = {
  ProviderManager,
  providerManager
};
