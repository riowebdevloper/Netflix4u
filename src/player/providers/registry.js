/**
 * Netflix4U Universal Multi-Server Streaming Architecture
 * Centralized Provider Registry
 */

const { allAdapters } = require('./adapters');

// Map of provider by unique ID
const PROVIDERS_BY_ID = new Map();
allAdapters.forEach(adapter => {
  PROVIDERS_BY_ID.set(adapter.id, adapter);
});

// Map of provider by display name
const PROVIDERS_BY_NAME = new Map();
allAdapters.forEach(adapter => {
  PROVIDERS_BY_NAME.set(adapter.name.toLowerCase(), adapter);
});

/**
 * Get provider adapter by ID or name
 */
function getProvider(idOrName) {
  if (!idOrName) return null;
  const key = String(idOrName).toLowerCase();
  if (key === 'pvrplay') return PROVIDERS_BY_ID.get('reelsdownload') || null;
  return PROVIDERS_BY_ID.get(key) || PROVIDERS_BY_NAME.get(key) || null;
}

/**
 * Get all providers, optionally filtered by enabled status and content type
 */
function getProviders(options = {}) {
  const { enabledOnly = true, contentType = null } = options;
  return allAdapters.filter(adapter => {
    if (enabledOnly && !adapter.enabled) return false;
    if (contentType && !adapter.supportedTypes.includes(contentType)) return false;
    return true;
  }).sort((a, b) => a.priority - b.priority);
}

/**
 * Get distinct provider groups to prevent treating mirrors as independent fallbacks
 */
function getProviderGroups() {
  const groups = new Map();
  allAdapters.forEach(adapter => {
    const group = adapter.providerGroup || adapter.id;
    if (!groups.has(group)) {
      groups.set(group, []);
    }
    groups.get(group).push(adapter);
  });
  return groups;
}

module.exports = {
  allAdapters,
  getProvider,
  getProviders,
  getProviderGroups
};
