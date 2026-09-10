/** Content Validation Service for Netflix4U Catalog */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const POSTER_ROOTS = [path.join(ROOT, 'images', 'catalog'), path.join(ROOT, 'uploads', 'posts', 'covers')];

function hasSafePoster(record) {
  const poster = record && (record.poster || record.backdrop || record.featured_image);
  if (typeof poster !== 'string' || !poster.trim() || /no-poster|placeholder|placehold|default-poster/i.test(poster)) return false;
  // Genuine external URLs (TMDB, IMDb, Amazon, Hicine storage, CDNs)
  if (/^https?:\/\//i.test(poster)) return true;
  if (!poster.startsWith('/')) return false;
  const localPath = path.resolve(ROOT, `.${poster}`);
  return POSTER_ROOTS.some(root => localPath.startsWith(root + path.sep)) && fs.existsSync(localPath);
}

function isPublicRecord(record) {
  if (!record) return false;
  // If record has an authentic poster, allow full public browsing
  if (hasSafePoster(record)) return true;
  // Also allow records marked PUBLISHED
  return Boolean(record.status === 'PUBLISHED' && record.title);
}

function publicOnly(records) {
  return Array.isArray(records) ? records.filter(isPublicRecord) : [];
}

module.exports = { hasSafePoster, isPublicRecord, publicOnly };
