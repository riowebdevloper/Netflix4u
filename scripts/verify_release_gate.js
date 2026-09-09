const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { isPublicRecord, publicOnly } = require('../services/contentValidationService');
const { getPlaybackSources } = require('../services/playbackService');

const root = path.resolve(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data', 'catalog_summary.json'), 'utf8'));
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const publicRecords = publicOnly(catalog);

assert.equal(publicRecords.every(isPublicRecord), true, 'a public catalog record bypassed validation');
assert.equal(getPlaybackSources({ imdbId: 'tt1234567', links: [{ url: 'https://untrusted.example' }] }).length, 0, 'derived playback source was accepted');
assert.equal(getPlaybackSources({ licensedPlaybackSources: [{ provider: 'licensed-demo', url: 'https://licensed.example/watch', licenseStatus: 'VERIFIED' }] }).length, 1, 'verified licensed source was rejected');
assert.equal(/<loc>https:\/\/netflix4u\.in\/(movie|series|anime|kdrama)\//.test(sitemap), publicRecords.length > 0, 'sitemap/public catalog gate diverged');
assert.equal(/slast430did|vidsrc|vidlink/i.test(fs.readFileSync(path.join(root, 'services', 'playbackService.js'), 'utf8')), false, 'unapproved player source remains in playback service');

console.log(`PASS release gate: ${catalog.length} catalog records inspected; ${publicRecords.length} eligible for publication.`);
