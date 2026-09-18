/**
 * Netflix4U — Centralized Player Resolver Module
 * Enforces 100% TMDB-ID Canonical Identity & Multi-Server Resolution
 * 
 * Rules:
 * 1. Zero Title-based playback resolution.
 * 2. Movie: CARD TMDB ID = DETAIL TMDB ID = PLAYER TMDB ID = X
 * 3. TV: SERIES TMDB ID = X, SEASON = Y, EPISODE = Z -> PLAYER SOURCE = X / Y / Z
 * 4. Strict Validation: Numeric TMDB ID > 0. For TV: Season >= 1, Episode >= 1.
 * 5. Primary Reference Player: vidsrc.sbs
 *    - Movie: https://vidsrc.sbs/embed/movie/{tmdb_id}
 *    - TV:    https://vidsrc.sbs/embed/tv/{tmdb_id}/{season}/{episode}
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Netflix4uPlayerResolver = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Strict allowlist for embed origins
  var ALLOWED_ORIGINS = [
    'https://vidsrc.sbs',
    'https://peachify.pro',
    'https://peachify.top',
    'https://vidlink.pro',
    'https://slast430did.com',
    'https://acceptable.a-ads.com',
    'https://www.youtube-nocookie.com',
    'https://www.youtube.com'
  ];

  /**
   * Sanitizes and extracts a pure numeric TMDB ID.
   * Strips prefixes like 'tmdb-movie-', 'tmdb-series-', 'tmdb-tv-', 'tmdb-'.
   * Rejects non-numeric strings, 0, or negative numbers.
   */
  function cleanTmdbId(raw) {
    if (raw === null || raw === undefined) return null;
    var str = String(raw).trim();
    str = str.replace(/^(?:tmdb-(?:movie|series|tv)-|tmdb-|dotmobiz-)/i, '');
    if (!/^\d{1,10}$/.test(str)) return null;
    var num = parseInt(str, 10);
    return (num > 0 && !isNaN(num)) ? num : null;
  }

  /**
   * Validates a playback request according to strict canonical rules.
   * @param {Object} req - { type: 'movie'|'tv'|'series', tmdbId: number|string, season?: number|string, episode?: number|string }
   * @returns {Object} - { valid: boolean, error?: string, sanitized?: Object }
   */
  function validatePlaybackRequest(req) {
    if (!req || typeof req !== 'object') {
      return { valid: false, error: 'Playback request payload is required.' };
    }

    var rawType = String(req.type || 'movie').toLowerCase();
    var isTv = (rawType === 'tv' || rawType === 'series' || rawType === 'anime' || rawType === 'kdrama');
    var canonicalType = isTv ? 'tv' : 'movie';

    var tmdbId = cleanTmdbId(req.tmdbId);
    if (!tmdbId) {
      return {
        valid: false,
        error: 'Invalid or missing numeric TMDB ID. Title-based resolution is disallowed.'
      };
    }

    if (canonicalType === 'movie') {
      return {
        valid: true,
        sanitized: {
          type: 'movie',
          tmdbId: tmdbId
        }
      };
    }

    // Series validation
    var season = parseInt(req.season, 10);
    var episode = parseInt(req.episode, 10);

    if (isNaN(season) || season < 1) {
      return {
        valid: false,
        error: 'Series playback requires a valid season number >= 1. Guessing is disallowed.'
      };
    }

    if (isNaN(episode) || episode < 1) {
      return {
        valid: false,
        error: 'Series playback requires a valid episode number >= 1. Guessing is disallowed.'
      };
    }

    return {
      valid: true,
      sanitized: {
        type: 'tv',
        tmdbId: tmdbId,
        season: season,
        episode: episode
      }
    };
  }

  /**
   * Generates a canonical cache key.
   */
  function getCanonicalCacheKey(req) {
    var validation = validatePlaybackRequest(req);
    if (!validation.valid || !validation.sanitized) {
      return null;
    }
    var s = validation.sanitized;
    if (s.type === 'movie') {
      return 'player:movie:tmdb:' + s.tmdbId;
    }
    return 'player:tv:tmdb:' + s.tmdbId + ':s' + s.season + ':e' + s.episode;
  }

  /**
   * Resolves exact player embed URL for a given provider.
   * @param {Object} req - Playback request
   * @param {string} provider - 'vidsrc_sbs' | 'peachify' | 'vidlink' | 's1'
   * @param {Object} options - { lang: string, autoPlay: boolean }
   * @returns {string|null} - Embed URL or null if invalid
   */
  function resolvePlayerUrl(req, provider, options) {
    var validation = validatePlaybackRequest(req);
    if (!validation.valid || !validation.sanitized) {
      return null;
    }

    var s = validation.sanitized;
    var p = (provider || 'vidsrc_sbs').toLowerCase();
    var opt = options || {};
    var lang = (opt.lang || 'hi').toLowerCase();

    // 1. Primary Reference Provider: VidSrc SBS
    if (p === 'vidsrc_sbs' || p === 'vidsrc' || p === 'default') {
      if (s.type === 'movie') {
        return 'https://vidsrc.sbs/embed/movie/' + s.tmdbId;
      }
      return 'https://vidsrc.sbs/embed/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    }

    // 2. Peachify Pro (Ad-Free HD with multi-audio sync)
    if (p === 'peachify') {
      var peachifyDub = (lang === 'hi') ? 'Hindi' : (lang === 'ta' ? 'Tamil' : (lang === 'te' ? 'Telugu' : 'English'));
      var dubParam = peachifyDub ? '&dub=' + encodeURIComponent(peachifyDub) : '';
      if (s.type === 'movie') {
        return 'https://peachify.pro/embed/movie/' + s.tmdbId + '?accent=E50914&autoPlay=true' + dubParam;
      }
      return 'https://peachify.pro/embed/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode + '?accent=E50914&autoPlay=true&autoNext=true&showNextBtn=true' + dubParam;
    }

    // 3. VidLink Pro Multi-Audio
    if (p === 'vidlink' || p === 's3') {
      var langParam = (opt.lang) ? '&lang=' + encodeURIComponent(String(opt.lang).toLowerCase()) : '';
      if (s.type === 'movie') {
        return 'https://vidlink.pro/movie/' + s.tmdbId + '?multiLang=true' + langParam;
      }
      return 'https://vidlink.pro/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode + '?multiLang=true' + langParam;
    }

    // 4. Server 1 (Fast Cloud Multi-Audio Stream)
    if (p === 's1') {
      var s1Query = 'type=' + s.type +
        '&id=' + s.tmdbId +
        '&lang=' + encodeURIComponent(lang) +
        (s.type === 'tv' ? ('&se=' + s.season + '&ep=' + s.episode) : '');
      return '/api/stream-player?' + s1Query;
    }

    // Fallback to Primary Provider
    if (s.type === 'movie') {
      return 'https://vidsrc.sbs/embed/movie/' + s.tmdbId;
    }
    return 'https://vidsrc.sbs/embed/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
  }

  /**
   * Verifies that a target embed URL originates from an authorized domain.
   */
  function isAllowedOrigin(url) {
    if (!url || typeof url !== 'string') return false;
    // Relative paths like /api/... on our origin are allowed
    if (url.startsWith('/api/')) return true;
    try {
      var parsed = new URL(url, 'https://netflix4u.in');
      var origin = parsed.origin.toLowerCase();
      if (origin === 'https://netflix4u.in' || origin === 'http://localhost:3000' || origin === 'http://localhost:3001') {
        return true;
      }
      return ALLOWED_ORIGINS.some(function(allowed) {
        return origin === allowed.toLowerCase() || origin.endsWith('.' + allowed.replace('https://', '').toLowerCase());
      });
    } catch (e) {
      return false;
    }
  }

  return {
    cleanTmdbId: cleanTmdbId,
    validatePlaybackRequest: validatePlaybackRequest,
    getCanonicalCacheKey: getCanonicalCacheKey,
    resolvePlayerUrl: resolvePlayerUrl,
    isAllowedOrigin: isAllowedOrigin,
    ALLOWED_ORIGINS: ALLOWED_ORIGINS
  };
}));
