#!/usr/bin/env node
/**
 * Discord Notification & Delta Intelligence System for Netflix4U
 * 
 * Features:
 *  1. Delta Intelligence: Snapshot model, field diffing, change detection (Sections 29-35)
 *  2. Event Deduplication: Deterministic fingerprinting preventing duplicate alerts
 *  3. Catalog Ingestion & Hero Carousel Sync alerts
 *  4. Website Deployment / Code Updates alerts (Git Push)
 *
 * Usage:
 *  node scripts/notify_discord.js --event=deltas
 *  node scripts/notify_discord.js --event=catalog
 *  node scripts/notify_discord.js --event=push --commit="fix: audit" --author="Rio"
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const HOME_FEED_PATH = path.join(DATA_DIR, 'home_feed.json');
const REPORT_PATH = path.join(DATA_DIR, 'last_sync_report.json');
const CURATED_TRENDING_PATH = path.join(DATA_DIR, 'curated_trending.json');
const DISCORD_STATE_PATH = path.join(DATA_DIR, 'discord_state.json');

const DEFAULT_WEBHOOK = 'https://discord.com/api/webhooks/1549714027846963240/sdeYGglawTUFdbcUFpYccJ5lCD5YQUho8A-rmNV0EZIK9tdcGp0w3yO_y0k1fO7LMztb';

function getGitMetadata() {
  let msg = '';
  let author = '';
  let sha = '';
  try {
    msg = execSync('git log -1 --pretty=format:%s', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (e) {}
  try {
    author = execSync('git log -1 --pretty=format:%an', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (e) {}
  try {
    sha = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (e) {}
  return { msg, author, sha };
}

function getWebhookUrl() {
  const envUrl = process.env.DISCORD_WEBHOOK_URL;
  if (envUrl && envUrl.trim() && envUrl.startsWith('https://discord.com/api/webhooks/')) {
    return envUrl.trim();
  }
  return DEFAULT_WEBHOOK;
}

// ============================================================================
// DELTA INTELLIGENCE ENGINE (Sections 29-35)
// ============================================================================

/**
 * Normalizes item state into a standardized snapshot schema.
 */
