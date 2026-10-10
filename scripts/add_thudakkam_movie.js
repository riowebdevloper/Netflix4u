/**
 * Script to ingest Thudakkam (2026) into Netflix4U database
 * Updates:
 * - data/details_map.json
 * - data/details/thudakkam-2026.json & data/details/dotmobiz-58494.json
 * - data/catalog_summary.json
 * - data/home_feed.json
 * - data/movies.json
 * - data/south-indian.json
 * - data/hindi-dubbed.json
 * - data/recent.json
 * - data/trending.json
 * - data/curated_latestrelease.json
 * - data/curated_trending.json
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DETAILS_DIR = path.join(DATA_DIR, 'details');

const POSTER_URL = 'https://wsrv.nl/?url=https%3A%2F%2Fvegamoviess.build%2Fuploads%2Fposts%2Fcovers%2Fthudakkam-2026-hindi--malayalam-dual-audio-webdl-720p--480p--1080p.webp&output=webp';
const BACKDROP_URL = 'https://wsrv.nl/?url=https%3A%2F%2Fvegamoviess.build%2Fuploads%2Fposts%2Fcovers%2Fthudakkam-2026-hindi--malayalam-dual-audio-webdl-720p--480p--1080p.webp&output=webp';

const movieRecord = {
  id: '58494',
  record_id: 58494,
  canonicalId: 'dotmobiz-58494',
  title: 'Thudakkam (2026)',
  rawTitle: 'Thudakkam 2026 Hindi - Malayalam Dual Audio WEB-DL 720p - 480p - 1080p',
  slug: 'thudakkam-2026',
  poster: POSTER_URL,
  backdrop: BACKDROP_URL,
  type: 'movie',
  contentType: 'movie',
  mediaType: 'movie',
  categories: [
    'South Indian',
    'Malayalam',
    'Hindi Dubbed',
    'Drama',
    'Thriller',
    'Action',
    '2026',
    '1080p',
    '720p',
    '480p'
  ],
  year: 2026,
  quality: 'FHD',
  rating: 8.4,
  imdbId: 'tt37510017',
  tmdbId: null,
  date: '2026-10-10T04:00:00.000Z',
  publishedAt: '2026-10-10T04:00:00.000Z',
  _id: 'thudakkam58494',
  description: 'When danger strikes, a young woman fights to survive through courage and determination. Thudakkam (2026) Full Movie Hindi - Malayalam Dual Audio WEB-DL.',
  overview: 'When danger strikes, a young woman fights to survive through courage and determination. Thudakkam (2026) Full Movie Hindi - Malayalam Dual Audio WEB-DL.',
  provider: 'vegamovies',
  source: 'vegamovies',
  status: 'PUBLISHED',
  links: [
    {
      url: 'https://nexdrive.you/genxfm263443586047992/',
      quality: '480p',
      size: '641MB',
      label: 'Click Here To Download [641MB]',
      isCloud: false,
      isDotmovies: true,
      source: 'Direct Ultra HD',
      provider: 'vegamovies'
    },
    {
      url: 'https://nexdrive.you/genxfm202757136514415/',
      quality: '720p',
      size: '821MB',
      label: 'Click Here To Download [821MB]',
      isCloud: false,
      isDotmovies: true,
      source: 'Direct Ultra HD',
      provider: 'vegamovies'
    },
    {
      url: 'https://nexdrive.you/genxfm574663691623239/',
      quality: '720p',
      size: '1.59GB',
      label: 'Click Here To Download [1.59GB]',
      isCloud: false,
      isDotmovies: true,
      source: 'Direct Ultra HD',
      provider: 'vegamovies'
    },
    {
      url: 'https://nexdrive.you/genxfm839324307018053/',
      quality: '1080p',
      size: '3.44GB',
      label: 'Click Here To Download [3.44GB]',
      isCloud: false,
      isDotmovies: true,
      source: 'Direct Ultra HD',
      provider: 'vegamovies'
    }
  ]
};

const catalogItem = {
  id: 'dotmobiz-58494',
  canonicalId: 'dotmobiz-58494',
  title: 'Thudakkam (2026)',
  rawTitle: 'Thudakkam 2026 Hindi - Malayalam Dual Audio WEB-DL 720p - 480p - 1080p',
  slug: 'thudakkam-2026',
  type: 'movie',
  year: 2026,
  quality: 'FHD',
  provider: 'vegamovies',
  rating: 8.4,
  poster: POSTER_URL,
  backdrop: BACKDROP_URL,
  imdbId: 'tt37510017',
  tmdbId: null,
  categories: [
    'South Indian',
    'Malayalam',
    'Hindi Dubbed',
    'Drama',
    'Thriller',
    'Action'
  ],
  status: 'PUBLISHED',
  publishedAt: '2026-10-10T04:00:00.000Z',
  links: movieRecord.links
};

console.log('Ingesting Thudakkam (2026)...');

// 1. Details files
if (!fs.existsSync(DETAILS_DIR)) fs.mkdirSync(DETAILS_DIR, { recursive: true });
fs.writeFileSync(path.join(DETAILS_DIR, 'thudakkam-2026.json'), JSON.stringify(movieRecord, null, 2));
fs.writeFileSync(path.join(DETAILS_DIR, 'dotmobiz-58494.json'), JSON.stringify(movieRecord, null, 2));
console.log('✓ Wrote details files in data/details/');

// 2. data/details_map.json
const detailsMapPath = path.join(DATA_DIR, 'details_map.json');
if (fs.existsSync(detailsMapPath)) {
  const dMap = JSON.parse(fs.readFileSync(detailsMapPath, 'utf8'));
  dMap['58494'] = movieRecord;
  dMap['thudakkam-2026'] = movieRecord;
  dMap['dotmobiz-58494'] = movieRecord;
  dMap['tt37510017'] = movieRecord;
  fs.writeFileSync(detailsMapPath, JSON.stringify(dMap));
  console.log('✓ Updated data/details_map.json');
}

// 3. data/catalog_summary.json
const summaryPath = path.join(DATA_DIR, 'catalog_summary.json');
if (fs.existsSync(summaryPath)) {
  let summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  summary = summary.filter(item => item.id !== 'dotmobiz-58494' && item.slug !== 'thudakkam-2026' && item.imdbId !== 'tt37510017');
  summary.unshift(catalogItem);
  fs.writeFileSync(summaryPath, JSON.stringify(summary));
  console.log('✓ Prepend to data/catalog_summary.json');
}

// 4. Update Category JSON files
function prependToFile(filename, item) {
  const fPath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fPath)) return;
  try {
    let content = JSON.parse(fs.readFileSync(fPath, 'utf8'));
    if (Array.isArray(content)) {
      content = content.filter(i => i.id !== item.id && i.slug !== item.slug && i.imdbId !== item.imdbId);
      content.unshift(item);
      fs.writeFileSync(fPath, JSON.stringify(content, null, 2));
      console.log(`✓ Prepend to data/${filename}`);
    } else if (content && typeof content === 'object') {
      const curatedItem = {
        tmdbId: item.tmdbId,
        imdbId: item.imdbId,
        canonicalId: item.canonicalId,
        type: item.type,
        title: item.title,
        year: String(item.year),
        poster: item.poster,
        backdrop: item.backdrop,
        rating: item.rating,
        overview: item.description || item.title
      };
      if (Array.isArray(content.hero)) {
        content.hero = content.hero.filter(i => i.canonicalId !== item.canonicalId && i.title !== item.title);
        content.hero.unshift(curatedItem);
      }
      if (Array.isArray(content.rails)) {
        content.rails.forEach(rail => {
          if (Array.isArray(rail.items)) {
            rail.items = rail.items.filter(i => i.canonicalId !== item.canonicalId && i.title !== item.title);
            rail.items.unshift(curatedItem);
          }
        });
      }
      fs.writeFileSync(fPath, JSON.stringify(content, null, 2));
      console.log(`✓ Updated curated rails & hero in data/${filename}`);
    }
  } catch(e) {
    console.error(`Failed to update ${filename}:`, e.message);
  }
}

prependToFile('movies.json', catalogItem);
prependToFile('south-indian.json', catalogItem);
prependToFile('hindi-dubbed.json', catalogItem);
prependToFile('trending.json', catalogItem);
prependToFile('recent.json', catalogItem);
prependToFile('curated_latestrelease.json', catalogItem);
prependToFile('curated_trending.json', catalogItem);

// 5. Update data/home_feed.json
const homeFeedPath = path.join(DATA_DIR, 'home_feed.json');
if (fs.existsSync(homeFeedPath)) {
  try {
    const feed = JSON.parse(fs.readFileSync(homeFeedPath, 'utf8'));
    ['trending', 'recent', 'featured', 'popularMovies', 'topRated', 'nowPlaying'].forEach(section => {
      if (Array.isArray(feed[section])) {
        feed[section] = feed[section].filter(i => i.id !== catalogItem.id && i.slug !== catalogItem.slug && i.imdbId !== catalogItem.imdbId);
        feed[section].unshift(catalogItem);
      }
    });
    feed.updatedAt = new Date().toISOString();
    fs.writeFileSync(homeFeedPath, JSON.stringify(feed, null, 2));
    console.log('✓ Updated data/home_feed.json sections');
  } catch(e) {
    console.error('Failed to update home_feed.json:', e.message);
  }
}

console.log('🎉 Done! Thudakkam (2026) is fully indexed.');
