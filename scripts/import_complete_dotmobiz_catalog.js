const fs = require('fs');
const path = require('path');
const https = require('https');
const { cleanDotmobizTitle, extractYear, extractQuality } = require('../services/dotmobizAdapter');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const SITEMAP_URL = 'https://dotmobiz.com/sitemap.xml';

function fetchSitemap() {
  return new Promise((resolve, reject) => {
    https.get(SITEMAP_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 20000
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

function slugToTitle(slug) {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

async function run() {
  console.log('📡 Fetching complete sitemap from Dotmobiz.com...');
  const sitemapXml = await fetchSitemap();
  console.log(`Received sitemap (${(sitemapXml.length / 1024 / 1024).toFixed(2)} MB).`);

  const regex = /<loc>https:\/\/dotmobiz\.com\/([0-9]+)-([^<]+)\.html<\/loc>/g;
  let match;
  const catalog = [];
  const seenIds = new Set();

  while ((match = regex.exec(sitemapXml)) !== null) {
    const postId = match[1];
    const rawSlug = match[2];
    if (seenIds.has(postId)) continue;
    seenIds.add(postId);

    const fullRawTitle = slugToTitle(rawSlug);
    const pureTitle = cleanDotmobizTitle(fullRawTitle);
    const year = extractYear(fullRawTitle, null);
    const isSeries = /season|episode|web[- ]?series|\[ep/i.test(rawSlug) && !/the[- ]movie/i.test(rawSlug);
    const quality = extractQuality(fullRawTitle, []);

    catalog.push({
      id: `dotmobiz-${postId}`,
      record_id: postId,
      title: pureTitle,
      rawTitle: fullRawTitle,
      slug: `${postId}-${rawSlug}`,
      url: `https://dotmobiz.com/${postId}-${rawSlug}.html`,
      type: isSeries ? 'series' : 'movie',
      year: year,
      quality: quality,
      provider: 'dotmobiz',
      rating: 8.4,
      poster: `https://placehold.co/500x750/111427/ffffff?text=${encodeURIComponent(pureTitle)}`,
      backdrop: `https://placehold.co/1280x720/111427/ffffff?text=${encodeURIComponent(pureTitle)}`
    });
  }

  console.log(`🎉 Parsed ${catalog.length} complete titles from Dotmobiz!`);

  // Load the 25 pre-enriched latest 2026 releases from dotmobiz_harvested.json
  const harvestedPath = path.resolve(__dirname, '..', 'scratch', 'dotmobiz_harvested.json');
  let harvested = [];
  if (fs.existsSync(harvestedPath)) {
    harvested = JSON.parse(fs.readFileSync(harvestedPath, 'utf8'));
  }

  const enrichedMap = new Map();
  for (const item of harvested) {
    enrichedMap.set(item.postId, item);
  }

  // Enrich items with high-res TMDB / local posters & backdrops
  for (const item of catalog) {
    if (enrichedMap.has(item.record_id)) {
      const enr = enrichedMap.get(item.record_id);
      item.poster = enr.poster || enr.image || item.poster;
      item.backdrop = enr.backdrop || enr.poster || item.backdrop;
      item.rating = enr.rating || item.rating;
      item.imdbId = enr.imdbId || '';
      item.title = cleanDotmobizTitle(enr.title) || item.title;
    }
  }

  // Save complete dotmobiz catalog
  fs.writeFileSync(path.join(DATA_DIR, 'dotmobiz_complete_catalog.json'), JSON.stringify(catalog));
  console.log(`✅ Saved ${catalog.length} titles to data/dotmobiz_complete_catalog.json`);

  // Update catalog_summary.json by prepending Dotmobiz complete catalog
  const summaryPath = path.join(DATA_DIR, 'catalog_summary.json');
  let existing = [];
  if (fs.existsSync(summaryPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    } catch(e) {}
  }

  // Keep existing non-dotmobiz items
  const nonDotmobiz = existing.filter(item => !String(item.id).startsWith('dotmobiz-'));
  
  // Create merged summary: Dotmobiz 2026 latest releases at the very top, followed by other Dotmobiz, followed by non-dotmobiz
  const topReleases = catalog.filter(c => enrichedMap.has(c.record_id));
  const otherDotmobiz = catalog.filter(c => !enrichedMap.has(c.record_id));

  const finalSummary = [
    ...topReleases,
    ...otherDotmobiz.slice(0, 5000), // Top 5,000 dotmobiz catalog entries for blisteringly fast instant search
    ...nonDotmobiz
  ];

  fs.writeFileSync(summaryPath, JSON.stringify(finalSummary));
  console.log(`✅ Updated data/catalog_summary.json with ${finalSummary.length} titles!`);
}

run().catch(console.error);
