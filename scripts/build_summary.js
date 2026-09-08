const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const movies = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'movies.json'), 'utf8'));
const series = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'series.json'), 'utf8'));
const anime = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'anime.json'), 'utf8'));
const trending = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'trending.json'), 'utf8'));
const recent = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'recent.json'), 'utf8'));

function cleanTitle(raw) {
  if (!raw) return 'Untitled';
  return raw.replace(/^(NetFlix|Prime|Disney\+|Hotstar|SonyLIV|ZEE5)\s+/i, '').trim();
}

function extractYear(title, dateStr) {
  const match = (title || '').match(/\b(19\d{2}|20\d{2})\b/);
  if (match) return parseInt(match[1]);
  if (dateStr) {
    const y = new Date(dateStr).getFullYear();
    if (!isNaN(y)) return y;
  }
  return new Date().getFullYear();
}

function extractQuality(categories, links, title) {
  const text = (categories || '') + ' ' + (links || '') + ' ' + (title || '');
  if (/4K|2160p/i.test(text)) return '4K';
  if (/1080p|FHD/i.test(text)) return 'FHD';
  if (/720p|HD/i.test(text)) return 'HD';
  if (/480p|SD/i.test(text)) return '480p';
  return 'HD';
}

function parseLinks(rawLinks) {
  if (!rawLinks) return [];
  const lines = rawLinks.split('\n').map(l => l.trim()).filter(Boolean);
  const parsed = [];

  for (const line of lines) {
    const parts = line.split(',').map(p => p.trim());
    const url = parts[0] || '';
    if (!url.startsWith('http')) continue;

    const qualityMatch = line.match(/\b(480p|720p|1080p|2160p|4K)\b/i);
    const sizeMatch = line.match(/\b(\d+(?:\.\d+)?\s*(?:MB|GB|TB))\b/i);
    const labelMatch = parts.find(p => /\[.*\]|WEB-DL|HDRip|NF|BluRay/i.test(p));

    parsed.push({
      url,
      quality: qualityMatch ? qualityMatch[1].toUpperCase() : 'HD',
      size: sizeMatch ? sizeMatch[1].toUpperCase() : '',
      label: labelMatch || `Server Stream (${qualityMatch ? qualityMatch[1] : 'Direct'})`,
      isCloud: url.includes('vcloud') || url.includes('cloud') || url.includes('workers.dev') || url.includes('drive')
    });
  }
  return parsed;
}

const allRecords = [
  ...trending.map(t => ({ ...t, mediaType: t.contentType && t.contentType.includes('series') ? 'series' : 'movie' })),
  ...recent.map(r => ({ ...r, mediaType: r.contentType && r.contentType.includes('series') ? 'series' : 'movie' })),
  ...movies.map(m => ({ ...m, mediaType: 'movie' })),
  ...series.map(s => ({ ...s, mediaType: 'series' })),
  ...anime.map(a => ({ ...a, mediaType: 'anime' }))
];

const catalogSummary = [];
const detailsMap = {};
const seenIds = new Set();

for (const item of allRecords) {
  const id = String(item.record_id || item._id);
  if (!id || seenIds.has(id)) continue;
  seenIds.add(id);

  const year = extractYear(item.title, item.date);
  const quality = extractQuality(item.categories, item.links, item.title);
  const cleanedTitle = cleanTitle(item.title);
  const parsedLinks = parseLinks(item.links);

  const summaryItem = {
    id,
    title: cleanedTitle,
    rawTitle: item.title,
    slug: item.url_slug || '',
    poster: item.featured_image || '',
    backdrop: item.featured_image || '',
    type: item.mediaType,
    categories: item.categories ? item.categories.split(',').map(c => c.trim()).filter(Boolean) : [],
    year,
    quality,
    date: item.date || ''
  };

  catalogSummary.push(summaryItem);

  const detailEntry = {
    ...summaryItem,
    _id: item._id,
    record_id: item.record_id,
    links: parsedLinks,
    rawLinks: item.links || '',
    content: item.content || '',
    status: item.status || 'publish'
  };

  detailsMap[id] = detailEntry;

  if (item._id && String(item._id) !== id) {
    detailsMap[String(item._id)] = detailEntry;
  }

  if (item.url_slug) {
    detailsMap[item.url_slug] = detailEntry;
  }
}

fs.writeFileSync(path.join(DATA_DIR, 'catalog_summary.json'), JSON.stringify(catalogSummary));
fs.writeFileSync(path.join(DATA_DIR, 'details_map.json'), JSON.stringify(detailsMap));
console.log('✅ Successfully indexed total titles:', catalogSummary.length);
