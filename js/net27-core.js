/**
 * Netflix4U Net27 Edition - Core Application Controller
 * Handles Honeycomb Loader, Theme Wash, Hero Carousel, Multi-Rail Engine & Search Overlay
 */
(function() {
  'use strict';

  function getPosterFallback(title) {
    var t = escapeHtml((title || 'Netflix4U').slice(0, 22));
    return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 450'><defs><linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%231a1028'/><stop offset='50%' stop-color='%2310111d'/><stop offset='100%' stop-color='%230a0a10'/></linearGradient></defs><rect width='300' height='450' fill='url(%23g)'/><circle cx='150' cy='180' r='42' fill='%23e50914' opacity='0.16'/><polygon points='142,165 168,180 142,195' fill='%23e50914'/><text x='150' y='260' font-family='sans-serif' font-size='15' font-weight='bold' fill='%23ffffff' text-anchor='middle' opacity='0.9'>" + encodeURIComponent(t) + "</text><text x='150' y='285' font-family='sans-serif' font-size='11' font-weight='700' fill='%23e50914' text-anchor='middle' letter-spacing='2'>NETFLIX4U</text></svg>";
  }
  window.__getPosterSvg = getPosterFallback;
  var NO_POSTER_SVG = getPosterFallback('Netflix4U');

  var progressBar = document.getElementById('progress-bar');
  var railsView = document.getElementById('rails-view');
  var gridView = document.getElementById('grid-view');
  var gridTitle = document.getElementById('grid-title');
  var gridMeta = document.getElementById('grid-meta');
  var gridContent = document.getElementById('grid-content');

  var searchInput = document.getElementById('search-input');
  var searchClear = document.getElementById('search-clear');
  var searchOverlay = document.getElementById('search-overlay');
  var soInput = document.getElementById('so-input');
  var soResults = document.getElementById('so-results');
  var soClose = document.getElementById('so-close');
  var soGo = document.getElementById('so-go');

  var heroSection = document.getElementById('hero');
  var heroTitle = document.getElementById('hero-title');
  var heroMeta = document.getElementById('hero-meta');
  var heroDesc = document.getElementById('hero-desc');
  var heroPlay = document.getElementById('hero-play');
  var heroInfo = document.getElementById('hero-info');
  var heroDownload = document.getElementById('hero-download');
  var heroClick = document.getElementById('hero-click');
  var heroDots = document.getElementById('hero-dots');
  var heroPrev = document.getElementById('hero-prev');
  var heroNext = document.getElementById('hero-next');

  var activeReqCount = 0;
  var heroItems = [];
  var currentHeroIdx = 0;
  var heroInterval = null;
  var currentPlatform = 'trending';

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[<>&"]/g, function(c) {
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c;
    });
  }

  // ─── Network Progress Bar ───
  function startProgress() {
    activeReqCount++;
    if (activeReqCount === 1 && progressBar) {
      progressBar.style.opacity = '1';
      progressBar.style.width = '30%';
    }
  }

  function endProgress() {
    activeReqCount = Math.max(0, activeReqCount - 1);
    if (activeReqCount === 0 && progressBar) {
      progressBar.style.width = '100%';
      setTimeout(function() {
        progressBar.style.opacity = '0';
        setTimeout(function() { progressBar.style.width = '0%'; }, 250);
      }, 200);
    }
  }

  async function apiFetch(url) {
    startProgress();
    try {
      var res = await fetch(url);
      return res;
    } finally {
      endProgress();
    }
  }

  // ─── Honeycomb Loader ───
  function initHoneycombLoader() {
    var hive = document.getElementById('nm-hive');
    if (!hive) return;
    var S = 16, cx = 105, cy = 105, R = 2;
    for (var q = -R; q <= R; q++) {
      for (var r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) {
        var x = cx + S * Math.sqrt(3) * (q + r / 2);
        var y = cy + S * 1.5 * r;
        var ring = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
        var hex = document.createElement('div');
        hex.className = 'nm-hex';
        hex.style.left = x + 'px';
        hex.style.top = y + 'px';
        hex.style.animationDelay = (ring * 0.16) + 's';
        hive.appendChild(hex);
      }
    }
    var loader = document.getElementById('nm-loader');
    function hideLoader() {
      if (!loader) return;
      loader.classList.add('nm-hide');
      setTimeout(function() { loader.style.display = 'none'; }, 450);
    }
    window.__nmHideLoader = hideLoader;
    setTimeout(hideLoader, 600); // Safety fallback: guarantee loader never gets stuck
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(hideLoader, 200);
    } else {
      document.addEventListener('DOMContentLoaded', function() { setTimeout(hideLoader, 200); });
      window.addEventListener('load', function() { setTimeout(hideLoader, 200); });
    }
  }

  // ─── Header Scroll ───
  function initHeaderScroll() {
    var header = document.getElementById('home-header');
    if (!header) return;
    var check = function() {
      if (window.scrollY > 40) header.classList.add('scrolled');
      else header.classList.remove('scrolled');
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
  }

  // ─── Hero Carousel ───
  function initHeroCarousel() {
    if (!heroSection) return;
    try {
      var rawHero = heroSection.dataset.hero;
      if (rawHero) heroItems = JSON.parse(rawHero);
    } catch(e) {
      heroItems = [];
    }
    if (!heroItems.length) return;

    renderHeroDots();
    showHeroSlide(0);
    startHeroTimer();

    if (heroPrev) heroPrev.addEventListener('click', function() {
      prevHeroSlide();
      startHeroTimer();
    });
    if (heroNext) heroNext.addEventListener('click', function() {
      nextHeroSlide();
      startHeroTimer();
    });

    heroSection.addEventListener('mouseenter', function() {
      if (heroInterval) clearInterval(heroInterval);
    });
    heroSection.addEventListener('mouseleave', function() {
      startHeroTimer();
    });
  }

  function startHeroTimer() {
    if (heroInterval) clearInterval(heroInterval);
    heroInterval = setInterval(nextHeroSlide, 6500);
  }

  function prevHeroSlide() {
    var idx = (currentHeroIdx - 1 + heroItems.length) % heroItems.length;
    showHeroSlide(idx);
  }

  function nextHeroSlide() {
    var idx = (currentHeroIdx + 1) % heroItems.length;
    showHeroSlide(idx);
  }

  function showHeroSlide(idx) {
    if (!heroItems.length || !heroItems[idx]) return;
    currentHeroIdx = idx;
    var item = heroItems[idx];

    // Toggle backdrop opacity
    var bgLayers = heroSection.querySelectorAll('.hero-bg');
    bgLayers.forEach(function(bg, i) {
      bg.style.opacity = (i === idx) ? '1' : '0';
    });

    // Update Text & Badges
    if (heroTitle) heroTitle.textContent = item.title;
    if (heroDesc) heroDesc.textContent = item.overview || '';
    if (heroMeta) {
      heroMeta.innerHTML =
        '<span class="px-1.5 py-0.5 rounded bg-yellow-400/90 text-black font-bold text-[11px]">⭐ ' + (item.rating ? Number(item.rating).toFixed(1) : '8.2') + '</span>' +
        '<span>' + (item.year || '2026') + '</span>' +
        '<span>•</span>' +
        '<span class="uppercase tracking-wider">' + (item.type === 'tv' ? 'Series' : 'Movie') + '</span>' +
        '<span class="px-1.5 py-0.5 rounded bg-white/15 text-[10px] tracking-wider font-bold">HD</span>';
    }

    // Update Action Buttons data attributes
    if (heroPlay) {
      heroPlay.dataset.tmdbid = item.tmdbId;
      heroPlay.dataset.type = item.type || 'movie';
      heroPlay.dataset.backdrop = item.backdrop || '';
      if (item.type === 'tv') {
        heroPlay.dataset.se = '1';
        heroPlay.dataset.ep = '1';
      } else {
        delete heroPlay.dataset.se;
        delete heroPlay.dataset.ep;
      }
    }
    if (heroInfo) {
      heroInfo.dataset.tmdbid = item.tmdbId;
      heroInfo.dataset.type = item.type || 'movie';
    }
    if (heroDownload) {
      heroDownload.dataset.tmdbid = item.tmdbId;
      heroDownload.dataset.type = item.type || 'movie';
    }
    if (heroClick) {
      heroClick.dataset.tmdbid = item.tmdbId;
      heroClick.dataset.type = item.type || 'movie';
      heroClick.setAttribute('aria-label', 'More info for ' + item.title);
    }

    // Update active dot
    if (heroDots) {
      heroDots.querySelectorAll('.hero-dot').forEach(function(dot, i) {
        if (i === idx) {
          dot.classList.remove('bg-white/30');
          dot.classList.add('bg-white', 'w-5');
        } else {
          dot.classList.remove('bg-white', 'w-5');
          dot.classList.add('bg-white/30');
        }
      });
    }
  }

  function renderHeroDots() {
    if (!heroDots) return;
    heroDots.innerHTML = heroItems.map(function(_, idx) {
      return '<button type="button" data-hero-dot="' + idx + '" aria-label="Show featured ' + (idx + 1) + '" class="hero-dot w-2 h-2 rounded-full bg-white/30 hover:bg-white/60 transition cursor-pointer"></button>';
    }).join('');

    heroDots.querySelectorAll('.hero-dot').forEach(function(dot) {
      dot.addEventListener('click', function() {
        var idx = Number(dot.dataset.heroDot);
        showHeroSlide(idx);
        startHeroTimer();
      });
    });
  }

  // ─── Platform Selector & Ambient Glow ───
  function initPlatformSwitcher() {
    var buttons = document.querySelectorAll('.platform-btn');
    var themeWash = document.getElementById('theme-wash');

    buttons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var platform = btn.dataset.platform;
        var color = btn.dataset.color || '#e50914';

        buttons.forEach(function(b) {
          b.classList.remove('is-active', 'text-white');
          b.classList.add('text-white/80');
        });
        btn.classList.add('is-active', 'text-white');
        btn.classList.remove('text-white/80');

        document.documentElement.style.setProperty('--accent', color);
        if (themeWash) {
          themeWash.style.background = 'radial-gradient(ellipse at top, ' + color + ' 0%, transparent 65%)';
        }

        // Reset search if active
        if (searchInput && searchInput.value) {
          searchInput.value = '';
          if (searchClear) searchClear.classList.add('hidden');
        }
        if (gridView) gridView.classList.add('hidden');
        if (railsView) railsView.classList.remove('hidden');

        window.scrollTo({ top: 0, behavior: 'smooth' });
        loadPlatformRails(platform);
      });
    });
  }

  // ─── Multi-Rail Engine ───
  var GENRES = { Action: 28, Adventure: 12, Comedy: 35, Crime: 80, Drama: 18, Family: 10751, Fantasy: 14, Horror: 27, Mystery: 9648, Romance: 10749, 'Sci-Fi': 878, Thriller: 53, Animation: 16 };
  var PLATFORM_LOGOS = {
    Netflix: '/images/platforms/FjWTYs9RfCsT.jpg',
    PrimeVideo: '/images/platforms/teMwgjoxOg9u.jpg',
    JioHotstar: '/images/platforms/JmxIsKiiiFkm.jpg',
    SonyLIV: '/images/platforms/IQHvNlAlUHxi.jpg',
    Crunchyroll: '/images/platforms/nnYmRNZy6VSX.jpg',
    MX: '/images/platforms/Hoj6RBCM9kDd.jpg'
  };

  function getRailConfigs(platform) {
    var reg = '&region=IN';
    if (platform === 'trending') {
      return [
        { key: 'trending-day', title: 'Top 10 Today', url: '/api/catalog/trending?window=day', ranked: true },
        { key: 'new-releases', title: 'New Releases', url: '/api/catalog/discover?type=movie&sort=release&year_from=2025&year_to=2026' + reg },
        { key: 'netflix-popular', title: 'Popular on Netflix', url: '/api/catalog/discover?platform=Netflix&type=movie' + reg, logo: PLATFORM_LOGOS.Netflix },
        { key: 'prime-popular', title: 'Popular on Prime Video', url: '/api/catalog/discover?platform=PrimeVideo&type=movie' + reg, logo: PLATFORM_LOGOS.PrimeVideo },
        { key: 'kdrama', title: 'Korean Dramas', url: '/api/catalog/discover?platform=Netflix&type=tv' + reg },
        { key: 'anime', title: 'Anime Series', url: '/api/catalog/discover?platform=Crunchyroll&type=tv' + reg, logo: PLATFORM_LOGOS.Crunchyroll },
        { key: 'action', title: 'Action Blockbusters', url: '/api/catalog/discover?type=movie&genre=' + GENRES.Action + reg },
        { key: 'comedy', title: 'Comedies', url: '/api/catalog/discover?type=movie&genre=' + GENRES.Comedy + reg },
        { key: 'top-rated', title: 'Critically Acclaimed', url: '/api/catalog/discover?type=movie&sort=rating' + reg }
      ];
    } else if (platform === 'LatestRelease') {
      return [
        { key: 'lr-trending', title: 'Trending This Week', url: '/api/catalog/trending?window=week', ranked: true },
        { key: 'lr-new-movies', title: 'New Movies (2026)', url: '/api/catalog/discover?type=movie&sort=release&year_from=2026&year_to=2026' + reg },
        { key: 'lr-2025-movies', title: 'Latest Movies (2025)', url: '/api/catalog/discover?type=movie&sort=release&year_from=2025&year_to=2025' + reg },
        { key: 'lr-new-series', title: 'New Series', url: '/api/catalog/discover?type=tv&sort=release&year_from=2025&year_to=2026' + reg },
        { key: 'lr-netflix', title: 'New on Netflix', url: '/api/catalog/discover?platform=Netflix&type=movie&sort=release' + reg, logo: PLATFORM_LOGOS.Netflix },
        { key: 'lr-prime', title: 'New on Prime Video', url: '/api/catalog/discover?platform=PrimeVideo&type=movie&sort=release' + reg, logo: PLATFORM_LOGOS.PrimeVideo },
        { key: 'lr-action', title: 'Latest Action', url: '/api/catalog/discover?type=movie&genre=' + GENRES.Action + '&sort=release' + reg }
      ];
    } else if (platform === 'Kids') {
      return [
        { key: 'kids-animation', title: 'Animated Movies', url: '/api/catalog/discover?type=movie&genre=' + GENRES.Animation + '&sort=popularity' + reg },
        { key: 'kids-family', title: 'Family Movies', url: '/api/catalog/discover?type=movie&genre=' + GENRES.Family + '&sort=popularity' + reg },
        { key: 'kids-new', title: 'New for Kids', url: '/api/catalog/discover?type=movie&genre=' + GENRES.Family + '&sort=release' + reg },
        { key: 'kids-adventure', title: 'Adventure Films', url: '/api/catalog/discover?type=movie&genre=' + GENRES.Adventure + '&sort=popularity' + reg },
        { key: 'kids-comedy', title: 'Funny Movies', url: '/api/catalog/discover?type=movie&genre=' + GENRES.Comedy + '&sort=popularity' + reg }
      ];
    } else {
      var base = '/api/catalog/discover?platform=' + encodeURIComponent(platform);
      var pLogo = PLATFORM_LOGOS[platform] || null;
      return [
        { key: platform + '-popular-m', title: 'Popular Movies', url: base + '&type=movie&sort=popularity' + reg, logo: pLogo },
        { key: platform + '-popular-s', title: 'Popular Series', url: base + '&type=tv&sort=popularity' + reg, logo: pLogo },
        { key: platform + '-new', title: 'New Releases', url: base + '&type=movie&sort=release' + reg, logo: pLogo },
        { key: platform + '-top-rated', title: 'Top Rated', url: base + '&type=movie&sort=rating' + reg, logo: pLogo },
        { key: platform + '-action', title: 'Action', url: base + '&type=movie&genre=' + GENRES.Action + reg, logo: pLogo },
        { key: platform + '-comedy', title: 'Comedy', url: base + '&type=movie&genre=' + GENRES.Comedy + reg, logo: pLogo }
      ];
    }
  }

  async function loadPlatformRails(platform) {
    currentPlatform = platform;
    var configs = getRailConfigs(platform);
    if (!railsView) return;

    // Render skeleton rails first
    railsView.innerHTML = configs.map(function(cfg) {
      return '<section data-rail-key="' + cfg.key + '" class="mb-6">' +
        '<div class="flex items-center gap-3 mb-3 px-1">' +
          '<div class="w-1.5 h-5 rounded-full" style="background: var(--accent, #ff6b00);"></div>' +
          (cfg.logo ? '<img src="' + cfg.logo + '" class="w-7 h-7 rounded-md bg-white object-cover shadow-sm" alt="" />' : '') +
          '<h2 class="text-base sm:text-lg font-bold tracking-tight text-white">' + escapeHtml(cfg.title) + '</h2>' +
        '</div>' +
        '<div class="relative rail-wrap">' +
          '<button type="button" data-rail-prev aria-label="Scroll left" class="rail-arrow rail-arrow-left rail-arrow-hidden">' +
            '<span class="rail-arrow-btn"><svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m15 18-6-6 6-6"/></svg></span>' +
          '</button>' +
          '<div class="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-none rail-scroll" data-rail-content>' +
            Array.from({ length: 7 }).map(function() {
              return '<div class="shrink-0 ' + (cfg.ranked ? 'w-40 sm:w-48' : 'w-[150px] sm:w-[200px]') + '"><div class="aspect-[2/3] rounded-lg shimmer"></div></div>';
            }).join('') +
          '</div>' +
          '<button type="button" data-rail-next aria-label="Scroll right" class="rail-arrow rail-arrow-right rail-arrow-hidden">' +
            '<span class="rail-arrow-btn"><svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg></span>' +
          '</button>' +
        '</div>' +
      '</section>';
    }).join('');

    // Fetch and populate each rail
    configs.forEach(async function(cfg) {
      try {
        var res = await apiFetch(cfg.url);
        var data = await res.json();
        var items = (data && data.items) || [];
        var validItems = items.filter(function(it) { return it && (it.poster || it.title); });

        var railSection = railsView.querySelector('[data-rail-key="' + cfg.key + '"]');
        if (!railSection) return;

        var contentDiv = railSection.querySelector('[data-rail-content]');
        if (!contentDiv) return;

        if (!validItems.length) {
          var fbFeed = cfg.ranked ? '/data/trending.json' : '/data/home_feed.json';
          try {
            var fbRes = await fetch(fbFeed);
            var fbData = await fbRes.json();
            var fbRaw = Array.isArray(fbData) ? fbData : (fbData.items || fbData.results || []);
            validItems = fbRaw.map(function(it) {
              return {
                tmdbId: it.tmdbId || it.id,
                title: it.title,
                year: it.year,
                poster: it.poster,
                backdrop: it.backdrop,
                rating: it.rating || 8.0,
                type: it.type === 'series' ? 'tv' : 'movie'
              };
            }).filter(function(it) { return it && (it.poster || it.title); });
          } catch(e) {}
        }

        if (!validItems.length) {
          railSection.style.display = 'none';
          return;
        }

        var maxItems = cfg.ranked ? 10 : 20;
        var widthClass = cfg.ranked ? 'w-40 sm:w-48' : 'w-[150px] sm:w-[200px]';

        contentDiv.innerHTML = validItems.slice(0, maxItems).map(function(item, idx) {
          return '<div class="shrink-0 ' + widthClass + '">' +
            renderCard(item, cfg.ranked ? { rank: idx + 1 } : {}) +
          '</div>';
        }).join('');

        initRailScrollButtons(railSection);
      } catch(err) {
        var sec = railsView.querySelector('[data-rail-key="' + cfg.key + '"]');
        if (!sec) return;
        try {
          var fbRes = await fetch(cfg.ranked ? '/data/trending.json' : '/data/home_feed.json');
          var fbData = await fbRes.json();
          var fbRaw = Array.isArray(fbData) ? fbData : (fbData.items || fbData.results || []);
          var fbItems = fbRaw.map(function(it) {
            return {
              tmdbId: it.tmdbId || it.id,
              title: it.title,
              year: it.year,
              poster: it.poster,
              backdrop: it.backdrop,
              rating: it.rating || 8.0,
              type: it.type === 'series' ? 'tv' : 'movie'
            };
          }).filter(function(it) { return it && (it.poster || it.title); });

          var cd = sec.querySelector('[data-rail-content]');
          if (cd && fbItems.length) {
            var mi = cfg.ranked ? 10 : 20;
            var wc = cfg.ranked ? 'w-40 sm:w-48' : 'w-[150px] sm:w-[200px]';
            cd.innerHTML = fbItems.slice(0, mi).map(function(item, idx) {
              return '<div class="shrink-0 ' + wc + '">' +
                renderCard(item, cfg.ranked ? { rank: idx + 1 } : {}) +
              '</div>';
            }).join('');
            initRailScrollButtons(sec);
            return;
          }
        } catch(e) {}
        sec.style.display = 'none';
      }
    });
  }

  function renderCard(item, options) {
    options = options || {};
    var title = item.title || 'Untitled';
    var posterUrl = (item.poster && !item.poster.includes('placehold.co')) ? item.poster : getPosterFallback(title);
    var isTv = item.type === 'tv';
    var matchScore = item.rating ? Math.round(item.rating * 10) + '% match' : '96% match';

    var ratingBadge = item.rating
      ? '<div class="absolute top-1.5 right-1.5 z-10 bg-black/75 backdrop-blur px-1.5 py-0.5 rounded text-[10px] font-bold text-yellow-300 flex items-center gap-0.5"><svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>' + Number(item.rating).toFixed(1) + '</div>'
      : '';

    var typeBadge = isTv
      ? '<div class="absolute top-1.5 left-1.5 z-10 bg-black/75 backdrop-blur px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-semibold text-white/90">Series</div>'
      : '';

    var hoverOverlay =
      '<div class="nm-hover absolute inset-x-0 bottom-0 px-2 pt-10 pb-2 bg-gradient-to-t from-black via-black/85 to-transparent opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 pointer-events-none">' +
        '<div class="flex items-center gap-1.5 mb-1.5">' +
          '<button type="button" aria-label="Play" data-modal="watch" data-tmdbid="' + item.tmdbId + '" data-type="' + (item.type || 'movie') + '" class="w-7 h-7 rounded-full bg-white flex items-center justify-center pointer-events-auto hover:scale-105 active:scale-95 transition shadow-lg cursor-pointer">' +
            '<svg class="w-3.5 h-3.5 ml-0.5 text-black" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
          '</button>' +
          '<button type="button" aria-label="More Info" data-modal="title" data-tmdbid="' + item.tmdbId + '" data-type="' + (item.type || 'movie') + '" class="w-7 h-7 rounded-full bg-white/20 backdrop-blur flex items-center justify-center pointer-events-auto hover:bg-white/30 transition border border-white/20 cursor-pointer">' +
            '<svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="flex items-center gap-1.5 text-[10px] font-medium leading-tight">' +
          '<span class="text-green-400 shrink-0">' + matchScore + '</span>' +
          '<span class="text-white/70 truncate">' + (item.year ? item.year + ' • ' : '') + (isTv ? 'Series' : 'Movie') + '</span>' +
        '</div>' +
      '</div>';

    if (options.rank) {
      return '<a href="#" data-modal="title" data-tmdbid="' + item.tmdbId + '" data-type="' + (item.type || 'movie') + '" class="nm-card card group block">' +
        '<div class="flex items-stretch gap-1">' +
          '<div class="rank-num shrink-0 self-end leading-none">' + options.rank + '</div>' +
          '<div class="nm-card-inner flex-1 relative aspect-[2/3] rounded-md overflow-hidden bg-white/5 ring-1 ring-white/10 group-hover:ring-2 group-hover:ring-red-600 transition">' +
            '<img src="' + posterUrl + '" loading="lazy" decoding="async" alt="' + escapeHtml(title) + '" class="w-full h-full object-cover" onerror="this.onerror=null;this.src=window.__getPosterSvg(this.alt);" />' +
            ratingBadge + typeBadge + hoverOverlay +
          '</div>' +
        '</div>' +
      '</a>';
    }

    return '<a href="#" data-modal="title" data-tmdbid="' + item.tmdbId + '" data-type="' + (item.type || 'movie') + '" class="nm-card card group block">' +
      '<div class="nm-card-inner relative aspect-[2/3] rounded-lg overflow-hidden bg-white/5 ring-1 ring-white/10 group-hover:ring-2 group-hover:ring-red-600 transition">' +
        '<img src="' + posterUrl + '" loading="lazy" decoding="async" alt="' + escapeHtml(title) + '" class="w-full h-full object-cover" onerror="this.onerror=null;this.src=window.__getPosterSvg(this.alt);" />' +
        ratingBadge + typeBadge + hoverOverlay +
      '</div>' +
      '<div class="mt-1.5 px-0.5 text-[12px] sm:text-[13px] text-white/85 font-medium truncate">' + escapeHtml(title) + '</div>' +
    '</a>';
  }

  function initRailScrollButtons(section) {
    var content = section.querySelector('[data-rail-content]');
    var prevBtn = section.querySelector('[data-rail-prev]');
    var nextBtn = section.querySelector('[data-rail-next]');
    if (!content) return;

    var updateArrows = function() {
      if (!prevBtn || !nextBtn) return;
      var sl = content.scrollLeft;
      var max = content.scrollWidth - content.clientWidth - 4;
      if (sl <= 10) prevBtn.classList.add('rail-arrow-hidden');
      else prevBtn.classList.remove('rail-arrow-hidden');
      if (sl >= max) nextBtn.classList.add('rail-arrow-hidden');
      else nextBtn.classList.remove('rail-arrow-hidden');
    };

    updateArrows();
    content.addEventListener('scroll', updateArrows, { passive: true });

    if (prevBtn) {
      prevBtn.addEventListener('click', function() {
        content.scrollBy({ left: -content.clientWidth * 0.75, behavior: 'smooth' });
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function() {
        content.scrollBy({ left: content.clientWidth * 0.75, behavior: 'smooth' });
      });
    }
  }

  // ─── Live Search & Search Overlay ───
  function initSearch() {
    var searchTimer = null;
    var overlayTimer = null;

    if (searchInput) {
      searchInput.addEventListener('input', function() {
        clearTimeout(searchTimer);
        var q = searchInput.value.trim();
        if (searchClear) searchClear.classList.toggle('hidden', !q);
        if (!q) {
          if (gridView) gridView.classList.add('hidden');
          if (railsView) railsView.classList.remove('hidden');
          if (heroSection) heroSection.classList.remove('hidden');
          return;
        }
        searchTimer = setTimeout(function() { executeSearch(q); }, 350);
      });

      searchInput.addEventListener('focus', function() {
        // Open Net27 search overlay
        if (searchOverlay) {
          searchOverlay.classList.remove('hidden');
          searchOverlay.setAttribute('aria-hidden', 'false');
          if (soInput) {
            soInput.value = searchInput.value;
            soInput.focus();
            if (soInput.value) executeOverlaySearch(soInput.value);
          }
        }
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', function() {
        if (searchInput) {
          searchInput.value = '';
          searchClear.classList.add('hidden');
        }
        if (gridView) gridView.classList.add('hidden');
        if (railsView) railsView.classList.remove('hidden');
        if (heroSection) heroSection.classList.remove('hidden');
      });
    }

    if (soInput) {
      soInput.addEventListener('input', function() {
        clearTimeout(overlayTimer);
        var q = soInput.value.trim();
        if (!q) {
          if (soResults) soResults.innerHTML = '';
          return;
        }
        overlayTimer = setTimeout(function() { executeOverlaySearch(q); }, 250);
      });
      soInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          var q = soInput.value.trim();
          if (q) {
            closeSearchOverlay();
            if (searchInput) searchInput.value = q;
            executeSearch(q);
          }
        }
      });
    }

    if (soClose) soClose.addEventListener('click', closeSearchOverlay);
    if (soGo) {
      soGo.addEventListener('click', function() {
        var q = soInput ? soInput.value.trim() : '';
        if (q) {
          closeSearchOverlay();
          if (searchInput) searchInput.value = q;
          executeSearch(q);
        }
      });
    }
  }

  function closeSearchOverlay() {
    if (!searchOverlay) return;
    searchOverlay.classList.add('hidden');
    searchOverlay.setAttribute('aria-hidden', 'true');
    if (soResults) soResults.innerHTML = '';
  }
  window.__closeSearchOverlay = closeSearchOverlay;

  async function executeOverlaySearch(query) {
    if (!soResults) return;
    soResults.innerHTML = '<div class="p-6 text-center text-white/50 text-sm flex items-center justify-center gap-2">' +
      '<div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>' +
      '<span>Searching catalog...</span>' +
    '</div>';

    try {
      var res = await apiFetch('/api/catalog/search?q=' + encodeURIComponent(query));
      var data = await res.json();
      var items = (data && data.items) || [];

      if (!items.length) {
        soResults.innerHTML = '<div class="p-8 text-center text-white/40 text-sm">No results found for "' + escapeHtml(query) + '"</div>';
        return;
      }

      soResults.innerHTML = items.slice(0, 10).map(function(item) {
        var poster = (item.poster && !item.poster.includes('placehold.co')) ? item.poster : (item.backdrop || getPosterFallback(item.title));
        var isTv = item.type === 'tv';
        return '<a href="#" data-modal="title" data-tmdbid="' + item.tmdbId + '" data-type="' + (item.type || 'movie') + '" class="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.08] transition group block">' +
          '<div class="relative w-16 sm:w-20 aspect-video rounded-md overflow-hidden bg-white/5 shrink-0">' +
            '<img src="' + poster + '" alt="' + escapeHtml(item.title) + '" referrerpolicy="no-referrer" class="w-full h-full object-cover" loading="lazy" onerror="this.onerror=null;this.src=window.__getPosterSvg(this.alt);" />' +
          '</div>' +
          '<div class="flex-1 min-w-0">' +
            '<div class="text-sm font-bold text-white group-hover:text-red-500 transition truncate">' + escapeHtml(item.title) + '</div>' +
            '<div class="flex items-center gap-2 text-xs text-white/50 mt-0.5">' +
              (item.rating ? '<span class="text-yellow-400 font-bold">⭐ ' + Number(item.rating).toFixed(1) + '</span>' : '') +
              '<span>' + (item.year || '') + '</span>' +
              '<span>•</span>' +
              '<span class="uppercase text-[10px] tracking-wide">' + (isTv ? 'Series' : 'Movie') + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="shrink-0 text-white/40 group-hover:text-white transition">' +
            '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 18 6-6-6-6"/></svg>' +
          '</div>' +
        '</a>';
      }).join('');
    } catch(e) {
      soResults.innerHTML = '<div class="p-6 text-center text-red-400 text-sm">Search error. Please try again.</div>';
    }
  }

  async function executeSearch(query) {
    if (!gridView || !gridContent) return;
    if (heroSection) heroSection.classList.add('hidden');
    if (railsView) railsView.classList.add('hidden');
    gridView.classList.remove('hidden');

    if (gridTitle) gridTitle.textContent = 'Search: "' + query + '"';
    if (gridMeta) gridMeta.textContent = 'Searching catalog...';
    gridContent.innerHTML = Array.from({ length: 10 }).map(function() {
      return '<div class="aspect-[2/3] rounded-lg shimmer"></div>';
    }).join('');

    try {
      var res = await apiFetch('/api/catalog/search?q=' + encodeURIComponent(query));
      var data = await res.json();
      var items = (data && data.items) || [];

      if (!items.length) {
        gridContent.innerHTML = '<div class="col-span-full text-white/40 text-center py-16">No matches found for "' + escapeHtml(query) + '".</div>';
        if (gridMeta) gridMeta.textContent = '0 results';
        return;
      }

      if (gridMeta) gridMeta.textContent = items.length + ' results found';
      gridContent.innerHTML = items.map(function(it) {
        return renderCard(it);
      }).join('');
    } catch(err) {
      gridContent.innerHTML = '<div class="col-span-full text-red-400 text-center py-16">Search failed.</div>';
    }
  }

  // ─── Deep Link & Initial URL Handling ───
  function handleInitialRoutes() {
    // 1. Direct Movie/Series/Title URL path (e.g. /movie/1339713 or /series/90545)
    var path = window.location.pathname;
    var pathMatch = path.match(/^\/(movie|series|tv|title)\/([^\/?#]+)/i);
    if (pathMatch) {
      var mediaType = pathMatch[1].toLowerCase() === 'movie' ? 'movie' : 'tv';
      var id = pathMatch[2];
      setTimeout(function() {
        if (window.Netflix4uModal && window.Netflix4uModal.openTitle) {
          window.Netflix4uModal.openTitle(id, mediaType, false);
        }
      }, 400);
    }

    // 2. Hash Watch link (e.g. #w=1339713-movie-1-1)
    var hash = window.location.hash;
    var hashMatch = hash.match(/^#w=([^-]+)-(movie|tv)(?:-(\d+)(?:-(\d+))?)?$/i);
    if (hashMatch) {
      var wId = hashMatch[1];
      var wType = hashMatch[2];
      var wSe = hashMatch[3] || 1;
      var wEp = hashMatch[4] || 1;
      setTimeout(function() {
        if (window.Netflix4uModal && window.Netflix4uModal.openWatch) {
          window.Netflix4uModal.openWatch(wId, wType, wSe, wEp, '');
        }
      }, 400);
    }
  }

  // ─── App Initialization ───
  function init() {
    initHoneycombLoader();
    initHeaderScroll();
    initHeroCarousel();
    initPlatformSwitcher();
    initSearch();
    loadPlatformRails('trending');
    handleInitialRoutes();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
