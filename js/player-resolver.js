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

  // Strict allowlist for embed origins (including verified multi-server providers, zero Rivestream)
  var ALLOWED_ORIGINS = [
    'https://vidsrc.pm',
    'https://vidsrc.in',
    'https://vidsrc.sh',
    'https://vidsrc.sbs',
    'https://vidsrc.to',
    'https://vidsrc.net',
    'https://peachify.pro',
    'https://peachify.top',
    'https://slast430did.com',
    'https://allmovieland.link',
    'https://laika422mon.com',
    'https://vidlink.pro',
    'https://www.vidsrc.party',
    'https://api.cineby.homes',
    'https://vidbolt.xyz',
    'https://vidrock.ru',
    'https://player.videasy.net',
    'https://embed.wplay.me',
    'https://play.xpass.top',
    'https://vidnest.fun',
    'https://vidcore.net',
    'https://vaplayer.ru',
    'https://zxcstream.xyz',
    'https://1embed.cc',
    'https://cinesrc.st',
    'https://vidlux.site',
    'https://vsembed.ru',
    'https://vixsrc.to',
    'https://player.vidify.top',
    'https://mapple.rip',
    'https://vidfast.pro',
    'https://vidflix.club',
    'https://vidsrc.su',
    'https://www.viduki.net',
    'https://vidsrc2.ru',
    'https://www.2embed.stream',
    'https://frembed.asia',
    'https://moviesapi.to',
    'https://111movies.com',
    'https://superflixapi.beer',
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

    var tmdbId = cleanTmdbId(req.tmdbId || req.id);
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
   * Generates isolated cache key for AllMovieLand provider (Section B11).
   */
  function getAllmovielandCacheKey(req, opt) {
    var validation = validatePlaybackRequest(req);
    if (!validation.valid || !validation.sanitized) {
      return null;
    }
    var s = validation.sanitized;
    var extId = (opt && opt.imdbId && String(opt.imdbId).startsWith('tt')) ? opt.imdbId : s.tmdbId;
    if (s.type === 'movie') {
      return 'allmovieland:movie:' + extId;
    }
    return 'allmovieland:tv:' + extId + ':s' + s.season + ':e' + s.episode;
  }

  // ─── VIDSRC.WIN REVERSE-ENGINEERED PROVIDERS ADAPTER SUITE ───
  // Strictly excludes Rivestream / Fade per architectural mandate.
  var PROVIDER_BUILDERS = {
    // 1. VidSrc Global Reference
    vidsrc_sbs: function(s, opt) {
      var vHost = (opt && opt.domain) || 'vidsrc.pm';
      return s.type === 'movie'
        ? 'https://' + vHost + '/embed/movie/' + s.tmdbId
        : 'https://' + vHost + '/embed/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    // 2. Braflix (api.cineby.homes)
    braflix: function(s, opt) {
      if (s.type === 'movie') {
        return 'https://api.cineby.homes/embed/movie/' + s.tmdbId;
      }
      return 'https://api.cineby.homes/embed/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode + '?autonext=1&ds_lang=en';
    },
    // 3. Videasy 4K (player.videasy.net)
    videasy: function(s, opt) {
      var c = 'nextEpisode=true&autoplayNextEpisode=true&episodeSelector=true&color=#E50914';
      if (s.type === 'movie') {
        return 'https://player.videasy.net/movie/' + s.tmdbId;
      }
      return 'https://player.videasy.net/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode + '?' + c;
    },
    '4k': function(s, opt) { return PROVIDER_BUILDERS.videasy(s, opt); },
    // 4. VidLink Pro Multi-Audio
    vidlink: function(s, opt) {
      var langParam = (opt && opt.lang) ? '&lang=' + encodeURIComponent(String(opt.lang).toLowerCase()) : '';
      if (s.type === 'movie') {
        return 'https://vidlink.pro/movie/' + s.tmdbId + '?multiLang=true' + langParam;
      }
      return 'https://vidlink.pro/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode + '?multiLang=true' + langParam;
    },
    s3: function(s, opt) { return PROVIDER_BUILDERS.vidlink(s, opt); },
    // 5. Wootly (vidsrc.party)
    wootly: function(s, opt) {
      return s.type === 'movie'
        ? 'https://www.vidsrc.party/movie/' + s.tmdbId
        : 'https://www.vidsrc.party/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    // 6. Bolt & Flix (vidbolt.xyz)
    vidbolt: function(s, opt) {
      return s.type === 'movie'
        ? 'https://vidbolt.xyz/movie/' + s.tmdbId
        : 'https://vidbolt.xyz/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    bolt: function(s, opt) { return PROVIDER_BUILDERS.vidbolt(s, opt); },
    flix: function(s, opt) { return PROVIDER_BUILDERS.vidbolt(s, opt); },
    // 7. Nero (vidfast.pro)
    vidfast: function(s, opt) {
      return s.type === 'movie'
        ? 'https://vidfast.pro/movie/' + s.tmdbId
        : 'https://vidfast.pro/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    nero: function(s, opt) { return PROVIDER_BUILDERS.vidfast(s, opt); },
    // 8. Flixify (vidflix.club)
    vidflix: function(s, opt) {
      return s.type === 'movie'
        ? 'https://vidflix.club/movie/' + s.tmdbId
        : 'https://vidflix.club/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    flixify: function(s, opt) { return PROVIDER_BUILDERS.vidflix(s, opt); },
    // 9. Astra (vidsrc.su)
    vidsrc_su: function(s, opt) {
      return s.type === 'movie'
        ? 'https://vidsrc.su/embed/movie/' + s.tmdbId
        : 'https://vidsrc.su/embed/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    astra: function(s, opt) { return PROVIDER_BUILDERS.vidsrc_su(s, opt); },
    // 10. Vid (embed.wplay.me)
    wplay: function(s, opt) {
      return s.type === 'movie'
        ? 'https://embed.wplay.me/embed/movie/' + s.tmdbId
        : 'https://embed.wplay.me/embed/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    vid: function(s, opt) { return PROVIDER_BUILDERS.wplay(s, opt); },
    // 11. Mist (play.xpass.top)
    xpass: function(s, opt) {
      return s.type === 'movie'
        ? 'https://play.xpass.top/e/movie/' + s.tmdbId
        : 'https://play.xpass.top/e/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    mist: function(s, opt) { return PROVIDER_BUILDERS.xpass(s, opt); },
    // 12. Peachify Pro (peachify.pro)
    peachify: function(s, opt) {
      var lang = ((opt && opt.lang) || 'hi').toLowerCase();
      var dub = (lang === 'hi') ? 'Hindi' : (lang === 'ta' ? 'Tamil' : (lang === 'te' ? 'Telugu' : 'English'));
      var dubParam = dub ? '&dub=' + encodeURIComponent(dub) : '';
      if (s.type === 'movie') {
        return 'https://peachify.pro/embed/movie/' + s.tmdbId + '?accent=E50914&autoPlay=true' + dubParam;
      }
      return 'https://peachify.pro/embed/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode + '?accent=E50914&autoPlay=true&autoNext=true&showNextBtn=true' + dubParam;
    },
    // 13. Peach (peachify.top)
    peach: function(s, opt) {
      return s.type === 'movie'
        ? 'https://peachify.top/embed/movie/' + s.tmdbId
        : 'https://peachify.top/embed/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    peachify_top: function(s, opt) { return PROVIDER_BUILDERS.peach(s, opt); },
    // 14. Nest (vidnest.fun)
    vidnest: function(s, opt) {
      return s.type === 'movie'
        ? 'https://vidnest.fun/movie/' + s.tmdbId
        : 'https://vidnest.fun/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    nest: function(s, opt) { return PROVIDER_BUILDERS.vidnest(s, opt); },
    // 15. Pass (vidcore.net)
    vidcore: function(s, opt) {
      return s.type === 'movie'
        ? 'https://vidcore.net/movie/' + s.tmdbId
        : 'https://vidcore.net/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    pass: function(s, opt) { return PROVIDER_BUILDERS.vidcore(s, opt); },
    // 16. Mistify (vaplayer.ru)
    vaplayer: function(s, opt) {
      return s.type === 'movie'
        ? 'https://vaplayer.ru/embed/movie/' + s.tmdbId
        : 'https://vaplayer.ru/embed/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    mistify: function(s, opt) { return PROVIDER_BUILDERS.vaplayer(s, opt); },
    // 17. Simplify (zxcstream.xyz)
    zxcstream: function(s, opt) {
      if (s.type === 'movie') {
        return 'https://zxcstream.xyz/player/movie/' + s.tmdbId + '?autoplay=true&color=addc35&back=false&domainAd=braflix.win';
      }
      return 'https://zxcstream.xyz/player/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode + '?autoplay=true&color=addc35&back=false&domainAd=braflix.win';
    },
    simplify: function(s, opt) { return PROVIDER_BUILDERS.zxcstream(s, opt); },
    // 18. Asia (1embed.cc)
    embed_cc: function(s, opt) {
      return s.type === 'movie'
        ? 'https://1embed.cc/embed/movie/' + s.tmdbId
        : 'https://1embed.cc/embed/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    asia: function(s, opt) { return PROVIDER_BUILDERS.embed_cc(s, opt); },
    // 19. Cine (cinesrc.st)
    cinesrc: function(s, opt) {
      return s.type === 'movie'
        ? 'https://cinesrc.st/embed/movie/' + s.tmdbId
        : 'https://cinesrc.st/embed/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    cine: function(s, opt) { return PROVIDER_BUILDERS.cinesrc(s, opt); },
    // 20. Vidmux (vidlux.site)
    vidlux: function(s, opt) {
      return s.type === 'movie'
        ? 'https://vidlux.site/embed/movie/' + s.tmdbId
        : 'https://vidlux.site/embed/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    vidmux: function(s, opt) { return PROVIDER_BUILDERS.vidlux(s, opt); },
    // 21. Diablo (vsembed.ru)
    vsembed: function(s, opt) {
      return s.type === 'movie'
        ? 'https://vsembed.ru/embed/movie/' + s.tmdbId
        : 'https://vsembed.ru/embed/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    diablo: function(s, opt) { return PROVIDER_BUILDERS.vsembed(s, opt); },
    // 22. Italian (vixsrc.to)
    vixsrc: function(s, opt) {
      return s.type === 'movie'
        ? 'https://vixsrc.to/movie/' + s.tmdbId + '?autoplay=true&lang=it'
        : 'https://vixsrc.to/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode + '?autoplay=true&lang=it';
    },
    italian: function(s, opt) { return PROVIDER_BUILDERS.vixsrc(s, opt); },
    // 23. Vidind (player.vidify.top)
    vidify: function(s, opt) {
      return s.type === 'movie'
        ? 'https://player.vidify.top/embed/movie/' + s.tmdbId
        : 'https://player.vidify.top/embed/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    vidind: function(s, opt) { return PROVIDER_BUILDERS.vidify(s, opt); },
    // 24. 4KHD (mapple.rip)
    mapple: function(s, opt) {
      return s.type === 'movie'
        ? 'https://mapple.rip/watch/movie/' + s.tmdbId + '?autoPlay=true&theme=addc35'
        : 'https://mapple.rip/watch/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode + '?autoPlay=true&theme=addc35';
    },
    '4khd': function(s, opt) { return PROVIDER_BUILDERS.mapple(s, opt); },
    // 25. Hindi (viduki.net)
    viduki: function(s, opt) {
      return s.type === 'movie'
        ? 'https://www.viduki.net/1/movie/?id=' + s.tmdbId + '&color=ffffff'
        : 'https://www.viduki.net/1/tv/?id=' + s.tmdbId + '&s=' + s.season + '&e=' + s.episode + '&color=ffffff';
    },
    hindi: function(s, opt) { return PROVIDER_BUILDERS.viduki(s, opt); },
    // 26. Vidsrc2 (vidsrc2.ru)
    vidsrc2: function(s, opt) {
      return s.type === 'movie'
        ? 'https://vidsrc2.ru/embed/movie/' + s.tmdbId
        : 'https://vidsrc2.ru/embed/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    vidsrc2_ru: function(s, opt) { return PROVIDER_BUILDERS.vidsrc2(s, opt); },
    // 27. 2embed (2embed.stream)
    twoembed: function(s, opt) {
      return s.type === 'movie'
        ? 'https://www.2embed.stream/embed/movie/' + s.tmdbId
        : 'https://www.2embed.stream/embed/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    '2embed': function(s, opt) { return PROVIDER_BUILDERS.twoembed(s, opt); },
    // 28. French (frembed.asia)
    frembed: function(s, opt) {
      return s.type === 'movie'
        ? 'https://frembed.asia/api/film.php?id=' + s.tmdbId
        : 'https://frembed.asia/api/serie.php?id=' + s.tmdbId + '&sa=' + s.season + '&epi=' + s.episode;
    },
    french: function(s, opt) { return PROVIDER_BUILDERS.frembed(s, opt); },
    // 29. Club (moviesapi.to)
    moviesapi: function(s, opt) {
      return s.type === 'movie'
        ? 'https://moviesapi.to/movie/' + s.tmdbId
        : 'https://moviesapi.to/tv/' + s.tmdbId + '-' + s.season + '-' + s.episode;
    },
    club: function(s, opt) { return PROVIDER_BUILDERS.moviesapi(s, opt); },
    // 30. Sage (111movies.com)
    onemovies: function(s, opt) {
      return s.type === 'movie'
        ? 'https://111movies.com/movie/' + s.tmdbId
        : 'https://111movies.com/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    sage: function(s, opt) { return PROVIDER_BUILDERS.onemovies(s, opt); },
    // 31. Portuguese (superflixapi.beer)
    superflix: function(s, opt) {
      return s.type === 'movie'
        ? 'https://superflixapi.beer/filme/' + s.tmdbId
        : 'https://superflixapi.beer/serie/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    portuguese: function(s, opt) { return PROVIDER_BUILDERS.superflix(s, opt); },
    // 32. Azute (vidrock.ru)
    vidrock: function(s, opt) {
      return s.type === 'movie'
        ? 'https://vidrock.ru/movie/' + s.tmdbId
        : 'https://vidrock.ru/tv/' + s.tmdbId + '/' + s.season + '/' + s.episode;
    },
    azute: function(s, opt) { return PROVIDER_BUILDERS.vidrock(s, opt); },
    // 33. AllMovieLand
    allmovieland: function(s, opt) {
      var amlBase = (opt && opt.domain) ? ('https://' + opt.domain + '/play/') : 'https://slast430did.com/play/';
      var mediaId = (opt && opt.imdbId && String(opt.imdbId).startsWith('tt')) ? opt.imdbId : s.tmdbId;
      return s.type === 'movie'
        ? amlBase + encodeURIComponent(mediaId)
        : amlBase + encodeURIComponent(mediaId) + '?s=' + s.season + '&e=' + s.episode;
    },
    s2: function(s, opt) { return PROVIDER_BUILDERS.allmovieland(s, opt); },
    aml: function(s, opt) { return PROVIDER_BUILDERS.allmovieland(s, opt); },
    // 34. Fast Cloud Stream (/api/stream-player)
    s1: function(s, opt) {
      var lang = ((opt && opt.lang) || 'hi').toLowerCase();
      var s1Query = 'type=' + s.type +
        '&id=' + s.tmdbId +
        '&lang=' + encodeURIComponent(lang) +
        (s.type === 'tv' ? ('&se=' + s.season + '&ep=' + s.episode) : '');
      return '/api/stream-player?' + s1Query;
    },
    fastcloud: function(s, opt) { return PROVIDER_BUILDERS.s1(s, opt); }
  };

  /**
   * Resolves exact player embed URL for a given provider.
   * @param {Object} req - Playback request
   * @param {string} provider - Provider ID or Alias
   * @param {Object} options - { lang: string, domain: string, imdbId: string }
   * @returns {string|null} - Embed URL or null if invalid / excluded
   */
  function resolvePlayerUrl(req, provider, options) {
    var validation = validatePlaybackRequest(req);
    if (!validation.valid || !validation.sanitized) {
      return null;
    }

    var s = validation.sanitized;
    var p = (provider || 'vidsrc_sbs').toLowerCase().trim();
    var opt = options || {};

    // Absolute Exclusion Guard: Rivestream / Fade must strictly never resolve
    if (/rivestream|fade/i.test(p)) {
      console.warn('[Netflix4U Security] Blocked attempt to resolve excluded Rivestream / Fade provider');
      return null;
    }

    // Check direct builder in provider suite
    if (PROVIDER_BUILDERS[p]) {
      try {
        return PROVIDER_BUILDERS[p](s, opt);
      } catch(e) {
        console.error('[Netflix4U Resolver] Error generating URL for provider ' + p, e);
      }
    }

    // Try multi-server provider manager in Node / universal environment if available
    try {
      if (typeof require === 'function') {
        var pm = require('../src/player/providers/provider-manager').providerManager;
        if (pm) {
          var input = {
            canonicalId: req.canonicalId || ('tmdb-' + s.tmdbId),
            contentType: s.type,
            tmdbId: s.tmdbId,
            imdbId: opt.imdbId || req.imdbId,
            season: s.season,
            episode: s.episode
          };
          var resolvedFromPm = pm.resolvePlayerUrl(input, p, opt);
          if (resolvedFromPm) return resolvedFromPm;
        }
      }
    } catch(e) {}

    // Fallback to Primary Reference Provider
    return PROVIDER_BUILDERS.vidsrc_sbs(s, opt);
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
    getAllmovielandCacheKey: getAllmovielandCacheKey,
    resolvePlayerUrl: resolvePlayerUrl,
    isAllowedOrigin: isAllowedOrigin,
    ALLOWED_ORIGINS: ALLOWED_ORIGINS,
    PROVIDER_BUILDERS: PROVIDER_BUILDERS
  };
}));
