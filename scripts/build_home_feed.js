const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');

console.log('⚡ Generating ultra-fast lightweight home_feed.json (~120KB)...');

const trending = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'trending.json'), 'utf8'));
const recent = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'recent.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'catalog_summary.json'), 'utf8'));
const anime = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'anime.json'), 'utf8'));

function cleanItem(item, defaultType = 'movie') {
  if (!item) return null;
  const id = String(item.record_id || item.id || item._id);
  const rawTitle = item.rawTitle || item.title || 'Untitled';
  const cleanTitle = rawTitle.replace(/^(NetFlix|Prime|Disney\+|Hotstar|SonyLIV|ZEE5)\s+/i, '').trim();
  const poster = item.poster || item.featured_image || 'https://placehold.co/500x750/111427/ffffff?text=No+Poster';
  const backdrop = item.backdrop || item.featured_image || poster;
  const cats = Array.isArray(item.categories) ? item.categories : (typeof item.categories === 'string' ? item.categories.split(',').map(c => c.trim()).filter(Boolean) : []);
  
  const isSeries = item.type === 'series' || (item.contentType && item.contentType.includes('series')) || cats.some(c => /series/i.test(c));
  const isAnime = item.type === 'anime' || cats.some(c => /anime/i.test(c));
  const isKdrama = cats.some(c => /korean|kdrama|k-drama/i.test(c));
  const type = isAnime ? 'anime' : (isKdrama ? 'kdrama' : (isSeries ? 'series' : (item.type || defaultType)));

  return {
    id,
    type,
    title: cleanTitle,
    originalTitle: rawTitle,
    poster,
    backdrop,
    description: item.content || item.description || (`Watch ${rawTitle} in high quality on FlixWorld.`),
    year: item.year || 2026,
    rating: 8.5,
    quality: item.quality || 'FHD',
    genres: cats.filter(c => !/^\d+p$/i.test(c) && !/^\d{4}$/.test(c)).slice(0, 3)
  };
}

const moviesList = catalog.filter(x => x.type === 'movie');
const seriesList = catalog.filter(x => x.type === 'series');
const kdramaList = catalog.filter(x => x.categories && x.categories.some(c => /korean|kdrama|k-drama/i.test(c)));

const homeFeed = {
  trending: trending.map(t => cleanItem(t, 'movie')),
  recent: recent.map(r => cleanItem(r, 'movie')),
  featured: trending.slice(0, 8).map(t => cleanItem(t, 'movie')),
  popularMovies: moviesList.slice(0, 20).map(m => cleanItem(m, 'movie')),
  popularSeries: seriesList.slice(0, 20).map(s => cleanItem(s, 'series')),
  anime: anime.slice(0, 20).map(a => cleanItem(a, 'anime')),
  kdrama: kdramaList.slice(0, 20).map(k => cleanItem(k, 'kdrama')),
  topRated: moviesList.filter(m => m.quality === '4K').slice(0, 20).map(m => cleanItem(m, 'movie')),
  nowPlaying: moviesList.slice(20, 40).map(m => cleanItem(m, 'movie'))
};

fs.writeFileSync(path.join(DATA_DIR, 'home_feed.json'), JSON.stringify(homeFeed));
const sizeKb = (fs.statSync(path.join(DATA_DIR, 'home_feed.json')).size / 1024).toFixed(1);
console.log(`✅ Generated data/home_feed.json (${sizeKb} KB) for instantaneous homepage rendering!`);
