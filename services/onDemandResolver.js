const fs = require('fs');
const path = require('path');
const https = require('https');
const { cleanDotmobizTitle, normalizeDotmobizPost } = require('./dotmobizAdapter');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const DETAILS_DIR = path.join(DATA_DIR, 'details');
const COMPLETE_CATALOG_PATH = path.join(DATA_DIR, 'dotmobiz_complete_catalog.json');
const TMDB_API_KEY = process.env.TMDB_API_KEY || '';

let completeCatalogMap = null;

function getCompleteCatalogMap() {
  if (completeCatalogMap) return completeCatalogMap;
  completeCatalogMap = new Map();
  if (fs.existsSync(COMPLETE_CATALOG_PATH)) {
    try {
      const list = JSON.parse(fs.readFileSync(COMPLETE_CATALOG_PATH, 'utf8'));
      for (const item of list) {
        completeCatalogMap.set(item.id, item);
        completeCatalogMap.set(item.record_id, item);
        completeCatalogMap.set(item.slug, item);
      }
    } catch(e) {}
  }
  return completeCatalogMap;
}

function fetchUrl(url) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 8000
    }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', () => resolve(null));
  });
}

function findTmdbData(cleanTitle, imdbId, type = 'movie') {
  return new Promise((resolve) => {
    if (imdbId) {
      const url = `https://api.tmdb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
      return https.get(url, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(d);
            const item = (json.movie_results && json.movie_results[0]) || (json.tv_results && json.tv_results[0]);
            if (item) return resolve(item);
            searchByTitle(cleanTitle, type, resolve);
          } catch(e) { searchByTitle(cleanTitle, type, resolve); }
        });
      }).on('error', () => searchByTitle(cleanTitle, type, resolve));
    }
    searchByTitle(cleanTitle, type, resolve);
  });
}

function searchByTitle(cleanTitle, type, resolve) {
  const endpoint = type === 'series' ? 'tv' : 'movie';
  const url = `https://api.tmdb.org/3/search/${endpoint}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}`;
  https.get(url, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      try {
        const json = JSON.parse(d);
        resolve(json.results && json.results[0] ? json.results[0] : null);
      } catch(e) { resolve(null); }
    });
  }).on('error', () => resolve(null));
}

function parseDownloads(postHtml) {
  const downloads = [];
  const divMatch = postHtml.match(/<div class="download-links-div">([\s\S]*?)<\/div>\s*<hr>/i) ||
                   postHtml.match(/<div class="download-links-div">([\s\S]*?)<\/div>/i);
  if (!divMatch) return downloads;
  const content = divMatch[1];

  const blockRegex = /<h3[^>]*>(?:<span[^>]*>)?([^<]+?)(?:<\/span>)?<\/h3>[\s\S]*?<a class="btn"[^>]*href="([^"]+)"[\s\S]*?<button class="dwd-button">([\s\S]*?)<\/button>/gi;
  let m;
  while ((m = blockRegex.exec(content)) !== null) {
    const quality = m[1].replace(/<[^>]+>/g, '').trim();
    const url = m[2].trim();
    const rawBtn = m[3].replace(/<[^>]+>/g, '').trim();
    const sizeMatch = rawBtn.match(/\[(.*?)\]/);
    downloads.push({
      quality,
      url,
      size: sizeMatch ? sizeMatch[1] : '',
      label: rawBtn || `Download [${quality}]`
    });
  }
  return downloads;
}

