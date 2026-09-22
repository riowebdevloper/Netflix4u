/**
 * Netflix4U Net27 Edition - Modal Controller (Title, Watch, Trailer & Direct Downloads)
 */
(function() {
  'use strict';

  var titleModal = document.getElementById('title-modal');
  var titleModalBody = document.getElementById('title-modal-body');
  var titleModalHeaderTitle = document.getElementById('title-modal-header-title');
  var titleModalBack = document.getElementById('title-modal-back');
  var titleModalClose = document.getElementById('title-modal-close');

  var watchModal = document.getElementById('watch-modal');
  var watchModalIframe = document.getElementById('watch-modal-iframe');
  var watchModalBackdrop = document.getElementById('watch-modal-backdrop');
  var watchModalClose = document.getElementById('watch-modal-close');
  var watchPlayerBar = document.getElementById('watch-player-bar');

  // Net27 Floating Player Header Elements
  var watchTopBar = document.getElementById('watch-top-bar');
  var watchBackBtn = document.getElementById('watch-back-btn');
  var watchReloadBtn = document.getElementById('watch-reload-btn');
  var watchReloadIcon = document.getElementById('watch-reload-icon');
  var watchServerToggle = document.getElementById('watch-server-toggle');
  var watchServerMenu = document.getElementById('watch-server-menu');
  var watchCurrentServerLabel = document.getElementById('watch-current-server-label');
  var watchServerArrow = document.getElementById('watch-server-arrow');
  var watchMetaTitle = document.getElementById('watch-meta-title');
  var watchMetaYear = document.getElementById('watch-meta-year');
  var watchMetaType = document.getElementById('watch-meta-type');
  var watchPortraitHint = document.getElementById('watch-portrait-hint');
  var watchPortraitHintDismiss = document.getElementById('watch-portrait-hint-dismiss');

  var policyModal = document.getElementById('policy-modal');
  var policyModalBody = document.getElementById('policy-modal-body');
  var policyModalClose = document.getElementById('policy-modal-close');
  var policyTabs = document.getElementById('policy-tabs');

  var trailerModal = document.getElementById('trailer-modal');
  var trailerModalIframe = document.getElementById('trailer-modal-iframe');
  var trailerModalClose = document.getElementById('trailer-modal-close');

  var historyStack = [];
  var activeWatchServers = {};
  var currentWatchServer = 's1';
  var activeWatchParams = null;

  // Direct High-Speed Cloud File Download Handlers
  if (!window.getFastCloudDownloadHref) {
    window.getFastCloudDownloadHref = function(rawUrl) {
      if (!rawUrl || typeof rawUrl !== 'string') return '#';
      if (rawUrl.startsWith('/api/download-file')) return rawUrl;
      var isExternal = /nexdrive|hubcloud|dotmobiz|drivehub/i.test(rawUrl);
      if (isExternal) {
        return rawUrl;
      }
      // Direct cloud video streams route directly through the fast file download handler
      if (rawUrl.indexOf('workers.dev') !== -1 || rawUrl.indexOf('vcloud') !== -1 || rawUrl.indexOf('r2.dev') !== -1) {
        return '/api/download-file?url=' + encodeURIComponent(rawUrl);
      }
      if (rawUrl.startsWith('http')) {
        return '/api/download-file?url=' + encodeURIComponent(rawUrl);
      }
      return rawUrl;
    };
  }

  if (!window.handleFastCloudDownload) {
    window.handleFastCloudDownload = function(event, rawUrl, buttonEl) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      var targetEl = buttonEl || (event && (event.currentTarget || (event.target && event.target.closest('a'))));
      var originalHtml = '';
      if (targetEl) {
        originalHtml = targetEl.innerHTML;
        targetEl.style.pointerEvents = 'none';
        targetEl.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;"><svg style="animation:spinOnce 1s linear infinite;width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path></svg>Downloading...</span>';
      }
      var restore = function() {
        if (targetEl && originalHtml) {
          setTimeout(function() {
            targetEl.innerHTML = originalHtml;
            targetEl.style.pointerEvents = 'auto';
          }, 2500);
        }
      };

      var clean = rawUrl || '';
      var isExternal = /nexdrive|hubcloud|dotmobiz|drivehub/i.test(clean);
      if (isExternal) {
        if (window.__showToast) {
          window.__showToast('🚀 Opening high-speed direct download mirror...', '⚡');
        }
        window.open(clean, '_blank');
        restore();
        return;
      }

      var dlUrl = (window.getFastCloudDownloadHref && window.getFastCloudDownloadHref(clean)) || clean;

      if (window.__showToast) {
        window.__showToast('📥 High-speed direct file download starting...', '⚡');
      }

      // Trigger native browser download directly via location assign
      try {
        window.location.assign(dlUrl);
      } catch(e) {
        var dlLink = document.createElement('a');
        dlLink.href = dlUrl;
        dlLink.setAttribute('download', '');
        dlLink.target = '_blank';
        document.body.appendChild(dlLink);
        dlLink.click();
        setTimeout(function() {
          if (dlLink.parentNode) dlLink.parentNode.removeChild(dlLink);
        }, 1000);
      }

      restore();
    };
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[<>&"]/g, function(c) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c;
    });
  }

  function unwrapImageUrl(url) {
    if (!url || typeof url !== 'string') return '';
    var u = url.trim();
    if (u.indexOf('wsrv.nl/?url=') !== -1) {
      var m = u.match(/[?&]url=([^&#]+)/);
      if (m) {
        try {
          u = decodeURIComponent(m[1]);
          if (u.indexOf('wsrv.nl/?url=') !== -1) {
            return unwrapImageUrl(u);
          }
        } catch (e) {}
      }
    }
    if (u.indexOf('//') === 0) u = 'https:' + u;
    if (u.indexOf('/uploads/') === 0) u = 'https://dotmobiz.com' + u;
    if (u.indexOf('image.tmdb.org/') === 0) u = 'https://' + u;
    return u;
  }

  function lockBodyScroll() {
    document.body.style.overflow = 'hidden';
    document.body.classList.add('modal-open');
    var stickyAd = document.getElementById('aads-sticky-wrap');
    if (stickyAd) stickyAd.style.display = 'none';
  }

  function unlockBodyScroll() {
    if (titleModal && titleModal.classList.contains('hidden') &&
        watchModal && watchModal.classList.contains('hidden') &&
        trailerModal && trailerModal.classList.contains('hidden') &&
        (!policyModal || policyModal.classList.contains('hidden'))) {
      document.body.style.overflow = '';
      document.body.classList.remove('modal-open');
      document.body.classList.remove('watch-active');
      var stickyAd = document.getElementById('aads-sticky-wrap');
      var aadsCheck = document.getElementById('aadsstickymtz6up6x');
      if (stickyAd && (!aadsCheck || !aadsCheck.checked)) {
        stickyAd.style.display = '';
      }
    }
  }

  // ─── TITLE MODAL ───
  function openTitleModal(tmdbId, type, pushHistory, canonicalId, imdbId, titleHint, yearHint, posterHint, backdropHint) {
    if (window.__closeSearchOverlay) window.__closeSearchOverlay();
    var lookupId = canonicalId || tmdbId;
    if (pushHistory !== false) {
      historyStack.push({ tmdbId: tmdbId, type: type, canonicalId: canonicalId, imdbId: imdbId, title: titleHint, year: yearHint, poster: posterHint, backdrop: backdropHint });
      try {
        var titleHash = '#title=' + lookupId + '-' + type;
        if (location.hash !== titleHash && !location.hash.startsWith('#w=')) {
          history.pushState({ modal: 'title', tmdbId: lookupId, type: type }, '', titleHash);
        }
      } catch(e) {}
    }

    if (!titleModal) return;
    titleModal.classList.remove('hidden');
    titleModal.classList.add('flex');
    titleModal.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(function() {
      titleModal.classList.add('nm-modal-in');
    });
    lockBodyScroll();

    // Skeleton loader
    titleModalBody.innerHTML =
      '<div class="aspect-video sm:aspect-[21/9] bg-white/5 animate-pulse"></div>' +
      '<div class="p-6 space-y-4">' +
        '<div class="h-8 w-3/4 bg-white/10 rounded animate-pulse"></div>' +
        '<div class="h-4 w-1/3 bg-white/5 rounded animate-pulse"></div>' +
        '<div class="h-16 w-full bg-white/5 rounded animate-pulse"></div>' +
      '</div>';
    titleModal.scrollTop = 0;

    fetchTitleDetails(lookupId, type, canonicalId, imdbId, titleHint, yearHint, posterHint, backdropHint);
  }

  async function fetchTitleDetails(lookupId, type, canonicalId, imdbId, titleHint, yearHint, posterHint, backdropHint) {
    try {
      var query = '?title=' + encodeURIComponent(titleHint || '') +
                  '&year=' + encodeURIComponent(yearHint || '') +
                  '&poster=' + encodeURIComponent(posterHint || '') +
                  '&backdrop=' + encodeURIComponent(backdropHint || '');
      var res = await fetch('/api/catalog/title/' + encodeURIComponent(type) + '/' + encodeURIComponent(lookupId) + query);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      data.canonicalId = data.canonicalId || canonicalId || lookupId;
      if (imdbId && !data.imdbId) data.imdbId = imdbId;
      if ((!data.title || data.title === 'Unknown Title') && titleHint) data.title = titleHint;
      if (!data.poster && posterHint) data.poster = posterHint;
      if (!data.backdrop && (backdropHint || posterHint)) data.backdrop = backdropHint || posterHint;
      renderTitleModal(data, lookupId, type);
    } catch (err) {
      titleModalBody.innerHTML =
        '<div class="p-12 text-center text-white/60 space-y-3">' +
          '<div class="text-xl font-bold text-red-400">Failed to load title information</div>' +
          '<div class="text-sm">' + escapeHtml(err.message) + '</div>' +
          '<button onclick="window.Netflix4uModal.openTitle(\'' + lookupId + '\', \'' + type + '\')" class="px-5 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white font-semibold text-xs mt-3 transition">Try Again</button>' +
        '</div>';
    }
  }

  function renderTitleModal(data, tmdbId, type) {
    if (titleModalHeaderTitle) {
      titleModalHeaderTitle.textContent = data.title || '';
    }

    // Auto save to Continue Watching upon opening details
    if (window.__saveContinueWatching && (data.tmdbId || data.canonicalId)) {
      window.__saveContinueWatching({
        tmdbId: data.tmdbId,
        canonicalId: data.canonicalId || tmdbId,
        title: data.title || 'Netflix4U',
        poster: data.poster || data.backdrop || '',
        backdrop: data.backdrop || data.poster || '',
        type: type || data.type || 'movie',
        year: data.year || '',
        se: data.initialSeason || 1,
        ep: 1,
        progress: 20
      });
    }

    var isTv = data.type === 'tv' || type === 'tv';
    var backdropUrl = unwrapImageUrl(data.backdrop || '');
    var posterUrl = unwrapImageUrl(data.poster || '');

    var runtime = data.runtime ? Math.floor(data.runtime / 60) + 'h ' + (data.runtime % 60) + 'm' : '';
    var ratingBadge = (data.rating && data.rating > 0)
      ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-400/90 text-black font-bold text-[11px]"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' + data.rating.toFixed(1) + '</span>'
      : '';
    var matchScore = (data.rating && data.rating > 0) ? Math.round(data.rating * 10) + '% match' : '98% match';
    var cert = (data.certification && data.certification.rating) || 'U/A 13+';

    var castList = (data.cast || []).slice(0, 4).map(function(c) { return escapeHtml(c.name); }).join(', ') + ((data.cast || []).length > 4 ? ', more' : '');
    var genresList = (data.genres || []).map(function(g) { return escapeHtml(g.name); }).join(', ');

    // Cast circular avatars with error recovery
    var castAvatars = (data.cast || []).slice(0, 12).map(function(c) {
      var photoUrl = unwrapImageUrl(c.photo || c.profile_path || '');
      return '<div class="shrink-0 w-20 sm:w-24 text-center">' +
        '<div class="aspect-square rounded-full overflow-hidden bg-white/5 mb-1.5 ring-1 ring-white/10 mx-auto">' +
          (photoUrl
            ? '<img src="' + photoUrl + '" alt="' + escapeHtml(c.name) + '" class="w-full h-full object-cover" loading="lazy" decoding="async" onerror="this.onerror=null;this.parentElement.innerHTML=\'<div class=\\\'w-full h-full flex items-center justify-center text-white/40 text-sm font-bold bg-white/10\\\'>' + escapeHtml((c.name || 'C').slice(0, 1)) + '</div>\';" />'
            : '<div class="w-full h-full flex items-center justify-center text-white/30 text-lg font-bold">' + escapeHtml((c.name || 'C').slice(0, 1)) + '</div>') +
        '</div>' +
        '<div class="text-[11px] font-semibold text-white/90 truncate">' + escapeHtml(c.name) + '</div>' +
        '<div class="text-[10px] text-white/50 truncate">' + escapeHtml(c.character || '') + '</div>' +
      '</div>';
    }).join('');

    // Audio Language Tabs
    var audioLangs = (data.catalog && Array.isArray(data.catalog.audioLangs) && data.catalog.audioLangs.length)
      ? data.catalog.audioLangs
      : ['Hindi', 'English'];

    var audioTabs = audioLangs.map(function(lang, idx) {
      return '<button type="button" class="nm-lang-tab shrink-0' + (idx === 0 ? ' nm-lang-active' : '') + '">' + escapeHtml(lang) + '</button>';
    }).join('');

    // Download links partition: Dotmovies Direct Downloads vs Fast Cloud CDN
    var downloadLinks = data.downloadLinks || data.links || [];

    var dotmoviesLinks = downloadLinks.filter(function(l) {
      if (!l || !l.url) return false;
      var u = String(l.url || '').toLowerCase();
      var s = String(l.source || '').toLowerCase();
      return Boolean(l.isDotmovies || s.includes('dotmovies') || s.includes('dotmobiz') || s.includes('direct ultra hd') || u.includes('nexdrive') || u.includes('dotmobiz'));
    });

    var cloudLinks = downloadLinks.filter(function(l) {
      if (!l || !l.url) return false;
      var u = String(l.url || '').toLowerCase();
      var s = String(l.source || '').toLowerCase();
      return Boolean(l.isCloud || s.includes('fast cloud') || s.includes('hicine') || u.includes('vcloud') || u.includes('workers.dev') || u.includes('r2.dev'));
    });

    // Guaranteed visibility: If either partition is empty, share/synthesize from the other
    if (!dotmoviesLinks.length && downloadLinks.length) {
      dotmoviesLinks = downloadLinks.map(function(l) {
        return Object.assign({}, l, {
          isDotmovies: true,
          source: 'Direct Ultra HD (Dotmovies)',
          label: (l.label || data.title).replace(/fast cloud|hicine/gi, 'Direct Ultra HD')
        });
      });
    }
    if (!cloudLinks.length && downloadLinks.length) {
      cloudLinks = downloadLinks.map(function(l) {
        return Object.assign({}, l, {
          isCloud: true,
          source: 'Fast Cloud CDN',
          label: (l.label || data.title).replace(/direct ultra hd|dotmobiz|dotmovies/gi, 'Fast Cloud CDN')
        });
      });
    }

    var dotmoviesSectionHtml = renderDotmoviesSection(dotmoviesLinks, data.title, isTv, data.slug, data.canonicalId, tmdbId);
    var cloudSectionHtml = renderCloudSection(cloudLinks, data.title, isTv, tmdbId);

    // Episodes for TV Series
    var episodesSectionHtml = '';
    if (isTv) {
      var seasons = data.seasons || [];
      var currentSeason = data.initialSeason || 1;
      var seasonOptions = seasons.map(function(s) {
        return '<option value="' + s.season_number + '"' + (s.season_number === currentSeason ? ' selected' : '') + '>' +
          escapeHtml(s.name || ('Season ' + s.season_number)) + ' · ' + (s.episode_count || 10) + ' ep</option>';
      }).join('');

      var initialEpisodesHtml = renderEpisodeList(data.initialEpisodes || [], tmdbId, currentSeason, backdropUrl, downloadLinks, data.title, data.year, data.imdbId);

      episodesSectionHtml =
        '<section class="mt-8 pt-4 border-t border-white/10">' +
          '<div class="flex items-center justify-between gap-3 mb-4">' +
            '<div class="flex items-center gap-2.5">' +
              '<div class="w-1.5 h-5 rounded-full bg-red-600"></div>' +
              '<h3 class="text-lg sm:text-xl font-bold tracking-tight text-white">Episodes</h3>' +
            '</div>' +
            (seasons.length > 1
              ? '<div class="relative">' +
                  '<select id="modal-season-select" data-tmdbid="' + tmdbId + '" class="appearance-none pl-3 pr-8 py-2 rounded-lg bg-white/10 border border-white/15 text-xs sm:text-sm font-semibold text-white focus:outline-none focus:border-red-500 hover:bg-white/15 transition cursor-pointer">' +
                    seasonOptions +
                  '</select>' +
                  '<svg class="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>' +
                '</div>'
              : '<span class="text-xs text-white/50 font-semibold">Season 1</span>') +
          '</div>' +
          '<div id="modal-episode-list" data-current-season="' + currentSeason + '" class="space-y-3">' +
            initialEpisodesHtml +
          '</div>' +
        '</section>';
    }

    // Recommendations
    var recommendationsHtml = '';
    if (data.recommendations && data.recommendations.length) {
      recommendationsHtml =
        '<section class="mt-8 pt-4 border-t border-white/10">' +
          '<div class="flex items-center gap-2.5 mb-3">' +
            '<div class="w-1.5 h-5 rounded-full bg-red-600"></div>' +
            '<h3 class="text-lg sm:text-xl font-bold tracking-tight text-white">More Like This</h3>' +
          '</div>' +
          '<div class="flex gap-3 overflow-x-auto scrollbar-none pb-2">' +
            data.recommendations.map(function(rec) {
              var recPoster = unwrapImageUrl(rec.poster || '');
              return '<a href="#" data-modal="title" data-tmdbid="' + rec.tmdbId + '" data-type="' + (rec.type || 'movie') + '" class="shrink-0 w-28 sm:w-32 group block">' +
                '<div class="aspect-[2/3] rounded-lg overflow-hidden bg-white/5 ring-1 ring-white/10 group-hover:ring-2 group-hover:ring-red-600 transition">' +
                  (recPoster ? '<img src="' + recPoster + '" alt="' + escapeHtml(rec.title) + '" class="w-full h-full object-cover" loading="lazy" onerror="if(window.__healPoster){window.__healPoster(this);}else{this.onerror=null;this.src=window.__getPosterSvg(this.alt);}" />' : '') +
                '</div>' +
                '<div class="mt-1.5 text-xs font-semibold text-white/90 truncate">' + escapeHtml(rec.title) + '</div>' +
                '<div class="text-[10px] text-white/50">' + escapeHtml(rec.year || '') + '</div>' +
              '</a>';
            }).join('') +
          '</div>' +
        '</section>';
    }

    // Action buttons for modal
    var inList = window.__isBookmarked && window.__isBookmarked(tmdbId);
    var myListBtnHtml =
      '<button type="button" id="modal-mylist-btn" class="nm-btn-bookmark ' + (inList ? 'is-active' : '') + '">' +
        '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="' + (inList ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2.5"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>' +
        '<span>' + (inList ? 'In My List' : 'My List') + '</span>' +
      '</button>';

    var shareBtnHtml =
      '<button type="button" id="modal-share-btn" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/15 backdrop-blur text-white font-semibold hover:bg-white/25 active:scale-95 transition text-sm border border-white/10 cursor-pointer" title="Share with Friends">' +
        '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>' +
        '<span>Share</span>' +
      '</button>';

    // Assemble Full Modal Body
    titleModalBody.innerHTML =
      '<!-- Hero Backdrop -->' +
      '<div class="relative">' +
        '<div class="aspect-video sm:aspect-[21/9] overflow-hidden bg-zinc-950 relative">' +
          (backdropUrl ? '<img src="' + backdropUrl + '" alt="" class="w-full h-full object-cover" referrerpolicy="no-referrer" onerror="this.onerror=null;' + (posterUrl ? 'this.src=\'' + posterUrl + '\';' : 'this.style.display=\'none\';') + '" />' : (posterUrl ? '<img src="' + posterUrl + '" alt="" class="w-full h-full object-cover blur-sm opacity-50" />' : '')) +
          '<div class="absolute inset-0 bg-gradient-to-t from-[#15151c] via-[#15151c]/40 to-transparent"></div>' +
        '</div>' +
        '<div class="absolute inset-x-0 bottom-0 p-4 sm:p-6">' +
          '<div class="flex flex-col sm:flex-row gap-4 items-end">' +
            '<img src="' + (posterUrl || (window.__getPosterSvg ? window.__getPosterSvg(data.title) : '')) + '" alt="' + escapeHtml(data.title) + '" referrerpolicy="no-referrer" class="hidden sm:block w-28 lg:w-32 aspect-[2/3] object-cover rounded-lg shadow-2xl ring-1 ring-white/10 shrink-0" onerror="if(window.__healPoster){window.__healPoster(this);}else{this.onerror=null;this.src=window.__getPosterSvg?window.__getPosterSvg(this.alt):\'\';}" />' +
            '<div class="flex-1 min-w-0">' +
              '<h2 id="modal-title" data-modal-title="' + escapeHtml(data.title) + '" data-tmdbid="' + escapeHtml(data.tmdbId || tmdbId) + '" class="title-text text-2xl sm:text-3xl md:text-4xl font-black leading-tight mb-2 tracking-tight text-white" style="text-shadow: 0 2px 16px rgba(0,0,0,0.8);">' + escapeHtml(data.title) + '</h2>' +
              (data.tagline ? '<p class="text-xs sm:text-sm text-white/70 italic mb-2 line-clamp-1">' + escapeHtml(data.tagline) + '</p>' : '') +
              '<div class="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-white/85 font-medium">' +
                '<span class="text-green-400 font-semibold">' + matchScore + '</span>' +
                '<span>' + escapeHtml(data.year) + '</span>' +
                '<span class="px-1.5 py-0.5 rounded border border-white/40 text-[10px] tracking-wide">' + escapeHtml(cert) + '</span>' +
                (runtime ? '<span>' + runtime + '</span>' : '') +
                '<span class="px-1.5 py-0.5 rounded bg-white/15 text-[10px] tracking-wider font-bold">HD</span>' +
                ratingBadge +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<!-- Content Body -->' +
      '<div class="p-4 sm:p-6 space-y-6">' +
        '<!-- Action Buttons -->' +
        '<div class="flex flex-wrap items-center gap-2.5 sm:gap-3">' +
          '<button type="button" data-modal="watch" data-tmdbid="' + ((typeof Netflix4uPlayerResolver !== 'undefined' && Netflix4uPlayerResolver.cleanTmdbId) ? (Netflix4uPlayerResolver.cleanTmdbId(data.tmdbId || tmdbId) || data.tmdbId || tmdbId) : (data.tmdbId || tmdbId)) + '" data-canonical-id="' + escapeHtml(data.canonicalId || tmdbId) + '" data-type="' + type + '" data-title="' + escapeHtml(data.title) + '" data-year="' + (data.year || '') + '" data-imdbid="' + (data.imdbId || '') + '" data-backdrop="' + (data.backdrop || '') + '" data-poster="' + (data.poster || '') + '"' + (isTv ? ' data-se="' + (data.initialSeason || 1) + '" data-ep="1"' : '') + ' class="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white text-black font-bold hover:bg-white/90 active:scale-95 transition text-sm shadow-xl cursor-pointer">' +
            '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
            (isTv ? 'Play S' + (data.initialSeason || 1) + ' E1' : 'Watch Now') +
          '</button>' +
          '<button type="button" id="scroll-to-downloads-btn" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold active:scale-95 transition text-sm shadow-xl cursor-pointer">' +
            '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>' +
            'Downloads' +
          '</button>' +
          (data.trailerKey ? '<button type="button" data-modal="trailer" data-yt="' + data.trailerKey + '" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/15 backdrop-blur text-white font-semibold hover:bg-white/25 active:scale-95 transition text-sm border border-white/10 cursor-pointer">' +
            '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>' +
            'Trailer' +
          '</button>' : '') +
          myListBtnHtml +
          shareBtnHtml +
        '</div>' +

        '<!-- Two Column Synopsis & Cast/Genres -->' +
        '<div class="modal-info-grid">' +
          '<div class="modal-overview">' +
            '<p class="text-sm text-white/90 leading-relaxed">' + escapeHtml(data.overview || 'No synopsis available.') + '</p>' +
          '</div>' +
          '<div class="modal-sidebar space-y-2">' +
            (castList ? '<div><span class="text-white/45">Cast: </span><span class="text-white/85">' + castList + '</span></div>' : '') +
            (genresList ? '<div><span class="text-white/45">Genres: </span><span class="text-white/85">' + genresList + '</span></div>' : '') +
          '</div>' +
        '</div>' +

        '<!-- In-Modal Dedicated Ad Section 1: Modal Top Sponsor -->' +
        '<div class="nm-ad-container !my-3" data-ad-container="ad-slot-modal-top">' +
          '<div class="nm-ad-label">Sponsored</div>' +
          '<div id="ad-slot-modal-top" class="nm-ad-slot nm-ad-modal"></div>' +
        '</div>' +

        '<!-- Audio Languages Bar -->' +
        '<div class="pt-1">' +
          '<div class="text-[11px] uppercase tracking-wider font-bold text-white/40 mb-2">Available Audio Tracks</div>' +
          '<div class="nm-audio-bar flex gap-6 overflow-x-auto scrollbar-none">' +
            audioTabs +
          '</div>' +
        '</div>' +

        '<!-- In-Modal Dedicated Ad Section 2: Pre-Dotmovies Sponsor -->' +
        '<div class="nm-ad-container !my-3" data-ad-container="ad-slot-modal-dotmovies">' +
          '<div class="nm-ad-label">Sponsored Downloads</div>' +
          '<div id="ad-slot-modal-dotmovies" class="nm-ad-slot nm-ad-modal"></div>' +
        '</div>' +

        '<!-- SEPARATE DOWNLOAD SECTIONS -->' +
        dotmoviesSectionHtml +

        '<!-- In-Modal Dedicated Ad Section 3: Cloud Server Sponsor -->' +
        '<div class="nm-ad-container !my-3" data-ad-container="ad-slot-modal-cloud">' +
          '<div class="nm-ad-label">Sponsored Server</div>' +
          '<div id="ad-slot-modal-cloud" class="nm-ad-slot nm-ad-modal"></div>' +
        '</div>' +

        cloudSectionHtml +
        (function() {
          var streamableUrl = resolveStreamableVideoUrl(data, isTv, data.initialSeason || 1, 1);
          return '<!-- Direct External Player Strip -->' +
          '<div class="nm-ext-stream-strip">' +
            '<div class="flex items-center gap-2">' +
              '<span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>' +
              '<div>' +
                '<div class="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">' +
                  'Stream in External App (Zero Buffering)' +
                '</div>' +
                '<div class="text-[11px] text-white/50">Direct hardware-accelerated playback with multi-audio & subtitles</div>' +
              '</div>' +
            '</div>' +
            '<div class="flex items-center gap-2 flex-wrap">' +
              '<button type="button" class="btn-vlc" data-ext-stream-vlc="' + encodeURIComponent(streamableUrl) + '" title="Open in VLC Media Player">' +
                '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.8L20.2 19H3.8L12 5.8z"/></svg>' +
                '<span>Open in VLC</span>' +
              '</button>' +
              '<button type="button" class="btn-mx" data-ext-stream-mx="' + encodeURIComponent(streamableUrl) + '" title="Open in MX Player">' +
                '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
                '<span>Open in MX Player</span>' +
              '</button>' +
              '<button type="button" class="btn-stream-copy" data-ext-stream-copy="' + encodeURIComponent(streamableUrl) + '" title="Copy Stream URL">' +
                '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>' +
                '<span>Copy Stream Link</span>' +
              '</button>' +
            '</div>' +
          '</div>';
        })() +

        episodesSectionHtml +

        (castAvatars ? '<section class="mt-8 pt-4 border-t border-white/10">' +
          '<div class="flex items-center gap-2.5 mb-3">' +
            '<div class="w-1.5 h-5 rounded-full bg-red-600"></div>' +
            '<h3 class="text-lg sm:text-xl font-bold tracking-tight text-white">Top Cast</h3>' +
          '</div>' +
          '<div class="flex gap-4 overflow-x-auto scrollbar-none pb-2">' + castAvatars + '</div>' +
        '</section>' : '') +

        '<!-- In-Modal Dedicated Ad Section 4: Modal Bottom Recommendations Sponsor -->' +
        '<div class="nm-ad-container !my-4" data-ad-container="ad-slot-modal-bottom">' +
          '<div class="nm-ad-label">Recommended Partner</div>' +
          '<div id="ad-slot-modal-bottom" class="nm-ad-slot nm-ad-modal"></div>' +
        '</div>' +

        recommendationsHtml +
      '</div>';

    // Render ad slots inside modal body & top dock
    if (window.Netflix4uAds) {
      window.Netflix4uAds.renderAll(titleModal);
      window.Netflix4uAds.renderSlot('ad-slot-modal-popunder-top-slot');
    }

    // Hook events inside modal body
    titleModal.scrollTop = 0;
    var scrollBtn = document.getElementById('scroll-to-downloads-btn');
    if (scrollBtn) {
      scrollBtn.addEventListener('click', function() {
        var dlSection = document.getElementById('dotmovies-download-section') || document.getElementById('download-mirrors-section');
        if (dlSection) dlSection.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // My List button click in modal
    var modalMylistBtn = document.getElementById('modal-mylist-btn');
    if (modalMylistBtn) {
      modalMylistBtn.addEventListener('click', function() {
        if (window.__toggleMyList) {
          var added = window.__toggleMyList({
            tmdbId: data.tmdbId || tmdbId,
            canonicalId: data.canonicalId || tmdbId,
            imdbId: data.imdbId || '',
            title: data.title,
            poster: posterUrl,
            backdrop: backdropUrl,
            year: data.year,
            type: type,
            rating: data.rating
          });
          modalMylistBtn.classList.toggle('is-active', added);
          modalMylistBtn.querySelector('span').textContent = added ? 'In My List' : 'My List';
          var svg = modalMylistBtn.querySelector('svg');
          if (svg) svg.setAttribute('fill', added ? 'currentColor' : 'none');
        }
      });
    }

    // Share button click in modal
    var modalShareBtn = document.getElementById('modal-share-btn');
    if (modalShareBtn) {
      modalShareBtn.addEventListener('click', function() {
        if (window.__openShareDialog) {
          var shareUrl = window.location.origin + '/?title=' + encodeURIComponent(data.title) + '&id=' + (data.tmdbId || tmdbId);
          window.__openShareDialog({
            title: data.title,
            url: shareUrl
          });
        }
      });
    }

    // Audio tabs click (preserves language preference into streaming player)
    titleModalBody.querySelectorAll('.nm-lang-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        titleModalBody.querySelectorAll('.nm-lang-tab').forEach(function(b) { b.classList.remove('nm-lang-active'); });
        btn.classList.add('nm-lang-active');
        var txt = (btn.textContent || '').trim().toLowerCase();
        if (txt.includes('hin')) currentWatchLang = 'hi';
        else if (txt.includes('eng')) currentWatchLang = 'en';
        else if (txt.includes('tam')) currentWatchLang = 'ta';
        else if (txt.includes('tel')) currentWatchLang = 'te';
        else currentWatchLang = 'multi';
      });
    });

    // Season change event
    var seasonSelect = document.getElementById('modal-season-select');
    var episodeListContainer = document.getElementById('modal-episode-list');
    if (seasonSelect && episodeListContainer) {
      seasonSelect.addEventListener('change', async function() {
        var selectedSeason = Number(seasonSelect.value);
        episodeListContainer.innerHTML =
          '<div class="flex items-center justify-center p-8 text-white/50 text-sm gap-2">' +
            '<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>' +
            '<span>Loading Season ' + selectedSeason + ' episodes...</span>' +
          '</div>';
        try {
          var sRes = await fetch('/api/catalog/season/' + tmdbId + '/' + selectedSeason);
          var sData = await sRes.json();
          if (sData.ok && sData.episodes && sData.episodes.length) {
            episodeListContainer.innerHTML = renderEpisodeList(sData.episodes, tmdbId, selectedSeason, data.backdrop, downloadLinks, data.title, data.year, data.imdbId);
          } else {
            episodeListContainer.innerHTML = '<div class="text-white/40 text-sm p-6 text-center">No episodes found for this season.</div>';
          }
        } catch(e) {
          episodeListContainer.innerHTML = '<div class="text-red-400 text-sm p-6 text-center">Failed to load season episodes.</div>';
        }
      });
    }
  }

  // Smooth scroll and highlight episode in download list
  function handleEpisodeDownloadClick(sNum, eNum) {
    var dlSection = document.getElementById('dotmovies-download-section') || document.getElementById('download-mirrors-section');
    if (!dlSection) return;

    var accBtn = dlSection.querySelector('[data-season="' + sNum + '"]');
    if (accBtn) {
      var parentAccordion = accBtn.closest('[data-accordion-item]');
      if (parentAccordion && !parentAccordion.classList.contains('is-open')) {
        parentAccordion.classList.add('is-open');
      }
    }

    var epRow = document.getElementById('dl-ep-row-' + sNum + '-' + eNum) || document.getElementById('dl-dot-ep-row-' + sNum + '-' + eNum);
    if (epRow) {
      epRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      epRow.classList.add('ring-2', 'ring-red-500', 'bg-red-500/15');
      setTimeout(function() {
        epRow.classList.remove('ring-2', 'ring-red-500', 'bg-red-500/15');
      }, 3500);
      if (window.__showToast) {
        window.__showToast('Season ' + sNum + ' Episode ' + eNum + ' download links highlighted below', '📥');
      }
    } else {
      dlSection.scrollIntoView({ behavior: 'smooth' });
      if (window.__showToast) {
        window.__showToast('Showing Season ' + sNum + ' download mirrors below', '📥');
      }
    }
  }

  // Delegated Download Click Listener on Title Modal Body (100% Quote-Safe)
  if (titleModalBody) {
    titleModalBody.addEventListener('click', function(e) {
      // Direct Episode Download Trigger
      var epDlBtn = e.target.closest('.ep-download-trigger');
      if (epDlBtn) {
        e.preventDefault();
        e.stopPropagation();
        var sNum = Number(epDlBtn.dataset.dlSe) || 1;
        var eNum = Number(epDlBtn.dataset.dlEp) || 1;
        handleEpisodeDownloadClick(sNum, eNum);
        return;
      }

      // Accordion Toggle for Series Seasons
      var accBtn = e.target.closest('[data-accordion-toggle]');
      if (accBtn) {
        e.preventDefault();
        var item = accBtn.closest('[data-accordion-item]');
        if (item) {
          item.classList.toggle('is-open');
        }
        return;
      }

      var dlBtn = e.target.closest('[data-fast-download]');
      if (dlBtn) {
        e.preventDefault();
        var rawUrl = decodeURIComponent(dlBtn.dataset.fastDownload);
        if (window.handleFastCloudDownload) {
          window.handleFastCloudDownload(e, rawUrl, dlBtn);
        } else {
          window.open(dlBtn.href, '_blank', 'noopener,noreferrer');
        }
      }
    });
  }

  function renderDownloadMirrors(links, title, isTv, tmdbId) {
    if (!links || !links.length) {
      return '<div class="p-5 rounded-xl bg-white/[0.03] border border-white/10 text-center space-y-2">' +
        '<div class="text-sm text-white/80 font-medium">Direct download links being updated for this title.</div>' +
        '<div class="text-xs text-white/40">You can stream this title instantly using the "Watch Now" button above.</div>' +
      '</div>';
    }

    var hasSeriesStructure = isTv || links.some(function(l) { return l.season || l.episode; });

    if (hasSeriesStructure) {
      // Group series links by season: separate full batch packs from individual episodes
      var seasonMap = {};
      var batchMap = {};
      links.forEach(function(l) {
        var sNum = Number(l.season) || 1;
        var isBatchLink = Boolean(l.isBatch || l.episode === null || typeof l.episode === 'undefined');
        if (isBatchLink) {
          if (!batchMap[sNum]) batchMap[sNum] = [];
          batchMap[sNum].push(l);
        } else {
          var eNum = Number(l.episode) || 1;
          if (!seasonMap[sNum]) seasonMap[sNum] = {};
          if (!seasonMap[sNum][eNum]) seasonMap[sNum][eNum] = [];
          seasonMap[sNum][eNum].push(l);
        }
      });

      var allSeasonKeys = Object.keys(seasonMap).concat(Object.keys(batchMap));
      var seasons = Array.from(new Set(allSeasonKeys.map(Number))).sort(function(a, b) { return a - b; });
      if (!seasons.length) seasons = [1];

      return '<div class="dl-accordion">' +
        seasons.map(function(sNum, sIdx) {
          var epMap = seasonMap[sNum] || {};
          var epNums = Object.keys(epMap).map(Number).sort(function(a, b) { return a - b; });
          var batches = batchMap[sNum] || [];
          var isOpen = sIdx === 0 ? ' is-open' : '';

          var batchHtml = '';
          if (batches.length) {
            var batchPills = batches.map(function(link) {
              var q = String(link.quality || 'Batch Pack').toUpperCase();
              var rawUrl = link.url || '#';
              var cleanUrl = (window.getFastCloudDownloadHref && window.getFastCloudDownloadHref(rawUrl, { title: title + ' Season ' + sNum + ' Full Pack', tmdbId: tmdbId, se: sNum, quality: q })) || rawUrl;
              return '<a href="' + cleanUrl + '" data-fast-download="' + encodeURIComponent(rawUrl) + '" data-title="' + escapeHtml(title) + ' Season ' + sNum + ' Full Pack" data-tmdbid="' + escapeHtml(tmdbId || '') + '" data-se="' + sNum + '" data-quality="' + escapeHtml(q) + '" class="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md">' +
                '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>' +
                '<span>' + escapeHtml(q) + '</span>' +
                (link.size ? '<span class="text-white/80 text-[10px]">(' + escapeHtml(link.size) + ')</span>' : '') +
              '</a>';
            }).join('');

            batchHtml =
              '<div class="p-3.5 rounded-xl bg-gradient-to-r from-red-950/40 via-red-900/20 to-black/60 border border-red-500/30 mb-3 shadow-lg">' +
                '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
                  '<div class="flex items-center gap-2.5">' +
                    '<div class="w-8 h-8 rounded-lg bg-red-600/25 text-red-400 border border-red-500/40 flex items-center justify-center shrink-0">' +
                      '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>' +
                    '</div>' +
                    '<div>' +
                      '<div class="text-xs sm:text-sm font-bold text-white flex items-center gap-2">' +
                        '<span>Season ' + sNum + ' Complete (All Episodes Pack)</span>' +
                        '<span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black uppercase tracking-wider">FULL ZIP</span>' +
                      '</div>' +
                      '<div class="text-[11px] text-white/60">One-click download for entire Season ' + sNum + ' • Multi-Audio Tracks</div>' +
                    '</div>' +
                  '</div>' +
                  '<div class="flex flex-wrap items-center gap-2 shrink-0">' +
                    batchPills +
                  '</div>' +
                '</div>' +
              '</div>';
          }

          var epRowsHtml = epNums.map(function(eNum) {
            var epLinks = epMap[eNum] || [];
            var epQualityPills = epLinks.map(function(link) {
              var q = String(link.quality || 'HD').toUpperCase();
              var rawUrl = link.url || '#';
              var cleanUrl = (window.getFastCloudDownloadHref && window.getFastCloudDownloadHref(rawUrl, { title: title, tmdbId: tmdbId, se: sNum, ep: eNum, quality: q })) || rawUrl;
              return '<a href="' + cleanUrl + '" data-fast-download="' + encodeURIComponent(rawUrl) + '" data-title="' + escapeHtml(title) + '" data-tmdbid="' + escapeHtml(tmdbId || '') + '" data-se="' + sNum + '" data-ep="' + eNum + '" data-quality="' + escapeHtml(q) + '" class="px-2.5 py-1 rounded bg-white/10 hover:bg-red-600 active:scale-95 text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer border border-white/10">' +
                '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>' +
                '<span>' + escapeHtml(q) + '</span>' +
                (link.size ? '<span class="text-white/50 text-[10px]">(' + escapeHtml(link.size) + ')</span>' : '') +
              '</a>';
            }).join('');

            return '<div id="dl-ep-row-' + sNum + '-' + eNum + '" class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition">' +
              '<div class="flex items-center gap-2">' +
                '<span class="w-8 text-center text-xs font-bold text-red-400 bg-red-500/10 rounded py-0.5 border border-red-500/20">E' + eNum + '</span>' +
                '<span class="text-xs font-semibold text-white/90">Episode ' + eNum + '</span>' +
              '</div>' +
              '<div class="flex flex-wrap items-center gap-1.5">' +
                epQualityPills +
              '</div>' +
            '</div>';
          }).join('');

          return '<div class="dl-accordion-item' + isOpen + '" data-accordion-item>' +
            '<button type="button" class="dl-accordion-header" data-accordion-toggle data-season="' + sNum + '">' +
              '<span class="flex items-center gap-2">' +
                '<svg class="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>' +
                'Season ' + sNum + ' <span class="text-white/40 text-xs font-normal">(' + epNums.length + ' Episodes + Full Season Pack)</span>' +
              '</span>' +
              '<svg class="dl-accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>' +
            '</button>' +
            '<div class="dl-accordion-body space-y-2">' +
              batchHtml +
              epRowsHtml +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>';
    }

    // Movies: Sorted from highest quality (4K) down to 480p
    var qualWeight = function(q) {
      q = String(q || '').toUpperCase();
      if (q.includes('4K') || q.includes('2160')) return 4;
      if (q.includes('1440')) return 3;
      if (q.includes('1080')) return 2;
      if (q.includes('720')) return 1;
      return 0;
    };

    var sortedLinks = links.slice().sort(function(a, b) {
      return qualWeight(b.quality) - qualWeight(a.quality);
    });

    return sortedLinks.map(function(link) {
      var rawQual = String(link.quality || 'HD').toUpperCase();
      var qualBadgeClass = 'dl-quality-1080p';
      if (rawQual.includes('4K') || rawQual.includes('2160')) qualBadgeClass = 'dl-quality-4k';
      else if (rawQual.includes('1440')) qualBadgeClass = 'dl-quality-1080p';
      else if (rawQual.includes('720')) qualBadgeClass = 'dl-quality-720p';
      else if (rawQual.includes('480')) qualBadgeClass = 'dl-quality-480p';

      var sizeText = link.size || (rawQual.includes('4K') ? '4.8 GB' : rawQual.includes('1080') ? '2.4 GB' : rawQual.includes('720') ? '1.1 GB' : '550 MB');
      var audioText = link.audio || 'Hindi + English [Multi-Audio]';
      var rawUrl = link.url || '#';
      var cleanUrl = (window.getFastCloudDownloadHref && window.getFastCloudDownloadHref(rawUrl, { title: title, tmdbId: tmdbId, quality: rawQual })) || rawUrl;

      return '<div class="dl-card">' +
        '<div class="flex items-center gap-3 min-w-0">' +
          '<span class="dl-quality-badge ' + qualBadgeClass + '">' + escapeHtml(rawQual) + '</span>' +
          '<div class="min-w-0">' +
            '<div class="text-xs sm:text-sm font-bold text-white/90 truncate">' + escapeHtml(link.label || link.title || title) + '</div>' +
            '<div class="flex items-center gap-2 text-[11px] text-white/50 mt-0.5">' +
              '<span class="font-semibold text-white/70">' + escapeHtml(sizeText) + '</span>' +
              '<span>•</span>' +
              '<span class="truncate text-white/60">' + escapeHtml(audioText) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="shrink-0">' +
          '<a href="' + cleanUrl + '" data-fast-download="' + encodeURIComponent(rawUrl) + '" data-title="' + escapeHtml(title) + '" data-tmdbid="' + escapeHtml(tmdbId || '') + '" data-quality="' + escapeHtml(rawQual) + '" class="dl-btn dl-cloud-btn cursor-pointer">' +
            '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>' +
            '<span>Fast Download</span>' +
          '</a>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderCloudSection(links, title, isTv, tmdbId) {
    return '<section id="download-mirrors-section" class="dl-section">' +
      '<div class="flex items-center justify-between mb-3.5">' +
        '<div class="flex items-center gap-2.5">' +
          '<div class="w-1.5 h-5 rounded-full bg-red-600"></div>' +
          '<h3 class="text-lg sm:text-xl font-bold tracking-tight text-white">Fast Cloud CDN Downloads</h3>' +
        '</div>' +
        '<span class="text-xs text-green-400 font-semibold flex items-center gap-1">' +
          '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>' +
          'High-Speed CDN Active' +
        '</span>' +
      '</div>' +
      '<div id="modal-download-links" class="space-y-2.5">' +
        renderDownloadMirrors(links, title, isTv, tmdbId) +
      '</div>' +
    '</section>';
  }

  function resolveStreamableVideoUrl(data, isTv, season, episode) {
    if (!data) return '';
    var s = Number(season) || 1;
    var ep = Number(episode) || 1;

    // 1. Check if data.links has direct cloud/stream/video URLs
    var links = data.links || data.downloadLinks || [];
    if (links && Array.isArray(links) && links.length > 0) {
      // Find matching season & episode for series
      var match = null;
      if (isTv) {
        match = links.find(function(l) {
          return l && l.url && Number(l.season) === s && Number(l.episode) === ep && (l.isCloud || l.url.includes('workers.dev') || l.url.includes('vcloud') || l.url.includes('hicine'));
        });
        if (!match) {
          match = links.find(function(l) {
            return l && l.url && Number(l.season) === s && Number(l.episode) === ep;
          });
        }
      }
      // If not TV or no episode-specific match found, look for best cloud stream
      if (!match) {
        match = links.find(function(l) {
          return l && l.url && (l.isCloud || l.url.includes('workers.dev') || l.url.includes('vcloud') || l.url.includes('hicine') || /\.(mp4|mkv|m3u8)($|\?)/i.test(l.url));
        });
      }
      // Or any direct link
      if (!match) {
        match = links.find(function(l) { return l && l.url && !l.url.startsWith('#'); });
      }
      if (match && match.url) {
        return match.url;
      }
    }

    // 2. Fallback: if TMDB ID is present, construct fallback stream URL
    var tmdbId = data.tmdbId || data.id;
    if (tmdbId) {
      var cleanId = String(tmdbId).replace(/^tmdb-(?:movie|series)-/, '');
      if (isTv) {
        return 'https://autoembed.co/tv/tmdb/' + cleanId + '/' + s + '/' + ep;
      }
      return 'https://autoembed.co/movie/tmdb/' + cleanId;
    }
    return '';
  }

  function launchInVlc(rawUrl) {
    if (!rawUrl) {
      if (window.__showToast) window.__showToast('No stream URL available to launch VLC', '⚠️');
      return;
    }
    var isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      var vlcIntent = 'intent:' + rawUrl + '#Intent;action=android.intent.action.VIEW;type=video/*;package=org.videolan.vlc;end';
      window.location.href = vlcIntent;
    } else {
      var clean = rawUrl.replace(/^https?:\/\//i, '');
      window.location.href = 'vlc://' + clean;
    }
    if (window.__showToast) window.__showToast('Opening stream in VLC Player…', '🎬');
  }

  function launchInMxPlayer(rawUrl) {
    if (!rawUrl) {
      if (window.__showToast) window.__showToast('No stream URL available to launch MX Player', '⚠️');
      return;
    }
    var isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
      var mxIntent = 'intent:' + rawUrl + '#Intent;action=android.intent.action.VIEW;type=video/*;package=com.mxtech.videoplayer.ad;end';
      window.location.href = mxIntent;
    } else {
      var clean = rawUrl.replace(/^https?:\/\//i, '');
      window.location.href = 'vlc://' + clean;
    }
    if (window.__showToast) window.__showToast('Opening stream in MX Player…', '🎬');
  }

  function renderDotmoviesSection(links, title, isTv, slug, canonicalId, tmdbId) {
    var headerHtml =
      '<div class="flex items-center justify-between mb-3.5">' +
        '<div class="flex items-center gap-2.5">' +
          '<span class="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black tracking-wider uppercase">DIRECT ULTRA HD</span>' +
          '<h3 class="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">' +
            'Direct Ultra HD Downloads' +
          '</h3>' +
        '</div>' +
        '<span class="text-xs text-amber-400 font-semibold flex items-center gap-1">' +
          '<svg class="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' +
          'High-Speed Direct Mirrors' +
        '</span>' +
      '</div>';

    if (!links || !links.length) {
      if (isTv) {
        links = [
          { quality: '1080p FHD', size: '7.5 GB', isBatch: true, season: 1, label: (title || 'Series') + ' Season 1 Complete Direct Ultra HD Zip', url: '/api/download-file?title=' + encodeURIComponent(title || 'Series') + '+Season+1&id=' + encodeURIComponent(tmdbId || '') + '&quality=1080p&type=series&download=1', isDotmovies: true },
          { quality: '720p HD', size: '4.2 GB', isBatch: true, season: 1, label: (title || 'Series') + ' Season 1 Complete Direct Ultra HD Zip (720p)', url: '/api/download-file?title=' + encodeURIComponent(title || 'Series') + '+Season+1&id=' + encodeURIComponent(tmdbId || '') + '&quality=720p&type=series&download=1', isDotmovies: true },
          { quality: '1080p', size: '750 MB', episode: 1, season: 1, label: (title || 'Series') + ' S01E01 (Direct Ultra HD 1080p)', url: '/api/download-file?title=' + encodeURIComponent(title || 'Series') + '+S01E01&id=' + encodeURIComponent(tmdbId || '') + '&quality=1080p&type=series&download=1', isDotmovies: true },
          { quality: '720p', size: '420 MB', episode: 1, season: 1, label: (title || 'Series') + ' S01E01 (Direct Ultra HD 720p)', url: '/api/download-file?title=' + encodeURIComponent(title || 'Series') + '+S01E01&id=' + encodeURIComponent(tmdbId || '') + '&quality=720p&type=series&download=1', isDotmovies: true }
        ];
      } else {
        links = [
          { quality: '4K', size: '4.8 GB', label: (title || 'Movie') + ' 4K Ultra HD Dual Audio [Direct Ultra HD]', url: '/api/download-file?title=' + encodeURIComponent(title || 'Movie') + '&id=' + encodeURIComponent(tmdbId || '') + '&quality=4K&type=movie&download=1', isDotmovies: true },
          { quality: '1080p', size: '2.4 GB', label: (title || 'Movie') + ' 1080p FHD Dual Audio [Direct Ultra HD]', url: '/api/download-file?title=' + encodeURIComponent(title || 'Movie') + '&id=' + encodeURIComponent(tmdbId || '') + '&quality=1080p&type=movie&download=1', isDotmovies: true },
          { quality: '720p', size: '1.1 GB', label: (title || 'Movie') + ' 720p HD Dual Audio [Direct Ultra HD]', url: '/api/download-file?title=' + encodeURIComponent(title || 'Movie') + '&id=' + encodeURIComponent(tmdbId || '') + '&quality=720p&type=movie&download=1', isDotmovies: true },
          { quality: '480p', size: '520 MB', label: (title || 'Movie') + ' 480p SD Dual Audio [Direct Ultra HD]', url: '/api/download-file?title=' + encodeURIComponent(title || 'Movie') + '&id=' + encodeURIComponent(tmdbId || '') + '&quality=480p&type=movie&download=1', isDotmovies: true }
        ];
      }
    }

    var hasSeriesStructure = isTv || links.some(function(l) { return l.season || l.episode; });
    var linksContent = '';

    if (hasSeriesStructure) {
      var seasonMap = {};
      var batchMap = {};
      links.forEach(function(l) {
        var sNum = Number(l.season) || 1;
        var isBatchLink = Boolean(l.isBatch || l.episode === null || typeof l.episode === 'undefined');
        if (isBatchLink) {
          if (!batchMap[sNum]) batchMap[sNum] = [];
          batchMap[sNum].push(l);
        } else {
          var eNum = Number(l.episode) || 1;
          if (!seasonMap[sNum]) seasonMap[sNum] = {};
          if (!seasonMap[sNum][eNum]) seasonMap[sNum][eNum] = [];
          seasonMap[sNum][eNum].push(l);
        }
      });

      var allSeasonKeys = Object.keys(seasonMap).concat(Object.keys(batchMap));
      var seasons = Array.from(new Set(allSeasonKeys.map(Number))).sort(function(a, b) { return a - b; });
      if (!seasons.length) seasons = [1];

      linksContent = '<div class="dl-accordion">' +
        seasons.map(function(sNum, sIdx) {
          var epMap = seasonMap[sNum] || {};
          var epNums = Object.keys(epMap).map(Number).sort(function(a, b) { return a - b; });
          var batches = batchMap[sNum] || [];
          var isOpen = sIdx === 0 ? ' is-open' : '';

          var batchHtml = '';
          if (batches.length) {
            var batchPills = batches.map(function(link) {
              var q = String(link.quality || 'Full Season Zip').toUpperCase();
              var rawUrl = link.url || '#';
              return '<a href="' + rawUrl + '" data-fast-download="' + encodeURIComponent(rawUrl) + '" data-title="' + escapeHtml(title) + ' Season ' + sNum + ' Full Pack" data-tmdbid="' + escapeHtml(tmdbId || '') + '" data-se="' + sNum + '" data-quality="' + escapeHtml(q) + '" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md">' +
                '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>' +
                '<span>' + escapeHtml(q) + '</span>' +
                (link.size ? '<span class="text-black/70 text-[10px]">(' + escapeHtml(link.size) + ')</span>' : '') +
              '</a>';
            }).join('');

            batchHtml =
              '<div class="p-3.5 rounded-xl bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-black/60 border border-amber-500/30 mb-3 shadow-lg">' +
                '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
                  '<div class="flex items-center gap-2.5">' +
                    '<div class="w-8 h-8 rounded-lg bg-amber-500/25 text-amber-400 border border-amber-500/40 flex items-center justify-center shrink-0">' +
                      '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>' +
                    '</div>' +
                    '<div>' +
                      '<div class="text-xs sm:text-sm font-bold text-white flex items-center gap-2">' +
                        '<span>Season ' + sNum + ' Complete Direct Ultra HD Zip</span>' +
                        '<span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-black uppercase tracking-wider">ALL EPISODES</span>' +
                      '</div>' +
                      '<div class="text-[11px] text-white/60">One-click high-speed direct download for entire Season ' + sNum + '</div>' +
                    '</div>' +
                  '</div>' +
                  '<div class="flex flex-wrap items-center gap-2 shrink-0">' +
                    batchPills +
                  '</div>' +
                '</div>' +
              '</div>';
          }

          var epRowsHtml = epNums.map(function(eNum) {
            var epLinks = epMap[eNum] || [];
            var epQualityPills = epLinks.map(function(link) {
              var q = String(link.quality || 'HD').toUpperCase();
              var rawUrl = link.url || '#';
              var cleanUrl = (window.getFastCloudDownloadHref && window.getFastCloudDownloadHref(rawUrl, { title: title, tmdbId: tmdbId, se: sNum, ep: eNum, quality: q })) || rawUrl;
              return '<a href="' + cleanUrl + '" data-fast-download="' + encodeURIComponent(rawUrl) + '" data-title="' + escapeHtml(title) + '" data-tmdbid="' + escapeHtml(tmdbId || '') + '" data-se="' + sNum + '" data-ep="' + eNum + '" data-quality="' + escapeHtml(q) + '" class="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500 hover:text-black active:scale-95 text-amber-300 font-bold text-xs flex items-center gap-1 transition cursor-pointer border border-amber-500/30">' +
                '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>' +
                '<span>' + escapeHtml(q) + '</span>' +
                (link.size ? '<span class="text-white/60 text-[10px]">(' + escapeHtml(link.size) + ')</span>' : '') +
              '</a>';
            }).join('');

            return '<div id="dl-dot-ep-row-' + sNum + '-' + eNum + '" class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-amber-500/[0.03] border border-amber-500/10 hover:bg-amber-500/[0.06] transition">' +
              '<div class="flex items-center gap-2">' +
                '<span class="w-8 text-center text-xs font-bold text-amber-400 bg-amber-500/10 rounded py-0.5 border border-amber-500/20">E' + eNum + '</span>' +
                '<span class="text-xs font-semibold text-white/90">Episode ' + eNum + '</span>' +
              '</div>' +
              '<div class="flex flex-wrap items-center gap-1.5">' +
                epQualityPills +
              '</div>' +
            '</div>';
          }).join('');

          return '<div class="dl-accordion-item' + isOpen + '" data-accordion-item>' +
            '<button type="button" class="dl-accordion-header" data-accordion-toggle data-season="' + sNum + '">' +
              '<span class="flex items-center gap-2">' +
                '<svg class="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>' +
                'Season ' + sNum + ' <span class="text-white/40 text-xs font-normal">(' + epNums.length + ' Episodes + Full Season Pack)</span>' +
              '</span>' +
              '<svg class="dl-accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>' +
            '</button>' +
            '<div class="dl-accordion-body space-y-2">' +
              batchHtml +
              epRowsHtml +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>';
    } else {
      var qualWeight = function(q) {
        q = String(q || '').toUpperCase();
        if (q.includes('4K') || q.includes('2160')) return 4;
        if (q.includes('1440')) return 3;
        if (q.includes('1080')) return 2;
        if (q.includes('720')) return 1;
        return 0;
      };

      var sortedLinks = links.slice().sort(function(a, b) {
        return qualWeight(b.quality) - qualWeight(a.quality);
      });

      linksContent = sortedLinks.map(function(link) {
        var rawQual = String(link.quality || 'HD').toUpperCase();
        var sizeText = link.size || (rawQual.includes('4K') ? '4.8 GB' : rawQual.includes('1080') ? '2.4 GB' : rawQual.includes('720') ? '1.1 GB' : '550 MB');
        var audioText = (link.audio || 'Hindi Multi-Audio [Direct Fast Cloud]').replace(/dotmovies/gi, 'Direct').replace(/nexdrive/gi, 'Ultra HD');
        var rawUrl = link.url || '#';
        var cleanUrl = (window.getFastCloudDownloadHref && window.getFastCloudDownloadHref(rawUrl, { title: title, tmdbId: tmdbId, quality: rawQual })) || rawUrl;
        var rawLabel = (link.label || link.title || title).replace(/dotmovies/gi, 'Netflix4U').replace(/dotmobiz/gi, 'Direct').replace(/nexdrive/gi, 'Ultra HD');

        return '<div class="dl-card dl-dotmovies-card">' +
          '<div class="flex items-center gap-3 min-w-0">' +
            '<span class="dl-quality-badge dl-dotmovies-badge">' + escapeHtml(rawQual) + '</span>' +
            '<div class="min-w-0">' +
              '<div class="text-xs sm:text-sm font-bold text-white/95 truncate">' + escapeHtml(rawLabel) + '</div>' +
              '<div class="flex items-center gap-2 text-[11px] text-white/50 mt-0.5">' +
                '<span class="font-bold text-amber-400">' + escapeHtml(sizeText) + '</span>' +
                '<span>•</span>' +
                '<span class="truncate text-white/70">' + escapeHtml(audioText) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="shrink-0">' +
            '<a href="' + cleanUrl + '" data-fast-download="' + encodeURIComponent(rawUrl) + '" data-title="' + escapeHtml(title) + '" data-tmdbid="' + escapeHtml(tmdbId || '') + '" data-quality="' + escapeHtml(rawQual) + '" class="dl-btn dl-dotmovies-btn cursor-pointer">' +
              '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>' +
              '<span>Download (' + escapeHtml(rawQual) + ')</span>' +
            '</a>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    return '<section id="dotmovies-download-section" class="dl-section dl-dotmovies-section mb-6">' +
      headerHtml +
      '<div id="modal-dotmovies-links" class="space-y-2.5">' +
        linksContent +
      '</div>' +
    '</section>';
  }

  function renderEpisodeList(episodes, tmdbId, seasonNum, fallbackBackdrop, downloadLinks, parentTitle, parentYear, parentImdbId) {
    if (!episodes || !episodes.length) {
      return '<div class="text-white/40 text-sm p-4 text-center">No episodes available.</div>';
    }

    var cleanSeriesTmdb = (typeof Netflix4uPlayerResolver !== 'undefined' && Netflix4uPlayerResolver.cleanTmdbId)
      ? (Netflix4uPlayerResolver.cleanTmdbId(tmdbId) || tmdbId)
      : tmdbId;

    var safeFallback = unwrapImageUrl(fallbackBackdrop || '');

    return episodes.map(function(ep) {
      var rawStill = ep.still_path
        ? (ep.still_path.indexOf('http') === 0 ? ep.still_path : ('https://image.tmdb.org/t/p/w300' + ep.still_path))
        : (fallbackBackdrop || '');
      var still = unwrapImageUrl(rawStill, 300);
      var epNum = ep.episode_number || 1;
      var epTitle = ep.name || ('Episode ' + epNum);
      var duration = ep.runtime ? ep.runtime + 'm' : '45m';
      var overview = ep.overview ? ep.overview.slice(0, 140) + '...' : 'Play episode ' + epNum + ' of Season ' + seasonNum + '.';
      var fullTitle = (parentTitle ? (parentTitle + ' - ') : '') + epTitle;

      return '<div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition group">' +
        '<div class="flex items-center gap-3 w-full sm:w-auto">' +
          '<span class="text-sm font-bold text-white/40 w-6 text-center">' + epNum + '</span>' +
          '<div class="relative w-28 sm:w-36 aspect-video rounded-lg overflow-hidden bg-white/5 shrink-0">' +
            (still ? '<img src="' + still + '" alt="' + escapeHtml(epTitle) + '" class="w-full h-full object-cover" loading="lazy" onerror="this.onerror=null;' + (safeFallback ? 'this.src=\'' + escapeHtml(safeFallback) + '\';' : 'this.style.display=\'none\';') + '" />' : (safeFallback ? '<img src="' + safeFallback + '" alt="' + escapeHtml(epTitle) + '" class="w-full h-full object-cover" />' : '')) +
            '<div class="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">' +
              '<button type="button" data-modal="watch" data-tmdbid="' + cleanSeriesTmdb + '" data-type="tv" data-se="' + seasonNum + '" data-ep="' + epNum + '" data-title="' + escapeHtml(fullTitle) + '" data-year="' + (parentYear || '') + '" data-imdbid="' + (parentImdbId || '') + '" data-poster="' + escapeHtml(still || safeFallback || '') + '" data-backdrop="' + escapeHtml(still || safeFallback || '') + '" class="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg transform active:scale-95 cursor-pointer">' +
                '<svg class="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div class="sm:hidden flex-1 min-w-0">' +
            '<div class="text-xs font-bold text-white truncate">' + escapeHtml(epTitle) + '</div>' +
            '<div class="text-[10px] text-white/50">' + duration + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="flex-1 min-w-0">' +
          '<div class="hidden sm:flex items-center justify-between gap-2 mb-1">' +
            '<h4 class="text-sm font-bold text-white truncate">' + escapeHtml(epTitle) + '</h4>' +
            '<span class="text-xs text-white/50 shrink-0">' + duration + '</span>' +
          '</div>' +
          '<p class="text-xs text-white/60 line-clamp-2 leading-relaxed">' + escapeHtml(overview) + '</p>' +
        '</div>' +
        '<div class="flex items-center gap-2 self-end sm:self-center shrink-0">' +
          '<button type="button" data-modal="watch" data-tmdbid="' + cleanSeriesTmdb + '" data-type="tv" data-se="' + seasonNum + '" data-ep="' + epNum + '" data-title="' + escapeHtml(fullTitle) + '" data-year="' + (parentYear || '') + '" data-imdbid="' + (parentImdbId || '') + '" data-poster="' + escapeHtml(still || safeFallback || '') + '" data-backdrop="' + escapeHtml(still || safeFallback || '') + '" class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer">' +
            '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
            '<span>Play</span>' +
          '</button>' +
          '<button type="button" data-dl-se="' + seasonNum + '" data-dl-ep="' + epNum + '" class="ep-download-trigger px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer" title="Download Season ' + seasonNum + ' Episode ' + epNum + '">' +
            '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>' +
            '<span>Download</span>' +
          '</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function closeTitleModal() {
    if (!titleModal) return;
    titleModal.setAttribute('aria-hidden', 'true');
    historyStack = [];
    titleModal.classList.remove('nm-modal-in');
    if (location.hash && (location.hash.startsWith('#title=') || location.hash.startsWith('#w='))) {
      try {
        history.replaceState(null, '', location.pathname + location.search);
      } catch(e) {}
    }
    setTimeout(function() {
      titleModal.classList.add('hidden');
      titleModal.classList.remove('flex');
      titleModalBody.innerHTML = '';
      if (titleModalHeaderTitle) titleModalHeaderTitle.textContent = '';
      unlockBodyScroll();
      if (window.__renderContinueWatchingRail) {
        window.__renderContinueWatchingRail();
      }
    }, 280);
  }

  function goBackTitleModal() {
    historyStack.pop();
    var prev = historyStack[historyStack.length - 1];
    if (!prev) {
      closeTitleModal();
      return;
    }
    historyStack.pop();
    openTitleModal(prev.tmdbId, prev.type);
  }

  // ─── WATCH MODAL (Net27 Multi-Server Streaming Player UI with Full Vidsrc.win Suite) ───
  var SERVERS_CONFIG = [
    // ─── FEATURED & PRIMARY PLAYERS ───
    { id: 'vidsrc_sbs', name: 'VidSrc Global (Primary Direct TMDB)', shortName: 'VidSrc • Global', tag: 'Direct TMDB', tagClass: 'tag-peachify', category: 'featured', isFeatured: true, desc: 'VidSrc Global Direct Stream • Original English Audio • Worldwide Unblocked CDN' },
    { id: 'braflix', name: 'Braflix (Auto-Next & Ultra HD)', shortName: 'Braflix • AutoNext', tag: 'AutoNext HD', tagClass: 'tag-multi', category: 'featured', isFeatured: true, desc: 'Braflix High-Speed Player • Auto-Next Episodes & Multi-Source Cloud' },
    { id: 'videasy', name: '4K Cinema (Videasy Ultra)', shortName: '4K • Videasy', tag: '4K ULTRA', tagClass: 'tag-fast', category: 'featured', isFeatured: true, desc: 'Videasy 4K Ultra HD Engine • Direct TMDB Player with Responsive Controls' },
    { id: 's3', name: 'VidLink Pro (Multi-Audio Global)', shortName: 'VidLink • Global', tag: 'Multi-Lang', tagClass: 'tag-multi', category: 'featured', isFeatured: true, desc: 'VidLink Pro Ultra-Fast Player with Multi-Language Audio Selection' },
    { id: 'peachify', name: 'Peachify (Hindi Dub • Multi-Audio HD)', shortName: 'Peachify • Hindi', tag: 'Hindi Dub HD', tagClass: 'tag-peachify', category: 'featured', isFeatured: true, desc: 'Peachify Pro Ad-Free Player • Synchronized Multi-Audio Dubbing (Hindi/Tamil/Telugu/English)' },
    { id: 's1', name: 'Fast Cloud (Direct CDN Multi-Audio)', shortName: 'Fast Cloud • App', tag: 'Direct CDN', tagClass: 'tag-fast', category: 'featured', isFeatured: true, desc: 'Direct Fast Cloud Media Engine with MX Player / VLC App Launch' },

    // ─── VIDSRC.WIN REVERSE-ENGINEERED HIGH-SPEED SERVERS ───
    { id: 'wootly', name: 'Wootly (VidSrc Party)', shortName: 'Wootly • Party', tag: 'Party CDN', tagClass: 'tag-multi', category: 'vidsrc', isFeatured: false, desc: 'VidSrc Party Direct Stream Engine' },
    { id: 'vidbolt', name: 'Bolt (VidBolt High-Speed)', shortName: 'Bolt • HighSpeed', tag: 'Fast CDN', tagClass: 'tag-fast', category: 'vidsrc', isFeatured: false, desc: 'VidBolt Cloud Streaming Cluster' },
    { id: 'vidfast', name: 'Nero (VidFast Pro)', shortName: 'Nero • VidFast', tag: 'Ultra Fast', tagClass: 'tag-fast', category: 'vidsrc', isFeatured: false, desc: 'VidFast High-Speed Direct Cloud Stream' },
    { id: 'vidflix', name: 'Flixify (VidFlix Club)', shortName: 'Flixify • Club', tag: 'HD Cloud', tagClass: 'tag-multi', category: 'vidsrc', isFeatured: false, desc: 'VidFlix High-Definition Streaming Mirror' },
    { id: 'vidsrc_su', name: 'Astra (VidSrc Astra Direct)', shortName: 'Astra • VidSrc', tag: 'Astra CDN', tagClass: 'tag-peachify', category: 'vidsrc', isFeatured: false, desc: 'VidSrc Astra Cloud Embed Engine' },
    { id: 'wplay', name: 'Vid (WPlay Media)', shortName: 'Vid • WPlay', tag: 'WPlay', tagClass: 'tag-multi', category: 'vidsrc', isFeatured: false, desc: 'WPlay Cloud Player Embed' },
    { id: 'xpass', name: 'Mist (XPass Stream)', shortName: 'Mist • XPass', tag: 'XPass', tagClass: 'tag-multi', category: 'vidsrc', isFeatured: false, desc: 'XPass Media Direct Player' },
    { id: 'peach', name: 'Peach (Peachify Mirror)', shortName: 'Peach • Mirror', tag: 'Peach Mirror', tagClass: 'tag-peachify', category: 'vidsrc', isFeatured: false, desc: 'Peachify Top High-Speed Mirror' },
    { id: 'vidnest', name: 'Nest (VidNest Fun)', shortName: 'Nest • VidNest', tag: 'VidNest', tagClass: 'tag-multi', category: 'vidsrc', isFeatured: false, desc: 'VidNest Direct Stream Engine' },
    { id: 'vidcore', name: 'Pass (VidCore Net)', shortName: 'Pass • VidCore', tag: 'VidCore', tagClass: 'tag-multi', category: 'vidsrc', isFeatured: false, desc: 'VidCore Cloud Embed Player' },
    { id: 'vaplayer', name: 'Mistify (VAPlayer RU)', shortName: 'Mistify • VAP', tag: 'VAPlayer', tagClass: 'tag-multi', category: 'vidsrc', isFeatured: false, desc: 'VAPlayer Direct Russian & Global CDN' },
    { id: 'zxcstream', name: 'Simplify (ZXCStream)', shortName: 'Simplify • ZXC', tag: 'ZXCStream', tagClass: 'tag-fast', category: 'vidsrc', isFeatured: false, desc: 'ZXCStream Player with Custom Subtitles' },
    { id: 'embed_cc', name: 'Asia (1Embed Asian CDN)', shortName: 'Asia • 1Embed', tag: 'Asia CDN', tagClass: 'tag-multi', category: 'vidsrc', isFeatured: false, desc: '1Embed Fast Asia-Pacific Cloud Stream' },
    { id: 'cinesrc', name: 'Cine (CineSrc ST)', shortName: 'Cine • CineSrc', tag: 'CineSrc', tagClass: 'tag-multi', category: 'vidsrc', isFeatured: false, desc: 'CineSrc Media Embed Player' },
    { id: 'vidlux', name: 'Vidmux (VidLux Site)', shortName: 'Vidmux • VidLux', tag: 'VidLux', tagClass: 'tag-multi', category: 'vidsrc', isFeatured: false, desc: 'VidLux High-Speed Stream' },
    { id: 'vsembed', name: 'Diablo (VSEmbed RU)', shortName: 'Diablo • VSE', tag: 'VSEmbed', tagClass: 'tag-multi', category: 'vidsrc', isFeatured: false, desc: 'VSEmbed Cloud Stream' },
    { id: 'vidify', name: 'Vidind (Vidify TOP)', shortName: 'Vidind • Vidify', tag: 'Vidify', tagClass: 'tag-multi', category: 'vidsrc', isFeatured: false, desc: 'Vidify Cloud Player' },
    { id: 'mapple', name: '4KHD (Mapple RIP)', shortName: '4KHD • Mapple', tag: '4KHD RIP', tagClass: 'tag-fast', category: 'vidsrc', isFeatured: false, desc: 'Mapple 4K Streaming Engine' },
    { id: 'vidsrc2', name: 'Vidsrc 2 (VidSrc RU Mirror)', shortName: 'VidSrc 2 • RU', tag: 'VidSrc 2', tagClass: 'tag-peachify', category: 'vidsrc', isFeatured: false, desc: 'VidSrc 2 Alternate Global Cluster' },
    { id: 'twoembed', name: '2embed (2Embed Stream)', shortName: '2embed • Global', tag: '2Embed', tagClass: 'tag-multi', category: 'vidsrc', isFeatured: false, desc: '2Embed Global TMDB Stream Engine' },
    { id: 'moviesapi', name: 'Club (MoviesAPI TO)', shortName: 'Club • MoviesAPI', tag: 'MoviesAPI', tagClass: 'tag-multi', category: 'vidsrc', isFeatured: false, desc: 'MoviesAPI Club Direct Player' },
    { id: 'onemovies', name: 'Sage (111Movies COM)', shortName: 'Sage • 111Movies', tag: '111Movies', tagClass: 'tag-multi', category: 'vidsrc', isFeatured: false, desc: '111Movies Stream Server' },
    { id: 'vidrock', name: 'Azute (VidRock RU)', shortName: 'Azute • VidRock', tag: 'VidRock', tagClass: 'tag-multi', category: 'vidsrc', isFeatured: false, desc: 'VidRock Cloud Stream' },
    { id: 'allmovieland', name: 'AllMovieLand (Ultra HD Fast)', shortName: 'AllMovieLand', tag: 'Ultra HD', tagClass: 'tag-peachify', category: 'vidsrc', isFeatured: false, desc: 'AllMovieLand Indian & Global Stream Player' },

    // ─── REGIONAL & MULTI-AUDIO DUBBED ───
    { id: 'viduki', name: 'Hindi Dub (Viduki NET)', shortName: 'Hindi • Viduki', tag: 'Hindi Dub', tagClass: 'tag-peachify', category: 'regional', isFeatured: false, desc: 'Viduki Hindi-first Audio Stream Engine' },
    { id: 'vixsrc', name: 'Italian (VixSrc TO)', shortName: 'Italian • VixSrc', tag: 'Italian Dub', tagClass: 'tag-multi', category: 'regional', isFeatured: false, desc: 'VixSrc Stream with Italian Audio Track' },
    { id: 'frembed', name: 'French (FrEmbed ASIA)', shortName: 'French • FrEmbed', tag: 'French Dub', tagClass: 'tag-multi', category: 'regional', isFeatured: false, desc: 'FrEmbed with French Dubbing' },
    { id: 'superflix', name: 'Portuguese (Superflix BEER)', shortName: 'Portuguese • Super', tag: 'Portuguese', tagClass: 'tag-multi', category: 'regional', isFeatured: false, desc: 'Superflix with Portuguese Dubbing' }
  ];

  var currentWatchLang = 'hi';
  var AUDIO_LANGS_CONFIG = [
    { id: 'hi', label: 'Hindi', code: 'hi', tag: 'ORG DUB' },
    { id: 'en', label: 'English', code: 'en', tag: 'ORIGINAL' },
    { id: 'ta', label: 'Tamil', code: 'ta', tag: 'DUB' },
    { id: 'te', label: 'Telugu', code: 'te', tag: 'DUB' },
    { id: 'multi', label: 'Multi Audio', code: '', tag: '100% ALL' }
  ];

  // Auto-failover & orientation state
  var isAutoSwitchEnabled = true;
  var autoSwitchTimer = null;
  var autoSwitchIndex = 0;
  var isPlaybackConfirmed = false;
  var autoSwitchOrder = ['vidsrc_sbs', 'braflix', 'videasy', 's3', 'peachify', 's1', 'wootly', 'vidbolt', 'vidfast', 'allmovieland'];
  var currentAutoSwitchToken = 0;
  var activeProbeController = null;
  var watchTopBarHideTimeout = null;

  var watchStreamStatusText = document.getElementById('watch-stream-status-text');
  var watchStreamSubstatusText = document.getElementById('watch-stream-substatus-text');
  var watchServerIndicator = document.getElementById('watch-server-indicator');
  var watchAutoswitchToggleBtn = document.getElementById('watch-autoswitch-toggle-btn');
  var watchRotateBtn = document.getElementById('watch-rotate-btn');
  var watchAudioToggle = document.getElementById('watch-audio-toggle');
  var watchAudioMenu = document.getElementById('watch-audio-menu');
  var watchCurrentAudioLabel = document.getElementById('watch-current-audio-label');

  // TV Episode Navigation Controls (Desktop + Mobile Floating Bar)
  var watchEpNav = document.getElementById('watch-ep-nav');
  var watchPrevEpBtn = document.getElementById('watch-prev-ep-btn');
  var watchNextEpBtn = document.getElementById('watch-next-ep-btn');
  var watchEpIndicator = document.getElementById('watch-ep-indicator');

  var watchMobileEpBar = document.getElementById('watch-mobile-ep-bar');
  var watchMobilePrevEp = document.getElementById('watch-mobile-prev-ep');
  var watchMobileNextEp = document.getElementById('watch-mobile-next-ep');
  var watchMobileEpIndicator = document.getElementById('watch-mobile-ep-indicator');

  function updateEpisodeNavUi() {
    if (!activeWatchParams) {
      if (watchEpNav) watchEpNav.classList.add('hidden');
      if (watchMobileEpBar) watchMobileEpBar.classList.add('hidden');
      return;
    }
    var isTv = Boolean(activeWatchParams.isTv || activeWatchParams.type === 'tv' || activeWatchParams.type === 'series');
    if (!isTv) {
      if (watchEpNav) watchEpNav.classList.add('hidden');
      if (watchMobileEpBar) watchMobileEpBar.classList.add('hidden');
      return;
    }

    if (watchEpNav) watchEpNav.classList.remove('hidden');
    if (watchMobileEpBar) watchMobileEpBar.classList.remove('hidden');

    var curEp = parseInt(activeWatchParams.episode || 1, 10) || 1;
    var curSe = parseInt(activeWatchParams.season || 1, 10) || 1;
    var epLabel = 'S' + curSe + ':E' + curEp;

    if (watchEpIndicator) watchEpIndicator.textContent = epLabel;
    if (watchMobileEpIndicator) watchMobileEpIndicator.textContent = epLabel;
    if (watchMetaType) watchMetaType.textContent = 'S' + curSe + ' E' + curEp;

    if (watchPrevEpBtn) watchPrevEpBtn.disabled = (curEp <= 1);
    if (watchMobilePrevEp) watchMobilePrevEp.disabled = (curEp <= 1);
  }

  function navigateToEpisode(targetEp) {
    if (!activeWatchParams || targetEp < 1) return;
    activeWatchParams.episode = targetEp;
    updateEpisodeNavUi();

    // Rebuild server URLs for target episode across ALL 34 servers via Universal Resolver
    if (window.Netflix4uPlayerResolver) {
      SERVERS_CONFIG.forEach(function(s) {
        activeWatchServers[s.id] = window.Netflix4uPlayerResolver.resolvePlayerUrl(activeWatchParams, s.id, { lang: currentWatchLang });
      });
    } else {
      var sTid = String(activeWatchParams.tmdbId || '').replace(/^(?:dotmobiz|tmdb(?:-movie|-series|-tv)?)-/, '');
      activeWatchServers.vidsrc_sbs = 'https://vidsrc.pm/embed/tv/' + sTid + '/' + (activeWatchParams.season || 1) + '/' + targetEp;
      activeWatchServers.peachify = buildPeachifyUrl(activeWatchParams, currentWatchLang);
      activeWatchServers.allmovieland = buildAllMovieLandUrl(activeWatchParams);
      activeWatchServers.s3 = buildVidlinkMultiAudioUrl(activeWatchParams, currentWatchLang);
    }
    activeWatchServers.s1 = buildFastCloudStreamUrl(activeWatchParams, currentWatchLang);

    // Reload active server iframe cleanly (zero stale artifacts)
    var srv = currentWatchServer || 'vidsrc_sbs';
    var targetUrl = activeWatchServers[srv] || activeWatchServers.vidsrc_sbs || activeWatchServers.peachify || activeWatchServers.s3;
    if (watchModalIframe && targetUrl) {
      watchModalIframe.src = 'about:blank';
      watchModalIframe.title = (activeWatchParams.title || 'Series') + ' Season ' + (activeWatchParams.season || 1) + ' Episode ' + targetEp + ' player';
      setTimeout(function() {
        if (watchModalIframe) watchModalIframe.src = targetUrl;
      }, 30);
    }

    var se = activeWatchParams.season || 1;
    setWatchStatus('Episode ' + targetEp + ' Loaded', 'Playing Season ' + se + ' Episode ' + targetEp);
    if (window.__showToast) {
      window.__showToast('Playing Episode ' + targetEp, '⏭️');
    }

    // Update history URL hash
    try {
      var tmdbId = activeWatchParams.tmdbId;
      var newHash = '#w=' + tmdbId + '-tv-' + se + '-' + targetEp;
      history.replaceState({ modal: 'watch', tmdbId: tmdbId, type: 'tv', se: se, ep: targetEp }, '', newHash);
    } catch(e) {}
  }

  if (watchPrevEpBtn) {
    watchPrevEpBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!activeWatchParams) return;
      var curEp = parseInt(activeWatchParams.episode || 1, 10) || 1;
      if (curEp > 1) {
        navigateToEpisode(curEp - 1);
      }
    });
  }

  if (watchNextEpBtn) {
    watchNextEpBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!activeWatchParams) return;
      var curEp = parseInt(activeWatchParams.episode || 1, 10) || 1;
      navigateToEpisode(curEp + 1);
    });
  }

  if (watchMobilePrevEp) {
    watchMobilePrevEp.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!activeWatchParams) return;
      var curEp = parseInt(activeWatchParams.episode || 1, 10) || 1;
      if (curEp > 1) {
        navigateToEpisode(curEp - 1);
      }
    });
  }

  if (watchMobileNextEp) {
    watchMobileNextEp.addEventListener('click', function(e) {
      e.stopPropagation();
      if (!activeWatchParams) return;
      var curEp = parseInt(activeWatchParams.episode || 1, 10) || 1;
      navigateToEpisode(curEp + 1);
    });
  }

  function setWatchStatus(status, substatus) {
    if (watchStreamStatusText && status) watchStreamStatusText.textContent = status;
    if (watchStreamSubstatusText && substatus) watchStreamSubstatusText.textContent = substatus;
  }

  function updateAutoSwitchToggleUi(enabled) {
    isAutoSwitchEnabled = enabled;
    if (!watchAutoswitchToggleBtn) return;
    if (enabled) {
      watchAutoswitchToggleBtn.textContent = 'AUTO';
      watchAutoswitchToggleBtn.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition cursor-pointer';
    } else {
      watchAutoswitchToggleBtn.textContent = 'MANUAL';
      watchAutoswitchToggleBtn.className = 'px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white/70 border border-white/20 hover:bg-white/20 transition cursor-pointer';
    }
  }

  if (watchAutoswitchToggleBtn) {
    watchAutoswitchToggleBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      isAutoSwitchEnabled = !isAutoSwitchEnabled;
      updateAutoSwitchToggleUi(isAutoSwitchEnabled);
      if (isAutoSwitchEnabled) {
        isPlaybackConfirmed = false;
        startAutoSwitchSequence(0);
      } else {
        isPlaybackConfirmed = true;
        if (autoSwitchTimer) {
          clearTimeout(autoSwitchTimer);
          autoSwitchTimer = null;
        }
      }
    });
  }

  function resetWatchTopBarTimer() {
    if (watchTopBar) watchTopBar.classList.remove('watch-bar-hidden');
    if (watchMobileEpBar) watchMobileEpBar.classList.remove('watch-bar-hidden');
    clearTimeout(watchTopBarHideTimeout);
    
    var isServerOpen = watchServerMenu && !watchServerMenu.classList.contains('hidden');
    var isAudioOpen = watchAudioMenu && !watchAudioMenu.classList.contains('hidden');
    var isExtOpen = watchExtMenu && !watchExtMenu.classList.contains('hidden');
    var isFailoverOpen = document.getElementById('watch-failover-card') && !document.getElementById('watch-failover-card').classList.contains('hidden');
    if (isServerOpen || isAudioOpen || isExtOpen || isFailoverOpen) return;

    watchTopBarHideTimeout = setTimeout(function() {
      if (watchModal && !watchModal.classList.contains('hidden')) {
        if (watchTopBar) watchTopBar.classList.add('watch-bar-hidden');
        if (watchMobileEpBar) watchMobileEpBar.classList.add('watch-bar-hidden');
      }
    }, 3000);
  }

  // In-Player Failover Card Handlers (When video file is not on server)
  function showWatchFailoverCard(failedServerId, reason) {
    var card = document.getElementById('watch-failover-card');
    if (!card) return;
    var cfg = SERVERS_CONFIG.find(function(s) { return s.id === failedServerId; }) || SERVERS_CONFIG[0];
    var titleEl = document.getElementById('failover-card-title');
    var descEl = document.getElementById('failover-card-desc');
    var actionsEl = document.getElementById('failover-card-actions');

    if (titleEl) titleEl.textContent = 'Stream Unavailable on ' + (cfg.shortName || cfg.name);
    if (descEl) descEl.textContent = 'This video file was not found or failed on ' + (cfg.shortName || cfg.name) + '. Choose another working server to continue watching:';

    if (actionsEl) {
      var otherServers = SERVERS_CONFIG.filter(function(s) { return s.id !== failedServerId; });
      actionsEl.innerHTML = otherServers.map(function(s) {
        var isRecommended = s.id === 's1';
        return '<button type="button" data-failover-server="' + s.id + '" class="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl ' + (isRecommended ? 'bg-red-600 hover:bg-red-500' : 'bg-white/10 hover:bg-white/20 border border-white/20') + ' text-white font-bold text-xs sm:text-sm transition cursor-pointer active:scale-95 shadow-lg">' +
          '<span>Play on ' + escapeHtml(s.shortName || s.name) + '</span>' +
          (isRecommended ? '<span class="px-1.5 py-0.5 rounded bg-white/20 text-[9px] font-black uppercase">BEST</span>' : '') +
        '</button>';
      }).join('');

      actionsEl.querySelectorAll('[data-failover-server]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var targetId = btn.dataset.failoverServer;
          card.classList.add('hidden');
          switchWatchServer(targetId, true);
        });
      });
    }

    card.classList.remove('hidden');
    resetWatchTopBarTimer();
  }

  function hideWatchFailoverCard() {
    var card = document.getElementById('watch-failover-card');
    if (card) card.classList.add('hidden');
  }

  // Choose Streaming Server Modal Handler (Bottom Sheet on Mobile, Centered on Desktop)
  function openServerPickerModal(tmdbId, type, season, episode, backdrop, title, year, imdbId, canonicalId, poster) {
    var pickerModal = document.getElementById('watch-server-picker-modal');
    if (!pickerModal) {
      openWatchModal(tmdbId, type, season, episode, backdrop, title, year, imdbId, canonicalId, poster, 'vidsrc_sbs');
      return;
    }

    var pickerTitle = document.getElementById('picker-modal-title');
    if (pickerTitle) {
      pickerTitle.textContent = (title || 'Stream') + (type === 'tv' || type === 'series' ? ' (S' + (season || 1) + ' E' + (episode || 1) + ')' : '');
    }

    var pickerList = document.getElementById('picker-server-list');
    if (pickerList) {
      var categories = [
        { id: 'featured', label: '🌟 Featured & Primary' },
        { id: 'vidsrc', label: '⚡ VidSrc.win High-Speed CDN Mirrors' },
        { id: 'regional', label: '🎧 Multi-Audio & Dubbed Regional' }
      ];

      function renderPickerServers(filterCat) {
        var html = '';
        var activeCats = categories;
        if (filterCat && filterCat !== 'all') {
          activeCats = categories.filter(function(c) { return c.id === filterCat; });
        }

        activeCats.forEach(function(cat) {
          var groupServers = SERVERS_CONFIG.filter(function(s) { return s.category === cat.id; });
          if (!groupServers.length) return;

          html += '<div class="col-span-full mt-2 mb-0.5">' +
            '<div class="text-[11px] sm:text-xs font-black uppercase tracking-wider text-white/50 px-1">' + escapeHtml(cat.label) + ' (' + groupServers.length + ')</div>' +
          '</div>';

          html += groupServers.map(function(s) {
            var isCurrent = s.id === currentWatchServer;
            var badge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white/80 border border-white/10 shrink-0">' + escapeHtml(s.tag) + '</span>';

            return '<button type="button" data-select-server="' + s.id + '" class="picker-server-card' + (isCurrent ? ' is-active' : '') + '">' +
              '<div class="flex items-center gap-2.5 min-w-0">' +
                '<div class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center font-bold text-xs text-white shrink-0">' +
                  (isCurrent ? '▶' : '⚡') +
                '</div>' +
                '<div class="min-w-0">' +
                  '<div class="text-xs sm:text-sm font-bold text-white truncate flex items-center gap-1.5">' +
                    '<span>' + escapeHtml(s.name) + '</span>' +
                  '</div>' +
                  '<div class="text-[10px] sm:text-[11px] text-white/50 truncate">' + escapeHtml(s.desc || '') + '</div>' +
                '</div>' +
              '</div>' +
              '<div class="shrink-0 ml-2">' + badge + '</div>' +
            '</button>';
          }).join('');
        });

        pickerList.innerHTML = html;

        pickerList.querySelectorAll('[data-select-server]').forEach(function(card) {
          card.addEventListener('click', function(e) {
            e.stopPropagation();
            var serverId = card.dataset.selectServer;
            pickerModal.classList.add('hidden');
            pickerModal.setAttribute('aria-hidden', 'true');
            openWatchModal(tmdbId, type, season, episode, backdrop, title, year, imdbId, canonicalId, poster, serverId);
          });
        });
      }

      renderPickerServers('all');

      var pickerTabs = document.getElementById('picker-category-tabs');
      if (pickerTabs) {
        pickerTabs.querySelectorAll('[data-picker-filter]').forEach(function(tabBtn) {
          tabBtn.onclick = function(e) {
            e.stopPropagation();
            pickerTabs.querySelectorAll('[data-picker-filter]').forEach(function(tb) { tb.classList.remove('is-active'); });
            tabBtn.classList.add('is-active');
            var f = tabBtn.dataset.pickerFilter || 'all';
            renderPickerServers(f);
          };
        });
      }
    }

    pickerModal.classList.remove('hidden');
    pickerModal.setAttribute('aria-hidden', 'false');
  }

  var pickerCloseBtn = document.getElementById('watch-server-picker-close');
  if (pickerCloseBtn) {
    pickerCloseBtn.addEventListener('click', function() {
      var pickerModal = document.getElementById('watch-server-picker-modal');
      if (pickerModal) {
        pickerModal.classList.add('hidden');
        pickerModal.setAttribute('aria-hidden', 'true');
      }
    });
  }

  var pickerModalEl = document.getElementById('watch-server-picker-modal');
  if (pickerModalEl) {
    pickerModalEl.addEventListener('click', function(e) {
      if (e.target === pickerModalEl) {
        pickerModalEl.classList.add('hidden');
        pickerModalEl.setAttribute('aria-hidden', 'true');
      }
    });
  }

  if (watchModal) {
    ['mousemove', 'touchstart', 'click', 'keydown'].forEach(function(evtName) {
      watchModal.addEventListener(evtName, function() {
        resetWatchTopBarTimer();
      }, { passive: true });
    });
  }

  function togglePlayerFullscreenLandscape() {
    if (!document.fullscreenElement) {
      var targetEl = watchModal || document.documentElement;
      var req = targetEl.requestFullscreen || targetEl.webkitRequestFullscreen || targetEl.msRequestFullscreen;
      if (req) {
        req.call(targetEl).then(function() {
          if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(function() {});
          }
        }).catch(function() {});
      }
    } else {
      var exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (exit) {
        exit.call(document).catch(function() {});
      }
    }
    resetWatchTopBarTimer();
  }

  if (watchRotateBtn) {
    watchRotateBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      togglePlayerFullscreenLandscape();
    });
  }

  if (watchPortraitHintDismiss) {
    watchPortraitHintDismiss.addEventListener('click', function(e) {
      e.stopPropagation();
      try { sessionStorage.setItem('watch_portrait_hint_dismissed', '1'); } catch(e) {}
      if (watchPortraitHint) watchPortraitHint.classList.add('hidden');
    });
  }

  function checkOrientationHint() {
    if (!watchPortraitHint) return;
    var isDismissed = false;
    try { isDismissed = sessionStorage.getItem('watch_portrait_hint_dismissed') === '1'; } catch(e) {}
    if (isDismissed) {
      watchPortraitHint.classList.add('hidden');
      return;
    }
    var isPortrait = window.matchMedia && window.matchMedia('(max-width: 768px) and (orientation: portrait)').matches;
    if (isPortrait && watchModal && !watchModal.classList.contains('hidden')) {
      watchPortraitHint.classList.remove('hidden');
      setTimeout(function() {
        if (watchPortraitHint) watchPortraitHint.classList.add('hidden');
      }, 6000);
    } else {
      watchPortraitHint.classList.add('hidden');
    }
  }

  window.addEventListener('resize', checkOrientationHint, { passive: true });
  window.addEventListener('orientationchange', checkOrientationHint, { passive: true });

  function probeStream(url, cb) {
    if (!url) return cb(false, 404);
    if (url.startsWith('/api/')) {
      return cb(true, 200);
    }
    if (activeProbeController) {
      try { activeProbeController.abort(); } catch(e) {}
    }
    activeProbeController = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var signal = activeProbeController ? activeProbeController.signal : undefined;
    var timedOut = false;
    var timeoutId = setTimeout(function() {
      timedOut = true;
      if (activeProbeController) {
        try { activeProbeController.abort(); } catch(e) {}
      }
      cb(true, 200);
    }, 2400);

    fetch('/api/probe-stream?url=' + encodeURIComponent(url), { signal: signal })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (timedOut) return;
        clearTimeout(timeoutId);
        if (data && data.status === 404) {
          cb(false, 404);
        } else if (data && data.ok === false && (data.status === 403 || data.status === 500 || data.status === 502)) {
          cb(false, data.status);
        } else {
          cb(true, (data && data.status) || 200);
        }
      })
      .catch(function(err) {
        if (timedOut) return;
        clearTimeout(timeoutId);
        if (err && err.name === 'AbortError') return;
        cb(true, 200);
      });
  }

  function confirmPlaybackActive() {
    if (isPlaybackConfirmed) return;
    isPlaybackConfirmed = true;
    isAutoSwitchEnabled = false;
    updateAutoSwitchToggleUi(false);
    if (autoSwitchTimer) {
      clearTimeout(autoSwitchTimer);
      autoSwitchTimer = null;
    }
    var cfg = SERVERS_CONFIG.find(function(s) { return s.id === currentWatchServer; }) || SERVERS_CONFIG[0];
    setWatchStatus('Connected to ' + cfg.name, 'Playback stream running');
    setTimeout(function() {
      hideWatchBackdrop();
    }, 400);
    if (watchServerIndicator) {
      watchServerIndicator.className = 'w-2 h-2 rounded-full bg-emerald-400';
    }
    resetWatchTopBarTimer();
  }

  function startAutoSwitchSequence(index) {
    if (!isAutoSwitchEnabled) return;
    if (autoSwitchTimer) {
      clearTimeout(autoSwitchTimer);
      autoSwitchTimer = null;
    }
    
    if (index >= autoSwitchOrder.length) {
      var fallbackServer = autoSwitchOrder[0] || 's1';
      var fallbackCfg = SERVERS_CONFIG.find(function(s) { return s.id === fallbackServer; }) || SERVERS_CONFIG[0];
      setWatchStatus('Connected to ' + fallbackCfg.name, 'Manual server switching available');
      currentWatchServer = fallbackServer;
      updateActiveServerUi(fallbackServer);
      if (activeWatchServers && activeWatchServers[fallbackServer]) {
        watchModalIframe.src = activeWatchServers[fallbackServer];
      }
      confirmPlaybackActive();
      return;
    }

    autoSwitchIndex = index;
    var serverId = autoSwitchOrder[index];
    var cfg = SERVERS_CONFIG.find(function(s) { return s.id === serverId; }) || SERVERS_CONFIG[0];
    
    currentWatchServer = serverId;
    updateActiveServerUi(serverId);
    
    setWatchStatus('Connecting ' + cfg.name + '…', 'Scanning for 404 errors & verified stream');
    if (activeWatchParams && activeWatchParams.backdrop) {
      showWatchBackdrop(activeWatchParams.backdrop);
    }
    
    var serverUrl = (activeWatchServers && activeWatchServers[serverId]) || '';
    if (!serverUrl) {
      startAutoSwitchSequence(index + 1);
      return;
    }

    var seqToken = ++currentAutoSwitchToken;

    // Fast HTTP health probe before user ever sees an error screen
    probeStream(serverUrl, function(isHealthy, statusCode) {
      if (seqToken !== currentAutoSwitchToken) return;
      if (!isAutoSwitchEnabled || isPlaybackConfirmed) return;

      if (!isHealthy && statusCode === 404) {
        console.warn('[Netflix4U AutoSwitch] Server ' + serverId + ' returned 404 (File Not Found). Switching immediately.');
        setWatchStatus(cfg.name + ' returned 404 (File Not Found)', 'Auto-switching to next server…');
        if (autoSwitchTimer) clearTimeout(autoSwitchTimer);
        autoSwitchTimer = setTimeout(function() {
          if (seqToken === currentAutoSwitchToken && isAutoSwitchEnabled && !isPlaybackConfirmed) {
            startAutoSwitchSequence(index + 1);
          }
        }, 250);
        return;
      }

      // Load the iframe URL only when verified reachable
      watchModalIframe.src = serverUrl;
      setWatchStatus('Connected to ' + cfg.name, 'Stream verified • Playback ready');

      // Stop auto-switch immediately on the verified working player!
      // "jis player par content chal jaye us par ruk jao. Aur uspe woh content chala do."
      confirmPlaybackActive();
    });
  }

  // Cross-origin postMessage listener for HTML5 video player events
  window.addEventListener('message', function(event) {
    if (!watchModal || watchModal.classList.contains('hidden')) return;

    // Peachify Pro Outbound PostMessage Sync (API Reference)
    if (event.origin === 'https://peachify.pro') {
      var peachData = event.data;
      if (peachData && peachData.type === 'MEDIA_DATA') {
        try {
          localStorage.setItem('peachifyProgress', JSON.stringify(peachData.data));
        } catch(e) {}
      }
      if (peachData && peachData.type === 'PLAYER_EVENT') {
        var pInfo = peachData.data || {};
        var pEvent = (pInfo.event || '').toLowerCase();
        if (pEvent === 'play' || pEvent === 'playing' || pEvent === 'timeupdate') {
          confirmPlaybackActive();
        }
        if (pEvent === 'ended' && activeWatchParams && (activeWatchParams.isTv || activeWatchParams.type === 'tv' || activeWatchParams.type === 'series')) {
          var nextEp = (parseInt(activeWatchParams.episode || 1, 10) || 1) + 1;
          navigateToEpisode(nextEp);
        }
      }
      return;
    }

    var data = event.data;
    if (!data) return;
    
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch(e) {}
    }
    
    var isPlaying = false;
    var isError = false;

    function evaluateEventString(str) {
      if (!str || typeof str !== 'string') return;
      var s = str.toLowerCase();
      // Genuine playback confirmation events ONLY
      if (
        s === 'play' ||
        s === 'playing' ||
        s === 'playback_started' ||
        s === 'playbackstarted' ||
        s === 'mediaplay' ||
        s === 'videoplaying' ||
        s === 'playing_started' ||
        s.indexOf('timeupdate') !== -1 ||
        s.indexOf('video_playing') !== -1
      ) {
        isPlaying = true;
      }
      // Error and 404 / File Not Found events
      if (
        s.indexOf('error') !== -1 ||
        s.indexOf('not_found') !== -1 ||
        s.indexOf('notfound') !== -1 ||
        s.indexOf('404') !== -1 ||
        s.indexOf('fail') !== -1 ||
        s.indexOf('unavailable') !== -1 ||
        s.indexOf('empty_source') !== -1 ||
        s.indexOf('no_source') !== -1 ||
        s.indexOf('abort') !== -1
      ) {
        isError = true;
      }
    }
    
    if (typeof data === 'object' && data !== null) {
      evaluateEventString(data.event);
      evaluateEventString(data.type);
      evaluateEventString(data.status);
      evaluateEventString(data.action);
      evaluateEventString(data.msg);
      evaluateEventString(data.message);
      if (data.data) {
        if (typeof data.data === 'string') evaluateEventString(data.data);
        else if (typeof data.data === 'object') {
          evaluateEventString(data.data.event);
          evaluateEventString(data.data.type);
          evaluateEventString(data.data.status);
          evaluateEventString(data.data.msg);
          evaluateEventString(data.data.message);
        }
      }
    } else if (typeof data === 'string') {
      evaluateEventString(data);
    }
    
    if (isError) {
      console.warn('[Netflix4U AutoSwitch] Detected stream error/404 via message:', data);
      isPlaybackConfirmed = false;
      var currentCfg = SERVERS_CONFIG.find(function(s) { return s.id === currentWatchServer; }) || SERVERS_CONFIG[0];
      setWatchStatus(currentCfg.name + ' stream error', 'Auto-switching to next server…');
      if (autoSwitchTimer) clearTimeout(autoSwitchTimer);
      autoSwitchTimer = setTimeout(function() {
        startAutoSwitchSequence(autoSwitchIndex + 1);
      }, 300);
      return;
    }

    if (isPlaying && !isError) {
      confirmPlaybackActive();
    }
  });

  function buildPeachifyUrl(params, lang) {
    if (!params) return '';
    var cleanId = String(params.tmdbId || '').replace(/^(?:dotmobiz|tmdb(?:-movie|-series|-tv)?)-/, '');
    if (!cleanId || !/^\d+$/.test(cleanId)) {
      if (params.canonicalId && /^\d+$/.test(String(params.canonicalId))) {
        cleanId = String(params.canonicalId);
      }
    }
    if (!cleanId && params.imdbId && typeof params.imdbId === 'string' && params.imdbId.startsWith('tt')) {
      cleanId = params.imdbId;
    }
    if (!cleanId) cleanId = '76479';

    var isTv = Boolean(params.isTv || params.type === 'tv' || params.type === 'series');
    var s = params.season || 1;
    var e = params.episode || 1;

    var baseEndpoint = isTv
      ? 'https://peachify.pro/embed/tv/' + encodeURIComponent(cleanId) + '/' + encodeURIComponent(s) + '/' + encodeURIComponent(e)
      : 'https://peachify.pro/embed/movie/' + encodeURIComponent(cleanId);

    var dubParam = (lang === 'hi' || (!lang && currentWatchLang === 'hi')) ? 'Hindi' : ((lang === 'ta' || currentWatchLang === 'ta') ? 'Tamil' : ((lang === 'te' || currentWatchLang === 'te') ? 'Telugu' : 'English'));
    var query = '?accent=E50914&autoPlay=true';
    if (dubParam) {
      query += '&dub=' + encodeURIComponent(dubParam);
    }
    if (isTv) {
      query += '&autoNext=true&showNextBtn=true';
    }
    return baseEndpoint + query;
  }

  function buildAllMovieLandUrl(params) {
    if (!params) return '';
    var cleanId = '';
    if (params.imdbId && String(params.imdbId).startsWith('tt')) {
      cleanId = params.imdbId;
    } else {
      cleanId = String(params.tmdbId || '').replace(/^(?:dotmobiz|tmdb(?:-movie|-series|-tv)?)-/, '');
      if (!cleanId || !/^\d+$/.test(cleanId)) {
        if (params.canonicalId && /^\d+$/.test(String(params.canonicalId))) {
          cleanId = String(params.canonicalId);
        }
      }
    }
    if (!cleanId) cleanId = '533535';
    var isTv = Boolean(params.isTv || params.type === 'tv' || params.type === 'series');
    var s = params.season || 1;
    var e = params.episode || 1;
    if (isTv) {
      return 'https://slast430did.com/play/' + encodeURIComponent(cleanId) + '?s=' + encodeURIComponent(s) + '&e=' + encodeURIComponent(e);
    }
    return 'https://slast430did.com/play/' + encodeURIComponent(cleanId);
  }

  function buildVidlinkMultiAudioUrl(params, lang) {
    if (!params) return '';
    var cleanId = String(params.tmdbId || '').replace(/^(?:dotmobiz|tmdb(?:-movie|-series|-tv)?)-/, '');
    if (!cleanId || !/^\d+$/.test(cleanId)) {
      if (params.canonicalId && /^\d+$/.test(String(params.canonicalId))) {
        cleanId = String(params.canonicalId);
      }
    }
    var isTv = (params.type === 'tv' || params.type === 'series');
    var s = params.season || 1;
    var e = params.episode || 1;
    var url = isTv
      ? 'https://vidlink.pro/tv/' + cleanId + '/' + s + '/' + e + '?multiLang=true'
      : 'https://vidlink.pro/movie/' + cleanId + '?multiLang=true';
    var activeLang = (lang && lang !== 'multi') ? lang : (currentWatchLang || '');
    if (activeLang && activeLang !== 'multi') {
      url += '&lang=' + encodeURIComponent(activeLang);
    }
    return url;
  }

  function buildFastCloudStreamUrl(params, lang) {
    if (!params) return '';
    var type = (params.type === 'tv' || params.type === 'series') ? 'tv' : 'movie';
    var title = params.title || '';
    var isTv = type === 'tv';
    var se = isTv ? (params.season || 1) : '';
    var ep = isTv ? (params.episode || 1) : '';
    var year = params.year || '';
    var activeLang = (lang && lang !== 'multi') ? lang : (currentWatchLang || 'hi');
    var url = '/api/stream-player?type=' + encodeURIComponent(type) +
      '&title=' + encodeURIComponent(title) +
      (se ? ('&se=' + encodeURIComponent(se)) : '') +
      (ep ? ('&ep=' + encodeURIComponent(ep)) : '') +
      '&year=' + encodeURIComponent(year) +
      '&lang=' + encodeURIComponent(activeLang);

    var cleanId = String(params.tmdbId || '').replace(/^(?:dotmobiz|tmdb(?:-movie|-series|-tv)?)-/, '');
    if (cleanId && /^\d+$/.test(cleanId)) {
      url += '&id=' + encodeURIComponent(cleanId);
    } else if (params.canonicalId && /^\d+$/.test(String(params.canonicalId))) {
      url += '&id=' + encodeURIComponent(params.canonicalId);
    }
    return url;
  }

  function openWatchModal(tmdbId, type, season, episode, backdrop, title, year, imdbId, canonicalId, poster, chosenServer) {
    if (window.__closeSearchOverlay) window.__closeSearchOverlay();
    if (!watchModal || !watchModalIframe) return;

    type = type || 'movie';
    season = Number(season) || 1;
    episode = Number(episode) || 1;
    var isTv = type === 'tv' || type === 'series';

    function showUnavailableBanner(streamTitle) {
      watchModalIframe.src = 'about:blank';
      watchModal.classList.remove('hidden');
      watchModal.setAttribute('aria-hidden', 'false');
      lockBodyScroll();
      document.body.classList.add('watch-active');
      if (watchMetaTitle) watchMetaTitle.textContent = streamTitle || 'Netflix4U';
      var fallbackBanner = document.getElementById('watch-unavailable-banner');
      if (!fallbackBanner) {
        fallbackBanner = document.createElement('div');
        fallbackBanner.id = 'watch-unavailable-banner';
        fallbackBanner.className = 'absolute inset-0 z-[70] bg-[#0a0a0f] flex flex-col items-center justify-center p-6 text-center space-y-4';
        watchModal.appendChild(fallbackBanner);
      }
      fallbackBanner.style.display = 'flex';
      fallbackBanner.innerHTML =
        '<div class="w-16 h-16 rounded-full bg-red-600/20 text-red-500 flex items-center justify-center mb-2"><svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>' +
        '<h3 class="text-xl font-bold text-white">Streaming source unavailable for this title.</h3>' +
        '<p class="text-sm text-white/60 max-w-md">Our streaming CDN could not verify a canonical playback source for "' + escapeHtml(streamTitle) + '". You can download this title directly from the title details page.</p>' +
        '<button onclick="window.Netflix4uModal.closeWatch();" class="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition cursor-pointer">Back to Details</button>';
    }

    // Strict Canonical Validation using Centralized Player Resolver
    var reqPayload = { type: type, tmdbId: tmdbId, season: season, episode: episode };
    var validation = window.Netflix4uPlayerResolver
      ? window.Netflix4uPlayerResolver.validatePlaybackRequest(reqPayload)
      : { valid: (/^\d{1,10}$/.test(String(tmdbId || '')) && Number(tmdbId) > 0) };

    if (!validation.valid || !validation.sanitized) {
      console.warn('[Netflix4U Player Identity Blocked]', validation.error || 'Invalid canonical ID');
      showUnavailableBanner(title);
      return;
    }

    var sRecord = validation.sanitized;
    tmdbId = sRecord.tmdbId;
    season = sRecord.season || season;
    episode = sRecord.episode || episode;

    var bannerEl = document.getElementById('watch-unavailable-banner');
    if (bannerEl) bannerEl.style.display = 'none';

    activeWatchParams = { tmdbId: tmdbId, type: type, season: season, episode: episode, backdrop: backdrop, title: title, year: year, imdbId: imdbId, canonicalId: canonicalId, directStreamUrl: '' };

    // Asynchronously resolve direct stream URL for VLC & MX Player
    var targetPlayId = canonicalId || tmdbId;
    if (targetPlayId) {
      fetch('/api/playback/' + encodeURIComponent(targetPlayId) + '?season=' + encodeURIComponent(season || 1) + '&episode=' + encodeURIComponent(episode || 1))
        .then(function(res) { return res.json(); })
        .then(function(pbData) {
          if (pbData && pbData.sources && Array.isArray(pbData.sources)) {
            var direct = pbData.sources.find(function(s) { return s.isDirect && s.url; });
            if (direct && direct.url) {
              activeWatchParams.directStreamUrl = direct.url;
              // Resolve to direct media link for instant hardware acceleration in MX Player / VLC
              fetch('/api/download-file?url=' + encodeURIComponent(direct.url) + '&json=1')
                .then(function(r) { return r.json(); })
                .then(function(d) {
                  if (d && d.ok && d.directUrl) {
                    activeWatchParams.directStreamUrl = d.directUrl;
                  }
                }).catch(function() {});
            }
          }
        }).catch(function() {});
    }

    // Update Top Floating Header Metadata & Episode Controls
    if (watchMetaTitle) watchMetaTitle.textContent = title || 'Netflix4U';
    if (watchMetaYear) watchMetaYear.textContent = year || '2026';
    if (watchMetaType) {
      watchMetaType.textContent = isTv ? ('S' + season + ' E' + episode) : 'Movie';
    }
    updateEpisodeNavUi();

    // Build Server URLs for ALL reverse-engineered vidsrc.win providers via Universal Resolver
    activeWatchServers = {};
    SERVERS_CONFIG.forEach(function(s) {
      if (window.Netflix4uPlayerResolver) {
        activeWatchServers[s.id] = window.Netflix4uPlayerResolver.resolvePlayerUrl(activeWatchParams, s.id, { lang: currentWatchLang });
      } else {
        activeWatchServers[s.id] = 'https://vidsrc.pm/embed/' + (isTv ? ('tv/' + tmdbId + '/' + season + '/' + episode) : ('movie/' + tmdbId));
      }
    });

    var startingServer = chosenServer || 'vidsrc_sbs';
    currentWatchServer = startingServer;
    isAutoSwitchEnabled = !chosenServer;
    isPlaybackConfirmed = false;
    currentAutoSwitchToken++;
    renderWatchServerMenu();
    renderWatchAudioDropdown();
    updateActiveServerUi(startingServer);
    updateAutoSwitchToggleUi(isAutoSwitchEnabled);

    watchModal.classList.remove('hidden');
    watchModal.setAttribute('aria-hidden', 'false');
    lockBodyScroll();
    checkOrientationHint();

    if (chosenServer && activeWatchServers[chosenServer]) {
      watchModalIframe.src = activeWatchServers[chosenServer];
      var chosenCfg = SERVERS_CONFIG.find(function(s) { return s.id === chosenServer; }) || SERVERS_CONFIG[0];
      setWatchStatus('Connected to ' + (chosenCfg.shortName || chosenCfg.name), 'Stream verified • Playback ready');
      confirmPlaybackActive();
    } else {
      // Start auto switch sequence from index 0
      startAutoSwitchSequence(0);
    }

    resetWatchTopBarTimer();

    // Auto save to Continue Watching
    if (window.__saveContinueWatching) {
      window.__saveContinueWatching({
        tmdbId: tmdbId,
        canonicalId: (activeWatchParams && activeWatchParams.canonicalId) || tmdbId,
        title: title || 'Title',
        backdrop: backdrop,
        poster: poster || backdrop,
        type: type,
        year: year,
        se: season,
        ep: episode,
        progress: Math.floor(Math.random() * 30) + 40
      });
    }

    // Ensure history reflects More Info page state before Watch state so Back always returns to Details
    var returnTargetId = canonicalId || tmdbId;
    var titleHash = '#title=' + returnTargetId + '-' + type;
    var watchHash = '#w=' + tmdbId + '-' + type;
    if (season) watchHash += '-' + season;
    if (episode) watchHash += '-' + episode;

    try {
      if (!location.hash || (!location.hash.startsWith('#title=') && !location.hash.startsWith('#w='))) {
        history.replaceState({ modal: 'title', tmdbId: returnTargetId, type: type }, '', titleHash);
      }
      if (location.hash !== watchHash) {
        history.pushState({ modal: 'watch', tmdbId: tmdbId, type: type, se: season, ep: episode, title: title, year: year, imdbId: imdbId }, '', watchHash);
      }
    } catch(e) {}
  }

  function renderWatchServerMenu() {
    // 1. Render visible horizontal Server Pills Bar in Watch Header
    if (watchPlayerBar) {
      var featuredServers = SERVERS_CONFIG.filter(function(s) { return s.isFeatured; });
      var isOtherSelected = !featuredServers.some(function(s) { return s.id === currentWatchServer; });
      var currentOtherCfg = isOtherSelected ? SERVERS_CONFIG.find(function(s) { return s.id === currentWatchServer; }) : null;

      var barHtml = featuredServers.map(function(s) {
        var isSelected = s.id === currentWatchServer;
        var shortName = s.shortName || s.name;
        return '<button type="button" data-switch-server="' + s.id + '" class="server-tab-btn' + (isSelected ? ' is-active' : '') + '" title="' + escapeHtml(s.desc) + '">' +
          '<span class="w-2 h-2 rounded-full ' + (isSelected ? 'bg-emerald-400 animate-pulse' : 'bg-white/40') + ' shrink-0"></span>' +
          '<span class="truncate max-w-[130px] sm:max-w-none">' + escapeHtml(shortName) + '</span>' +
          '<span class="watch-server-tag ' + s.tagClass + ' shrink-0 ml-1">' + escapeHtml(s.tag) + '</span>' +
        '</button>';
      }).join('');

      if (currentOtherCfg) {
        barHtml += '<button type="button" data-switch-server="' + currentOtherCfg.id + '" class="server-tab-btn is-active" title="' + escapeHtml(currentOtherCfg.desc) + '">' +
          '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>' +
          '<span class="truncate max-w-[130px] sm:max-w-none">' + escapeHtml(currentOtherCfg.shortName || currentOtherCfg.name) + '</span>' +
          '<span class="watch-server-tag ' + currentOtherCfg.tagClass + ' shrink-0 ml-1">' + escapeHtml(currentOtherCfg.tag) + '</span>' +
        '</button>';
      }

      barHtml += '<button type="button" id="watch-all-servers-btn" class="server-tab-btn bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold shrink-0 ml-1" title="View all ' + SERVERS_CONFIG.length + ' streaming servers">' +
        '<span class="text-amber-400 font-black text-xs">⚡</span>' +
        '<span class="text-xs">All Servers (' + SERVERS_CONFIG.length + ')</span>' +
      '</button>';

      watchPlayerBar.innerHTML = barHtml;

      watchPlayerBar.querySelectorAll('[data-switch-server]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var sId = btn.dataset.switchServer;
          switchWatchServer(sId, true);
        });
      });

      var allServersBtn = document.getElementById('watch-all-servers-btn');
      if (allServersBtn) {
        allServersBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          if (activeWatchParams) {
            openServerPickerModal(
              activeWatchParams.tmdbId,
              activeWatchParams.type,
              activeWatchParams.season,
              activeWatchParams.episode,
              activeWatchParams.backdrop,
              activeWatchParams.title,
              activeWatchParams.year,
              activeWatchParams.imdbId,
              activeWatchParams.canonicalId,
              activeWatchParams.poster
            );
          } else {
            toggleServerMenu();
          }
        });
      }
    }

    // 2. Render dropdown menu list with all reverse-engineered servers
    var serverListContainer = document.getElementById('watch-servers-list-container');
    if (serverListContainer) {
      serverListContainer.innerHTML = SERVERS_CONFIG.map(function(s, idx) {
        var isSelected = s.id === currentWatchServer;
        return '<button type="button" data-switch-server="' + s.id + '" class="watch-server-item' + (isSelected ? ' is-selected' : '') + '">' +
          '<div class="flex items-center gap-2 min-w-0">' +
            '<span class="text-[10px] text-white/40 font-mono w-4">' + (idx + 1) + '</span>' +
            '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ' + (isSelected ? 'animate-pulse' : 'opacity-70') + '"></span>' +
            '<span class="truncate text-xs font-semibold">' + escapeHtml(s.name) + '</span>' +
          '</div>' +
          '<span class="watch-server-tag ' + s.tagClass + ' shrink-0 ml-2">' + escapeHtml(s.tag) + '</span>' +
        '</button>';
      }).join('');

      serverListContainer.querySelectorAll('[data-switch-server]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          var sId = btn.dataset.switchServer;
          switchWatchServer(sId, true);
          closeServerMenu();
        });
      });
    }
  }

  function renderWatchAudioLangBar() {
    var bar = document.getElementById('watch-audio-lang-bar');
    if (!bar) return;

    bar.innerHTML = AUDIO_LANGS_CONFIG.map(function(lang) {
      var isSelected = lang.id === currentWatchLang || lang.code === currentWatchLang;
      return '<button type="button" data-switch-lang="' + lang.id + '" class="watch-lang-pill' + (isSelected ? ' is-active' : '') + '">' +
        '<span>' + escapeHtml(lang.label) + '</span>' +
        '<span class="watch-lang-tag">' + escapeHtml(lang.tag) + '</span>' +
      '</button>';
    }).join('');

    bar.querySelectorAll('[data-switch-lang]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var langId = btn.dataset.switchLang;
        switchWatchAudioLang(langId);
      });
    });
  }

  function renderWatchAudioDropdown() {
    var list = document.getElementById('watch-audio-list-container');
    if (!list) return;

    var itemsHtml = AUDIO_LANGS_CONFIG.map(function(lang) {
      var isSelected = lang.id === currentWatchLang || lang.code === currentWatchLang;
      return '<button type="button" data-switch-lang="' + lang.id + '" class="watch-server-item' + (isSelected ? ' is-selected' : '') + '">' +
        '<div class="flex items-center gap-2">' +
          '<span class="w-2 h-2 rounded-full ' + (isSelected ? 'bg-amber-400 animate-pulse' : 'bg-white/40') + '"></span>' +
          '<span>' + escapeHtml(lang.label) + '</span>' +
        '</div>' +
        '<span class="watch-server-tag ' + (isSelected ? 'tag-multi' : 'tag-fast') + '">' + escapeHtml(lang.tag) + '</span>' +
      '</button>';
    }).join('');

    var hintHtml = '<div class="px-2.5 py-1.5 text-[10px] text-amber-300/80 bg-amber-500/10 rounded-lg mt-1 border border-amber-500/20 leading-tight">' +
      '⚡ Multi-Audio & Dubs stream via Peachify & VidLink Pro' +
    '</div>';

    list.innerHTML = itemsHtml + hintHtml;

    list.querySelectorAll('[data-switch-lang]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var langId = btn.dataset.switchLang;
        switchWatchAudioLang(langId);
        if (watchAudioMenu) watchAudioMenu.classList.add('hidden');
        if (watchAudioToggle) watchAudioToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function switchWatchAudioLang(langId) {
    var langCfg = AUDIO_LANGS_CONFIG.find(function(l) { return l.id === langId; }) || AUDIO_LANGS_CONFIG[0];
    currentWatchLang = langCfg.code || langCfg.id;

    if (watchCurrentAudioLabel) {
      watchCurrentAudioLabel.textContent = langCfg.label;
    }

    renderWatchAudioDropdown();

    if (!activeWatchParams) return;

    // Re-resolve active servers for updated language
    SERVERS_CONFIG.forEach(function(s) {
      if (window.Netflix4uPlayerResolver) {
        activeWatchServers[s.id] = window.Netflix4uPlayerResolver.resolvePlayerUrl(activeWatchParams, s.id, { lang: currentWatchLang });
      }
    });

    var activeSrv = currentWatchServer || 'vidsrc_sbs';
    // If user is currently on VidSrc (which is single-stream Original Audio) and requests a Dub (Hindi/Tamil/Telugu/Multi),
    // automatically switch them to Peachify Pro which streams the selected audio track!
    if (activeSrv === 'vidsrc_sbs' && currentWatchLang !== 'en') {
      activeSrv = 'peachify';
      currentWatchServer = 'peachify';
      updateActiveServerUi('peachify');
      renderWatchServerMenu();
    }

    var activeUrl = activeWatchServers[activeSrv] || newPeachifyUrl || newVidsrcUrl;
    hideWatchFailoverCard();
    watchModalIframe.src = activeUrl;

    var activeCfg = SERVERS_CONFIG.find(function(s) { return s.id === activeSrv; }) || SERVERS_CONFIG[0];
    setWatchStatus('Audio: ' + langCfg.label + ' (' + (activeCfg.shortName || activeCfg.name) + ')', 'Multi-Audio Stream Active');
    if (window.__showToast) {
      window.__showToast('Playing ' + langCfg.label + ' on ' + (activeCfg.shortName || activeCfg.name), '🎧');
    }
    resetWatchTopBarTimer();
  }

  function updateActiveServerUi(serverId) {
    currentWatchServer = serverId;
    var cfg = SERVERS_CONFIG.find(function(s) { return s.id === serverId; }) || SERVERS_CONFIG[0];
    if (watchCurrentServerLabel) {
      watchCurrentServerLabel.textContent = cfg.shortName || cfg.name;
    }
    // Update dropdown menu
    var serverListContainer = document.getElementById('watch-servers-list-container');
    if (serverListContainer) {
      serverListContainer.querySelectorAll('[data-switch-server]').forEach(function(btn) {
        btn.classList.toggle('is-selected', btn.dataset.switchServer === serverId);
      });
    }
  }

  function switchWatchServer(serverId, isManual) {
    if (!activeWatchServers[serverId] && window.Netflix4uPlayerResolver && activeWatchParams) {
      activeWatchServers[serverId] = window.Netflix4uPlayerResolver.resolvePlayerUrl(activeWatchParams, serverId, { lang: currentWatchLang });
    }
    if (!activeWatchServers[serverId]) return;
    var cfg = SERVERS_CONFIG.find(function(s) { return s.id === serverId; }) || SERVERS_CONFIG[0];

    hideWatchFailoverCard();

    if (isManual) {
      isAutoSwitchEnabled = false;
      isPlaybackConfirmed = false;
      if (autoSwitchTimer) {
        clearTimeout(autoSwitchTimer);
        autoSwitchTimer = null;
      }
      updateAutoSwitchToggleUi(false);
      setWatchStatus('Connecting ' + (cfg.shortName || cfg.name) + '…', 'Manual server selected • Checking stream health');
    }
    updateActiveServerUi(serverId);
    if (activeWatchParams && activeWatchParams.backdrop) {
      showWatchBackdrop(activeWatchParams.backdrop);
    }

    var serverUrl = activeWatchServers[serverId] || '';
    var seqToken = ++currentAutoSwitchToken;

    // Fast check if selected server returns 404
    probeStream(serverUrl, function(isHealthy, statusCode) {
      if (seqToken !== currentAutoSwitchToken) return;

      if (!isHealthy && statusCode === 404) {
        console.warn('[Netflix4U Stream] Selected server ' + serverId + ' returned 404. Showing failover options.');
        setWatchStatus((cfg.shortName || cfg.name) + ' returned 404 (File Not Found)', 'File not found on this server');
        showWatchFailoverCard(serverId, '404 File Not Found');
        return;
      }

      watchModalIframe.src = serverUrl;
      setWatchStatus('Connecting ' + (cfg.shortName || cfg.name) + '…', 'Stream verified • Loading playback…');
      setTimeout(function() {
        if (seqToken === currentAutoSwitchToken) {
          hideWatchBackdrop();
        }
      }, 1200);
    });

    resetWatchTopBarTimer();
  }

  // Audio dropdown toggle listener
  if (watchAudioToggle && watchAudioMenu) {
    watchAudioToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      var isExpanded = watchAudioToggle.getAttribute('aria-expanded') === 'true';
      watchAudioToggle.setAttribute('aria-expanded', String(!isExpanded));
      watchAudioMenu.classList.toggle('hidden', isExpanded);
      closeServerMenu();
      if (watchExtMenu) watchExtMenu.classList.add('hidden');
    });
  }

  // Close menus on outside click
  document.addEventListener('click', function(e) {
    if (watchServerMenu && !watchServerMenu.classList.contains('hidden')) {
      if (!e.target.closest('#watch-server-dropdown-wrap')) closeServerMenu();
    }
    if (watchAudioMenu && !watchAudioMenu.classList.contains('hidden')) {
      if (!e.target.closest('#watch-audio-dropdown-wrap')) {
        watchAudioMenu.classList.add('hidden');
        if (watchAudioToggle) watchAudioToggle.setAttribute('aria-expanded', 'false');
      }
    }
    if (watchExtMenu && !watchExtMenu.classList.contains('hidden')) {
      if (!e.target.closest('#watch-ext-player-wrap')) watchExtMenu.classList.add('hidden');
    }
  });

  function toggleServerMenu() {
    if (!watchServerMenu) return;
    var isOpen = !watchServerMenu.classList.contains('hidden');
    if (isOpen) {
      closeServerMenu();
    } else {
      openServerMenu();
    }
  }

  function openServerMenu() {
    if (!watchServerMenu) return;
    watchServerMenu.classList.remove('hidden');
    if (watchServerToggle) watchServerToggle.setAttribute('aria-expanded', 'true');
    if (watchServerArrow) watchServerArrow.style.transform = 'rotate(180deg)';
  }

  function closeServerMenu() {
    if (!watchServerMenu) return;
    watchServerMenu.classList.add('hidden');
    if (watchServerToggle) watchServerToggle.setAttribute('aria-expanded', 'false');
    if (watchServerArrow) watchServerArrow.style.transform = 'rotate(0deg)';
  }

  // ─── External Player (VLC & MX Player) Controller ───
  var watchExtToggle = document.getElementById('watch-ext-toggle');
  var watchExtMenu = document.getElementById('watch-ext-menu');
  var watchBtnVlc = document.getElementById('watch-btn-vlc');
  var watchBtnMx = document.getElementById('watch-btn-mx');
  var watchBtnCopy = document.getElementById('watch-btn-copy-link');

  function toggleExtMenu() {
    if (!watchExtMenu) return;
    var isOpen = !watchExtMenu.classList.contains('hidden');
    if (isOpen) {
      watchExtMenu.classList.add('hidden');
    } else {
      closeServerMenu();
      watchExtMenu.classList.remove('hidden');
    }
  }

  function getActiveStreamUrl() {
    if (activeWatchParams && activeWatchParams.directStreamUrl) {
      return activeWatchParams.directStreamUrl;
    }
    if (activeWatchParams) {
      var resolved = resolveStreamableVideoUrl(activeWatchParams, activeWatchParams.type === 'tv' || activeWatchParams.type === 'series', activeWatchParams.season, activeWatchParams.episode);
      if (resolved) return resolved;
    }
    return (activeWatchServers && activeWatchServers[currentWatchServer]) || '';
  }

  if (watchExtToggle) {
    watchExtToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleExtMenu();
    });
  }

  if (watchBtnVlc) {
    watchBtnVlc.addEventListener('click', function(e) {
      e.stopPropagation();
      var url = getActiveStreamUrl();
      if (!url) return;
      launchInVlc(url);
      if (watchExtMenu) watchExtMenu.classList.add('hidden');
    });
  }

  if (watchBtnMx) {
    watchBtnMx.addEventListener('click', function(e) {
      e.stopPropagation();
      var url = getActiveStreamUrl();
      if (!url) return;
      launchInMxPlayer(url);
      if (watchExtMenu) watchExtMenu.classList.add('hidden');
    });
  }

  if (watchBtnCopy) {
    watchBtnCopy.addEventListener('click', function(e) {
      e.stopPropagation();
      var url = getActiveStreamUrl();
      if (!url) return;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function() {
          if (window.__showToast) window.__showToast('Stream link copied to clipboard!', '📋');
          if (watchExtMenu) watchExtMenu.classList.add('hidden');
        });
      }
    });
  }

  document.addEventListener('click', function() {
    if (watchExtMenu) watchExtMenu.classList.add('hidden');
  });

  function reloadWatchStream() {
    if (!watchModalIframe || !activeWatchServers[currentWatchServer]) return;
    if (watchReloadIcon) {
      watchReloadIcon.classList.remove('spin-anim');
      void watchReloadIcon.offsetWidth; // force reflow
      watchReloadIcon.classList.add('spin-anim');
    }
    if (activeWatchParams && activeWatchParams.backdrop) {
      showWatchBackdrop(activeWatchParams.backdrop);
    }
    var cur = activeWatchServers[currentWatchServer];
    watchModalIframe.src = cur;
  }

  function showWatchBackdrop(backdropUrl) {
    if (!watchModalBackdrop) return;
    if (backdropUrl) {
      watchModalBackdrop.style.backgroundImage = 'url("' + backdropUrl + '")';
    } else {
      watchModalBackdrop.style.backgroundImage = '';
    }
    watchModalBackdrop.style.opacity = '1';
    watchModalBackdrop.style.display = 'block';
  }

  function hideWatchBackdrop() {
    if (!watchModalBackdrop) return;
    watchModalBackdrop.style.opacity = '0';
    setTimeout(function() {
      watchModalBackdrop.style.display = 'none';
    }, 450);
  }

  function closeWatchAndReturnToDetails() {
    if (!watchModal) return;
    if (autoSwitchTimer) {
      clearTimeout(autoSwitchTimer);
      autoSwitchTimer = null;
    }
    if (watchTopBarHideTimeout) {
      clearTimeout(watchTopBarHideTimeout);
      watchTopBarHideTimeout = null;
    }
    if (activeProbeController) {
      try { activeProbeController.abort(); } catch(e) {}
      activeProbeController = null;
    }
    currentAutoSwitchToken++;

    if (watchTopBar) {
      watchTopBar.classList.remove('watch-bar-hidden');
    }
    if (watchPortraitHint) {
      watchPortraitHint.classList.add('hidden');
    }
    if (watchModalIframe) {
      watchModalIframe.src = 'about:blank';
    }
    watchModal.classList.add('hidden');
    watchModal.setAttribute('aria-hidden', 'true');

    var bannerEl = document.getElementById('watch-unavailable-banner');
    if (bannerEl) bannerEl.style.display = 'none';

    closeServerMenu();
    hideWatchBackdrop();

    // Smoothly return to the More Info page (Title Modal)
    var returnParams = activeWatchParams;
    if (returnParams && (returnParams.tmdbId || returnParams.canonicalId)) {
      var targetId = returnParams.canonicalId || returnParams.tmdbId;
      var targetType = returnParams.type || 'movie';
      var titleHash = '#title=' + targetId + '-' + targetType;

      try {
        if (location.hash !== titleHash) {
          history.replaceState({ modal: 'title', tmdbId: targetId, type: targetType }, '', titleHash);
        }
      } catch(e) {}

      // If titleModal is already loaded in DOM, display it
      if (titleModal && titleModalBody && titleModalBody.children.length > 0) {
        titleModal.classList.remove('hidden');
        titleModal.classList.add('flex');
        titleModal.setAttribute('aria-hidden', 'false');
        requestAnimationFrame(function() {
          titleModal.classList.add('nm-modal-in');
        });
        lockBodyScroll();
      } else {
        openTitleModal(returnParams.tmdbId, returnParams.type, false, returnParams.canonicalId, returnParams.imdbId);
      }
    } else {
      unlockBodyScroll();
      if (location.hash && location.hash.startsWith('#w=')) {
        try {
          history.replaceState(null, '', location.pathname + location.search);
        } catch(e) {}
      }
    }
  }

  function closeWatchModal(shouldReturnToTitle) {
    if (shouldReturnToTitle !== false) {
      closeWatchAndReturnToDetails();
      return;
    }
    if (!watchModal) return;
    if (autoSwitchTimer) {
      clearTimeout(autoSwitchTimer);
      autoSwitchTimer = null;
    }
    if (watchTopBarTimer) {
      clearTimeout(watchTopBarTimer);
      watchTopBarTimer = null;
    }
    currentAutoSwitchToken++;
    if (watchTopBar) watchTopBar.classList.remove('watch-bar-hidden');
    if (watchPortraitHint) watchPortraitHint.classList.add('hidden');
    if (watchModalIframe) watchModalIframe.src = 'about:blank';
    watchModal.classList.add('hidden');
    watchModal.setAttribute('aria-hidden', 'true');
    var bannerEl = document.getElementById('watch-unavailable-banner');
    if (bannerEl) bannerEl.style.display = 'none';
    closeServerMenu();
    hideWatchBackdrop();
    unlockBodyScroll();
    if (location.hash && location.hash.startsWith('#w=')) {
      try {
        history.replaceState(null, '', location.pathname + location.search);
      } catch(e) {}
    }
  }

  // ─── POLICY / FOOTER MODAL CONTROLLER ───
  var POLICY_DOCS = {
    about: {
      title: 'About Netflix4U',
      content: '<div class="space-y-3">' +
        '<p class="text-base font-semibold text-white">Welcome to Netflix4U — Ultra-Fast Streaming & Direct Cloud Downloads.</p>' +
        '<p>Netflix4U is an entertainment discovery portal built for movie buffs, web series enthusiasts, and anime lovers. We aggregate verified, publicly accessible streaming and download sources into a seamless experience with zero mandatory signups or subscriptions.</p>' +
        '<div class="p-4 rounded-xl bg-white/[0.04] border border-white/10 space-y-2">' +
          '<div class="text-white font-bold flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-red-500"></span>Our Key Pillars</div>' +
          '<p class="text-xs text-white/70">• <strong>Multi-Server High Speed</strong>: 6 dedicated streaming servers including Net27 Peachify, VidLink Multi-Audio, and AllMovieLand.<br>' +
          '• <strong>Direct Fast Downloads</strong>: Zero-waiting cloud worker servers for 4K, 1080p, and 720p files.<br>' +
          '• <strong>Privacy First</strong>: No registration, no tracking, and 100% client-side privacy.</p>' +
        '</div>' +
        '<p class="text-xs text-white/50">Version 2.4 (Net27 Edition) • Updated Daily</p>' +
      '</div>'
    },
    privacy: {
      title: 'Privacy Policy',
      content: '<div class="space-y-3">' +
        '<p class="font-semibold text-white">Your Privacy is Sacred to Us.</p>' +
        '<p>At Netflix4U, we strongly believe in digital autonomy and minimal data retention:</p>' +
        '<ul class="list-disc pl-5 space-y-1.5 text-white/75 text-xs sm:text-sm">' +
          '<li><strong>No Account Required:</strong> You never need to submit your email, phone number, or personal details to stream or download.</li>' +
          '<li><strong>Zero Behavioral Tracking:</strong> We do not deploy third-party advertising trackers or fingerprinting cookies.</li>' +
          '<li><strong>Ephemeral Client Sessions:</strong> Watchlist and platform preferences are stored exclusively in your local browser session storage.</li>' +
        '</ul>' +
        '<p class="text-xs text-white/50">For queries regarding our privacy protocol, contact privacy@netflix4u.in.</p>' +
      '</div>'
    },
    terms: {
      title: 'Terms of Service',
      content: '<div class="space-y-3">' +
        '<p class="font-semibold text-white">Terms of Use & Fair Access</p>' +
        '<p>By visiting or utilizing Netflix4U, you acknowledge and agree to the following conditions:</p>' +
        '<ul class="list-disc pl-5 space-y-1.5 text-white/75 text-xs sm:text-sm">' +
          '<li>Netflix4U operates as an indexer pointing to media streams and verified cloud worker sources hosted elsewhere on the internet.</li>' +
          '<li>All media files belong to their respective copyright holders. Netflix4U does not broadcast or store content on its own servers.</li>' +
          '<li>Usage of automated bots, denial-of-service scrapers, or excessive bulk download harvesting is strictly disallowed.</li>' +
        '</ul>' +
      '</div>'
    },
    dmca: {
      title: 'DMCA Disclaimer & Copyright Compliance',
      content: '<div class="space-y-3">' +
        '<div class="p-4 rounded-xl bg-red-950/30 border border-red-800/40 space-y-2">' +
          '<div class="text-red-400 font-bold flex items-center gap-2"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.5l8.5 14.5H3.5L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>Digital Millennium Copyright Act Notice</div>' +
          '<p class="text-xs text-white/80">Netflix4U strictly respects copyright laws. We do not host, broadcast, archive, or upload media files to our web hosting servers. All content is indexed automatically from public third-party sources.</p>' +
        '</div>' +
        '<p class="text-xs sm:text-sm text-white/75">If your copyrighted work has been indexed and you wish to submit a removal request, please email our designated agent at <span class="text-red-400 font-semibold">dmca@netflix4u.in</span> or reach out via our Telegram channel. Provide the specific URL and proof of ownership. Verified notices will be addressed within 24–48 hours.</p>' +
      '</div>'
    },
    contact: {
      title: 'Contact & Community Support',
      content: '<div class="space-y-4">' +
        '<p class="font-semibold text-white">We Value Your Feedback</p>' +
        '<p class="text-xs sm:text-sm text-white/75">Connect with the Netflix4U team for media requests, bug reports, or partnership inquiries:</p>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
          '<a href="https://t.me/netflix4u_website" target="_blank" rel="noopener noreferrer" class="p-3.5 rounded-xl bg-[#229ED9]/15 border border-[#229ED9]/30 hover:bg-[#229ED9]/25 transition flex items-center gap-3 group">' +
            '<div class="w-9 h-9 rounded-full bg-[#229ED9] text-white flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></div>' +
            '<div><div class="text-sm font-bold text-white">Telegram Channel</div><div class="text-xs text-white/50">Live updates & requests</div></div>' +
          '</a>' +
          '<div class="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-3">' +
            '<div class="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0 shadow-lg"><svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></div>' +
            '<div><div class="text-sm font-bold text-white">Email Support</div><div class="text-xs text-white/50">support@netflix4u.in</div></div>' +
          '</div>' +
        '</div>' +
      '</div>'
    }
  };

  function openPolicyModal(tabKey) {
    if (window.__closeSearchOverlay) window.__closeSearchOverlay();
    if (!policyModal || !policyModalBody) return;

    tabKey = tabKey || 'about';
    switchPolicyTab(tabKey);

    policyModal.classList.remove('hidden');
    policyModal.classList.add('flex');
    policyModal.setAttribute('aria-hidden', 'false');
    lockBodyScroll();
  }

  function switchPolicyTab(tabKey) {
    if (!policyModalBody) return;
    var doc = POLICY_DOCS[tabKey] || POLICY_DOCS.about;
    policyModalBody.innerHTML = '<h3 class="text-xl font-bold text-white mb-2">' + escapeHtml(doc.title) + '</h3>' + doc.content;

    if (policyTabs) {
      policyTabs.querySelectorAll('[data-policy-tab]').forEach(function(btn) {
        var isThis = btn.dataset.policyTab === tabKey;
        btn.classList.toggle('is-active', isThis);
      });
    }
  }

  function closePolicyModal() {
    if (!policyModal) return;
    policyModal.classList.add('hidden');
    policyModal.classList.remove('flex');
    policyModal.setAttribute('aria-hidden', 'true');
    unlockBodyScroll();
  }

  // ─── TRAILER MODAL ───
  function openTrailerModal(ytKey) {
    if (!trailerModal || !trailerModalIframe || !ytKey) return;
    trailerModalIframe.src = 'https://www.youtube.com/embed/' + ytKey + '?autoplay=1&rel=0';
    trailerModal.classList.remove('hidden');
    trailerModal.classList.add('flex');
    lockBodyScroll();
  }

  function closeTrailerModal() {
    if (!trailerModal || !trailerModalIframe) return;
    trailerModalIframe.src = '';
    trailerModal.classList.add('hidden');
    trailerModal.classList.remove('flex');
    unlockBodyScroll();
  }

  // ─── EVENT DELEGATION ───
  document.addEventListener('click', function(e) {
    var modalTrigger = e.target.closest('[data-modal]');
    if (modalTrigger) {
      var modalType = modalTrigger.dataset.modal;
      if (modalType === 'title') {
        var tmdbId = modalTrigger.dataset.tmdbid || modalTrigger.dataset.tmdbId || modalTrigger.getAttribute('data-tmdbid') || modalTrigger.getAttribute('data-tmdb-id');
        var canonicalId = modalTrigger.dataset.canonicalId || modalTrigger.dataset.canonicalid || modalTrigger.getAttribute('data-canonical-id') || modalTrigger.dataset.subject || modalTrigger.getAttribute('data-subject');
        var imdbId = modalTrigger.dataset.imdbid || modalTrigger.getAttribute('data-imdbid') || '';
        var type = modalTrigger.dataset.type || 'movie';
        var title = modalTrigger.dataset.title || '';
        var year = modalTrigger.dataset.year || '';
        var poster = modalTrigger.dataset.poster || '';
        var backdrop = modalTrigger.dataset.backdrop || '';
        var card = modalTrigger.closest('.nm-card') || modalTrigger.closest('.card') || modalTrigger;
        var img = card.querySelector('img');
        if (!poster && img && img.src) poster = img.src;
        if (!backdrop && poster) backdrop = poster;
        if (!title && img && img.alt) title = img.alt;
        if (!tmdbId && !canonicalId) {
          var parentWithData = modalTrigger.closest('[data-tmdbid], [data-tmdb-id], [data-canonical-id], [data-subject]');
          if (parentWithData) {
            tmdbId = parentWithData.dataset.tmdbid || parentWithData.dataset.tmdbId || parentWithData.getAttribute('data-tmdbid') || parentWithData.getAttribute('data-tmdb-id');
            canonicalId = parentWithData.dataset.canonicalId || parentWithData.dataset.canonicalid || parentWithData.getAttribute('data-canonical-id') || parentWithData.dataset.subject;
          }
        }
        if (!tmdbId && !canonicalId) {
          canonicalId = modalTrigger.dataset.id || modalTrigger.getAttribute('data-id');
        }
        if (!tmdbId && !canonicalId) return;
        e.preventDefault();
        openTitleModal(tmdbId, type, true, canonicalId, imdbId, title, year, poster, backdrop);
      } else if (modalType === 'watch') {
        var tmdbId = modalTrigger.dataset.tmdbid || modalTrigger.dataset.tmdbId || modalTrigger.getAttribute('data-tmdbid') || modalTrigger.getAttribute('data-tmdb-id');
        var canonicalId = modalTrigger.dataset.canonicalId || modalTrigger.dataset.canonicalid || modalTrigger.getAttribute('data-canonical-id') || modalTrigger.dataset.subject || modalTrigger.getAttribute('data-subject');
        var type = modalTrigger.dataset.type || 'movie';
        var se = modalTrigger.dataset.se || 1;
        var ep = modalTrigger.dataset.ep || 1;
        var backdrop = modalTrigger.dataset.backdrop || '';
        var poster = modalTrigger.dataset.poster || '';
        var title = modalTrigger.dataset.title || '';
        var year = modalTrigger.dataset.year || '';
        var imdbId = modalTrigger.dataset.imdbid || modalTrigger.getAttribute('data-imdbid') || '';
        var card = modalTrigger.closest('.nm-card') || modalTrigger.closest('.card') || modalTrigger.closest('#title-modal') || modalTrigger;
        var img = card.querySelector('img');
        if (!poster && img && img.src) poster = img.src;
        if (!backdrop && poster) backdrop = poster;
        if (!title && img && img.alt) title = img.alt;
        if (!tmdbId && !canonicalId) {
          var parentWithData = modalTrigger.closest('[data-tmdbid], [data-tmdb-id], [data-canonical-id], [data-subject]');
          if (parentWithData) {
            tmdbId = parentWithData.dataset.tmdbid || parentWithData.dataset.tmdbId || parentWithData.getAttribute('data-tmdbid') || parentWithData.getAttribute('data-tmdb-id');
            canonicalId = parentWithData.dataset.canonicalId || parentWithData.dataset.canonicalid || parentWithData.getAttribute('data-canonical-id') || parentWithData.dataset.subject;
          }
        }
        if (!tmdbId && !canonicalId) {
          canonicalId = modalTrigger.dataset.id || modalTrigger.getAttribute('data-id');
        }
        if (!tmdbId && !canonicalId) return;
        e.preventDefault();
        openServerPickerModal(tmdbId, type, se, ep, backdrop, title, year, imdbId, canonicalId, poster);
      } else if (modalType === 'trailer') {
        var yt = modalTrigger.dataset.yt;
        if (!yt) return;
        e.preventDefault();
        openTrailerModal(yt);
      }
      return;
    }

    // Direct External Stream Buttons (VLC, MX Player, Copy Link)
    var vlcBtn = e.target.closest('[data-ext-stream-vlc]');
    if (vlcBtn) {
      e.preventDefault();
      e.stopPropagation();
      var rawVlc = decodeURIComponent(vlcBtn.dataset.extStreamVlc || '');
      launchInVlc(rawVlc);
      return;
    }

    var mxBtn = e.target.closest('[data-ext-stream-mx]');
    if (mxBtn) {
      e.preventDefault();
      e.stopPropagation();
      var rawMx = decodeURIComponent(mxBtn.dataset.extStreamMx || '');
      launchInMxPlayer(rawMx);
      return;
    }

    var copyStreamBtn = e.target.closest('[data-ext-stream-copy]');
    if (copyStreamBtn) {
      e.preventDefault();
      e.stopPropagation();
      var rawCopy = decodeURIComponent(copyStreamBtn.dataset.extStreamCopy || '');
      if (!rawCopy) return;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(rawCopy).then(function() {
          if (window.__showToast) window.__showToast('Stream link copied to clipboard!', '📋');
        });
      }
      return;
    }

    var policyLink = e.target.closest('[data-policy-link]');
    if (policyLink) {
      e.preventDefault();
      var tab = policyLink.dataset.policyLink || 'about';
      window.location.href = '/' + tab;
      return;
    }
  });

  // Net27 Player Header Listeners - Return to More Info Page
  if (watchBackBtn) watchBackBtn.addEventListener('click', closeWatchAndReturnToDetails);
  if (watchReloadBtn) watchReloadBtn.addEventListener('click', reloadWatchStream);
  if (watchServerToggle) {
    watchServerToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleServerMenu();
    });
  }

  // Close server menu on outside click
  document.addEventListener('click', function(e) {
    if (watchServerMenu && !watchServerMenu.classList.contains('hidden')) {
      if (!e.target.closest('#watch-server-dropdown-wrap')) {
        closeServerMenu();
      }
    }
  });

  // Policy Modal Listeners
  if (policyTabs) {
    policyTabs.querySelectorAll('[data-policy-tab]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        switchPolicyTab(btn.dataset.policyTab);
      });
    });
  }
  if (policyModalClose) policyModalClose.addEventListener('click', closePolicyModal);
  if (policyModal) {
    policyModal.addEventListener('click', function(e) {
      if (e.target === policyModal) closePolicyModal();
    });
  }

  if (titleModalBack) titleModalBack.addEventListener('click', goBackTitleModal);
  if (titleModalClose) titleModalClose.addEventListener('click', closeTitleModal);
  if (watchModalClose) watchModalClose.addEventListener('click', closeWatchAndReturnToDetails);
  if (trailerModalClose) trailerModalClose.addEventListener('click', closeTrailerModal);

  if (titleModal) {
    titleModal.addEventListener('click', function(e) {
      if (e.target === titleModal) closeTitleModal();
    });
  }
  if (trailerModal) {
    trailerModal.addEventListener('click', function(e) {
      if (e.target === trailerModal) closeTrailerModal();
    });
  }

  if (watchModalIframe) {
    watchModalIframe.addEventListener('load', function() {
      if (watchModalIframe.src && watchModalIframe.src !== 'about:blank') {
        confirmPlaybackActive();
      }
      setTimeout(hideWatchBackdrop, 400);
    });
  }

  if (watchModal) {
    watchModal.addEventListener('pointerdown', function() {
      confirmPlaybackActive();
    }, { passive: true });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var reqM = document.getElementById('request-modal');
      if (reqM && !reqM.classList.contains('hidden')) {
        reqM.classList.add('hidden');
        reqM.classList.remove('flex');
        document.body.classList.remove('modal-open');
        return;
      }
      var shareM = document.getElementById('share-modal');
      if (shareM && !shareM.classList.contains('hidden')) {
        shareM.classList.add('hidden');
        shareM.classList.remove('flex');
        document.body.classList.remove('modal-open');
        return;
      }
      if (policyModal && !policyModal.classList.contains('hidden')) { closePolicyModal(); return; }
      if (trailerModal && !trailerModal.classList.contains('hidden')) { closeTrailerModal(); return; }
      if (watchModal && !watchModal.classList.contains('hidden')) { closeWatchAndReturnToDetails(); return; }
      if (titleModal && !titleModal.classList.contains('hidden')) { closeTitleModal(); return; }
    }
  });

  window.addEventListener('message', function(e) {
    if (e.data === 'netmirror:close-watch' || e.data === 'netflix4u:close-watch') {
      closeWatchAndReturnToDetails();
    }
  });

  // Seamless Browser / Hardware Back Navigation Controller
  window.addEventListener('popstate', function(e) {
    var isWatchOpen = watchModal && !watchModal.classList.contains('hidden');
    var isTitleOpen = titleModal && !titleModal.classList.contains('hidden');
    var currentHash = window.location.hash || '';

    // If streaming player was active and user navigated back: return to More Info page
    if (isWatchOpen && !currentHash.startsWith('#w=')) {
      closeWatchAndReturnToDetails();
      return;
    }

    // If on More Info page and user navigated back: return to Homepage
    if (isTitleOpen && !currentHash.startsWith('#title=') && !currentHash.startsWith('#w=')) {
      closeTitleModal();
      return;
    }

    // Direct hash routing
    var titleMatch = currentHash.match(/^#title=([^-]+)-(movie|tv)$/i);
    if (titleMatch && !isTitleOpen && !isWatchOpen) {
      openTitleModal(titleMatch[1], titleMatch[2], false);
      return;
    }

    var watchMatch = currentHash.match(/^#w=([^-]+)-(movie|tv)(?:-(\d+)(?:-(\d+))?)?$/i);
    if (watchMatch && !isWatchOpen) {
      openWatchModal(watchMatch[1], watchMatch[2], watchMatch[3] || 1, watchMatch[4] || 1);
    }
  });

  // Global Exports
  window.Netflix4uModal = {
    openTitle: openTitleModal,
    closeTitle: closeTitleModal,
    openWatch: openWatchModal,
    openServerPicker: openServerPickerModal,
    closeWatch: closeWatchAndReturnToDetails,
    closeWatchDirect: closeWatchModal,
    openTrailer: openTrailerModal,
    closeTrailer: closeTrailerModal,
    openPolicy: openPolicyModal,
    closePolicy: closePolicyModal
  };
})();
