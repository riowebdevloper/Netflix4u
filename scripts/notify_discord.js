#!/usr/bin/env node
/**
 * Discord Notification Sender for Netflix4U Daily Catalog Sync
 * Sends a rich Discord embed showing today's Hero Carousel & Sync Stats.
 * Usage: DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..." node scripts/notify_discord.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const HOME_FEED_PATH = path.join(ROOT, 'data', 'home_feed.json');
const REPORT_PATH = path.join(ROOT, 'data', 'last_sync_report.json');

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
  console.log('[DiscordNotifier] No valid DISCORD_WEBHOOK_URL configured. Skipping notification.');
  process.exit(0);
}

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

// 1. Format Hero Carousel items
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

// 2. Format Trending items
let trendingList = 'No trending items found';
if (trending.length > 0) {
  trendingList = trending.slice(0, 5).map((item, idx) => {
    const title = item.title || item.name || 'Untitled';
    const year = item.year ? `(${item.year})` : '';
    return `• ${title} ${year}`;
  }).join('\n');
}

// Pick the backdrop of the #1 Hero item for the banner image
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

// Format metrics summary
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

const payload = JSON.stringify({
  username: 'Netflix4U Updates',
  avatar_url: 'https://netflix4u.in/android-chrome-192x192.png',
  embeds: [embed]
});

const parsedUrl = new URL(webhookUrl);
const options = {
  hostname: parsedUrl.hostname,
  port: 443,
  path: parsedUrl.pathname + parsedUrl.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  let responseData = '';
  res.on('data', chunk => responseData += chunk);
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      console.log('[DiscordNotifier] Successfully sent daily update notification to Discord!');
    } else {
      console.error(`[DiscordNotifier] Discord returned status ${res.statusCode}: ${responseData}`);
    }
  });
});

req.on('error', (err) => {
  console.error('[DiscordNotifier] Failed to send Discord webhook:', err.message);
});

req.write(payload);
req.end();
