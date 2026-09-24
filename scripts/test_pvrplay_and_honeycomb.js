/**
 * Test Suite: PvrPlay Hindi Dubbed Player Integration & Net27 Honeycomb Animation
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const playerResolver = require('../js/player-resolver');
const { providerManager } = require('../src/player/providers/provider-manager');
const { getProvider } = require('../src/player/providers/registry');

console.log('====================================================');
console.log('NETFLIX4U: PVRPLAY & NET27 HONEYCOMB VERIFICATION');
console.log('====================================================\n');

// 1. ORIGIN & ALLOWLIST
console.log('--- 1. ALLOWED ORIGINS & REGISTRATION ---');
assert(playerResolver.ALLOWED_ORIGINS.includes('https://embed.reelsdownload.online'), 'embed.reelsdownload.online must be in ALLOWED_ORIGINS');
console.log('  ✓ PASS: https://embed.reelsdownload.online is in ALLOWED_ORIGINS');

// 2. PROVIDER REGISTRY & ALIASES
console.log('\n--- 2. PROVIDER REGISTRY & ADAPTER ---');
const providerByReels = getProvider('reelsdownload');
assert(providerByReels, 'getProvider("reelsdownload") must return an adapter');
assert.strictEqual(providerByReels.id, 'reelsdownload');
console.log('  ✓ PASS: getProvider("reelsdownload") found with id "reelsdownload"');

const providerByPvr = getProvider('pvrplay');
assert(providerByPvr, 'getProvider("pvrplay") alias must resolve to reelsdownload');
assert.strictEqual(providerByPvr.id, 'reelsdownload');
console.log('  ✓ PASS: getProvider("pvrplay") alias correctly resolves to "reelsdownload"');

// 3. MOVIE & TV URL RESOLUTION
console.log('\n--- 3. URL RESOLUTION CONTRACT ---');
const testMovieInput = { type: 'movie', tmdbId: 533535 };
const movieUrl = playerResolver.resolvePlayerUrl(testMovieInput, 'reelsdownload');
assert.strictEqual(movieUrl, 'https://embed.reelsdownload.online/player/533535?key=k_bf0ab0853bce46e3d90b256b', 'Movie URL format mismatch');
console.log('  ✓ PASS: Movie URL generated correctly: ' + movieUrl);

const testTvInput = { type: 'tv', tmdbId: 79744, season: 2, episode: 4 };
const tvUrl = playerResolver.resolvePlayerUrl(testTvInput, 'reelsdownload');
assert.strictEqual(tvUrl, 'https://embed.reelsdownload.online/player/79744/2/4?key=k_bf0ab0853bce46e3d90b256b', 'TV URL format mismatch');
console.log('  ✓ PASS: TV URL generated correctly: ' + tvUrl);

const pvrAliasMovieUrl = playerResolver.resolvePlayerUrl(testMovieInput, 'pvrplay');
assert.strictEqual(pvrAliasMovieUrl, movieUrl, 'pvrplay alias must generate identical URL');
console.log('  ✓ PASS: pvrplay alias generates identical movie URL');

// 4. PROVIDER MANAGER RESOLUTION
console.log('\n--- 4. PROVIDER MANAGER INTEGRATION ---');
const pmMovieUrl = providerManager.resolvePlayerUrl({ contentType: 'movie', tmdbId: 533535 }, 'reelsdownload');
assert.strictEqual(pmMovieUrl, movieUrl, 'providerManager must resolve reelsdownload movie URL');
console.log('  ✓ PASS: providerManager resolves reelsdownload correctly');

// 5. INDEX.HTML HONEYCOMB INTEGRATION
console.log('\n--- 5. INDEX.HTML PRE-RENDERED HONEYCOMB ---');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert(indexHtml.includes('id="nm-loader"'), 'index.html must include #nm-loader');
assert(indexHtml.includes('id="nm-hive"'), 'index.html must include #nm-hive');
assert(indexHtml.includes('window.__nmStartTime = Date.now()'), 'index.html must track start time for opening animation');
const hexMatches = indexHtml.match(/class="nm-hex"/g) || [];
assert(hexMatches.length >= 19, 'index.html must contain at least 19 pre-rendered .nm-hex elements for instant display, found: ' + hexMatches.length);
console.log('  ✓ PASS: index.html has ' + hexMatches.length + ' pre-rendered .nm-hex cells inside #nm-hive');

// 6. NETFLIX4U-NET27.CSS HONEYCOMB STYLES
console.log('\n--- 6. NET27 CSS HONEYCOMB STYLES ---');
const net27Css = fs.readFileSync(path.join(__dirname, '..', 'css', 'netflix4u-net27.css'), 'utf8');
assert(net27Css.includes('@keyframes nmHexPulse'), 'netflix4u-net27.css must define @keyframes nmHexPulse');
assert(net27Css.includes('.nm-modal-loader-wrap'), 'netflix4u-net27.css must define .nm-modal-loader-wrap');
assert(net27Css.includes('.nm-loader-box'), 'netflix4u-net27.css must define .nm-loader-box');
console.log('  ✓ PASS: netflix4u-net27.css contains all required honeycomb animation keyframes & classes');

// 7. NET27-MODAL.JS POSTER CLICK HONEYCOMB LOADER
console.log('\n--- 7. NET27-MODAL.JS POSTER CLICK HONEYCOMB LOADER ---');
const modalJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'net27-modal.js'), 'utf8');
assert(modalJs.includes('renderHoneycombModalLoader'), 'net27-modal.js must include renderHoneycombModalLoader');
assert(modalJs.includes('titleModalBody.innerHTML = renderHoneycombModalLoader'), 'openTitleModal must invoke renderHoneycombModalLoader');
assert(modalJs.includes("id: 'reelsdownload'"), 'SERVERS_CONFIG must include reelsdownload');
console.log('  ✓ PASS: net27-modal.js renders authentic honeycomb animation on poster clicks');

// 8. STREAM PLAYER BACKEND (APICORE.JS)
console.log('\n--- 8. STREAM PLAYER BACKEND (APICORE.JS) ---');
const apiCoreJs = fs.readFileSync(path.join(__dirname, '..', 'services', 'apiCore.js'), 'utf8');
assert(apiCoreJs.includes('id="iframe-reelsdownload"'), 'handleStreamPlayer must include iframe-reelsdownload');
assert(apiCoreJs.includes('id="btn-srv-reelsdownload"'), 'handleStreamPlayer must include btn-srv-reelsdownload');
assert(apiCoreJs.includes('reelsdownloadUrl'), 'handleStreamPlayer must compute reelsdownloadUrl');
console.log('  ✓ PASS: apiCore.js stream player embeds PvrPlay ReelsDownload Hindi Dubbed layer and button');

console.log('\n====================================================');
console.log('ALL PVRPLAY & HONEYCOMB TESTS PASSED (100% SUCCESS)');
console.log('====================================================');
