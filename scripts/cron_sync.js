#!/usr/bin/env node
/**
 * CLI Runner for Netflix4U Catalog Auto-Ingestion & Sync
 * Usage: node scripts/cron_sync.js [--max=30] [--rebuild-only]
 */

const {
  runIngestionPipeline,
  rebuildHomeFeed,
  rebuildCategories,
  rebuildSitemap
} = require('../services/ingestionService');

async function main() {
  const args = process.argv.slice(2);
  const rebuildOnly = args.includes('--rebuild-only');
  let maxDiscovery = 20;

  for (const arg of args) {
    if (arg.startsWith('--max=')) {
      maxDiscovery = parseInt(arg.split('=')[1], 10) || 20;
    }
  }

  console.log('========================================================');
  console.log('NETFLIX4U AUTOMATED CATALOG MAINTENANCE & SYNC');
  console.log('========================================================');

  if (rebuildOnly) {
    console.log('[CLI] Rebuild-only mode requested. Recalculating indexes...');
    rebuildHomeFeed();
    rebuildCategories();
    rebuildSitemap();
    console.log('[CLI] Rebuild complete.');
    process.exit(0);
  }

  console.log(`[CLI] Starting ingestion pipeline (maxDiscovery=${maxDiscovery})...`);
  const startTime = Date.now();
  const summary = await runIngestionPipeline({ maxDiscovery, concurrency: 3 });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('========================================================');
  console.log(`[CLI] Pipeline execution finished in ${duration}s.`);
  console.log('Summary:', JSON.stringify(summary, null, 2));
  console.log('========================================================');

  // Save last sync report for notifications & audits
  try {
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, '..', 'data', 'last_sync_report.json');
    fs.writeFileSync(reportPath, JSON.stringify({ ...summary, duration, timestamp: new Date().toISOString() }, null, 2), 'utf8');
  } catch (e) {}

  // Trigger Discord Webhook notification
  try {
    console.log('[CLI] Dispatching Discord notification...');
    const { sendDiscordNotification } = require('./notify_discord');
    await sendDiscordNotification({ event: 'catalog' });
    console.log('[CLI] Discord notification dispatched.');
  } catch (e) {
    console.error('[CLI] Failed to send Discord notification:', e.message);
  }

  process.exit(summary.status === 'error' ? 1 : 0);
}

main().catch(err => {
  console.error('[CLI] Fatal pipeline error:', err);
  process.exit(1);
});