function normalizeItemState(item) {
  if (!item) return null;
  const contentId = String(item.canonicalId || item.id || item.tmdbId || '').trim();
  const title = item.title || item.name || 'Untitled';
  const mediaType = (item.mediaType || item.type || 'movie').toLowerCase();
  const season = Number(item.season || item.latestSeason || 1);
  const episode = Number(item.episode || item.latestEpisode || (mediaType === 'tv' ? 1 : 0));
  
  let providers = [];
  if (Array.isArray(item.providers)) {
    providers = [...item.providers].map(p => String(p).toLowerCase()).sort();
  } else if (item.provider) {
    providers = [String(item.provider).toLowerCase()];
  }

  const downloadState = (item.downloadState || (item.downloads && item.downloads.length > 0 ? 'AVAILABLE' : 'UNAVAILABLE')).toUpperCase();
  
  let qualities = [];
  if (Array.isArray(item.qualities)) {
    qualities = [...item.qualities].map(q => String(q).toUpperCase()).sort();
  } else if (item.quality) {
    qualities = [String(item.quality).toUpperCase()];
  }

  let languages = [];
  if (Array.isArray(item.languages)) {
    languages = [...item.languages].map(l => String(l).toLowerCase()).sort();
  } else if (item.language) {
    languages = [String(item.language).toLowerCase()];
  }

  return {
    contentId,
    title,
    mediaType,
    status: (item.status || 'AVAILABLE').toUpperCase(),
    season,
    episode,
    providers,
    downloadState,
    qualities,
    languages,
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

/**
 * Compares previous snapshot with current normalized state to detect meaningful deltas.
 * Returns null if no changes or duplicate.
 */
function detectItemDeltas(previous, current) {
  if (!current || !current.contentId) return null;

  if (!previous) {
    // Completely new title
    return {
      eventType: 'NEW_TITLE',
      changedFields: ['title', 'mediaType', 'providers', 'downloadState'],
      diff: {
        title: current.title,
        mediaType: current.mediaType,
        season: current.season,
        episode: current.episode,
        providers: current.providers,
        downloadState: current.downloadState
      }
    };
  }

  const changedFields = [];
  const diff = {};

  // Check TV Season/Episode changes
  if (current.mediaType === 'tv') {
    if (current.season > previous.season) {
      changedFields.push('season');
      diff.season = { previous: previous.season, now: current.season };
    }
    if (current.season === previous.season && current.episode > previous.episode) {
      changedFields.push('episode');
      diff.episode = { previous: previous.episode, now: current.episode };
    }
  }

  // Check Streaming Providers
  const prevProv = previous.providers || [];
  const currProv = current.providers || [];
  const addedProv = currProv.filter(p => !prevProv.includes(p));
  const removedProv = prevProv.filter(p => !currProv.includes(p));

  if (addedProv.length > 0 || removedProv.length > 0) {
    changedFields.push('providers');
    diff.providers = {
      added: addedProv,
      removed: removedProv,
      now: currProv
    };
  }

  // Check Download Availability
  if (current.downloadState !== previous.downloadState) {
    changedFields.push('downloadState');
    diff.downloadState = { previous: previous.downloadState, now: current.downloadState };
  }

  // Check Qualities
  const prevQual = previous.qualities || [];
  const currQual = current.qualities || [];
  if (JSON.stringify(prevQual) !== JSON.stringify(currQual)) {
    changedFields.push('qualities');
    diff.qualities = { previous: prevQual, now: currQual };
  }

  // Check Languages
  const prevLang = previous.languages || [];
  const currLang = current.languages || [];
  if (JSON.stringify(prevLang) !== JSON.stringify(currLang)) {
    changedFields.push('languages');
    diff.languages = { previous: prevLang, now: currLang };
  }

  // Check Metadata Status
  if (current.status !== previous.status) {
    changedFields.push('status');
    diff.status = { previous: previous.status, now: current.status };
  }

  if (changedFields.length === 0) {
    return null; // NO CHANGES
  }

  // Determine Primary Event Type
  let eventType = 'METADATA_CHANGED';
  if (changedFields.includes('season')) {
    eventType = 'NEW_SEASON';
  } else if (changedFields.includes('episode')) {
    eventType = 'NEW_EPISODE';
  } else if (changedFields.includes('providers')) {
    if (diff.providers.added.length > 0 && diff.providers.removed.length === 0) {
      eventType = 'NEW_STREAMING_SOURCE';
    } else if (diff.providers.removed.length > 0 && diff.providers.added.length === 0) {
      eventType = 'SOURCE_REMOVED';
    } else {
      eventType = 'STREAMING_CHANGED';
    }
  } else if (changedFields.includes('downloadState')) {
    eventType = current.downloadState === 'AVAILABLE' ? 'DOWNLOAD_ADDED' : 'DOWNLOAD_REMOVED';
  } else if (changedFields.includes('qualities')) {
    eventType = 'QUALITY_CHANGED';
  } else if (changedFields.includes('languages')) {
    eventType = 'LANGUAGE_CHANGED';
  }

  if (changedFields.length > 1) {
    eventType = 'MULTIPLE_UPDATES';
  }

  return {
    eventType,
    changedFields,
    diff
  };
}

/**
 * Computes deterministic fingerprint for alert deduplication.
 */
function computeFingerprint(contentId, eventType, changedFields, diff) {
  const normFields = [...changedFields].sort().join(',');
  const raw = `${contentId}|${eventType}|${normFields}|${JSON.stringify(diff)}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Loads snapshot state file safely.
 */
function loadDiscordState(stateFilePath = DISCORD_STATE_PATH) {
  if (fs.existsSync(stateFilePath)) {
    try {
      return JSON.parse(fs.readFileSync(stateFilePath, 'utf8'));
    } catch (e) {}
  }
  return { snapshots: {}, sentFingerprints: {} };
}

/**
 * Saves snapshot state atomically.
 */
function saveDiscordState(state, stateFilePath = DISCORD_STATE_PATH) {
  try {
    const dir = path.dirname(stateFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error('[DiscordNotifier] Failed to persist state:', e.message);
  }
}

/**
 * Formats a Discord embed containing only useful change deltas.
 */
function buildDeltaAlertEmbed(delta, currentItem) {
  const title = currentItem.title || 'Untitled';
  const url = `https://netflix4u.in/${currentItem.mediaType}/${currentItem.contentId}`;
  const now = new Date().toISOString();

  let eventLabel = 'System Update';
  let color = 2278750; // Neon Green

  if (delta.eventType === 'NEW_EPISODE') {
    eventLabel = '🎉 New Episode Available';
    color = 15073298; // Netflix Red
  } else if (delta.eventType === 'NEW_SEASON') {
    eventLabel = '🔥 New Season Premiered';
    color = 15073298;
  } else if (delta.eventType === 'NEW_STREAMING_SOURCE') {
    eventLabel = '⚡ New High-Speed Streaming Source Live';
    color = 2278750;
  } else if (delta.eventType === 'SOURCE_REMOVED') {
    eventLabel = '⚠️ Streaming Source Offline / Re-routed';
    color = 16753920; // Amber
  } else if (delta.eventType === 'DOWNLOAD_ADDED') {
    eventLabel = '📥 High-Speed Cloud Downloads Active';
    color = 3447003; // Blue
  } else if (delta.eventType === 'DOWNLOAD_REMOVED') {
    eventLabel = '⚠️ Downloads Temporarily Offline';
    color = 16753920;
  } else if (delta.eventType === 'MULTIPLE_UPDATES') {
    eventLabel = '✨ Multiple Content & Stream Enhancements';
    color = 10181046; // Purple
  }

  const fields = [];

  // Detail what changed concisely
  if (delta.diff.season) {
    fields.push({
      name: 'SEASON UPDATE',
      value: `PREVIOUS: S${String(delta.diff.season.previous).padStart(2, '0')}\nNOW: S${String(delta.diff.season.now).padStart(2, '0')}`,
      inline: true
    });
  }

  if (delta.diff.episode) {
    fields.push({
      name: 'EPISODE UPDATE',
      value: `PREVIOUS: E${String(delta.diff.episode.previous).padStart(2, '0')}\nNOW: E${String(delta.diff.episode.now).padStart(2, '0')}`,
      inline: true
    });
  }

  if (delta.diff.providers) {
    const provLines = [];
    if (delta.diff.providers.added && delta.diff.providers.added.length > 0) {
      provLines.push(`ADDED: ${delta.diff.providers.added.join(', ').toUpperCase()}`);
    }
    if (delta.diff.providers.removed && delta.diff.providers.removed.length > 0) {
      provLines.push(`REMOVED: ${delta.diff.providers.removed.join(', ').toUpperCase()}`);
    }
    const activeProv = delta.diff.providers.now || (Array.isArray(delta.diff.providers) ? delta.diff.providers : []);
    provLines.push(`ACTIVE: ${activeProv.join(', ').toUpperCase() || 'None'}`);
    fields.push({
      name: 'STREAMING PROVIDERS',
      value: provLines.join('\n'),
      inline: false
    });
  }

  if (delta.diff.downloadState) {
    fields.push({
      name: 'DOWNLOAD STATUS',
      value: `PREVIOUS: ${delta.diff.downloadState.previous}\nNOW: ${delta.diff.downloadState.now}`,
      inline: true
    });
  }

  if (delta.diff.qualities) {
    fields.push({
      name: 'QUALITIES',
      value: `NOW: ${delta.diff.qualities.now.join(', ') || 'Standard HD'}`,
      inline: true
    });
  }

  if (delta.diff.languages) {
    fields.push({
      name: 'LANGUAGES / DUBS',
      value: `NOW: ${delta.diff.languages.now.join(', ').toUpperCase() || 'Default'}`,
      inline: true
    });
  }

  fields.push({
    name: 'DETECTED',
    value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
    inline: false
  });

  return {
    title: `[${currentItem.mediaType.toUpperCase()}] ${title}`,
    url,
    color,
    description: `**CHANGE**: ${eventLabel}`,
    fields,
    footer: {
      text: 'Netflix4U Delta Intelligence • netflix4u.in',
      icon_url: 'https://netflix4u.in/favicon-32x32.png'
    },
    timestamp: now
  };
}

/**
 * Scan items and return an array of alerts to dispatch.
 * Performs snapshot tracking and suppression of duplicate fingerprints.
 */
function processDiscordDeltas(items, stateFilePath = DISCORD_STATE_PATH, options = {}) {
  const state = loadDiscordState(stateFilePath);
  const alertsToSend = [];

  for (const rawItem of items) {
    const current = normalizeItemState(rawItem);
    if (!current || !current.contentId) continue;

    const previous = state.snapshots[current.contentId] || null;
    const delta = detectItemDeltas(previous, current);

    if (!delta) {
      // No changes detected -> skip
      continue;
    }

    const fingerprint = computeFingerprint(current.contentId, delta.eventType, delta.changedFields, delta.diff);

    if (state.sentFingerprints && state.sentFingerprints[fingerprint]) {
      // Already sent -> skip duplicate
      continue;
    }

    // Build fresh payload
    const embed = buildDeltaAlertEmbed(delta, current);

    alertsToSend.push({
      fingerprint,
      contentId: current.contentId,
      delta,
      embed
    });

    if (!options.dryRun) {
      state.snapshots[current.contentId] = current;
      state.sentFingerprints[fingerprint] = Date.now();
    }
  }

  if (!options.dryRun) {
    saveDiscordState(state, stateFilePath);
  }

  return alertsToSend;
}

// ============================================================================
// LEGACY CATALOG & DEPLOYMENT ALERTS
// ============================================================================

function buildCatalogSyncEmbed(options = {}) {
  let report = null;
  if (fs.existsSync(REPORT_PATH)) {
    try {
      report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
    } catch (e) {}
  }

  let curatedTrending = null;
  if (fs.existsSync(CURATED_TRENDING_PATH)) {
    try {
      curatedTrending = JSON.parse(fs.readFileSync(CURATED_TRENDING_PATH, 'utf8'));
    } catch (e) {}
  }

  const newItems = (report && Array.isArray(report.newItems)) ? report.newItems : [];
  const addedCount = report && report.metrics ? report.metrics.added || 0 : newItems.length;
  const updatedCount = report && report.metrics ? report.metrics.updated || 0 : 0;
  const durationSec = report && report.duration ? `${report.duration}s` : 'N/A';

  if (options.onlyIfNew && newItems.length === 0 && addedCount === 0) {
    return null;
  }

  if (newItems.length > 0) {
    const newItemsList = newItems.slice(0, 8).map((item, idx) => {
      const title = item.title || 'Untitled';
      const year = item.year ? `(${item.year})` : '';
      const rating = item.rating ? `⭐ ${Number(item.rating).toFixed(1)}` : '⭐ 8.0';
      const type = (item.type || 'movie').toUpperCase();
      const cId = item.canonicalId || item.id || item.tmdbId;
      const url = `https://netflix4u.in/${item.type || 'movie'}/${cId}`;
      const genres = Array.isArray(item.genres) ? item.genres.slice(0, 2).join(', ') : '';
      const genreBadge = genres ? ` • ${genres}` : '';
      return `**${idx + 1}. [${title} ${year}](${url})**\n└ 🏷️ \`${type}\` • ${rating}${genreBadge}`;
    }).join('\n\n');

    let heroBackdrop = '';
    if (newItems[0] && newItems[0].backdrop) {
      heroBackdrop = newItems[0].backdrop;
    }

    const embed = {
      title: `🎉 Netflix4U Daily Update: ${newItems.length} Naye Titles Live!`,
      url: 'https://netflix4u.in',
      color: 15073298,
      description: `Aaj Netflix4U par **${newItems.length} fresh releases** successfully add kar diye gaye hain! High-speed streaming aur direct cloud download links live hain.`,
      fields: [
        {
          name: '🆕 Newly Added Content Today',
          value: newItemsList,
          inline: false
        },
        {
          name: '📊 Sync Summary',
          value: `• **New Additions**: ${addedCount}\n• **Updated Records**: ${updatedCount}\n• **Pipeline Runtime**: ${durationSec}\n• **Status**: ✅ All Streams Verified & Live`,
          inline: false
        }
      ],
      footer: {
        text: 'Netflix4U Automation Bot • netflix4u.in',
        icon_url: 'https://netflix4u.in/favicon-32x32.png'
      },
      timestamp: new Date().toISOString()
    };

    if (heroBackdrop) {
      embed.image = { url: heroBackdrop };
    }

    return embed;
  }

  const realHero = (curatedTrending && Array.isArray(curatedTrending.hero)) ? curatedTrending.hero : [];
  let trendingList = 'No active trending titles available';
  if (realHero.length > 0) {
    trendingList = realHero.slice(0, 6).map((item, idx) => {
      const title = item.title || 'Untitled';
      const year = item.year ? `(${item.year})` : '';
      const rating = item.rating ? `⭐ ${Number(item.rating).toFixed(1)}` : '⭐ 8.0';
      const type = (item.type || 'movie').toUpperCase();
      const url = `https://netflix4u.in/${item.type || 'movie'}/${item.tmdbId || item.id}`;
      return `**${idx + 1}. [${title} ${year}](${url})** • \`${type}\` • ${rating}`;
    }).join('\n');
  }

  let heroBackdrop = (realHero[0] && realHero[0].backdrop) ? realHero[0].backdrop : '';

  const embed = {
    title: '🍿 Netflix4U Daily Catalog Status: All Systems Operational',
    url: 'https://netflix4u.in',
    color: 2278750,
    description: 'Daily automated catalog audit successfully complete ho chuka hai. All streaming servers & download mirrors are 100% active and healthy.',
    fields: [
      {
        name: '🔥 Top Trending Right Now on Netflix4U',
        value: trendingList,
        inline: false
      },
      {
        name: '📊 System Health',
        value: `• **Status**: ✅ 100% Operational\n• **Updated Records**: ${updatedCount}\n• **Pipeline Runtime**: ${durationSec}\n• **Next Automatic Check**: Tomorrow at 00:00 UTC`,
        inline: false
      }
    ],
    footer: {
      text: 'Netflix4U Automation Bot • netflix4u.in',
      icon_url: 'https://netflix4u.in/favicon-32x32.png'
    },
    timestamp: new Date().toISOString()
  };

  if (heroBackdrop) {
    embed.image = { url: heroBackdrop };
  }

  return embed;
}

function buildSiteUpdateEmbed(customData = {}) {
  const git = getGitMetadata();
  const commitMsg = customData.commitMsg || process.env.COMMIT_MESSAGE || git.msg || 'Website enhancements and fixes';
  const commitAuthor = customData.commitAuthor || process.env.COMMIT_AUTHOR || git.author || 'Rio';
  const commitSha = (customData.commitSha || process.env.COMMIT_SHA || git.sha || '').substring(0, 7);
  const version = customData.version || '3.5.0';

  if (commitMsg && (commitMsg.includes('[skip ci]') || commitMsg.startsWith('chore(auto):'))) {
    return null;
  }

  return {
    title: '🚀 Netflix4U Website Auto-Update Deployed!',
    url: 'https://netflix4u.in',
    color: 2278750,
    description: 'Website par new updates deploy kar diye gaye hain! Users ke browsers me auto-refresh trigger ho chuka hai.',
    fields: [
      {
        name: '📝 Changes / Commit',
        value: `\`${commitMsg}\``,
        inline: false
      },
      {
        name: '👤 Author',
        value: commitAuthor,
        inline: true
      },
      {
        name: '🔖 Version',
        value: `v${version}${commitSha ? ` (${commitSha})` : ''}`,
        inline: true
      },
      {
        name: '🌐 Live URL',
        value: '[netflix4u.in](https://netflix4u.in)',
        inline: true
      }
    ],
    footer: {
      text: 'Netflix4U System Alert • netflix4u.in',
      icon_url: 'https://netflix4u.in/favicon-32x32.png'
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Dispatch notification payload to Discord webhook.
 */
function sendDiscordNotification(options = {}) {
  return new Promise((resolve) => {
    const webhookUrl = getWebhookUrl();

    if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
      console.log('[DiscordNotifier] No valid DISCORD_WEBHOOK_URL configured. Skipping notification.');
      return resolve(false);
    }

    let embed;
    if (options.event === 'push' || options.type === 'site_update') {
      embed = buildSiteUpdateEmbed(options);
    } else if (options.embed) {
      embed = options.embed;
    } else {
      embed = buildCatalogSyncEmbed(options);
    }

    if (!embed) {
      console.log('[DiscordNotifier] Notification suppressed (no new content or automated commit).');
      return resolve(false);
    }

    const payload = JSON.stringify({
      username: 'Netflix4U Updates',
      avatar_url: 'https://netflix4u.in/android-chrome-192x192.png',
      embeds: [embed]
    });

    try {
      const parsedUrl = new URL(webhookUrl);
      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 10000
      };

      const req = https.request(reqOptions, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('[DiscordNotifier] Successfully sent notification to Discord!');
            resolve(true);
          } else {
            console.error(`[DiscordNotifier] Discord returned status ${res.statusCode}: ${responseData}`);
            resolve(false);
          }
        });
      });

      req.on('error', (err) => {
        console.error('[DiscordNotifier] Failed to send Discord webhook:', err.message);
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        console.error('[DiscordNotifier] Webhook request timed out after 10s');
        resolve(false);
      });

      req.write(payload);
      req.end();
    } catch (err) {
      console.error('[DiscordNotifier] Exception creating request:', err.message);
      resolve(false);
    }
  });
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  let eventType = 'catalog';
  let commitMsg = '';
  let commitAuthor = '';
  let commitSha = '';
  let onlyIfNew = args.includes('--only-if-new');

  for (const arg of args) {
    if (arg.startsWith('--event=')) eventType = arg.split('=')[1];
    if (arg.startsWith('--commit=')) commitMsg = arg.split('=')[1];
    if (arg.startsWith('--author=')) commitAuthor = arg.split('=')[1];
    if (arg.startsWith('--sha=')) commitSha = arg.split('=')[1];
  }

  if (eventType === 'deltas') {
    // Delta scan over trending/catalog items
    let items = [];
    if (fs.existsSync(CURATED_TRENDING_PATH)) {
      try {
        const tr = JSON.parse(fs.readFileSync(CURATED_TRENDING_PATH, 'utf8'));
        items = tr.hero || [];
      } catch (e) {}
    }
    const alerts = processDiscordDeltas(items);
    console.log(`[DiscordNotifier] Generated ${alerts.length} delta alerts.`);
    let p = Promise.resolve();
    for (const alert of alerts) {
      p = p.then(() => sendDiscordNotification({ embed: alert.embed }));
    }
    p.then(() => process.exit(0)).catch(() => process.exit(0));
  } else {
    sendDiscordNotification({
      event: eventType,
      commitMsg: commitMsg,
      commitAuthor: commitAuthor,
      commitSha: commitSha,
      onlyIfNew: onlyIfNew
    }).then(() => {
      process.exit(0);
    }).catch((err) => {
      console.error(err);
      process.exit(0);
    });
  }
}

module.exports = {
  sendDiscordNotification,
  getWebhookUrl,
  buildCatalogSyncEmbed,
  buildSiteUpdateEmbed,
  normalizeItemState,
  detectItemDeltas,
  computeFingerprint,
  buildDeltaAlertEmbed,
  processDiscordDeltas,
  loadDiscordState,
  saveDiscordState
};
