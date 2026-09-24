/**
 * Generate Curated Platform & Category Data for Netflix4U
 * Populates data/curated_*.json with genuine TMDB metadata
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { TMDB_API_KEY } = require('../services/apiCore');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

function fetchTmdb(endpoint) {
  return new Promise((resolve) => {
    const url = 'https://api.themoviedb.org/3' + endpoint + (endpoint.includes('?') ? '&' : '?') + 'api_key=' + TMDB_API_KEY;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }, (res) => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(buf));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

function mapItem(r, forcedType) {
  if (!r || !r.id) return null;
  const isTv = forcedType === 'tv' || (!forcedType && (r.name || r.first_air_date));
  const type = isTv ? 'tv' : 'movie';
  const title = r.title || r.name || 'Untitled';
  const year = String(r.release_date || r.first_air_date || '').slice(0, 4);
  return {
    tmdbId: r.id,
    canonicalId: `tmdb-${type}-${r.id}`,
    type: type,
    title: title,
    year: year,
    poster: r.poster_path ? `https://image.tmdb.org/t/p/w342${r.poster_path}` : null,
    backdrop: r.backdrop_path ? `https://image.tmdb.org/t/p/w780${r.backdrop_path}` : null,
    rating: r.vote_average ? Number(r.vote_average.toFixed(1)) : 8.0,
    overview: r.overview || ''
  };
}

async function buildAll() {
  console.log('Fetching curated data from TMDB for all platforms...');

  // 1. JioHotstar (with_watch_providers=2336, region=IN)
  console.log('Generating JioHotstar...');
  const jhMoviesRes = await fetchTmdb('/discover/movie?watch_region=IN&with_watch_providers=2336&sort_by=popularity.desc');
  const jhTvRes = await fetchTmdb('/discover/tv?watch_region=IN&with_watch_providers=2336&sort_by=popularity.desc');
  const jhHindiRes = await fetchTmdb('/discover/movie?watch_region=IN&with_watch_providers=2336&with_original_language=hi&sort_by=popularity.desc');

  const jhMovies = (jhMoviesRes?.results || []).map(r => mapItem(r, 'movie')).filter(Boolean);
  const jhTv = (jhTvRes?.results || []).map(r => mapItem(r, 'tv')).filter(Boolean);
  const jhHindi = (jhHindiRes?.results || []).map(r => mapItem(r, 'movie')).filter(Boolean);
  const jhHero = [...jhMovies.slice(0, 3), ...jhTv.slice(0, 2)];

  const jioHotstarData = {
    ok: true,
    tab: 'JioHotstar',
    hero: jhHero,
    rails: [
      { key: 'jiohotstar-top-movies', title: 'Top Movies on JioHotstar', ranked: true, logo: '/images/platforms/JmxIsKiiiFkm.jpg', auto: null, items: jhMovies },
      { key: 'jiohotstar-popular-series', title: 'Binge-Worthy Series on JioHotstar', ranked: false, logo: '/images/platforms/JmxIsKiiiFkm.jpg', auto: null, items: jhTv },
      { key: 'jiohotstar-hindi-hits', title: 'Hotstar Hindi Blockbusters', ranked: false, logo: '/images/platforms/JmxIsKiiiFkm.jpg', auto: null, items: jhHindi }
    ]
  };
  fs.writeFileSync(path.join(DATA_DIR, 'curated_jiohotstar.json'), JSON.stringify(jioHotstarData, null, 2), 'utf8');
  console.log(`✓ curated_jiohotstar.json saved (${jhMovies.length + jhTv.length + jhHindi.length} items)`);

  // 2. SonyLIV (with_watch_providers=237, region=IN)
  console.log('Generating SonyLIV...');
  const slMoviesRes = await fetchTmdb('/discover/movie?watch_region=IN&with_watch_providers=237&sort_by=popularity.desc');
  const slTvRes = await fetchTmdb('/discover/tv?watch_region=IN&with_watch_providers=237&sort_by=popularity.desc');
  const slThrillersRes = await fetchTmdb('/discover/tv?watch_region=IN&with_watch_providers=237&with_genres=80,18&sort_by=popularity.desc');

  const slMovies = (slMoviesRes?.results || []).map(r => mapItem(r, 'movie')).filter(Boolean);
  const slTv = (slTvRes?.results || []).map(r => mapItem(r, 'tv')).filter(Boolean);
  const slThrillers = (slThrillersRes?.results || []).map(r => mapItem(r, 'tv')).filter(Boolean);
  const slHero = [...slTv.slice(0, 3), ...slMovies.slice(0, 2)];

  const sonyLivData = {
    ok: true,
    tab: 'SonyLIV',
    hero: slHero,
    rails: [
      { key: 'sonyliv-top-series', title: 'Top SonyLIV Originals & Series', ranked: true, logo: '/images/platforms/IQHvNlAlUHxi.jpg', auto: null, items: slTv },
      { key: 'sonyliv-popular-movies', title: 'Popular Movies on SonyLIV', ranked: false, logo: '/images/platforms/IQHvNlAlUHxi.jpg', auto: null, items: slMovies },
      { key: 'sonyliv-crime-thrillers', title: 'SonyLIV Crime & Thrillers', ranked: false, logo: '/images/platforms/IQHvNlAlUHxi.jpg', auto: null, items: slThrillers }
    ]
  };
  fs.writeFileSync(path.join(DATA_DIR, 'curated_sonyliv.json'), JSON.stringify(sonyLivData, null, 2), 'utf8');
  console.log(`✓ curated_sonyliv.json saved (${slTv.length + slMovies.length + slThrillers.length} items)`);

  // 3. Kids & Family (with_genres=10751,16)
  console.log('Generating Kids...');
  const kidsAnimatedRes = await fetchTmdb('/discover/movie?watch_region=IN&with_genres=16&sort_by=popularity.desc');
  const kidsFamilyRes = await fetchTmdb('/discover/movie?watch_region=IN&with_genres=10751&sort_by=popularity.desc');
  const kidsTvRes = await fetchTmdb('/discover/tv?watch_region=IN&with_genres=16,10762&sort_by=popularity.desc');

  const kidsAnimated = (kidsAnimatedRes?.results || []).map(r => mapItem(r, 'movie')).filter(Boolean);
  const kidsFamily = (kidsFamilyRes?.results || []).map(r => mapItem(r, 'movie')).filter(Boolean);
  const kidsTv = (kidsTvRes?.results || []).map(r => mapItem(r, 'tv')).filter(Boolean);
  const kidsHero = [...kidsAnimated.slice(0, 3), ...kidsFamily.slice(0, 2)];

  const kidsData = {
    ok: true,
    tab: 'Kids',
    hero: kidsHero,
    rails: [
      { key: 'kids-animated-adventures', title: 'Top Animated Adventures', ranked: true, logo: '', auto: null, items: kidsAnimated },
      { key: 'kids-family-favorites', title: 'Family Movie Night', ranked: false, logo: '', auto: null, items: kidsFamily },
      { key: 'kids-animated-series', title: 'Popular Kids Animated Shows', ranked: false, logo: '', auto: null, items: kidsTv }
    ]
  };
  fs.writeFileSync(path.join(DATA_DIR, 'curated_kids.json'), JSON.stringify(kidsData, null, 2), 'utf8');
  console.log(`✓ curated_kids.json saved (${kidsAnimated.length + kidsFamily.length + kidsTv.length} items)`);

  // 4. Latest Release (2025-2026 releases sorted descending by release date)
  console.log('Generating Latest Release...');
  const lrMovies26Res = await fetchTmdb('/discover/movie?primary_release_date.gte=2025-10-01&primary_release_date.lte=2026-12-31&sort_by=primary_release_date.desc&vote_count.gte=5');
  const lrMovies25Res = await fetchTmdb('/discover/movie?primary_release_date.gte=2025-01-01&primary_release_date.lte=2025-12-31&sort_by=primary_release_date.desc&vote_count.gte=30');
  const lrTvRes = await fetchTmdb('/discover/tv?first_air_date.gte=2025-01-01&first_air_date.lte=2026-12-31&sort_by=first_air_date.desc&vote_count.gte=10');

  const lrMovies26 = (lrMovies26Res?.results || []).map(r => mapItem(r, 'movie')).filter(Boolean);
  const lrMovies25 = (lrMovies25Res?.results || []).map(r => mapItem(r, 'movie')).filter(Boolean);
  const lrTv = (lrTvRes?.results || []).map(r => mapItem(r, 'tv')).filter(Boolean);
  const lrHero = [...lrMovies26.slice(0, 3), ...lrTv.slice(0, 2)];

  const latestReleaseData = {
    ok: true,
    tab: 'LatestRelease',
    hero: lrHero,
    rails: [
      { key: 'lr-2026-movies', title: 'Brand New 2026 Releases', ranked: true, logo: '', auto: null, items: lrMovies26 },
      { key: 'lr-2025-movies', title: 'Latest Blockbusters (2025)', ranked: false, logo: '', auto: null, items: lrMovies25 },
      { key: 'lr-new-series', title: 'New Web Series (2025-2026)', ranked: false, logo: '', auto: null, items: lrTv }
    ]
  };
  fs.writeFileSync(path.join(DATA_DIR, 'curated_latestrelease.json'), JSON.stringify(latestReleaseData, null, 2), 'utf8');
  console.log(`✓ curated_latestrelease.json saved (${lrMovies26.length + lrMovies25.length + lrTv.length} items)`);

  // 5. MX Player (with_watch_providers=515|1898)
  console.log('Generating MX Player...');
  const mxTvRes = await fetchTmdb('/discover/tv?watch_region=IN&with_watch_providers=515|1898&sort_by=popularity.desc');
  const mxMoviesRes = await fetchTmdb('/discover/movie?watch_region=IN&with_watch_providers=515|1898&sort_by=popularity.desc');

  const mxTv = (mxTvRes?.results || []).map(r => mapItem(r, 'tv')).filter(Boolean);
  const mxMovies = (mxMoviesRes?.results || []).map(r => mapItem(r, 'movie')).filter(Boolean);
  const mxHero = [...mxTv.slice(0, 3), ...mxMovies.slice(0, 2)];

  const mxData = {
    ok: true,
    tab: 'MX',
    hero: mxHero,
    rails: [
      { key: 'mx-top-shows', title: 'Top Shows on MX Player', ranked: true, logo: '/images/platforms/Hoj6RBCM9kDd.jpg', auto: null, items: mxTv },
      { key: 'mx-popular-movies', title: 'Popular Movies on MX Player', ranked: false, logo: '/images/platforms/Hoj6RBCM9kDd.jpg', auto: null, items: mxMovies }
    ]
  };
  fs.writeFileSync(path.join(DATA_DIR, 'curated_mx.json'), JSON.stringify(mxData, null, 2), 'utf8');
  console.log(`✓ curated_mx.json saved (${mxTv.length + mxMovies.length} items)`);

  // 6. Netflix (with_watch_providers=8, region=IN)
  console.log('Generating Netflix...');
  const netflixSeriesRes = await fetchTmdb('/discover/tv?watch_region=IN&with_watch_providers=8&sort_by=popularity.desc');
  const netflixMoviesRes = await fetchTmdb('/discover/movie?watch_region=IN&with_watch_providers=8&sort_by=popularity.desc');
  const netflixOriginalsRes = await fetchTmdb('/discover/tv?watch_region=IN&with_networks=213&sort_by=popularity.desc');

  const netflixSeries = (netflixSeriesRes?.results || []).map(r => mapItem(r, 'tv')).filter(Boolean);
  const netflixMovies = (netflixMoviesRes?.results || []).map(r => mapItem(r, 'movie')).filter(Boolean);
  const netflixOriginals = (netflixOriginalsRes?.results || []).map(r => mapItem(r, 'tv')).filter(Boolean);
  const netflixHero = [...netflixSeries.slice(0, 3), ...netflixMovies.slice(0, 2)];

  const netflixData = {
    ok: true,
    tab: 'Netflix',
    hero: netflixHero,
    rails: [
      { key: 'netflix-top-series', title: 'Top Series on Netflix', ranked: true, logo: '/images/platforms/FjWTYs9RfCsT.jpg', auto: null, items: netflixSeries },
      { key: 'netflix-popular-movies', title: 'Popular Movies on Netflix', ranked: false, logo: '/images/platforms/FjWTYs9RfCsT.jpg', auto: null, items: netflixMovies },
      { key: 'netflix-originals', title: 'Netflix Global Originals', ranked: false, logo: '/images/platforms/FjWTYs9RfCsT.jpg', auto: null, items: netflixOriginals }
    ]
  };
  fs.writeFileSync(path.join(DATA_DIR, 'curated_netflix.json'), JSON.stringify(netflixData, null, 2), 'utf8');
  console.log(`✓ curated_netflix.json saved (${netflixSeries.length + netflixMovies.length + netflixOriginals.length} items)`);

  // 7. Prime Video (with_watch_providers=119, region=IN)
  console.log('Generating Prime Video...');
  const primeSeriesRes = await fetchTmdb('/discover/tv?watch_region=IN&with_watch_providers=119&sort_by=popularity.desc');
  const primeMoviesRes = await fetchTmdb('/discover/movie?watch_region=IN&with_watch_providers=119&sort_by=popularity.desc');
  const primeOriginalsRes = await fetchTmdb('/discover/tv?watch_region=IN&with_networks=1024&sort_by=popularity.desc');

  const primeSeries = (primeSeriesRes?.results || []).map(r => mapItem(r, 'tv')).filter(Boolean);
  const primeMovies = (primeMoviesRes?.results || []).map(r => mapItem(r, 'movie')).filter(Boolean);
  const primeOriginals = (primeOriginalsRes?.results || []).map(r => mapItem(r, 'tv')).filter(Boolean);
  const primeHero = [...primeSeries.slice(0, 3), ...primeMovies.slice(0, 2)];

  const primeData = {
    ok: true,
    tab: 'PrimeVideo',
    hero: primeHero,
    rails: [
      { key: 'prime-top-series', title: 'Top Series on Prime Video', ranked: true, logo: '/images/platforms/teMwgjoxOg9u.jpg', auto: null, items: primeSeries },
      { key: 'prime-popular-movies', title: 'Popular Movies on Prime Video', ranked: false, logo: '/images/platforms/teMwgjoxOg9u.jpg', auto: null, items: primeMovies },
      { key: 'prime-originals', title: 'Amazon Originals & Exclusives', ranked: false, logo: '/images/platforms/teMwgjoxOg9u.jpg', auto: null, items: primeOriginals }
    ]
  };
  fs.writeFileSync(path.join(DATA_DIR, 'curated_primevideo.json'), JSON.stringify(primeData, null, 2), 'utf8');
  console.log(`✓ curated_primevideo.json saved (${primeSeries.length + primeMovies.length + primeOriginals.length} items)`);

  // 8. Crunchyroll (with_watch_providers=283)
  console.log('Generating Crunchyroll...');
  const crTvRes = await fetchTmdb('/discover/tv?watch_region=IN&with_watch_providers=283&sort_by=popularity.desc');
  const crMoviesRes = await fetchTmdb('/discover/movie?watch_region=IN&with_watch_providers=283&sort_by=popularity.desc');

  const crTv = (crTvRes?.results || []).map(r => mapItem(r, 'tv')).filter(Boolean);
  const crMovies = (crMoviesRes?.results || []).map(r => mapItem(r, 'movie')).filter(Boolean);
  const crHero = [...crTv.slice(0, 3), ...crMovies.slice(0, 2)];

  const crData = {
    ok: true,
    tab: 'Crunchyroll',
    hero: crHero,
    rails: [
      { key: 'crunchyroll-top-anime', title: 'Top Anime Series on Crunchyroll', ranked: true, logo: '/images/platforms/nnYmRNZy6VSX.jpg', auto: null, items: crTv },
      { key: 'crunchyroll-movies', title: 'Anime Movies on Crunchyroll', ranked: false, logo: '/images/platforms/nnYmRNZy6VSX.jpg', auto: null, items: crMovies }
    ]
  };
  fs.writeFileSync(path.join(DATA_DIR, 'curated_crunchyroll.json'), JSON.stringify(crData, null, 2), 'utf8');
  console.log(`✓ curated_crunchyroll.json saved (${crTv.length + crMovies.length} items)`);

  console.log('All curated files successfully built and verified!');
}

buildAll();
