/**
 * Netflix4U Unified Content Service
 * Combines Dotmobiz and Hicine data providers into a high-performance content engine.
 */

const fs = require('fs');
const path = require('path');
const { normalizeDotmobizPost } = require('./dotmobizAdapter');
const { normalizeHicineItem } = require('./hicineAdapter');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DETAILS_DIR = path.join(DATA_DIR, 'details');

// In-Memory Fast Lookup Caches
let unifiedCatalog = null;
let unifiedCatalogMap = new Map();
let dotmobizItems = [];

function loadDotmobizItems() {
  const harvestedPath = path.resolve(__dirname, '..', 'scratch', 'dotmobiz_harvested.json');
  if (fs.existsSync(harvestedPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(harvestedPath, 'utf8'));
      dotmobizItems = raw.map(normalizeDotmobizPost).filter(Boolean);
      return dotmobizItems;
    } catch (e) {
      console.error('Error loading Dotmobiz harvested data:', e.message);
    }
  }
  return [];
}

function getUnifiedCatalog() {
  if (unifiedCatalog) return unifiedCatalog;

  const summaryPath = path.join(DATA_DIR, 'catalog_summary.json');
  let baseCatalog = [];
  if (fs.existsSync(summaryPath)) {
    try {
      baseCatalog = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    } catch (e) {}
  }

  // Load Dotmobiz items
  const dotmobiz = loadDotmobizItems();

  // Combine with Dotmobiz at the front (latest 2026 releases)
  const combined = [];
  const seenIds = new Set();

  for (const item of dotmobiz) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      combined.push({
        id: item.id,
        title: item.title,
        rawTitle: item.rawTitle,
        slug: item.slug,
        poster: item.poster,
        backdrop: item.backdrop,
        type: item.type,
        categories: item.categories,
        year: item.year,
        quality: item.quality,
        date: item.date || '04 Sep 2026',
        provider: 'dotmobiz',
        imdbId: item.imdbId,
        rating: item.rating
      });
      unifiedCatalogMap.set(item.id, item);
      if (item.record_id) unifiedCatalogMap.set(`dotmobiz-${item.record_id}`, item);
      if (item.slug) unifiedCatalogMap.set(item.slug, item);
    }
  }

  for (const item of baseCatalog) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      combined.push(item);
    }
  }

  unifiedCatalog = combined;
  return unifiedCatalog;
}

function getTitleDetails(id) {
  if (!id) return null;
  getUnifiedCatalog(); // Ensure memory map loaded

  // 1. Check in-memory Dotmobiz map
  if (unifiedCatalogMap.has(id)) {
    return unifiedCatalogMap.get(id);
  }

  // 2. Check individual file on disk
  const safeId = id.replace(/[/\\?%*:|"<>]/g, '_');
  const filePath = path.join(DETAILS_DIR, safeId + '.json');
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {}
  }

  // 3. Fallback: Check if numeric ID matches Dotmobiz
  for (const item of dotmobizItems) {
    if (item.record_id === id || item.id === `dotmobiz-${id}` || item.slug === id) {
      return item;
    }
  }

  return null;
}

function searchCatalog(query, limit = 40) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];

  const catalog = getUnifiedCatalog();
  const results = [];

  for (const item of catalog) {
    const matchTitle = item.title && item.title.toLowerCase().includes(q);
    const matchRaw = item.rawTitle && item.rawTitle.toLowerCase().includes(q);
    const matchSlug = item.slug && item.slug.toLowerCase().includes(q);
    const matchCat = item.categories && item.categories.some(c => c.toLowerCase().includes(q));

    if (matchTitle || matchRaw || matchSlug || matchCat) {
      results.push(item);
      if (results.length >= limit) break;
    }
  }

  return results;
}

module.exports = {
  loadDotmobizItems,
  getUnifiedCatalog,
  getTitleDetails,
  searchCatalog
};
