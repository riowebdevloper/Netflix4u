/** Content Validation Service for Netflix4U Catalog */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const POSTER_ROOTS = [path.join(ROOT, 'images', 'catalog'), path.join(ROOT, 'uploads', 'posts', 'covers')];

function hasSafePoster(record) {
  const poster = record && (record.poster || record.backdrop || record.featured_image);
  if (typeof poster !== 'string' || !poster.trim() || /no-poster|placeholder|placehold|default-poster/i.test(poster)) return false;

  // Genuine external URLs (TMDB, IMDb, Amazon, Hicine storage, YouTube thumbnails)
  if (/^https?:\/\//i.test(poster)) {
    try {
      const u = new URL(poster);
      const h = u.hostname.toLowerCase();
      const isApproved =
        h.endsWith('tmdb.org') ||
        h.endsWith('themoviedb.org') ||
        h.endsWith('hicine.sbs') ||
        h.endsWith('media-amazon.com') ||
        h.endsWith('ytimg.com') ||
        h === 'netflix4u.in' ||
        h.endsWith('workers.dev');
      return isApproved;
    } catch(e) {
      return false;
    }
  }

  if (!poster.startsWith('/')) return false;
  const localPath = path.resolve(ROOT, `.${poster}`);
  return POSTER_ROOTS.some(root => localPath.startsWith(root + path.sep)) && fs.existsSync(localPath);
}

function isPublicRecord(record) {
  if (!record || !record.title) return false;
  // A record can ONLY be public if it has a verified title-specific poster
  if (!hasSafePoster(record)) return false;
  // If explicitly set to POSTER_PENDING or DRAFT, hide from public feeds
  if (record.status === 'POSTER_PENDING' || record.status === 'DRAFT') return false;
  return true;
}

function publicOnly(records) {
  return Array.isArray(records) ? records.filter(isPublicRecord) : [];
}

module.exports = { hasSafePoster, isPublicRecord, publicOnly };
