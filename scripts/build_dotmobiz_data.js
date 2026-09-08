const fs = require('fs');
const path = require('path');
const { normalizeDotmobizPost } = require('../services/dotmobizAdapter');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DETAILS_DIR = path.join(DATA_DIR, 'details');
const HARVESTED_FILE = path.resolve(__dirname, '..', 'scratch', 'dotmobiz_harvested.json');

if (!fs.existsSync(DETAILS_DIR)) {
  fs.mkdirSync(DETAILS_DIR, { recursive: true });
}

async function run() {
  console.log('🚀 Starting Dotmobiz Data Integration Pipeline...');

  if (!fs.existsSync(HARVESTED_FILE)) {
    console.error('Harvested file not found:', HARVESTED_FILE);
    process.exit(1);
  }

  const rawPosts = JSON.parse(fs.readFileSync(HARVESTED_FILE, 'utf8'));
  console.log(`Loaded ${rawPosts.length} Dotmobiz harvested posts.`);

  const normalizedPosts = rawPosts.map(normalizeDotmobizPost).filter(Boolean);
  console.log(`Normalized ${normalizedPosts.length} posts into FlixWorld model.`);

  // 1. Write individual detail files for fast on-demand lookup
  let detailCount = 0;
  for (const post of normalizedPosts) {
    const filePath = path.join(DETAILS_DIR, `${post.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(post, null, 2));
    detailCount++;

    // Write slug alias if exists
    if (post.slug) {
      const safeSlug = post.slug.replace(/[/\\?%*:|"<>]/g, '_');
      fs.writeFileSync(path.join(DETAILS_DIR, `${safeSlug}.json`), JSON.stringify(post, null, 2));
    }
    // Write numeric id alias
    if (post.record_id) {
      fs.writeFileSync(path.join(DETAILS_DIR, `${post.record_id}.json`), JSON.stringify(post, null, 2));
    }
  }
  console.log(`✅ Written ${detailCount} individual detail files to data/details/`);

  // 2. Update catalog_summary.json
  const summaryPath = path.join(DATA_DIR, 'catalog_summary.json');
  let currentSummary = [];
  if (fs.existsSync(summaryPath)) {
    try {
      currentSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    } catch (e) {}
  }

  const dotmobizSummaryItems = normalizedPosts.map(p => ({
    id: p.id,
    title: p.title,
    rawTitle: p.rawTitle,
    slug: p.slug,
    poster: p.poster,
    backdrop: p.backdrop,
    type: p.type,
    categories: p.categories,
    year: p.year,
    quality: p.quality,
    date: p.date || '04 Sep 2026',
    provider: 'dotmobiz',
    imdbId: p.imdbId,
    rating: p.rating
  }));

  // Filter out any existing dotmobiz items to avoid duplicate keys
  const existingNonDotmobiz = currentSummary.filter(item => !String(item.id).startsWith('dotmobiz-'));
  const mergedSummary = [...dotmobizSummaryItems, ...existingNonDotmobiz];

  fs.writeFileSync(summaryPath, JSON.stringify(mergedSummary));
  console.log(`✅ Updated catalog_summary.json (Total titles: ${mergedSummary.length})`);

  // 3. Update home_feed.json with Dotmobiz featured 2026 titles
  const homeFeedPath = path.join(DATA_DIR, 'home_feed.json');
  let homeFeed = {};
  if (fs.existsSync(homeFeedPath)) {
    try {
      homeFeed = JSON.parse(fs.readFileSync(homeFeedPath, 'utf8'));
    } catch (e) {}
  }

  // Prepend Dotmobiz titles to hero carousel (featured)
  const dotmobizFeatured = normalizedPosts.slice(0, 8);
  const dotmobizMovies = normalizedPosts.filter(p => p.type === 'movie');
  const dotmobizSeries = normalizedPosts.filter(p => p.type === 'series');

  homeFeed.featured = [...dotmobizFeatured, ...(homeFeed.featured || []).filter(i => !String(i.id).startsWith('dotmobiz-'))].slice(0, 10);
  homeFeed.trending = [...normalizedPosts.slice(0, 12), ...(homeFeed.trending || []).filter(i => !String(i.id).startsWith('dotmobiz-'))].slice(0, 20);
  homeFeed.recent = [...normalizedPosts, ...(homeFeed.recent || []).filter(i => !String(i.id).startsWith('dotmobiz-'))].slice(0, 25);
  
  if (homeFeed.movies) {
    homeFeed.movies = [...dotmobizMovies, ...homeFeed.movies.filter(i => !String(i.id).startsWith('dotmobiz-'))].slice(0, 25);
  }
  if (homeFeed.series) {
    homeFeed.series = [...dotmobizSeries, ...homeFeed.series.filter(i => !String(i.id).startsWith('dotmobiz-'))].slice(0, 25);
  }

  fs.writeFileSync(homeFeedPath, JSON.stringify(homeFeed, null, 2));
  console.log(`✅ Updated home_feed.json with Dotmobiz 2026 content!`);
  console.log('🎉 Dotmobiz Migration Pipeline successfully completed!');
}

run().catch(err => {
  console.error('Migration Pipeline Error:', err);
  process.exit(1);
});
