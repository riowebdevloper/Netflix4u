/**
 * Netflix4U Universal Image Proxy & CDN Accelerator
 * Bypasses ISP DNS blocks on image.tmdb.org and serves cached images.
 */
const https = require('https');

module.exports = async (req, res) => {
  const imageUrl = req.query.url || req.query.src;
  if (!imageUrl) {
    res.statusCode = 400;
    return res.end('Image URL required');
  }

  let parsed;
  try {
    parsed = new URL(imageUrl);
  } catch (e) {
    res.statusCode = 400;
    return res.end('Invalid URL');
  }

  // Allow tmdb and storage domains
  const allowed = ['image.tmdb.org', 'media.themoviedb.org', 'storage.hicine.sbs', 'img.hicine.sbs'];
  if (!allowed.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))) {
    res.statusCode = 403;
    return res.end('Domain not allowed');
  }

  // Set long-term cache headers for CDN
  res.setHeader('Cache-Control', 'public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=86400');
  res.setHeader('Access-Control-Allow-Origin', '*');

  https.get(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, timeout: 6000 }, remoteRes => {
    if (remoteRes.statusCode !== 200) {
      res.statusCode = remoteRes.statusCode;
      return res.end('Upstream image error');
    }
    res.setHeader('Content-Type', remoteRes.headers['content-type'] || 'image/jpeg');
    if (remoteRes.headers['content-length']) {
      res.setHeader('Content-Length', remoteRes.headers['content-length']);
    }
    remoteRes.pipe(res);
  }).on('error', err => {
    // If direct fetch fails, redirect to wsrv.nl as fallback
    res.writeHead(302, { Location: `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}&output=webp` });
    res.end();
  });
};
