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

  // Resilient Cloud Download Handlers
  if (!window.getFastCloudDownloadHref) {
    window.getFastCloudDownloadHref = function(rawUrl) {
      if (!rawUrl) return '#';
      if (rawUrl.indexOf('workers.dev') !== -1 || rawUrl.indexOf('vcloud') !== -1) {
        var clean = rawUrl;
        var m = clean.match(/[?&]vcloud=([^&#]+)/);
        if (m) clean = decodeURIComponent(m[1]);
        return 'https://wild-sun-9376.oriue.workers.dev/?vcloud=' + encodeURIComponent(clean);
      }
      return rawUrl;
    };
  }

  if (!window.handleFastCloudDownload) {
    window.handleFastCloudDownload = async function(event, rawUrl, buttonEl) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      var targetEl = buttonEl || (event && (event.currentTarget || (event.target && event.target.closest('a'))));
      var originalHtml = '';
      if (targetEl) {
        originalHtml = targetEl.innerHTML;
        targetEl.style.pointerEvents = 'none';
        targetEl.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;"><svg style="animation:spinOnce 1s linear infinite;width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path></svg>Connecting Stream...</span>';
      }
      var restore = function() {
        if (targetEl && originalHtml) {
          setTimeout(function() {
            targetEl.innerHTML = originalHtml;
            targetEl.style.pointerEvents = 'auto';
          }, 2200);
        }
      };

      var clean = rawUrl || '';
      var m = clean.match(/[?&]vcloud=([^&#]+)/);
      if (m) clean = decodeURIComponent(m[1]);

      if (clean.indexOf('workers.dev') === -1 && clean.indexOf('vcloud') === -1 && (clean.indexOf('http://') === 0 || clean.indexOf('https://') === 0)) {
        window.open(clean, '_blank', 'noopener,noreferrer');
        restore();
        return;
      }

      var workerUrl = 'https://wild-sun-9376.oriue.workers.dev/?vcloud=' + encodeURIComponent(clean);
      window.open(workerUrl, '_blank', 'noopener,noreferrer');
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
  }

  function unlockBodyScroll() {
    if (titleModal && titleModal.classList.contains('hidden') &&
        watchModal && watchModal.classList.contains('hidden') &&
        trailerModal && trailerModal.classList.contains('hidden') &&
        (!policyModal || policyModal.classList.contains('hidden'))) {
      document.body.style.overflow = '';
    }
  }

  // ─── TITLE MODAL ───
  function openTitleModal(tmdbId, type, pushHistory, canonicalId, imdbId) {
    if (window.__closeSearchOverlay) window.__closeSearchOverlay();
    var lookupId = canonicalId || tmdbId;
    if (pushHistory !== false) {
      historyStack.push({ tmdbId: tmdbId, type: type, canonicalId: canonicalId, imdbId: imdbId });
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

    fetchTitleDetails(lookupId, type, canonicalId, imdbId);
  }

  async function fetchTitleDetails(lookupId, type, canonicalId, imdbId) {
    try {
      var res = await fetch('/api/catalog/title/' + encodeURIComponent(type) + '/' + encodeURIComponent(lookupId));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      data.canonicalId = data.canonicalId || canonicalId || lookupId;
      if (imdbId && !data.imdbId) data.imdbId = imdbId;
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
      return Boolean(l.isDotmovies || s === 'dotmovies' || s === 'dotmobiz' || u.includes('nexdrive') || u.includes('dotmobiz'));
    });

    var cloudLinks = downloadLinks.filter(function(l) {
      if (!l || !l.url) return false;
      return !dotmoviesLinks.includes(l);
    });

    var dotmoviesSectionHtml = renderDotmoviesSection(dotmoviesLinks, data.title, isTv, data.slug, data.canonicalId);
    var cloudSectionHtml = renderCloudSection(cloudLinks, data.title, isTv);

    // Episodes for TV Series
    var episodesSectionHtml = '';
    if (isTv) {
      var seasons = data.seasons || [];
      var currentSeason = data.initialSeason || 1;
      var seasonOptions = seasons.map(function(s) {
        return '<option value="' + s.season_number + '"' + (s.season_number === currentSeason ? ' selected' : '') + '>' +
          escapeHtml(s.name || ('Season ' + s.season_number)) + ' · ' + (s.episode_count || 10) + ' ep</option>';
      }).join('');

      var initialEpisodesHtml = renderEpisodeList(data.initialEpisodes || [], tmdbId, currentSeason, backdropUrl, downloadLinks);

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

    // Assemble Full Modal Body
    titleModalBody.innerHTML =
      '<!-- Hero Backdrop -->' +
      '<div class="relative">' +
        '<div class="aspect-video sm:aspect-[21/9] overflow-hidden bg-zinc-950 relative">' +
          (backdropUrl ? '<img src="' + backdropUrl + '" alt="" class="w-full h-full object-cover" referrerpolicy="no-referrer" onerror="this.onerror=null;if(\'' + posterUrl + '\'){this.src=\'' + posterUrl + '\';}else{this.style.display=\'none\';}" />' : (posterUrl ? '<img src="' + posterUrl + '" alt="" class="w-full h-full object-cover blur-sm opacity-50" />' : '')) +
          '<div class="absolute inset-0 bg-gradient-to-t from-[#15151c] via-[#15151c]/40 to-transparent"></div>' +
        '</div>' +
        '<div class="absolute inset-x-0 bottom-0 p-4 sm:p-6">' +
          '<div class="flex flex-col sm:flex-row gap-4 items-end">' +
            (posterUrl ? '<img src="' + posterUrl + '" alt="' + escapeHtml(data.title) + '" referrerpolicy="no-referrer" class="hidden sm:block w-28 lg:w-32 aspect-[2/3] object-cover rounded-lg shadow-2xl ring-1 ring-white/10 shrink-0" onerror="if(window.__healPoster){window.__healPoster(this);}else{this.onerror=null;this.src=window.__getPosterSvg(this.alt);}" />' : '') +
            '<div class="flex-1 min-w-0">' +
              '<h2 class="text-2xl sm:text-3xl md:text-4xl font-black leading-tight mb-2 tracking-tight text-white" style="text-shadow: 0 2px 16px rgba(0,0,0,0.8);">' + escapeHtml(data.title) + '</h2>' +
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
        '<div class="flex flex-wrap items-center gap-3">' +
          '<button type="button" data-modal="watch" data-tmdbid="' + (data.tmdbId || tmdbId) + '" data-canonical-id="' + escapeHtml(data.canonicalId || tmdbId) + '" data-type="' + type + '" data-title="' + escapeHtml(data.title) + '" data-year="' + (data.year || '') + '" data-imdbid="' + (data.imdbId || '') + '" data-backdrop="' + (data.backdrop || '') + '"' + (isTv ? ' data-se="' + (data.initialSeason || 1) + '" data-ep="1"' : '') + ' class="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white text-black font-bold hover:bg-white/90 active:scale-95 transition text-sm shadow-xl cursor-pointer">' +
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

        '<!-- In-Modal Dedicated Ad Section 3: Cloud Mirror Sponsor -->' +
        '<div class="nm-ad-container !my-3" data-ad-container="ad-slot-modal-cloud">' +
          '<div class="nm-ad-label">Sponsored Server</div>' +
          '<div id="ad-slot-modal-cloud" class="nm-ad-slot nm-ad-modal"></div>' +
        '</div>' +

        cloudSectionHtml +

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

    // Render ad slots inside modal body
    if (window.Netflix4uAds) {
      window.Netflix4uAds.renderAll(titleModalBody);
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

    // Audio tabs click
    titleModalBody.querySelectorAll('.nm-lang-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        titleModalBody.querySelectorAll('.nm-lang-tab').forEach(function(b) { b.classList.remove('nm-lang-active'); });
        btn.classList.add('nm-lang-active');
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

  // Delegated Download Click Listener on Title Modal Body (100% Quote-Safe)
  if (titleModalBody) {
    titleModalBody.addEventListener('click', function(e) {
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

  function renderDownloadMirrors(links, title, isTv) {
    if (!links || !links.length) {
      return '<div class="p-5 rounded-xl bg-white/[0.03] border border-white/10 text-center space-y-2">' +
        '<div class="text-sm text-white/80 font-medium">Direct download mirrors being updated for this title.</div>' +
        '<div class="text-xs text-white/40">You can stream this title instantly using the "Watch Now" button above.</div>' +
      '</div>';
    }

    var hasSeriesStructure = isTv || links.some(function(l) { return l.season || l.episode; });

    if (hasSeriesStructure) {
      // Group series links by season -> episode
      var seasonMap = {};
      links.forEach(function(l) {
        var sNum = Number(l.season) || 1;
        var eNum = Number(l.episode) || 1;
        if (!seasonMap[sNum]) seasonMap[sNum] = {};
        if (!seasonMap[sNum][eNum]) seasonMap[sNum][eNum] = [];
        seasonMap[sNum][eNum].push(l);
      });

      var seasons = Object.keys(seasonMap).map(Number).sort(function(a, b) { return a - b; });
      if (!seasons.length) seasons = [1];

      return '<div class="dl-accordion">' +
        seasons.map(function(sNum, sIdx) {
          var epMap = seasonMap[sNum] || {};
          var epNums = Object.keys(epMap).map(Number).sort(function(a, b) { return a - b; });
          var isOpen = sIdx === 0 ? ' is-open' : '';

          var epRowsHtml = epNums.map(function(eNum) {
            var epLinks = epMap[eNum] || [];
            var epQualityPills = epLinks.map(function(link) {
              var q = String(link.quality || 'HD').toUpperCase();
              var rawUrl = link.url || '#';
              var cleanUrl = (window.getFastCloudDownloadHref && window.getFastCloudDownloadHref(rawUrl)) || rawUrl;
              return '<a href="' + cleanUrl + '" data-fast-download="' + encodeURIComponent(rawUrl) + '" class="px-2.5 py-1 rounded bg-white/10 hover:bg-red-600 active:scale-95 text-white font-bold text-xs flex items-center gap-1 transition cursor-pointer border border-white/10">' +
                '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>' +
                '<span>' + escapeHtml(q) + '</span>' +
                (link.size ? '<span class="text-white/50 text-[10px]">(' + escapeHtml(link.size) + ')</span>' : '') +
              '</a>';
            }).join('');

            return '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition">' +
              '<div class="flex items-center gap-2">' +
                '<span class="w-6 text-center text-xs font-bold text-white/50">E' + eNum + '</span>' +
                '<span class="text-xs font-semibold text-white/90">Episode ' + eNum + '</span>' +
              '</div>' +
              '<div class="flex flex-wrap items-center gap-1.5">' +
                epQualityPills +
              '</div>' +
            '</div>';
          }).join('');

          return '<div class="dl-accordion-item' + isOpen + '" data-accordion-item>' +
            '<button type="button" class="dl-accordion-header" data-accordion-toggle>' +
              '<span class="flex items-center gap-2">' +
                '<svg class="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>' +
                'Season ' + sNum + ' <span class="text-white/40 text-xs font-normal">(' + epNums.length + ' episodes available)</span>' +
              '</span>' +
              '<svg class="dl-accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>' +
            '</button>' +
            '<div class="dl-accordion-body space-y-2">' +
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
      var cleanUrl = (window.getFastCloudDownloadHref && window.getFastCloudDownloadHref(rawUrl)) || rawUrl;

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
          '<a href="' + cleanUrl + '" data-fast-download="' + encodeURIComponent(rawUrl) + '" class="dl-btn dl-cloud-btn cursor-pointer">' +
            '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>' +
            '<span>Fast Download</span>' +
          '</a>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderCloudSection(links, title, isTv) {
    return '<section id="download-mirrors-section" class="dl-section">' +
      '<div class="flex items-center justify-between mb-3.5">' +
        '<div class="flex items-center gap-2.5">' +
          '<div class="w-1.5 h-5 rounded-full bg-red-600"></div>' +
          '<h3 class="text-lg sm:text-xl font-bold tracking-tight text-white">Fast Cloud CDN Mirrors</h3>' +
        '</div>' +
        '<span class="text-xs text-green-400 font-semibold flex items-center gap-1">' +
          '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>' +
          'High-Speed CDN Active' +
        '</span>' +
      '</div>' +
      '<div id="modal-download-links" class="space-y-2.5">' +
        renderDownloadMirrors(links, title, isTv) +
      '</div>' +
    '</section>';
  }

  function renderDotmoviesSection(links, title, isTv, slug, canonicalId) {
    var cleanTitle = (title || 'Movie').replace(/\(\d{4}\)/g, '').trim();
    var dotmoviesSearchUrl = 'https://dotmobiz.com/?s=' + encodeURIComponent(cleanTitle);

    var headerHtml =
      '<div class="flex items-center justify-between mb-3.5">' +
        '<div class="flex items-center gap-2.5">' +
          '<span class="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black tracking-wider uppercase">DOTMOVIES</span>' +
          '<h3 class="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">' +
            'Dotmovies Direct Downloads' +
          '</h3>' +
        '</div>' +
        '<span class="text-xs text-amber-400 font-semibold flex items-center gap-1">' +
          '<svg class="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' +
          'Original NexDrive High-Speed' +
        '</span>' +
      '</div>';

    if (!links || !links.length) {
      return '<section id="dotmovies-download-section" class="dl-section dl-dotmovies-section mb-6">' +
        headerHtml +
        '<div class="p-4 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">' +
          '<div class="space-y-0.5">' +
            '<div class="text-sm font-semibold text-white/90">Dotmovies Releases & Multi-Audio Rips</div>' +
            '<div class="text-xs text-white/50">Access original Hindi & Multi-Audio releases directly on Dotmovies.</div>' +
          '</div>' +
          '<a href="' + dotmoviesSearchUrl + '" target="_blank" rel="noopener noreferrer" class="dl-btn dl-dotmovies-btn shrink-0 cursor-pointer">' +
            '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>' +
            '<span>Search on Dotmovies</span>' +
          '</a>' +
        '</div>' +
      '</section>';
    }

    var hasSeriesStructure = isTv || links.some(function(l) { return l.season || l.episode; });
    var linksContent = '';

    if (hasSeriesStructure) {
      var seasonMap = {};
      links.forEach(function(l) {
        var sNum = Number(l.season) || 1;
        var eNum = Number(l.episode) || 1;
        if (!seasonMap[sNum]) seasonMap[sNum] = {};
        if (!seasonMap[sNum][eNum]) seasonMap[sNum][eNum] = [];
        seasonMap[sNum][eNum].push(l);
      });

      var seasons = Object.keys(seasonMap).map(Number).sort(function(a, b) { return a - b; });
      if (!seasons.length) seasons = [1];

      linksContent = '<div class="dl-accordion">' +
        seasons.map(function(sNum, sIdx) {
          var epMap = seasonMap[sNum] || {};
          var epNums = Object.keys(epMap).map(Number).sort(function(a, b) { return a - b; });
          var isOpen = sIdx === 0 ? ' is-open' : '';

          var epRowsHtml = epNums.map(function(eNum) {
            var epLinks = epMap[eNum] || [];
            var epQualityPills = epLinks.map(function(link) {
              var q = String(link.quality || 'HD').toUpperCase();
              var rawUrl = link.url || '#';
              return '<a href="' + rawUrl + '" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500 hover:text-black active:scale-95 text-amber-300 font-bold text-xs flex items-center gap-1 transition cursor-pointer border border-amber-500/30">' +
                '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>' +
                '<span>' + escapeHtml(q) + '</span>' +
                (link.size ? '<span class="text-white/60 text-[10px]">(' + escapeHtml(link.size) + ')</span>' : '') +
              '</a>';
            }).join('');

            return '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-amber-500/[0.03] border border-amber-500/10 hover:bg-amber-500/[0.06] transition">' +
              '<div class="flex items-center gap-2">' +
                '<span class="w-6 text-center text-xs font-bold text-amber-400">E' + eNum + '</span>' +
                '<span class="text-xs font-semibold text-white/90">Episode ' + eNum + '</span>' +
              '</div>' +
              '<div class="flex flex-wrap items-center gap-1.5">' +
                epQualityPills +
              '</div>' +
            '</div>';
          }).join('');

          return '<div class="dl-accordion-item' + isOpen + '" data-accordion-item>' +
            '<button type="button" class="dl-accordion-header" data-accordion-toggle>' +
              '<span class="flex items-center gap-2">' +
                '<svg class="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline></svg>' +
                'Season ' + sNum + ' <span class="text-white/40 text-xs font-normal">(' + epNums.length + ' episodes on Dotmovies)</span>' +
              '</span>' +
              '<svg class="dl-accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>' +
            '</button>' +
            '<div class="dl-accordion-body space-y-2">' +
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
        var audioText = link.audio || 'Hindi Multi-Audio [Dotmovies NexDrive]';
        var rawUrl = link.url || '#';

        return '<div class="dl-card dl-dotmovies-card">' +
          '<div class="flex items-center gap-3 min-w-0">' +
            '<span class="dl-quality-badge dl-dotmovies-badge">' + escapeHtml(rawQual) + '</span>' +
            '<div class="min-w-0">' +
              '<div class="text-xs sm:text-sm font-bold text-white/95 truncate">' + escapeHtml(link.label || link.title || title) + '</div>' +
              '<div class="flex items-center gap-2 text-[11px] text-white/50 mt-0.5">' +
                '<span class="font-bold text-amber-400">' + escapeHtml(sizeText) + '</span>' +
                '<span>•</span>' +
                '<span class="truncate text-white/70">' + escapeHtml(audioText) + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="shrink-0">' +
            '<a href="' + rawUrl + '" target="_blank" rel="noopener noreferrer" class="dl-btn dl-dotmovies-btn cursor-pointer">' +
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

    var safeFallback = unwrapImageUrl(fallbackBackdrop || '');

    return episodes.map(function(ep) {
      var rawStill = ep.still_path || fallbackBackdrop || '';
      var still = unwrapImageUrl(rawStill);
      var epNum = ep.episode_number || 1;
      var epTitle = ep.name || ('Episode ' + epNum);
      var duration = ep.runtime ? ep.runtime + 'm' : '45m';
      var overview = ep.overview ? ep.overview.slice(0, 140) + '...' : 'Play episode ' + epNum + ' of Season ' + seasonNum + '.';
      var fullTitle = (parentTitle ? (parentTitle + ' - ') : '') + epTitle;

      return '<div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition group">' +
        '<div class="flex items-center gap-3 w-full sm:w-auto">' +
          '<span class="text-sm font-bold text-white/40 w-6 text-center">' + epNum + '</span>' +
          '<div class="relative w-28 sm:w-36 aspect-video rounded-lg overflow-hidden bg-white/5 shrink-0">' +
            (still ? '<img src="' + still + '" alt="' + escapeHtml(epTitle) + '" class="w-full h-full object-cover" loading="lazy" onerror="this.onerror=null;if(\'' + escapeHtml(safeFallback) + '\'){this.src=\'' + escapeHtml(safeFallback) + '\';}else{this.style.display=\'none\';}" />' : '') +
            '<div class="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">' +
              '<button type="button" data-modal="watch" data-tmdbid="' + tmdbId + '" data-type="tv" data-se="' + seasonNum + '" data-ep="' + epNum + '" data-title="' + escapeHtml(fullTitle) + '" data-year="' + (parentYear || '') + '" data-imdbid="' + (parentImdbId || '') + '" class="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg transform active:scale-95 cursor-pointer">' +
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
          '<button type="button" data-modal="watch" data-tmdbid="' + tmdbId + '" data-type="tv" data-se="' + seasonNum + '" data-ep="' + epNum + '" data-title="' + escapeHtml(fullTitle) + '" data-year="' + (parentYear || '') + '" data-imdbid="' + (parentImdbId || '') + '" class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer">' +
            '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
            '<span>Play</span>' +
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
    setTimeout(function() {
      titleModal.classList.add('hidden');
      titleModal.classList.remove('flex');
      titleModalBody.innerHTML = '';
      if (titleModalHeaderTitle) titleModalHeaderTitle.textContent = '';
      unlockBodyScroll();
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

  // ─── WATCH MODAL (Net27 Streaming Player UI) ───
  var SERVERS_CONFIG = [
    { id: 's1', name: 'Server 1 (Net27 Multi)', tag: 'Multi', tagClass: 'tag-multi', desc: 'Net27 Peachify Multi-Audio (Wolf, Spider, Multi)' },
    { id: 's2', name: 'Server 2 (VidLink Multi)', tag: 'Hindi/Dual', tagClass: 'tag-multi', desc: 'VidLink Pro Multi-Audio Track Selector' },
    { id: 's3', name: 'Server 3 (AllMovieLand)', tag: 'High-Speed', tagClass: 'tag-fast', desc: 'AllMovieLand Indian & Global Fast Player' },
    { id: 's4', name: 'Server 4 (2Embed Global)', tag: 'CDN', tagClass: 'tag-global', desc: '2Embed Global High-Speed Mirror' },
    { id: 's5', name: 'Server 5 (VidSrc PM)', tag: 'Fast Mirror', tagClass: 'tag-fast', desc: 'VidSrc PM High Uptime Mirror' },
    { id: 's6', name: 'Server 6 (AutoEmbed)', tag: 'Backup', tagClass: 'tag-fast', desc: 'AutoEmbed Reliable CDN Backup' }
  ];

  function openWatchModal(tmdbId, type, season, episode, backdrop, title, year, imdbId, canonicalId) {
    if (window.__closeSearchOverlay) window.__closeSearchOverlay();
    if (!watchModal || !watchModalIframe) return;

    type = type || 'movie';
    season = Number(season) || 1;
    episode = Number(episode) || 1;
    var isTv = type === 'tv' || type === 'series';

    // Verify Streaming Identity
    var cleanTmdbId = String(tmdbId || '').replace(/^(?:dotmobiz|tmdb(?:-movie|-series|-tv)?)-/, '');
    var hasValidStreamSource = false;
    if (/^\d{1,9}$/.test(cleanTmdbId) && Number(cleanTmdbId) > 0) {
      hasValidStreamSource = true;
      tmdbId = cleanTmdbId;
    } else if (imdbId && typeof imdbId === 'string' && imdbId.startsWith('tt')) {
      hasValidStreamSource = true;
    }

    if (!hasValidStreamSource) {
      watchModalIframe.src = 'about:blank';
      watchModal.classList.remove('hidden');
      watchModal.setAttribute('aria-hidden', 'false');
      lockBodyScroll();
      if (watchMetaTitle) watchMetaTitle.textContent = title || 'Netflix4U';
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
        '<p class="text-sm text-white/60 max-w-md">Our streaming CDN is searching for verified playback mirrors for "' + escapeHtml(title) + '". You can download this title directly from the title details page.</p>' +
        '<button onclick="window.Netflix4uModal.closeWatch();" class="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-sm transition cursor-pointer">Back to Details</button>';
      return;
    }

    var bannerEl = document.getElementById('watch-unavailable-banner');
    if (bannerEl) bannerEl.style.display = 'none';

    activeWatchParams = { tmdbId: tmdbId, type: type, season: season, episode: episode, backdrop: backdrop, title: title, year: year, imdbId: imdbId, canonicalId: canonicalId };

    // Update Top Floating Header Metadata
    if (watchMetaTitle) watchMetaTitle.textContent = title || 'Netflix4U';
    if (watchMetaYear) watchMetaYear.textContent = year || '2026';
    if (watchMetaType) {
      watchMetaType.textContent = isTv ? ('S' + season + ' E' + episode) : 'Movie';
    }

    // Build Server URLs
    var allMovieLandUrl = '';
    if (imdbId && typeof imdbId === 'string' && imdbId.startsWith('tt')) {
      allMovieLandUrl = isTv
        ? 'https://slast430did.com/play/' + encodeURIComponent(imdbId) + '?s=' + season + '&e=' + episode
        : 'https://slast430did.com/play/' + encodeURIComponent(imdbId);
    } else {
      allMovieLandUrl = isTv
        ? 'https://slast430did.com/play/' + encodeURIComponent(tmdbId) + '?s=' + season + '&e=' + episode
        : 'https://slast430did.com/play/' + encodeURIComponent(tmdbId);
      // Fetch IMDb ID asynchronously if not available at boot
      fetch('/api/catalog/title/' + encodeURIComponent(type) + '/' + encodeURIComponent(tmdbId))
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data && data.imdbId) {
            activeWatchParams.imdbId = data.imdbId;
            activeWatchServers.s3 = isTv
              ? 'https://slast430did.com/play/' + encodeURIComponent(data.imdbId) + '?s=' + season + '&e=' + episode
              : 'https://slast430did.com/play/' + encodeURIComponent(data.imdbId);
            if (currentWatchServer === 's3' && watchModalIframe) {
              watchModalIframe.src = activeWatchServers.s3;
            }
          }
        }).catch(function() {});
    }

    activeWatchServers = {
      s1: isTv
        ? 'https://peachify.top/embed/tv/' + tmdbId + '/' + season + '/' + episode
        : 'https://peachify.top/embed/movie/' + tmdbId,
      s2: isTv
        ? 'https://vidlink.pro/tv/' + tmdbId + '/' + season + '/' + episode + '?multiLang=true'
        : 'https://vidlink.pro/movie/' + tmdbId + '?multiLang=true',
      s3: allMovieLandUrl,
      s4: isTv
        ? 'https://www.2embed.cc/embedtv/' + tmdbId + '&s=' + season + '&e=' + episode
        : 'https://www.2embed.cc/embed/' + tmdbId,
      s5: isTv
        ? 'https://vidsrc.pm/embed/tv/' + tmdbId + '/' + season + '/' + episode
        : 'https://vidsrc.pm/embed/movie/' + tmdbId,
      s6: isTv
        ? 'https://autoembed.co/tv/tmdb/' + tmdbId + '/' + season + '/' + episode
        : 'https://autoembed.co/movie/tmdb/' + tmdbId
    };

    currentWatchServer = 's1';
    renderWatchServerMenu();
    updateActiveServerUi('s1');

    showWatchBackdrop(backdrop);
    watchModalIframe.src = activeWatchServers.s1;
    watchModal.classList.remove('hidden');
    watchModal.setAttribute('aria-hidden', 'false');
    lockBodyScroll();

    var hash = '#w=' + tmdbId + '-' + type;
    if (season) hash += '-' + season;
    if (episode) hash += '-' + episode;
    if (location.hash !== hash) {
      history.pushState({ watch: { tmdbId: tmdbId, type: type, se: season, ep: episode, title: title, year: year, imdbId: imdbId } }, '', hash);
    }
  }

  function renderWatchServerMenu() {
    if (!watchServerMenu) return;
    watchServerMenu.innerHTML = SERVERS_CONFIG.map(function(s) {
      var isSelected = s.id === currentWatchServer;
      return '<button type="button" data-switch-server="' + s.id + '" class="watch-server-item' + (isSelected ? ' is-selected' : '') + '">' +
        '<div class="flex items-center gap-2 min-w-0">' +
          '<span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0 ' + (isSelected ? 'animate-pulse' : 'opacity-70') + '"></span>' +
          '<span class="truncate">' + escapeHtml(s.name) + '</span>' +
        '</div>' +
        '<span class="watch-server-tag ' + s.tagClass + ' shrink-0 ml-2">' + escapeHtml(s.tag) + '</span>' +
      '</button>';
    }).join('');

    watchServerMenu.querySelectorAll('[data-switch-server]').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var sId = btn.dataset.switchServer;
        switchWatchServer(sId);
        closeServerMenu();
      });
    });
  }

  function updateActiveServerUi(serverId) {
    currentWatchServer = serverId;
    var cfg = SERVERS_CONFIG.find(function(s) { return s.id === serverId; }) || SERVERS_CONFIG[0];
    if (watchCurrentServerLabel) {
      watchCurrentServerLabel.textContent = cfg.name;
    }
    if (watchServerMenu) {
      watchServerMenu.querySelectorAll('[data-switch-server]').forEach(function(btn) {
        btn.classList.toggle('is-selected', btn.dataset.switchServer === serverId);
      });
    }
  }

  function switchWatchServer(serverId) {
    if (!activeWatchServers[serverId]) return;
    updateActiveServerUi(serverId);
    if (activeWatchParams && activeWatchParams.backdrop) {
      showWatchBackdrop(activeWatchParams.backdrop);
    }
    watchModalIframe.src = activeWatchServers[serverId];
  }

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

  function closeWatchModal() {
    if (!watchModal || !watchModalIframe) return;
    watchModalIframe.src = 'about:blank';
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
        '<p>Netflix4U is an entertainment discovery portal built for movie buffs, web series enthusiasts, and anime lovers. We aggregate verified, publicly accessible streaming and download mirrors into a seamless experience with zero mandatory signups or subscriptions.</p>' +
        '<div class="p-4 rounded-xl bg-white/[0.04] border border-white/10 space-y-2">' +
          '<div class="text-white font-bold flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-red-500"></span>Our Key Pillars</div>' +
          '<p class="text-xs text-white/70">• <strong>Multi-Server High Speed</strong>: 6 dedicated streaming servers including Net27 Peachify, VidLink Multi-Audio, and AllMovieLand.<br>' +
          '• <strong>Direct Fast Downloads</strong>: Zero-waiting cloud worker mirrors for 4K, 1080p, and 720p files.<br>' +
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
          '<li>Netflix4U operates as an indexer pointing to media streams and verified cloud worker mirrors hosted elsewhere on the internet.</li>' +
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
          '<a href="https://t.me/netflix_mirror_apk" target="_blank" rel="noopener noreferrer" class="p-3.5 rounded-xl bg-[#229ED9]/15 border border-[#229ED9]/30 hover:bg-[#229ED9]/25 transition flex items-center gap-3 group">' +
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
        var tmdbId = modalTrigger.dataset.tmdbid;
        var canonicalId = modalTrigger.dataset.canonicalId;
        var imdbId = modalTrigger.dataset.imdbid;
        var type = modalTrigger.dataset.type || 'movie';
        if (!tmdbId && !canonicalId) return;
        e.preventDefault();
        openTitleModal(tmdbId, type, true, canonicalId, imdbId);
      } else if (modalType === 'watch') {
        var tmdbId = modalTrigger.dataset.tmdbid;
        var canonicalId = modalTrigger.dataset.canonicalId;
        var type = modalTrigger.dataset.type || 'movie';
        var se = modalTrigger.dataset.se || 1;
        var ep = modalTrigger.dataset.ep || 1;
        var backdrop = modalTrigger.dataset.backdrop || '';
        var title = modalTrigger.dataset.title || '';
        var year = modalTrigger.dataset.year || '';
        var imdbId = modalTrigger.dataset.imdbid || '';
        if (!tmdbId && !canonicalId) return;
        e.preventDefault();
        openWatchModal(tmdbId, type, se, ep, backdrop, title, year, imdbId, canonicalId);
      } else if (modalType === 'trailer') {
        var yt = modalTrigger.dataset.yt;
        if (!yt) return;
        e.preventDefault();
        openTrailerModal(yt);
      }
      return;
    }

    var policyLink = e.target.closest('[data-policy-link]');
    if (policyLink) {
      e.preventDefault();
      var tab = policyLink.dataset.policyLink;
      openPolicyModal(tab);
      return;
    }
  });

  // Net27 Player Header Listeners
  if (watchBackBtn) watchBackBtn.addEventListener('click', closeWatchModal);
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
  if (watchModalClose) watchModalClose.addEventListener('click', closeWatchModal);
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
      setTimeout(hideWatchBackdrop, 400);
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (policyModal && !policyModal.classList.contains('hidden')) { closePolicyModal(); return; }
      if (trailerModal && !trailerModal.classList.contains('hidden')) { closeTrailerModal(); return; }
      if (watchModal && !watchModal.classList.contains('hidden')) { closeWatchModal(); return; }
      if (titleModal && !titleModal.classList.contains('hidden')) { closeTitleModal(); return; }
    }
  });

  window.addEventListener('message', function(e) {
    if (e.data === 'netmirror:close-watch') {
      closeWatchModal();
    }
  });

  // Global Exports
  window.Netflix4uModal = {
    openTitle: openTitleModal,
    closeTitle: closeTitleModal,
    openWatch: openWatchModal,
    closeWatch: closeWatchModal,
    openTrailer: openTrailerModal,
    closeTrailer: closeTrailerModal,
    openPolicy: openPolicyModal,
    closePolicy: closePolicyModal
  };
})();
