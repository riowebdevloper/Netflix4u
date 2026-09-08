/**
 * Netflix4U Real Poster & Backdrop Resolver
 * Securely fetches high-res artwork via server proxy /api/poster-resolver
 * Zero client-side API key exposure.
 */

(function() {
  'use strict';

  const memoryCache = new Map();
  const pendingRequests = new Map();

  function cleanTitle(raw) {
    if (!raw) return '';
    let t = raw.replace(/&#039;/g, "'").replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    t = t.replace(/\bAmp\b/gi, 'and');
    t = t.replace(/(\d{4})([a-zA-Z]+)/g, '$1 $2').replace(/([a-zA-Z]+)(\d{4})/g, '$1 $2');
    t = t.replace(/\[[^\]]*\]/gi, ' ').replace(/\([^\)]*\)/gi, ' ').replace(/\{[^\}]*\}/gi, ' ');
    t = t.replace(/\b(?:Aka|A\.k\.a)\b.*$/gi, '');
    t = t.replace(/\b(?:Season\s*\d+|S\d{1,2}|Ep(?:isode)?\s*\d+|All\s*Episodes?|Complete\s*Season).*$/gi, '');
    t = t.replace(/\b(19\d{2}|20\d{2})\b\s*(?:[A-Za-z]+)?\s*(?:Audio|Dubbed|Web|Rip|720p|1080p|480p|576p|2160p|Season|Ep|Bengali|Hoichoi|Hulu|Netflix|Prime|Hotstar|Zee5|SonyLiv|Aha|All|$).*$/gi, '');
    t = t.replace(/\b(19\d{2}|20\d{2})\s*$/gi, '');
    t = t.replace(/\b(?:JioHotstar|Hotstar|Netflix|Prime(?:\s*Video)?|Zee5|SonyLiv|Disney\+?|Hulu|Hoichoi|Aha|Voot|MX\s*Player|Apple(?:\s*TV)?)\s*(?:Original)?\b/gi, '');
    t = t.replace(/\b(?:Hindi|English|Tamil|Telugu|Malayalam|Kannada|Bengali|Korean|Japanese|Chinese|Marathi|Punjabi|Multi|Dual|Line)\s*(?:-|–|—)?\s*(?:Audio|Dubbed)?\b/gi, '');
    t = t.replace(/\b(?:Audio|Dubbed|Subbed|Original Audio|Clean Audio|Line Audio)\b/gi, '');
    t = t.replace(/\b(?:\d{3,4}\s*p|2160p|1080p|720p|480p|576p|4K|FHD|HD|SD|HQ)\b/gi, '');
    t = t.replace(/\b(?:WEB[- ]?DL|WEB[- ]?Rip|HQ[- ]?HDTC|HDTC|HDRip|BluRay|BRRip|DVDRip|DVD|Pre[- ]?DVD|HEVC|x264|x265|CamRip|CAM|Rip|Line)\b/gi, '');
    t = t.replace(/[-–—:|/\\]+\s*$/g, '').replace(/^\s*[-–—:|/\\]+/g, '').replace(/\s{2,}/g, ' ').trim();
    return t || raw.trim();
  }

  async function fetchArtworkFromServer(title, imdbId, type) {
    const clean = cleanTitle(title);
    if (!clean && !imdbId) return null;

    try {
      const url = `/api/poster-resolver?title=${encodeURIComponent(clean)}&imdbId=${encodeURIComponent(imdbId || '')}&type=${encodeURIComponent(type || 'movie')}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && (data.poster || data.backdrop)) {
          return {
            poster: data.poster || null,
            backdrop: data.backdrop || data.poster || null
          };
        }
      }
    } catch(e) {}
    return null;
  }

  window.resolveRealPoster = function(title, imdbId, type, callback) {
    if (!callback || typeof callback !== 'function') return;
    if (!title && !imdbId) {
      callback(null, null);
      return;
    }

    const key = `${imdbId || ''}_${title || ''}_${type || 'movie'}`.toLowerCase();

    // 1. Memory cache hit
    if (memoryCache.has(key)) {
      const hit = memoryCache.get(key);
      callback(hit.poster, hit.backdrop);
      return;
    }

    // 2. Session cache hit
    try {
      const sess = sessionStorage.getItem('rp_' + key);
      if (sess) {
        const parsed = JSON.parse(sess);
        memoryCache.set(key, parsed);
        callback(parsed.poster, parsed.backdrop);
        return;
      }
    } catch(e) {}

    // 3. Deduplicate pending in-flight requests
    if (pendingRequests.has(key)) {
      pendingRequests.get(key).push(callback);
      return;
    }

    pendingRequests.set(key, [callback]);

    fetchArtworkFromServer(title, imdbId, type).then(result => {
      const poster = result ? result.poster : null;
      const backdrop = result ? result.backdrop : null;
      const storeObj = { poster, backdrop };

      memoryCache.set(key, storeObj);
      try {
        sessionStorage.setItem('rp_' + key, JSON.stringify(storeObj));
      } catch(e) {}

      const listeners = pendingRequests.get(key) || [];
      pendingRequests.delete(key);
      listeners.forEach(cb => {
        try { cb(poster, backdrop); } catch(e) {}
      });
    }).catch(() => {
      const listeners = pendingRequests.get(key) || [];
      pendingRequests.delete(key);
      listeners.forEach(cb => {
        try { cb(null, null); } catch(e) {}
      });
    });
  };
})();
