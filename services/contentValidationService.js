/** Fail-closed public catalog admission gate. */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const POSTER_ROOTS = [path.join(ROOT, 'images', 'catalog'), path.join(ROOT, 'uploads', 'posts', 'covers')];

function hasSafePoster(record) {
  const poster = record && record.poster;
  if (typeof poster !== 'string' || !poster.trim() || /no-poster|placeholder|placehold|default-poster/i.test(poster)) return false;
  if (/^https:\/\/(image\.tmdb\.org|images\.tmdb\.org|m\.media-amazon\.com)\//i.test(poster)) return true;
  if (!poster.startsWith('/')) return false;
  const localPath = path.resolve(ROOT, `.${poster}`);
  return POSTER_ROOTS.some(root => localPath.startsWith(root + path.sep)) && fs.existsSync(localPath);
}

function isPublicRecord(record) {
  return Boolean(record && record.status === 'PUBLISHED' && typeof record.canonicalId === 'string' &&
    record.posterVerification && record.posterVerification.status === 'VERIFIED' &&
    record.posterVerification.canonicalId === record.canonicalId && hasSafePoster(record));
}

function publicOnly(records) { return Array.isArray(records) ? records.filter(isPublicRecord) : []; }
module.exports = { hasSafePoster, isPublicRecord, publicOnly };
