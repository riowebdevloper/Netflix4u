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

function buildCatalogSyncEmbed() {
  let homeFeed = null;
  if (fs.existsSync(HOME_FEED_PATH)) {
    try {
      homeFeed = JSON.parse(fs.readFileSync(HOME_FEED_PATH, 'utf8'));
    } catch (e) {
      console.error('Failed to parse home_feed.json:', e.message);
    }
  }

  let report = null;
  if (fs.existsSync(REPORT_PATH)) {
    try {
      report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
    } catch (e) {}
  }

  const featured = (homeFeed && Array.isArray(homeFeed.featured)) ? homeFeed.featured : [];
  const trending = (homeFeed && Array.isArray(homeFeed.trending)) ? homeFeed.trending : [];

  let heroList = 'No featured items found';
  if (featured.length > 0) {
    heroList = featured.slice(0, 6).map((item, idx) => {
      const title = item.title || item.name || 'Untitled';
      const year = item.year ? `(${item.year})` : '';
      const rating = item.rating ? `⭐ ${item.rating}` : '';
      const type = item.type ? `[${item.type.toUpperCase()}]` : '';
      return `**${idx + 1}.** ${title} ${year} ${type} ${rating}`;
    }).join('\n');
  }

  let trendingList = 'No trending items found';
  if (trending.length > 0) {
    trendingList = trending.slice(0, 5).map((item, idx) => {
      const title = item.title || item.name || 'Untitled';
      const year = item.year ? `(${item.year})` : '';
      return `• ${title} ${year}`;
    }).join('\n');
  }

  let heroBackdrop = '';
  if (featured.length > 0 && featured[0].backdrop) {
    let bd = featured[0].backdrop;
    if (bd.includes('image.tmdb.org')) {
      heroBackdrop = bd;
    } else if (bd.startsWith('https://wsrv.nl/?url=')) {
      try {
        const parsed = new URL(bd);
        heroBackdrop = decodeURIComponent(parsed.searchParams.get('url') || bd);
      } catch (e) {
        heroBackdrop = bd;
      }
    } else {
      heroBackdrop = bd;
    }
  }

  const addedCount = report && report.metrics ? report.metrics.added || 0 : 'N/A';
  const updatedCount = report && report.metrics ? report.metrics.updated || 0 : 'N/A';
  const durationSec = report && report.duration ? `${report.duration}s` : 'N/A';

  const embed = {
    title: '🍿 Netflix4U Daily Catalog & Hero Carousel Update',
    url: 'https://netflix4u.in',
    color: 15073298, // Netflix Red #E50914
    description: 'Aaj ka automated catalog sync successfully complete ho chuka hai! Hero Carousel aur homepage feed latest trending titles ke sath update ho gayi hai.',
    fields: [
      {
        name: '🌟 Hero Carousel Headlines',
        value: heroList,
        inline: false
      },
      {
        name: '🔥 Top Trending Today',
        value: trendingList,
        inline: false
      },
      {
        name: '📊 Sync Summary',
        value: `• **New Additions**: ${addedCount}\n• **Updated Records**: ${updatedCount}\n• **Pipeline Runtime**: ${durationSec}\n• **Status**: ✅ Live on Website`,
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
  const version = customData.version || '3.3.0';

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
      embed = buildCatalogSyncEmbed();
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
    commitSha: commitSha
  }).then(() => {
    process.exit(0);
  }).catch((err) => {
    console.error(err);
    process.exit(0);
  });
}

module.exports = {
  sendDiscordNotification,
  getWebhookUrl
};
