/**
 * Automated Test Suite for Discord Delta Intelligence (Section 35)
 *
 * Verifies:
 * 1. No change -> NO ALERT
 * 2. New episode -> ONE ALERT
 * 3. Same new episode next poll -> NO DUPLICATE (suppressed)
 * 4. New source -> ONE ALERT
 * 5. Source disappears -> ONE ALERT
 * 6. Two fields change -> ONE consolidated useful alert
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const {
  normalizeItemState,
  detectItemDeltas,
  computeFingerprint,
  processDiscordDeltas,
  buildDeltaAlertEmbed
} = require('./notify_discord');

const TEST_STATE_PATH = path.join(__dirname, '..', 'data', 'test_discord_state_temp.json');

function cleanup() {
  if (fs.existsSync(TEST_STATE_PATH)) {
    fs.unlinkSync(TEST_STATE_PATH);
  }
}

async function runTests() {
  console.log('=== STARTING DISCORD DELTA SYSTEM TESTS (SECTION 35) ===\n');
  cleanup();

  try {
    // Baseline state: Stranger Things S04E08
    const baseItem = {
      canonicalId: 'tv-66732',
      title: 'Stranger Things',
      mediaType: 'tv',
      season: 4,
      episode: 8,
      providers: ['peachify', 'reelsdownload', 'vidsrc_sbs'],
      downloadState: 'AVAILABLE',
      quality: '1080p',
      language: 'hindi'
    };

    // Initialize baseline in state
    let alerts = processDiscordDeltas([baseItem], TEST_STATE_PATH);
    // Initial run sees title for first time -> 1 alert
    assert.strictEqual(alerts.length, 1, 'Initial ingestion emits 1 NEW_TITLE alert');
    assert.strictEqual(alerts[0].delta.eventType, 'NEW_TITLE');
    console.log('✔ Test 0: Initial title ingestion registers snapshot');

    // Test 1: No change -> NO ALERT
    alerts = processDiscordDeltas([baseItem], TEST_STATE_PATH);
    assert.strictEqual(alerts.length, 0, 'No change emits 0 alerts');
    console.log('✔ Test 1: No change -> NO ALERT (PASSED)');

    // Test 2: New episode (S04E08 -> S04E09) -> ONE ALERT
    const newEpisodeItem = {
      ...baseItem,
      episode: 9
    };
    alerts = processDiscordDeltas([newEpisodeItem], TEST_STATE_PATH);
    assert.strictEqual(alerts.length, 1, 'New episode emits exactly 1 alert');
    assert.strictEqual(alerts[0].delta.eventType, 'NEW_EPISODE');
    assert.strictEqual(alerts[0].delta.diff.episode.previous, 8);
    assert.strictEqual(alerts[0].delta.diff.episode.now, 9);
    console.log('✔ Test 2: New episode -> ONE ALERT (PASSED)');

    // Test 3: Same new episode in next poll -> NO DUPLICATE
    alerts = processDiscordDeltas([newEpisodeItem], TEST_STATE_PATH);
    assert.strictEqual(alerts.length, 0, 'Same new episode on next poll is deduplicated (0 alerts)');
    console.log('✔ Test 3: Same new episode next poll -> NO DUPLICATE (PASSED)');

    // Test 4: New source added -> ONE ALERT
    const sourceAddedItem = {
      ...newEpisodeItem,
      providers: ['peachify', 'reelsdownload', 'vidsrc_sbs', 'superstream']
    };
    alerts = processDiscordDeltas([sourceAddedItem], TEST_STATE_PATH);
    assert.strictEqual(alerts.length, 1, 'Adding new source emits exactly 1 alert');
    assert.strictEqual(alerts[0].delta.eventType, 'NEW_STREAMING_SOURCE');
    assert.deepStrictEqual(alerts[0].delta.diff.providers.added, ['superstream']);
    console.log('✔ Test 4: New source -> ONE ALERT (PASSED)');

    // Test 5: Source disappears -> ONE ALERT
    const sourceRemovedItem = {
      ...sourceAddedItem,
      providers: ['peachify', 'reelsdownload'] // vidsrc_sbs and superstream removed
    };
    alerts = processDiscordDeltas([sourceRemovedItem], TEST_STATE_PATH);
    assert.strictEqual(alerts.length, 1, 'Removing source emits exactly 1 alert');
    assert.strictEqual(alerts[0].delta.eventType, 'SOURCE_REMOVED');
    console.log('✔ Test 5: Source disappears -> ONE ALERT (PASSED)');

    // Test 6: Two fields change -> ONE consolidated useful alert
    const multiChangeItem = {
      ...sourceRemovedItem,
      downloadState: 'UNAVAILABLE',
      quality: '4K-UHD'
    };
    alerts = processDiscordDeltas([multiChangeItem], TEST_STATE_PATH);
    assert.strictEqual(alerts.length, 1, 'Multiple field changes emit exactly 1 consolidated alert');
    assert.strictEqual(alerts[0].delta.eventType, 'MULTIPLE_UPDATES');
    assert.ok(alerts[0].delta.changedFields.includes('downloadState'));
    assert.ok(alerts[0].delta.changedFields.includes('qualities'));
    console.log('✔ Test 6: Two fields change -> ONE consolidated useful alert (PASSED)');

    console.log('\n======================================================');
    console.log('ALL SECTION 35 DISCORD DELTA TESTS PASSED (6/6)!');
    console.log('======================================================\n');
  } finally {
    cleanup();
  }
}

runTests().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
