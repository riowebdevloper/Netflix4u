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

  var trailerModal = document.getElementById('trailer-modal');
  var trailerModalIframe = document.getElementById('trailer-modal-iframe');
  var trailerModalClose = document.getElementById('trailer-modal-close');

  var historyStack = [];
  var activeWatchServers = {};

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[<>&"]/g, function(c) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c;
    });
  }

  function lockBodyScroll() {
    document.body.style.overflow = 'hidden';
  }

  function unlockBodyScroll() {
    if (titleModal && titleModal.classList.contains('hidden') &&
        watchModal && watchModal.classList.contains('hidden') &&
        trailerModal && trailerModal.classList.contains('hidden')) {
      document.body.style.overflow = '';
    }
  }

  // ─── TITLE MODAL ───
  function openTitleModal(tmdbId, type, pushHistory) {
    if (window.__closeSearchOverlay) window.__closeSearchOverlay();
    if (pushHistory !== false) {
      historyStack.push({ tmdbId: tmdbId, type: type });
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

    fetchTitleDetails(tmdbId, type);
  }

  async function fetchTitleDetails(tmdbId, type) {
    try {
      var res = await fetch('/api/catalog/title/' + encodeURIComponent(type) + '/' + encodeURIComponent(tmdbId));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      renderTitleModal(data, tmdbId, type);
    } catch (err) {
      titleModalBody.innerHTML =
        '<div class="p-12 text-center text-white/60 space-y-3">' +
          '<div class="text-xl font-bold text-red-400">Failed to load title information</div>' +
          '<div class="text-sm">' + escapeHtml(err.message) + '</div>' +
          '<button onclick="window.Netflix4uModal.openTitle(' + tmdbId + ', \'' + type + '\')" class="px-5 py-2 rounded-md bg-white/10 hover:bg-white/20 text-white font-semibold text-xs mt-3 transition">Try Again</button>' +
        '</div>';
    }
  }

  function renderTitleModal(data, tmdbId, type) {
    if (titleModalHeaderTitle) {
      titleModalHeaderTitle.textContent = data.title || '';
    }

    var isTv = data.type === 'tv' || type === 'tv';
    var runtime = data.runtime ? Math.floor(data.runtime / 60) + 'h ' + (data.runtime % 60) + 'm' : '';
    var ratingBadge = (data.rating && data.rating > 0)
      ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-yellow-400/90 text-black font-bold text-[11px]"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' + data.rating.toFixed(1) + '</span>'
      : '';
    var matchScore = (data.rating && data.rating > 0) ? Math.round(data.rating * 10) + '% match' : '98% match';
    var cert = (data.certification && data.certification.rating) || 'U/A 13+';

    var castList = (data.cast || []).slice(0, 4).map(function(c) { return escapeHtml(c.name); }).join(', ') + ((data.cast || []).length > 4 ? ', more' : '');
    var genresList = (data.genres || []).map(function(g) { return escapeHtml(g.name); }).join(', ');

    // Cast circular avatars
    var castAvatars = (data.cast || []).slice(0, 12).map(function(c) {
      return '<div class="shrink-0 w-20 sm:w-24 text-center">' +
        '<div class="aspect-square rounded-full overflow-hidden bg-white/5 mb-1.5 ring-1 ring-white/10 mx-auto">' +
          (c.photo
            ? '<img src="' + c.photo + '" alt="' + escapeHtml(c.name) + '" class="w-full h-full object-cover" loading="lazy" decoding="async" />'
            : '<div class="w-full h-full flex items-center justify-center text-white/30 text-lg font-bold">' + escapeHtml(c.name.slice(0, 1)) + '</div>') +
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

    // Download links
    var downloadLinks = data.downloadLinks || data.links || [];
    var downloadMirrorsHtml = renderDownloadMirrors(downloadLinks, data.title);

    // Episodes for TV Series
    var episodesSectionHtml = '';
    if (isTv) {
      var seasons = data.seasons || [];
      var currentSeason = data.initialSeason || 1;
      var seasonOptions = seasons.map(function(s) {
        return '<option value="' + s.season_number + '"' + (s.season_number === currentSeason ? ' selected' : '') + '>' +
          escapeHtml(s.name || ('Season ' + s.season_number)) + ' · ' + (s.episode_count || 10) + ' ep</option>';
      }).join('');

      var initialEpisodesHtml = renderEpisodeList(data.initialEpisodes || [], tmdbId, currentSeason, data.backdrop, downloadLinks);

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
              return '<a href="#" data-modal="title" data-tmdbid="' + rec.tmdbId + '" data-type="' + (rec.type || 'movie') + '" class="shrink-0 w-28 sm:w-32 group block">' +
                '<div class="aspect-[2/3] rounded-lg overflow-hidden bg-white/5 ring-1 ring-white/10 group-hover:ring-2 group-hover:ring-red-600 transition">' +
                  (rec.poster ? '<img src="' + rec.poster + '" alt="' + escapeHtml(rec.title) + '" class="w-full h-full object-cover" loading="lazy" />' : '') +
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
        '<div class="aspect-video sm:aspect-[21/9] overflow-hidden bg-zinc-950">' +
          (data.backdrop ? '<img src="' + data.backdrop + '" alt="" class="w-full h-full object-cover" referrerpolicy="no-referrer" />' : '') +
          '<div class="absolute inset-0 bg-gradient-to-t from-[#15151c] via-[#15151c]/40 to-transparent"></div>' +
        '</div>' +
        '<div class="absolute inset-x-0 bottom-0 p-4 sm:p-6">' +
          '<div class="flex flex-col sm:flex-row gap-4 items-end">' +
            (data.poster ? '<img src="' + data.poster + '" alt="' + escapeHtml(data.title) + '" referrerpolicy="no-referrer" class="hidden sm:block w-28 lg:w-32 aspect-[2/3] object-cover rounded-lg shadow-2xl ring-1 ring-white/10 shrink-0" />' : '') +
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
          '<button type="button" data-modal="watch" data-tmdbid="' + tmdbId + '" data-type="' + type + '" data-backdrop="' + (data.backdrop || '') + '"' + (isTv ? ' data-se="' + (data.initialSeason || 1) + '" data-ep="1"' : '') + ' class="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white text-black font-bold hover:bg-white/90 active:scale-95 transition text-sm shadow-xl cursor-pointer">' +
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

        '<!-- Audio Languages Bar -->' +
        '<div class="pt-2">' +
          '<div class="text-[11px] uppercase tracking-wider font-bold text-white/40 mb-2">Available Audio Tracks</div>' +
          '<div class="nm-audio-bar flex gap-6 overflow-x-auto scrollbar-none">' +
            audioTabs +
          '</div>' +
        '</div>' +

        '<!-- DIRECT DOWNLOAD MIRRORS SECTION -->' +
        '<section id="download-mirrors-section" class="dl-section">' +
          '<div class="flex items-center justify-between mb-4">' +
            '<div class="flex items-center gap-2.5">' +
              '<div class="w-1.5 h-5 rounded-full bg-red-600"></div>' +
              '<h3 class="text-lg sm:text-xl font-bold tracking-tight text-white">Direct Download Mirrors</h3>' +
            '</div>' +
            '<span class="text-xs text-green-400 font-semibold flex items-center gap-1">' +
              '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>' +
              'High-Speed CDN Active' +
            '</span>' +
          '</div>' +
          '<div id="modal-download-links" class="space-y-2.5">' +
            downloadMirrorsHtml +
          '</div>' +
        '</section>' +

        episodesSectionHtml +

        (castAvatars ? '<section class="mt-8 pt-4 border-t border-white/10">' +
          '<div class="flex items-center gap-2.5 mb-3">' +
            '<div class="w-1.5 h-5 rounded-full bg-red-600"></div>' +
            '<h3 class="text-lg sm:text-xl font-bold tracking-tight text-white">Top Cast</h3>' +
          '</div>' +
          '<div class="flex gap-4 overflow-x-auto scrollbar-none pb-2">' + castAvatars + '</div>' +
        '</section>' : '') +

        recommendationsHtml +
      '</div>';

    // Hook events inside modal body
    titleModal.scrollTop = 0;
    var scrollBtn = document.getElementById('scroll-to-downloads-btn');
    if (scrollBtn) {
      scrollBtn.addEventListener('click', function() {
        var dlSection = document.getElementById('download-mirrors-section');
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
            episodeListContainer.innerHTML = renderEpisodeList(sData.episodes, tmdbId, selectedSeason, data.backdrop, downloadLinks);
          } else {
            episodeListContainer.innerHTML = '<div class="text-white/40 text-sm p-6 text-center">No episodes found for this season.</div>';
          }
        } catch(e) {
          episodeListContainer.innerHTML = '<div class="text-red-400 text-sm p-6 text-center">Failed to load season episodes.</div>';
        }
      });
    }
  }

  function renderDownloadMirrors(links, title) {
    if (!links || !links.length) {
      return '<div class="p-5 rounded-xl bg-white/[0.03] border border-white/10 text-center space-y-2">' +
        '<div class="text-sm text-white/80 font-medium">Direct download mirrors being updated for this title.</div>' +
        '<div class="text-xs text-white/40">You can stream this movie instantly using the "Watch Now" button above.</div>' +
      '</div>';
    }

    return links.map(function(link, index) {
      var rawQual = String(link.quality || 'HD').toUpperCase();
      var qualBadgeClass = 'dl-quality-1080p';
      if (rawQual.includes('4K') || rawQual.includes('2160')) qualBadgeClass = 'dl-quality-4k';
      else if (rawQual.includes('720')) qualBadgeClass = 'dl-quality-720p';
      else if (rawQual.includes('480')) qualBadgeClass = 'dl-quality-480p';

      var sizeText = link.size || (rawQual.includes('4K') ? '4.8 GB' : rawQual.includes('1080') ? '2.4 GB' : rawQual.includes('720') ? '1.1 GB' : '550 MB');
      var audioText = link.audio || 'Hindi + English [Multi-Audio]';
      var cleanUrl = (window.getFastCloudDownloadHref && window.getFastCloudDownloadHref(link.url)) || link.url;

      return '<div class="dl-card">' +
        '<div class="flex items-center gap-3 min-w-0">' +
          '<span class="dl-quality-badge ' + qualBadgeClass + '">' + escapeHtml(rawQual) + '</span>' +
          '<div class="min-w-0">' +
            '<div class="text-xs sm:text-sm font-bold text-white/90 truncate">' + escapeHtml(link.title || title) + '</div>' +
            '<div class="flex items-center gap-2 text-[11px] text-white/50 mt-0.5">' +
              '<span class="font-semibold text-white/70">' + escapeHtml(sizeText) + '</span>' +
              '<span>•</span>' +
              '<span class="truncate text-white/60">' + escapeHtml(audioText) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="shrink-0">' +
          '<a href="' + cleanUrl + '" onclick="window.handleFastCloudDownload(event, \'' + (link.url || cleanUrl) + '\')" class="dl-btn dl-cloud-btn">' +
            '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>' +
            '<span>Fast Download</span>' +
          '</a>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderEpisodeList(episodes, tmdbId, seasonNum, fallbackBackdrop, downloadLinks) {
    if (!episodes || !episodes.length) {
      return '<div class="text-white/40 text-sm p-4 text-center">No episodes available.</div>';
    }

    return episodes.map(function(ep) {
      var still = ep.still_path || fallbackBackdrop || '';
      var epNum = ep.episode_number || 1;
      var epTitle = ep.name || ('Episode ' + epNum);
      var duration = ep.runtime ? ep.runtime + 'm' : '45m';
      var overview = ep.overview ? ep.overview.slice(0, 140) + '...' : 'Play episode ' + epNum + ' of Season ' + seasonNum + '.';

      return '<div class="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition group">' +
        '<div class="flex items-center gap-3 w-full sm:w-auto">' +
          '<span class="text-sm font-bold text-white/40 w-6 text-center">' + epNum + '</span>' +
          '<div class="relative w-28 sm:w-36 aspect-video rounded-lg overflow-hidden bg-white/5 shrink-0">' +
            (still ? '<img src="' + still + '" alt="' + escapeHtml(epTitle) + '" class="w-full h-full object-cover" loading="lazy" />' : '') +
            '<div class="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">' +
              '<button type="button" data-modal="watch" data-tmdbid="' + tmdbId + '" data-type="tv" data-se="' + seasonNum + '" data-ep="' + epNum + '" class="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-lg transform active:scale-95">' +
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
          '<button type="button" data-modal="watch" data-tmdbid="' + tmdbId + '" data-type="tv" data-se="' + seasonNum + '" data-ep="' + epNum + '" class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer">' +
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

  // ─── WATCH MODAL ───
  function openWatchModal(tmdbId, type, season, episode, backdrop) {
    if (window.__closeSearchOverlay) window.__closeSearchOverlay();
    if (!watchModal || !watchModalIframe) return;

    type = type || 'movie';
    season = season || 1;
    episode = episode || 1;
    var isTv = type === 'tv';

    // Sanitize TMDB ID to prevent non-numeric prefixes
    if (typeof tmdbId === 'string') {
      tmdbId = tmdbId.replace(/^(?:dotmobiz|tmdb(?:-movie|-series|-tv)?)-/, '');
    }

    activeWatchServers = {
      s1: isTv
        ? 'https://vidlink.pro/tv/' + tmdbId + '/' + season + '/' + episode + '?multiLang=true'
        : 'https://vidlink.pro/movie/' + tmdbId + '?multiLang=true',
      s2: isTv
        ? 'https://peachify.top/embed/tv/' + tmdbId + '/' + season + '/' + episode
        : 'https://peachify.top/embed/movie/' + tmdbId,
      s3: isTv
        ? 'https://www.2embed.cc/embedtv/' + tmdbId + '&s=' + season + '&e=' + episode
        : 'https://www.2embed.cc/embed/' + tmdbId,
      s4: isTv
        ? 'https://vidsrc.pm/embed/tv/' + tmdbId + '/' + season + '/' + episode
        : 'https://vidsrc.pm/embed/movie/' + tmdbId,
      s5: isTv
        ? 'https://autoembed.co/tv/tmdb/' + tmdbId + '/' + season + '/' + episode
        : 'https://autoembed.co/movie/tmdb/' + tmdbId
    };

    // Render Server Switcher in Watch Modal Header
    if (watchPlayerBar) {
      watchPlayerBar.innerHTML =
        '<button type="button" class="server-tab-btn is-active" data-server="s1">🟢 Server 1 (VidLink Multi-Audio)</button>' +
        '<button type="button" class="server-tab-btn" data-server="s2">🔵 Server 2 (Net27 Fast)</button>' +
        '<button type="button" class="server-tab-btn" data-server="s3">🟣 Server 3 (2Embed Global)</button>' +
        '<button type="button" class="server-tab-btn" data-server="s4">🟠 Server 4 (VidSrc PM)</button>' +
        '<button type="button" class="server-tab-btn" data-server="s5">🟡 Server 5 (AutoEmbed)</button>';

      watchPlayerBar.querySelectorAll('.server-tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          watchPlayerBar.querySelectorAll('.server-tab-btn').forEach(function(b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');
          var sKey = btn.dataset.server;
          if (activeWatchServers[sKey]) {
            showWatchBackdrop(backdrop);
            watchModalIframe.src = activeWatchServers[sKey];
          }
        });
      });
    }

    showWatchBackdrop(backdrop);
    watchModalIframe.src = activeWatchServers.s1;
    watchModal.classList.remove('hidden');
    watchModal.setAttribute('aria-hidden', 'false');
    lockBodyScroll();

    var hash = '#w=' + tmdbId + '-' + type;
    if (season) hash += '-' + season;
    if (episode) hash += '-' + episode;
    if (location.hash !== hash) {
      history.pushState({ watch: { tmdbId: tmdbId, type: type, se: season, ep: episode } }, '', hash);
    }
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
    hideWatchBackdrop();
    unlockBodyScroll();
    if (location.hash && location.hash.startsWith('#w=')) {
      try {
        history.replaceState(null, '', location.pathname + location.search);
      } catch(e) {}
    }
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
    if (!modalTrigger) return;
    var modalType = modalTrigger.dataset.modal;

    if (modalType === 'title') {
      var tmdbId = modalTrigger.dataset.tmdbid;
      var type = modalTrigger.dataset.type || 'movie';
      if (!tmdbId) return;
      e.preventDefault();
      openTitleModal(tmdbId, type);
    } else if (modalType === 'watch') {
      var tmdbId = modalTrigger.dataset.tmdbid;
      var type = modalTrigger.dataset.type || 'movie';
      var se = modalTrigger.dataset.se || 1;
      var ep = modalTrigger.dataset.ep || 1;
      var backdrop = modalTrigger.dataset.backdrop || '';
      if (!tmdbId) return;
      e.preventDefault();
      openWatchModal(tmdbId, type, se, ep, backdrop);
    } else if (modalType === 'trailer') {
      var yt = modalTrigger.dataset.yt;
      if (!yt) return;
      e.preventDefault();
      openTrailerModal(yt);
    }
  });

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
    closeTrailer: closeTrailerModal
  };
})();
