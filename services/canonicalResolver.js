/**
 * Netflix4U Canonical Content ID & Record Resolver
 * Normalizes all ID formats (numeric, dotmobiz-prefixed, slug, record_id)
 * to ensure that any valid representation reliably resolves to the underlying title.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DETAILS_DIR = path.join(DATA_DIR, 'details');
const CATALOG_SUMMARY_PATH = path.join(DATA_DIR, 'catalog_summary.json');
const COMPLETE_CATALOG_PATH = path.join(DATA_DIR, 'dotmobiz_complete_catalog.json');

// In-Memory Fast Lookup Index
let catalogIndex = null;

function buildCatalogIndex() {
  if (catalogIndex) return catalogIndex;
  catalogIndex = new Map();

  // 1. Index catalog_summary.json
  if (fs.existsSync(CATALOG_SUMMARY_PATH)) {
    try {
      const summaryList = JSON.parse(fs.readFileSync(CATALOG_SUMMARY_PATH, 'utf8'));
      for (const item of summaryList) {
        if (!item) continue;
        const idStr = String(item.id || '');
        const recordIdStr = String(item.record_id || '');
        const slugStr = String(item.slug || '');
        
        if (idStr) catalogIndex.set(idStr, item);
        if (recordIdStr) {
          catalogIndex.set(recordIdStr, item);
          catalogIndex.set(`dotmobiz-${recordIdStr}`, item);
        }
        if (slugStr) {
          catalogIndex.set(slugStr, item);
          const slugIdMatch = slugStr.match(/^(\d+)-/);
          if (slugIdMatch) {
            catalogIndex.set(slugIdMatch[1], item);
            catalogIndex.set(`dotmobiz-${slugIdMatch[1]}`, item);
          }
        }
      }
    } catch (e) {
      console.error('Error indexing catalog_summary.json:', e.message);
    }
  }

  // 2. Index dotmobiz_complete_catalog.json
  if (fs.existsSync(COMPLETE_CATALOG_PATH)) {
    try {
      const completeList = JSON.parse(fs.readFileSync(COMPLETE_CATALOG_PATH, 'utf8'));
      for (const item of completeList) {
        if (!item) continue;
        const idStr = String(item.id || '');
        const recordIdStr = String(item.record_id || '');
        const slugStr = String(item.slug || '');
        
        if (idStr && !catalogIndex.has(idStr)) catalogIndex.set(idStr, item);
        if (recordIdStr && !catalogIndex.has(recordIdStr)) {
          catalogIndex.set(recordIdStr, item);
          if (!catalogIndex.has(`dotmobiz-${recordIdStr}`)) {
            catalogIndex.set(`dotmobiz-${recordIdStr}`, item);
          }
        }
        if (slugStr && !catalogIndex.has(slugStr)) catalogIndex.set(slugStr, item);
      }
    } catch (e) {
      console.error('Error indexing dotmobiz_complete_catalog.json:', e.message);
    }
  }

  // 3. Index slug files in data/details that start with a record ID (e.g., 96465-mirzapur...)
  if (fs.existsSync(DETAILS_DIR)) {
    try {
      const files = fs.readdirSync(DETAILS_DIR);
      for (const f of files) {
        const m = f.match(/^(\d{3,7})-/);
        if (m && m[1]) {
          const num = m[1];
          const baseName = f.replace(/\.json$/, '');
          const entry = { detailFilename: baseName, record_id: num, id: `dotmobiz-${num}` };
          if (!catalogIndex.has(num)) catalogIndex.set(num, entry);
          if (!catalogIndex.has(`dotmobiz-${num}`)) catalogIndex.set(`dotmobiz-${num}`, entry);
        }
      }
    } catch(e) {}
  }

  return catalogIndex;
}

/**
 * Reads a JSON file from DETAILS_DIR safely
 */
function readDetailFile(filename) {
  if (!filename) return null;
  const safeFile = filename.replace(/[/\\?%*:|"<>]/g, '_');
  const targetPath = path.join(DETAILS_DIR, safeFile.endsWith('.json') ? safeFile : `${safeFile}.json`);
  
  // Guard against path traversal
  if (!path.resolve(targetPath).startsWith(DETAILS_DIR)) {
    return null;
  }

  if (fs.existsSync(targetPath)) {
    try {
      return JSON.parse(fs.readFileSync(targetPath, 'utf8'));
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * Canonical Content Resolver
 * Resolves any valid identifier representation to the underlying title object
 */
async function resolveContentId(rawId) {
  if (!rawId || typeof rawId !== 'string') return null;
  
  const id = rawId.trim().replace(/^\/+|\/+$/g, '');
  if (!id) return null;

  // 1. Direct file lookup with the exact id
  let item = readDetailFile(id);
  if (item) return item;

  // 2. If ID has 'dotmobiz-' prefix, try without prefix
  if (id.startsWith('dotmobiz-')) {
    const rawNum = id.replace(/^dotmobiz-/, '');
    item = readDetailFile(rawNum);
    if (item) return item;
  }

  // 3. If ID is numeric, try with 'dotmobiz-' prefix
  if (/^\d+$/.test(id)) {
    item = readDetailFile(`dotmobiz-${id}`);
    if (item) return item;
  }

  // 4. Check memory catalog index for alias mapping
  const index = buildCatalogIndex();
  const catalogEntry = index.get(id) || index.get(id.toLowerCase());

  if (catalogEntry) {
    // Try candidate file names based on catalog entry
    const candidateNames = [
      catalogEntry.detailFilename,
      catalogEntry.id,
      catalogEntry.record_id ? String(catalogEntry.record_id) : null,
      catalogEntry.record_id ? `dotmobiz-${catalogEntry.record_id}` : null,
      catalogEntry.slug,
      catalogEntry.title ? catalogEntry.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : null
    ].filter(Boolean);

    for (const name of candidateNames) {
      item = readDetailFile(name);
      if (item) return item;
    }

    // Network discovery is not a detail-page fallback. Only persisted records
    // with a canonical relationship may be returned here.
  }

  return null;
}

module.exports = {
  resolveContentId,
  buildCatalogIndex,
  readDetailFile
};
