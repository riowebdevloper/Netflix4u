const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { buildCatalogSyncEmbed, buildSiteUpdateEmbed } = require('./notify_discord');

console.log('====================================================');
console.log('DISCORD NOTIFICATION SYSTEM VERIFICATION');
console.log('====================================================');

const reportPath = path.join(__dirname, '..', 'data', 'last_sync_report.json');
const originalReport = fs.readFileSync(reportPath, 'utf8');

try {
  // Test 1: Real new items present
  console.log('\n--- 1. REAL NEW ITEMS PRESENT ---');
  const mockReportWithNewItems = {
    status: 'SUCCESS',
    metrics: { added: 2, updated: 5 },
    newItems: [
      {
        id: '1248832',
        canonicalId: '1248832',
        title: 'Digger',
        year: 2024,
        type: 'movie',
        rating: 8.4,
        genres: ['Action', 'Thriller'],
        backdrop: 'https://image.tmdb.org/t/p/original/digger_backdrop.jpg'
      },
      {
        id: '321958',
        canonicalId: '321958',
        title: 'Line of Fire',
        year: 2024,
        type: 'tv',
        rating: 8.7,
        genres: ['Drama', 'Crime'],
        backdrop: 'https://image.tmdb.org/t/p/original/fire_backdrop.jpg'
      }
    ],
    duration: '12.45'
  };

  fs.writeFileSync(reportPath, JSON.stringify(mockReportWithNewItems, null, 2), 'utf8');

  const embed1 = buildCatalogSyncEmbed({});
  assert(embed1 !== null, 'Embed should not be null when new items exist');
  assert(embed1.title.includes('2 Naye Titles Live!'), 'Title must show real count of new titles');
  assert(embed1.fields[0].name.includes('Newly Added Content Today'), 'Must have Newly Added Content Today field');
  assert(embed1.fields[0].value.includes('[Digger (2024)](https://netflix4u.in/movie/1248832)'), 'Must include direct link to Digger');
  assert(embed1.fields[0].value.includes('[Line of Fire (2024)](https://netflix4u.in/tv/321958)'), 'Must include direct link to Line of Fire');
  assert.strictEqual(embed1.image.url, 'https://image.tmdb.org/t/p/original/digger_backdrop.jpg', 'Hero image must match backdrop of new title');
  console.log('  ✓ PASS: New items generate accurate, clickable embed with posters and details');

  // Test 2: onlyIfNew flag with 0 new items
  console.log('\n--- 2. --only-if-new SUPPRESSION ---');
  const mockReportEmpty = {
    status: 'SUCCESS',
    metrics: { added: 0, updated: 3 },
    newItems: [],
    duration: '5.10'
  };
  fs.writeFileSync(reportPath, JSON.stringify(mockReportEmpty, null, 2), 'utf8');

  const embedSuppressed = buildCatalogSyncEmbed({ onlyIfNew: true });
  assert.strictEqual(embedSuppressed, null, 'Notification must be suppressed when onlyIfNew is true and 0 items added');
  console.log('  ✓ PASS: Discord notification correctly suppressed when no new items added');

  // Test 3: Maintenance report without onlyIfNew flag
  console.log('\n--- 3. OPERATIONAL STATUS EMBED ---');
  const embedMaintenance = buildCatalogSyncEmbed({ onlyIfNew: false });
  assert(embedMaintenance !== null, 'Maintenance embed should generate when onlyIfNew is false');
  assert(embedMaintenance.title.includes('Operational'), 'Title should state operational status');
  assert(embedMaintenance.fields[0].name.includes('Top Trending Right Now'), 'Should show active trending content');
  assert(!embedMaintenance.fields[0].value.includes('Wolf (2039)'), 'Must NOT show outdated Wolf (2039) static fallback');
  console.log('  ✓ PASS: Maintenance status uses curated live trending content instead of static 2021 items');

  // Test 4: Bot commit suppression in site updates
  console.log('\n--- 4. BOT COMMIT DEPLOY ALERT SUPPRESSION ---');
  const botAlert = buildSiteUpdateEmbed({ commitMsg: 'chore(auto): daily catalog ingestion & sync [skip ci]' });
  assert.strictEqual(botAlert, null, 'Deploy alert must be suppressed for chore(auto) bot commits');

  const humanAlert = buildSiteUpdateEmbed({ commitMsg: 'feat: add new player controls' });
  assert(humanAlert !== null, 'Deploy alert should fire for manual/feature commits');
  console.log('  ✓ PASS: Automated chore commits do not trigger duplicate Discord deploy alerts');

  console.log('\n====================================================');
  console.log('ALL DISCORD NOTIFICATION TESTS PASSED (100% SUCCESS)');
  console.log('====================================================');
} finally {
  fs.writeFileSync(reportPath, originalReport, 'utf8');
}
