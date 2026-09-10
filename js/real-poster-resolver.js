/**
 * Netflix4U Real Poster & Backdrop Resolver & Publish Gate
 * Securely fetches high-res artwork via server proxy /api/poster-resolver
 * Zero client-side API key exposure.
 * Enforces domain allowlist and prevents placeholder/fake poster rendering.
 */

(function() {
  'use strict';

  const memoryCache = new Map();
  const pendingRequests = new Map();

  const ALLOWED_HOSTS = [
    'image.tmdb.org',
    'media.themoviedb.org',
    'storage.hicine.sbs',
    'img.hicine.sbs',
    'm.media-amazon.com',
    'images-na.ssl-images-amazon.com',
    'i.imgur.com'
  ];

  function isAllowedPoster(url) {
    if (!url || typeof url !== 'string') return false;
    const lower = url.trim().toLowerCase();
    if (
      lower.includes('no-poster') ||
      lower.includes('placeholder') ||
      lower.includes('data:image') ||
      lower.includes('unavailable') ||
      lower.includes('dummy') ||
      lower === ''
    ) {
      return false;
    }
    if (lower.startsWith('/uploads/') || lower.startsWith('/images/covers/')) {
      return true;
    }
    try {
      const parsed = new URL(url, window.location.origin);
      return ALLOWED_HOSTS.some(host => parsed.hostname === host || parsed.hostname.endsWith('.' + host));
    } catch(e) {
      return false;
    }
  }

  window.isAllowedPoster = isAllowedPoster;

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
      if (res.ok && (!res.headers.get("content-type") || res.headers.get("content-type").indexOf("json") !== -1)) {
        const data = await res.json();
        if (data && (data.poster || data.backdrop)) {
          const poster = isAllowedPoster(data.poster) ? data.poster : null;
          const backdrop = isAllowedPoster(data.backdrop) ? data.backdrop : (poster || null);
          if (poster || backdrop) {
            return { poster, backdrop };
          }
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
        if (isAllowedPoster(parsed.poster)) {
          memoryCache.set(key, parsed);
          callback(parsed.poster, parsed.backdrop);
          return;
        }
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

  // Detect content type from card elements, links, and badges
  function detectCardType(card) {
    if (!card) return 'movie';
    const dataType = card.getAttribute('data-type');
    if (dataType) return dataType;

    const link = card.querySelector('a[href]');
    if (link) {
      const href = link.getAttribute('href') || '';
      if (href.includes('/series/')) return 'series';
      if (href.includes('/tv/')) return 'series';
      if (href.includes('/anime/')) return 'anime';
      if (href.includes('/kdrama/')) return 'kdrama';
      if (href.includes('/movie/')) return 'movie';
    }

    const text = card.textContent || '';
    if (/\b(?:K-Drama|Kdrama)\b/i.test(text)) return 'kdrama';
    if (/\b(?:Anime)\b/i.test(text)) return 'anime';
    if (/\b(?:Series|Web Series|Season\s*\d+|S\d{1,2})\b/i.test(text)) return 'series';

    return 'movie';
  }

  // --- Poster Artwork Enhancer ---
  // Resolves high-resolution posters without ever hiding cards or breaking grid layout
  function runPublishGate() {
    try {
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        const src = img.getAttribute('src') || '';
        if (!src || src.includes('no-poster') || src.includes('placeholder') || src.includes('undefined') || src.includes('null')) {
          const card = img.closest('.group, [data-card], .relative.rounded-xl, .aspect-\\[2\\/3\\]') || img.parentElement;
          if (card) {
            const titleEl = card.querySelector('h3, h4, p.font-bold, .card-title') || card.querySelector('a[title]') || card.querySelector('p');
            const title = titleEl ? (titleEl.getAttribute('title') || titleEl.textContent || '').trim() : (img.getAttribute('alt') || '').trim();
            if (title && !img.dataset.resolving) {
              img.dataset.resolving = '1';
              const type = detectCardType(card);
              window.resolveRealPoster(title, '', type, (realPoster) => {
                if (realPoster) {
                  img.src = realPoster;
                  img.style.objectFit = 'cover';
                }
                delete img.dataset.resolving;
              });
            }
          }
        }
      });
    } catch(e) {}
  }

  // Handle runtime image loading failures
  if (typeof window !== 'undefined') {
    window.addEventListener('error', function(e) {
      if (e && e.target && e.target.tagName === 'IMG') {
        const img = e.target;
        if (img.dataset.failedResolved) return;
        img.dataset.failedResolved = '1';
        const card = img.closest('.group, [data-card], .relative.rounded-xl, .aspect-\\[2\\/3\\]') || img.parentElement;
        const titleEl = card ? (card.querySelector('h3, h4, p.font-bold, .card-title') || card.querySelector('p')) : null;
        const title = titleEl ? (titleEl.textContent || '').trim() : (img.getAttribute('alt') || '').trim();
        if (title) {
          const type = detectCardType(card);
          window.resolveRealPoster(title, '', type, function(realPoster) {
            if (realPoster) {
              img.src = realPoster;
              img.style.objectFit = 'cover';
            }
          });
        }
      }
    }, true);
  }

  // Continuous monitoring via MutationObserver and throttled scanning
  if (typeof document !== 'undefined') {
    let gateTimer = null;
    function debouncedGate() {
      if (gateTimer) clearTimeout(gateTimer);
      gateTimer = setTimeout(runPublishGate, 250);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(runPublishGate, 300);
        setTimeout(runPublishGate, 1500);
      });
    } else {
      setTimeout(runPublishGate, 300);
      setTimeout(runPublishGate, 1500);
    }

    // Set up MutationObserver to catch dynamically rendered catalog items
    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver((mutations) => {
        for (let i = 0; i < mutations.length; i++) {
          if (mutations[i].addedNodes.length > 0) {
            debouncedGate();
            break;
          }
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    // Fallback periodic scan for smooth infinite-scroll experiences
    setInterval(runPublishGate, 3000);
  }
})();
