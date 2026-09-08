const fs = require('fs');
const path = require('path');
const https = require('https');

const API_BASE = 'https://api.hicine.sbs';
const DATA_DIR = path.resolve(__dirname, '..', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function fetchJson(url, retries = 3) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'FlixWorld-Exporter/1.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (err) {
          if (retries > 0) {
            console.log(`Retrying (${retries} left) for ${url}`);
            setTimeout(() => resolve(fetchJson(url, retries - 1)), 1500);
          } else {
            reject(new Error(`Failed to parse JSON from ${url}: ${err.message}`));
          }
        }
      });
    }).on('error', err => {
      if (retries > 0) {
        console.log(`Connection error on ${url}, retrying (${retries} left)...`);
        setTimeout(() => resolve(fetchJson(url, retries - 1)), 2000);
      } else {
        reject(err);
      }
    });
  });
}

async function fetchAllPages(collectionName, limit = 1000) {
  console.log(`\n📦 Fetching all records for: ${collectionName}...`);
  let page = 1;
  let allData = [];
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${API_BASE}/api/${collectionName}?page=${page}&limit=${limit}`;
    try {
      const res = await fetchJson(url);
      if (res && res.data && Array.isArray(res.data)) {
        allData = allData.concat(res.data);
        if (res.pagination && res.pagination.pages) {
          totalPages = res.pagination.pages;
        }
        console.log(`   Fetched page ${page}/${totalPages} (${allData.length} total items)`);
      } else if (Array.isArray(res)) {
        allData = allData.concat(res);
        break;
      } else {
        console.warn(`   Unexpected response structure for ${collectionName}`);
        break;
      }
    } catch (err) {
      console.error(`   Error fetching page ${page} of ${collectionName}:`, err.message);
    }
    page++;
    // Small polite delay between batch requests
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`✅ Finished ${collectionName}: ${allData.length} records retrieved.`);
  return allData;
}

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
  const text = `${categories || ''} ${links || ''} ${title || ''}`;
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

    // Look for quality and size in the line
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

async function run() {
  console.log('🚀 Starting complete Hicine database export...');
  const startTime = Date.now();

  // 1. Trending
  console.log('\n🔥 Fetching Trending...');
  const trending = await fetchJson(`${API_BASE}/api/trending`);
  fs.writeFileSync(path.join(DATA_DIR, 'trending.json'), JSON.stringify(trending, null, 2));

  // 2. Recent
  console.log('\n✨ Fetching Recent...');
  const recent = await fetchJson(`${API_BASE}/api/recent`);
  fs.writeFileSync(path.join(DATA_DIR, 'recent.json'), JSON.stringify(recent, null, 2));

  // 3. Anime
  const anime = await fetchAllPages('anime', 500);
  fs.writeFileSync(path.join(DATA_DIR, 'anime.json'), JSON.stringify(anime, null, 2));

  // 4. Series
  const series = await fetchAllPages('series', 1000);
  fs.writeFileSync(path.join(DATA_DIR, 'series.json'), JSON.stringify(series, null, 2));

  // 5. Movies
  const movies = await fetchAllPages('movies', 1000);
  fs.writeFileSync(path.join(DATA_DIR, 'movies.json'), JSON.stringify(movies, null, 2));

  // 6. Build Compact Summary & Details Map
  console.log('\n⚙️ Generating catalog summary & detail index map...');
  const catalogSummary = [];
  const detailsMap = {};

  const allRecords = [
    ...movies.map(m => ({ ...m, mediaType: 'movie' })),
    ...series.map(s => ({ ...s, mediaType: 'series' })),
    ...anime.map(a => ({ ...a, mediaType: 'anime' }))
  ];

  // Deduplicate by record_id / _id
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

    // Full detail entry
    detailsMap[id] = {
      ...summaryItem,
      _id: item._id,
      record_id: item.record_id,
      links: parsedLinks,
      rawLinks: item.links || '',
      content: item.content || '',
      status: item.status || 'publish'
    };

    if (item.url_slug) {
      detailsMap[item.url_slug] = detailsMap[id];
    }
  }

  fs.writeFileSync(path.join(DATA_DIR, 'catalog_summary.json'), JSON.stringify(catalogSummary));
  fs.writeFileSync(path.join(DATA_DIR, 'details_map.json'), JSON.stringify(detailsMap));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 Export complete in ${elapsed}s!`);
  console.log(`   - Total Unique Titles: ${catalogSummary.length}`);
  console.log(`   - Movies: ${movies.length}`);
  console.log(`   - Series: ${series.length}`);
  console.log(`   - Anime: ${anime.length}`);
  console.log(`   - Trending: ${trending.length}`);
  console.log(`   - Recent: ${recent.length}`);
  console.log(`   - All data saved to ${DATA_DIR}`);
}

run().catch(err => {
  console.error('Fatal export error:', err);
  process.exit(1);
});
