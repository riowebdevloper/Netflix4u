/**
 * Comprehensive Streaming Provider Live Audit
 * Tests every configured streaming provider in Netflix4U
 */
const https = require('https');
const http = require('http');
const { allAdapters, getProvider } = require('../src/player/providers/registry');
const playerResolver = require('../js/player-resolver');

const MOVIE_TMDB = 533535; // Deadpool & Wolverine
const MOVIE_IMDB = 'tt6263850';
const TV_TMDB = 1399; // Game of Thrones
const TV_IMDB = 'tt0944947';
const TV_S = 1;
const TV_E = 1;

async function fetchUrlHeadersAndSample(url, timeoutMs = 7000) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const isHttps = parsed.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const req = client.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Referer': 'https://netflix4u.in/',
          'Origin': 'https://netflix4u.in'
        },
        timeout: timeoutMs
      }, (res) => {
        let data = '';
        res.on('data', chunk => {
          if (data.length < 2048) {
            data += chunk.toString();
          }
        });
        res.on('end', () => {
          const xFrame = res.headers['x-frame-options'] || '';
          const csp = res.headers['content-security-policy'] || '';
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            xFrame,
            csp,
            bodySample: data.substring(0, 500)
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ statusCode: 0, error: 'TIMEOUT' });
      });

      req.on('error', (err) => {
        resolve({ statusCode: 0, error: err.message });
      });
    } catch (e) {
      resolve({ statusCode: 0, error: e.message });
    }
  });
}

async function runAudit() {
  console.log('=== STARTING NETFLIX4U STREAMING PROVIDER AUDIT ===\n');

  const movieInput = {
    canonicalId: `tmdb-${MOVIE_TMDB}`,
    contentType: 'movie',
    tmdbId: MOVIE_TMDB,
    imdbId: MOVIE_IMDB
  };

  const tvInput = {
    canonicalId: `tmdb-${TV_TMDB}`,
    contentType: 'tv',
    tmdbId: TV_TMDB,
    imdbId: TV_IMDB,
    season: TV_S,
    episode: TV_E
  };

  const results = [];

  for (const adapter of allAdapters) {
    const movieUrl = adapter.buildMovieUrl ? adapter.buildMovieUrl(movieInput) : null;
    const tvUrl = adapter.buildTvUrl ? adapter.buildTvUrl(tvInput) : null;

    let movieAudit = null;
    let tvAudit = null;

    if (movieUrl && movieUrl.startsWith('http')) {
      movieAudit = await fetchUrlHeadersAndSample(movieUrl);
    }
    if (tvUrl && tvUrl.startsWith('http')) {
      tvAudit = await fetchUrlHeadersAndSample(tvUrl);
    }

    let status = 'UNVERIFIED';
    let actualResult = '';

    const checkRes = movieAudit || tvAudit;

    if (!checkRes) {
      status = 'BAD_URL';
      actualResult = 'No URL generated';
    } else if (checkRes.error === 'TIMEOUT') {
      status = 'UNAVAILABLE';
      actualResult = 'Request timeout (host down/blocked)';
    } else if (checkRes.error) {
      status = 'UNAVAILABLE';
      actualResult = `Connection error: ${checkRes.error}`;
    } else if (checkRes.statusCode === 404) {
      status = 'UNAVAILABLE';
      actualResult = 'HTTP 404 (File Not Found / endpoint removed)';
    } else if (checkRes.statusCode === 403) {
      status = 'BLOCKED';
      actualResult = 'HTTP 403 (Cloudflare challenge / forbidden)';
    } else if (checkRes.xFrame && (checkRes.xFrame.includes('DENY') || checkRes.xFrame.includes('SAMEORIGIN'))) {
      status = 'BLOCKED';
      actualResult = `X-Frame-Options: ${checkRes.xFrame}`;
    } else if (checkRes.statusCode === 200 || checkRes.statusCode === 301 || checkRes.statusCode === 302) {
      // Check content for "File not found" or "not available"
      const sample = (checkRes.bodySample || '').toLowerCase();
      if (sample.includes('file not found') || sample.includes('video not found') || sample.includes('media not found') || sample.includes('no video') || sample.includes('deleted')) {
        status = 'UNAVAILABLE';
        actualResult = 'Page returned 200 but body contains "File Not Found"';
      } else {
        status = 'WORKING';
        actualResult = `HTTP ${checkRes.statusCode} with embed player`;
      }
    } else {
      status = 'UNAVAILABLE';
      actualResult = `HTTP ${checkRes.statusCode}`;
    }

    results.push({
      id: adapter.id,
      name: adapter.name,
      enabled: adapter.enabled,
      baseUrl: adapter.baseUrl,
      movieUrl,
      tvUrl,
      idType: adapter.requiredIdentifier || 'tmdb',
      movieAudit,
      tvAudit,
      actualResult,
      status
    });

    console.log(`[${status}] ${adapter.name} (${adapter.id}) -> ${actualResult}`);
  }

  console.log('\n=== AUDIT COMPLETE ===');
  console.log(JSON.stringify(results.map(r => ({
    name: r.name,
    id: r.id,
    enabled: r.enabled,
    baseUrl: r.baseUrl,
    idType: r.idType,
    movieUrl: r.movieUrl,
    tvUrl: r.tvUrl,
    status: r.status,
    actualResult: r.actualResult
  })), null, 2));
}

runAudit();
