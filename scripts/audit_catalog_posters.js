/**
 * Automated Poster Quality & Integrity Audit Script
 * Audits all catalog datasets to ensure 100% real posters and 0 unverified placeholders.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const ALLOWED_DOMAINS = [
  'image.tmdb.org',
  'storage.hicine.sbs',
  'm.media-amazon.com'
];

function checkPoster(url) {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return { valid: false, reason: 'MISSING' };
  }
  const lower = url.toLowerCase();
  if (
    lower.includes('no-poster') ||
    lower.includes('placeholder') ||
    lower.includes('data:image') ||
    lower.includes('unavailable')
  ) {
    return { valid: false, reason: 'PLACEHOLDER' };
  }
  if (lower.startsWith('/uploads/') || lower.startsWith('/images/covers/')) {
    return { valid: true, domain: 'local' };
  }
  try {
    const parsed = new URL(url);
    const matched = ALLOWED_DOMAINS.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d));
    if (matched) {
      return { valid: true, domain: parsed.hostname };
    } else {
      return { valid: false, reason: 'UNAPPROVED_DOMAIN: ' + parsed.hostname };
    }
  } catch(e) {
    return { valid: false, reason: 'INVALID_URL' };
  }
}

function auditFile(relPath, extractItems) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${relPath}`);
    return;
  }

  console.log(`\n======================================================`);
  console.log(`🔍 AUDITING: ${relPath}`);
  console.log(`======================================================`);

  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const items = extractItems(data);

  let total = items.length;
  let valid = 0;
  let missing = 0;
  let placeholder = 0;
  let unapproved = 0;
  const domainBreakdown = {};

  items.forEach(it => {
    const res = checkPoster(it.poster);
    if (res.valid) {
      valid++;
      domainBreakdown[res.domain] = (domainBreakdown[res.domain] || 0) + 1;
    } else {
      if (res.reason === 'MISSING') missing++;
      else if (res.reason === 'PLACEHOLDER') placeholder++;
      else unapproved++;
    }
  });

  console.log(`Total Titles Audited: ${total}`);
  console.log(`✅ Verified Real Posters: ${valid} (${((valid/total)*100).toFixed(1)}%)`);
  console.log(`❌ Placeholders (no-poster.svg): ${placeholder}`);
  console.log(`❌ Missing Posters: ${missing}`);
  console.log(`❌ Unapproved Domains: ${unapproved}`);
  console.log(`\nVerified Domain Breakdown:`, domainBreakdown);

  return { total, valid, placeholder, missing, unapproved };
}

console.log('🛡️  NETFLIX4U CATALOG POSTER INTEGRITY AUDIT');

// 1. Audit catalog_summary.json
auditFile('data/catalog_summary.json', data => data);

// 2. Audit trending.json
auditFile('data/trending.json', data => data);

// 3. Audit home_feed.json
auditFile('data/home_feed.json', data => {
  let all = [];
  Object.keys(data).forEach(k => {
    if (Array.isArray(data[k])) all = all.concat(data[k]);
  });
  return all;
});
