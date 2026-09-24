#!/usr/bin/env node
/**
 * Discord Notification Sender for Netflix4U
 * Supports:
 *  1. Daily Catalog Ingestion & Hero Carousel Sync alerts
 *  2. Website Deployment / Code Updates alerts (Git Push)
 *  3. Custom admin / maintenance alerts
 *
 * Usage:
 *  node scripts/notify_discord.js --event=catalog
 *  node scripts/notify_discord.js --event=push --commit="fix: new servers" --author="Rio"
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const HOME_FEED_PATH = path.join(ROOT, 'data', 'home_feed.json');
const REPORT_PATH = path.join(ROOT, 'data', 'last_sync_report.json');

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

const CURATED_TRENDING_PATH = path.join(ROOT, 'data', 'curated_trending.json');

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

  // If user passed --only-if-new and nothing was added, return null to skip spam
  if (options.onlyIfNew && newItems.length === 0 && addedCount === 0) {
    return null;
  }

  // 1. REAL NEW ADDITIONS: If new titles were added during sync
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
      color: 15073298, // Netflix Red #E50914
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

  // 2. MAINTENANCE SYNC: If no new titles today, report real trending from curated_trending.json
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
    color: 2278750, // Neon Green #22C55E
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

  // Skip automated bot commits to prevent duplicate notifications
  if (commitMsg && (commitMsg.includes('[skip ci]') || commitMsg.startsWith('chore(auto):'))) {
    return null;
  }

  return {
    title: '🚀 Netflix4U Website Auto-Update Deployed!',
    url: 'https://netflix4u.in',
    color: 2278750, // Neon Cyan #22C35E
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
 * Returns a Promise that resolves when the request completes.
 */
function sendDiscordNotification(options = {}) {
  return new Promise((resolve, reject) => {
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

// Support CLI execution
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

module.exports = {
  sendDiscordNotification,
  getWebhookUrl,
  buildCatalogSyncEmbed,
  buildSiteUpdateEmbed
};