async function resolveDotmobizOnDemand(id) {
  const map = getCompleteCatalogMap();
  const summaryEntry = map.get(id) || map.get(id.replace('dotmobiz-', ''));
  if (!summaryEntry) return null;

  console.log(`⚡ Resolving on-demand Dotmobiz title: ${summaryEntry.title} (${summaryEntry.url})...`);
  const postHtml = await fetchUrl(summaryEntry.url);
  if (!postHtml) return null;

  // Extract IMDb ID
  const playerMatch = postHtml.match(/IndStreamPlayerConfigs\s*=\s*({[\s\S]*?});/);
  let imdbId = null;
  if (playerMatch) {
    const srcMatch = playerMatch[1].match(/src:\s*'([^']+)'/);
    if (srcMatch) imdbId = srcMatch[1];
  }

  // Rating
  const ratingMatch = postHtml.match(/IMDb Rating:<\/strong>-?\s*([\d\.]+)/i);
  const votesMatch = postHtml.match(/IMDb Rating:<\/strong>-?\s*[\d\.]+\s*\/(\d+)/i);

  // Cast & Director
  const castMatch = postHtml.match(/<strong>Cast:<\/strong>([^<]+)/i);
  const dirMatch = postHtml.match(/<strong>Director:<\/strong>([^<]+)/i);
  const runtimeMatch = postHtml.match(/<strong>Runtime\s*:<\/strong>([^<]+)/i);
  const langMatch = postHtml.match(/<strong>(?:Original language|Language):<\/strong>\s*(?:<span[^>]*>)?([^<]+)/i);
  const synMatch = postHtml.match(/Movie-SYNOPSIS\/PLOT:<\/span><\/h3>\s*<p>([^<]+)<\/p>/i);
  const ogImgMatch = postHtml.match(/<meta property="og:image" content="([^"]+)"/i);
  const dotmobizCover = ogImgMatch ? ogImgMatch[1] : '';

  // Screenshots
  const ssMatches = [];
  const ssRegex = /<img\s+(?:decoding="async"\s+)?src="([^"]*screenshot-[^"]+)"/gi;
  let ssm;
  while ((ssm = ssRegex.exec(postHtml)) !== null) {
    ssMatches.push(ssm[1]);
  }

  const downloads = parseDownloads(postHtml);

  // Clean title
  const pureTitle = cleanDotmobizTitle(summaryEntry.title || summaryEntry.rawTitle);

  // Enrich with high-res TMDB artwork
  const tmdb = await findTmdbData(pureTitle, imdbId, summaryEntry.type);

  let poster = (summaryEntry.poster && !summaryEntry.poster.includes('placehold.co')) ? summaryEntry.poster : dotmobizCover;
  let backdrop = (summaryEntry.backdrop && !summaryEntry.backdrop.includes('placehold.co')) ? summaryEntry.backdrop : poster;
  let rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;
  let votes = votesMatch ? votesMatch[1] : null;
  let overview = synMatch ? synMatch[1].trim() : '';

  if (tmdb) {
    if (tmdb.poster_path) poster = `https://image.tmdb.org/t/p/w500${tmdb.poster_path}`;
    if (tmdb.backdrop_path) backdrop = `https://image.tmdb.org/t/p/original${tmdb.backdrop_path}`;
    if (tmdb.vote_average) rating = parseFloat(tmdb.vote_average.toFixed(1));
    if (tmdb.vote_count) votes = tmdb.vote_count > 1000 ? `${(tmdb.vote_count / 1000).toFixed(1)}K` : `${tmdb.vote_count}`;
    if (tmdb.overview && (!overview || overview.length < 50)) overview = tmdb.overview;
  }

  const normalized = normalizeDotmobizPost({
    postId: summaryEntry.record_id,
    url: summaryEntry.url,
    title: summaryEntry.rawTitle,
    poster,
    backdrop,
    image: poster,
    date: '2026',
    isSeries: summaryEntry.type === 'series',
    type: summaryEntry.type,
    imdbId,
    rating,
    votes,
    cast: castMatch ? castMatch[1].trim().split(',').map(c => c.trim()).filter(Boolean) : [],
    director: dirMatch ? dirMatch[1].trim() : 'Director',
    runtime: runtimeMatch ? runtimeMatch[1].trim() : (summaryEntry.type === 'series' ? '~45m/ep' : '2h 10m'),
    language: langMatch ? langMatch[1].trim() : 'Hindi / Dual Audio',
    overview,
    screenshots: ssMatches,
    downloads
  });

  // Cache to disk
  if (normalized) {
    try {
      const safeId = normalized.id.replace(/[/\\?%*:|"<>]/g, '_');
      fs.writeFileSync(path.join(DETAILS_DIR, `${safeId}.json`), JSON.stringify(normalized, null, 2));
      if (normalized.record_id) {
        fs.writeFileSync(path.join(DETAILS_DIR, `${normalized.record_id}.json`), JSON.stringify(normalized, null, 2));
      }
      console.log(`✅ Cached on-demand title to data/details/${safeId}.json`);
    } catch(e) {}
  }

  return normalized;
}

module.exports = {
  resolveDotmobizOnDemand
};
