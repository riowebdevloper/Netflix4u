/**
 * Netflix4U Universal Multi-Server Streaming Architecture
 * Lightweight Provider Health & Timeout Tracker
 */

class ProviderHealthTracker {
  constructor() {
    this.records = new Map();
  }

  recordSuccess(providerId) {
    const existing = this.records.get(providerId) || { consecutiveFailures: 0 };
    this.records.set(providerId, {
      providerId,
      lastChecked: Date.now(),
      isHealthy: true,
      consecutiveFailures: 0,
      lastError: null
    });
  }

  recordFailure(providerId, error = 'Load timeout or network error') {
    const existing = this.records.get(providerId) || { consecutiveFailures: 0 };
    const failures = (existing.consecutiveFailures || 0) + 1;
    this.records.set(providerId, {
      providerId,
      lastChecked: Date.now(),
      isHealthy: failures < 3,
      consecutiveFailures: failures,
      lastError: error
    });
  }

  isProviderHealthy(providerId) {
    const rec = this.records.get(providerId);
    if (!rec) return true; // Default optimistic until proven failing
    return rec.isHealthy;
  }

  getHealthSummary() {
    const summary = {};
    for (const [id, rec] of this.records.entries()) {
      summary[id] = { ...rec };
    }
    return summary;
  }
}

const healthTracker = new ProviderHealthTracker();

module.exports = {
  ProviderHealthTracker,
  healthTracker
};
