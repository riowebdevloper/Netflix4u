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
  window.__unwrapImageUrl = unwrapImageUrl;
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

  // ─── Toast Notification System ───
  function showToast(message, icon) {
    var container = document.getElementById('toast-container');
    if (!container) return;
    var toast = document.createElement('div');
    toast.className = 'nm-toast';
    var ic = icon || '<svg class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
    toast.innerHTML = ic + '<span>' + escapeHtml(message) + '</span>';
    container.appendChild(toast);
    requestAnimationFrame(function() {
      toast.classList.add('show');
    });
    setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() { toast.remove(); }, 300);
    }, 2800);
  }
  window.__showToast = showToast;

  // ─── My List (Watchlist) Storage Engine ───
  var MY_LIST_KEY = 'n4u_my_list';
  function getMyList() {
    try {
      var raw = localStorage.getItem(MY_LIST_KEY) || localStorage.getItem('n4u_my_list_v1');
      return raw ? JSON.parse(raw) : [];
    } catch(e) {
      return [];
    }
  }
  function isBookmarked(id) {
    if (!id) return false;
    var list = getMyList();
    return list.some(function(item) {
      return String(item.tmdbId || item.id) === String(id) || String(item.canonicalId) === String(id);
    });
  }
  function toggleMyList(item) {
    if (!item) return false;
    var id = String(item.tmdbId || item.id || item.canonicalId);
    var list = getMyList();
    var idx = list.findIndex(function(x) {
      return String(x.tmdbId || x.id || x.canonicalId) === id;
    });
    var added = false;
    if (idx >= 0) {
      list.splice(idx, 1);
      added = false;
      showToast('Removed from My List', '<svg class="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>');
    } else {
      list.unshift({
        tmdbId: item.tmdbId || item.id,
        canonicalId: item.canonicalId || item.id || item.tmdbId,
        imdbId: item.imdbId || '',
        title: item.title,
        poster: item.poster,
        backdrop: item.backdrop,
        year: item.year,
        type: item.type || 'movie',
        rating: item.rating || 8.0,
        addedAt: Date.now()
      });
      added = true;
      showToast('Added to My List', '<svg class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="currentColor"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>');
    }
    try {
      localStorage.setItem(MY_LIST_KEY, JSON.stringify(list));
      localStorage.setItem('n4u_my_list_v1', JSON.stringify(list));
    } catch(e) {}
    window.dispatchEvent(new CustomEvent('mylist-changed', { detail: { id: id, added: added } }));
    return added;
  }
  window.__getMyList = getMyList;
  window.__isBookmarked = isBookmarked;
  window.__toggleMyList = toggleMyList;

  // Reactive My List synchronization across open views and card badges
  window.addEventListener('mylist-changed', function(e) {
    if (!e || !e.detail) return;
    var changedId = String(e.detail.id);
    var isAdded = Boolean(e.detail.added);
    document.querySelectorAll('[data-card-bookmark="' + changedId + '"]').forEach(function(btn) {
      btn.classList.toggle('is-bookmarked', isAdded);
      btn.title = isAdded ? 'In My List' : 'Add to My List';
      var svg = btn.querySelector('svg');
      if (svg) svg.setAttribute('fill', isAdded ? 'currentColor' : 'none');
    });
    if (currentPlatform === 'mylist') {
      loadPlatformRails('mylist');
    }
  });

  // ─── Continue Watching Engine (Local Playback Resume) ───
  var CONTINUE_KEY = 'n4u_continue_watching';
  function getContinueWatching() {
    try {
      var raw = localStorage.getItem(CONTINUE_KEY) || localStorage.getItem('n4u_continue_watching_v1');
      return raw ? JSON.parse(raw) : [];
    } catch(e) {
      return [];
    }
  }
  function saveContinueWatching(item) {
    if (!item || (!item.tmdbId && !item.canonicalId)) return;
    var id = String(item.tmdbId || item.canonicalId);
    var list = getContinueWatching();
    list = list.filter(function(x) {
      return String(x.tmdbId || x.canonicalId) !== id;
    });
    list.unshift({
      tmdbId: item.tmdbId,
      canonicalId: item.canonicalId || item.tmdbId,
      title: item.title || 'Movie',
      poster: item.poster || '',
      backdrop: item.backdrop || '',
      type: item.type || 'movie',
      year: item.year || '',
      se: item.se || 1,
      ep: item.ep || 1,
      progress: item.progress || 52,
      lastWatched: Date.now()
    });
    if (list.length > 15) list = list.slice(0, 15);
    try {
      localStorage.setItem(CONTINUE_KEY, JSON.stringify(list));
      localStorage.setItem('n4u_continue_watching_v1', JSON.stringify(list));
    } catch(e) {}
    if (currentPlatform === 'trending') {
      renderContinueWatchingRail();
    }
  }
  function removeContinueWatching(id) {
    var list = getContinueWatching().filter(function(x) {
      return String(x.tmdbId || x.canonicalId) !== String(id);
    });
    try {
      localStorage.setItem(CONTINUE_KEY, JSON.stringify(list));
      localStorage.setItem('n4u_continue_watching_v1', JSON.stringify(list));
    } catch(e) {}
    renderContinueWatchingRail();
    showToast('Removed from Continue Watching');
  }
  window.__saveContinueWatching = saveContinueWatching;
  window.__removeContinueWatching = removeContinueWatching;

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

  // ─── SWR Cache Layer (sessionStorage) ───
  var CACHE_PREFIX = 'n4u_cache_rail_v4_';
  var CACHE_TTL_MS = 15 * 60 * 1000; // 15 mins fresh
  var STALE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours usable stale

  function getCachedRail(key) {
    try {
      var raw = sessionStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      var age = Date.now() - parsed.timestamp;
      if (age > STALE_TTL_MS) {
        sessionStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }
      return {
        items: parsed.items,
        isFresh: age < CACHE_TTL_MS
      };
    } catch (e) {
      return null;
    }
  }

  function setCachedRail(key, items) {
    try {
      if (!items || !items.length) return;
      sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
        timestamp: Date.now(),
        items: items
      }));
    } catch (e) {}
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

    // Touch Swipe Support for Mobile (320px - 768px)
    var touchStartX = 0;
    var touchStartY = 0;
    heroSection.addEventListener('touchstart', function(e) {
      if (e.touches && e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    heroSection.addEventListener('touchend', function(e) {
      if (!touchStartX) return;
      var touchEndX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : 0;
      var touchEndY = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : 0;
      var diffX = touchEndX - touchStartX;
      var diffY = touchEndY - touchStartY;
      if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0) {
          nextHeroSlide();
        } else {
          prevHeroSlide();
        }
        startHeroTimer();
      }
      touchStartX = 0;
      touchStartY = 0;
    }, { passive: true });

    // Dynamic Hero Carousel Sync with Live Trending Feed
    syncHeroWithTrending();
  }

  async function syncHeroWithTrending() {
    // Preserve exact net27.cc featured hero titles if already present in data-hero
    if (heroItems && heroItems.length >= 5) return;
    try {
      var items = null;
      var cached = getCachedRail('trending-day');
      if (cached && cached.items && cached.items.length) {
        items = cached.items;
      } else {
        var res = await fetch('/api/catalog/trending?window=day');
        if (res && res.ok) {
          var data = await res.json();
          items = data && data.items;
          if (items && items.length) {
            setCachedRail('trending-day', items);
          }
        }
      }

      if (!items || !items.length) return;

      var valid = items.filter(function(it) {
        return it && it.tmdbId && it.title && (it.backdrop || it.poster);
      }).slice(0, 5);

      if (valid.length < 3) return;

      heroItems = valid.map(function(it) {
        var bdrop = it.backdrop || it.poster;
        if (bdrop && !bdrop.startsWith('http') && !bdrop.startsWith('data:')) {
          bdrop = 'https://wsrv.nl/?url=image.tmdb.org/t/p/w1280/' + bdrop.replace(/^\//, '');
        }
        return {
          tmdbId: it.tmdbId,
          title: it.title,
          year: it.year || '2026',
          backdrop: bdrop,
          overview: it.overview || '',
          rating: it.rating ? Number(it.rating) : 8.2,
          type: it.type === 'tv' || it.type === 'series' ? 'tv' : 'movie'
        };
      });

      // Update background layers seamlessly
      var existingBgs = heroSection.querySelectorAll('.hero-bg');
      existingBgs.forEach(function(el) { el.remove(); });

      var clickTrigger = heroSection.querySelector('#hero-click');
      heroItems.forEach(function(item, i) {
        var bg = document.createElement('div');
        bg.className = 'hero-bg absolute inset-0 bg-cover bg-center transition-opacity duration-[1200ms]';
        bg.style.backgroundImage = 'url("' + item.backdrop + '")';
        bg.style.opacity = (i === currentHeroIdx) ? '1' : '0';
        bg.style.zIndex = String(10 - i);
        if (clickTrigger) {
          heroSection.insertBefore(bg, clickTrigger);
        } else {
          heroSection.prepend(bg);
        }
      });

      renderHeroDots();
      showHeroSlide(currentHeroIdx % heroItems.length);
    } catch(e) {}
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
        { key: 'top-rated', title: 'Critically Acclaimed', url: '/api/catalog/discover?type=movie&sort=rating' + reg },
        { key: 'bollywood', title: 'Bollywood Blockbusters', url: '/api/category/bollywood' },
        { key: 'hollywood', title: 'Hollywood Hits', url: '/api/category/hollywood' },
        { key: 'south-indian', title: 'South Indian Cinema', url: '/api/category/south-indian' },
        { key: 'hindi-dubbed', title: 'Hindi Dubbed Movies', url: '/api/category/hindi-dubbed' }
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

  // ─── IntersectionObserver for Lazy Rail Loading ───
  var railObserver = null;
  if (typeof window !== 'undefined' && 'IntersectionObserver' in window) {
    railObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var target = entry.target;
          railObserver.unobserve(target);
          if (typeof target._loadRail === 'function') {
            target._loadRail();
            delete target._loadRail;
          }
        }
      });
    }, { rootMargin: '350px 0px' });
  }

  async function populateRailContent(cfg, railSection, items) {
    var contentDiv = railSection.querySelector('[data-rail-content]');
    if (!contentDiv) return;
    if (!items || !items.length) {
      railSection.style.display = 'none';
      return;
    }

    var maxItems = cfg.ranked ? 10 : 20;
    var widthClass = cfg.ranked ? 'w-40 sm:w-48' : 'w-[150px] sm:w-[200px]';

    contentDiv.innerHTML = items.slice(0, maxItems).map(function(item, idx) {
      return '<div class="shrink-0 ' + widthClass + '">' +
        renderCard(item, cfg.ranked ? { rank: idx + 1 } : {}) +
      '</div>';
    }).join('');

    initRailScrollButtons(railSection);
  }

  async function fetchRailItems(cfg) {
    try {
      var res = await apiFetch(cfg.url);
      var data = await res.json();
      var items = (data && data.items) || [];
      var valid = items.filter(function(it) { return it && (it.poster || it.title); });
      if (valid.length) {
        setCachedRail(cfg.key, valid);
        return valid;
      }
    } catch(e) {}

    // Fallback feed from local verified JSON
    try {
      var fbKey = cfg.key.replace(/^lr-/, '');
      var fbFeed = '/data/' + fbKey + '.json';
      if (cfg.ranked) fbFeed = '/data/trending.json';
      var fbRes = await fetch(fbFeed);
      if (fbRes.ok) {
        var fbData = await fbRes.json();
        var fbRaw = Array.isArray(fbData) ? fbData : (fbData.items || fbData.results || []);
        var fbValid = fbRaw.map(function(it) {
          return {
            tmdbId: it.tmdbId || it.id,
            canonicalId: it.canonicalId || it.id,
            imdbId: it.imdbId || '',
            title: it.title,
            year: it.year,
            poster: it.poster,
            backdrop: it.backdrop,
            rating: it.rating || 8.0,
            type: it.type === 'series' || it.type === 'tv' ? 'tv' : 'movie'
          };
        }).filter(function(it) { return it && (it.poster || it.title); });
        if (fbValid.length) {
          setCachedRail(cfg.key, fbValid);
          return fbValid;
        }
      }
    } catch(e) {}

    return [];
  }

  async function loadPlatformRails(platform) {
    currentPlatform = platform;

    // Handle "My List" Tab
    if (platform === 'mylist') {
      var myList = getMyList();
      if (!railsView) return;
      if (!myList.length) {
        railsView.innerHTML =
          '<section class="py-16 text-center max-w-md mx-auto px-4">' +
            '<div class="w-16 h-16 rounded-full bg-white/10 text-white/40 flex items-center justify-center mx-auto mb-4">' +
              '<svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>' +
            '</div>' +
            '<h3 class="text-xl font-bold text-white mb-2">Your List is Empty</h3>' +
            '<p class="text-sm text-white/60 mb-6 leading-relaxed">Click the bookmark icon on any movie or series to save it here for quick access anytime.</p>' +
            '<button type="button" onclick="document.querySelector(\'[data-platform=trending]\').click()" class="px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition shadow-lg cursor-pointer">Explore Trending Titles</button>' +
          '</section>';
        return;
      }
      railsView.innerHTML =
        '<section class="mb-8">' +
          '<div class="flex items-center justify-between mb-4 px-1">' +
            '<div class="flex items-center gap-3">' +
              '<div class="w-1.5 h-5 rounded-full bg-red-600"></div>' +
              '<h2 class="text-lg sm:text-xl font-bold tracking-tight text-white">My List (' + myList.length + ')</h2>' +
            '</div>' +
          '</div>' +
          '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">' +
            myList.map(function(item) {
              return renderCard(item);
            }).join('') +
          '</div>' +
        '</section>';
      return;
    }

    var configs = getRailConfigs(platform);
    if (!railsView) return;

    // Disconnect previous observer targets
    if (railObserver) {
      railsView.querySelectorAll('[data-rail-key]').forEach(function(el) {
        railObserver.unobserve(el);
      });
    }

    // Fast SWR Check: Pre-read cached rails for instant rendering (<50ms)
    var cachedDataMap = {};
    configs.forEach(function(cfg) {
      var cached = getCachedRail(cfg.key);
      if (cached && cached.items && cached.items.length) {
        cachedDataMap[cfg.key] = cached;
      }
    });

    // Render rails: if cached, cards show instantly; otherwise, skeleton shimmer
    railsView.innerHTML = configs.map(function(cfg, idx) {
      var cached = cachedDataMap[cfg.key];
      var innerHtml = '';
      if (cached && cached.items && cached.items.length) {
        var maxItems = cfg.ranked ? 10 : 20;
        var widthClass = cfg.ranked ? 'w-40 sm:w-48' : 'w-[150px] sm:w-[200px]';
        innerHtml = cached.items.slice(0, maxItems).map(function(item, i) {
          return '<div class="shrink-0 ' + widthClass + '">' +
            renderCard(item, cfg.ranked ? { rank: i + 1 } : {}) +
          '</div>';
        }).join('');
      } else {
        innerHtml = Array.from({ length: 7 }).map(function() {
          return '<div class="shrink-0 ' + (cfg.ranked ? 'w-40 sm:w-48' : 'w-[150px] sm:w-[200px]') + '"><div class="aspect-[2/3] rounded-lg shimmer"></div></div>';
        }).join('');
      }

      var adMarkup = '';
      if (idx === 1) {
        adMarkup = '<div class="nm-ad-container max-w-5xl mx-auto my-6" data-ad-container="ad-slot-rail-mid-1">' +
          '<div class="nm-ad-label">Sponsored</div>' +
          '<div id="ad-slot-rail-mid-1" class="nm-ad-slot nm-ad-leaderboard">' +
            '<a href="https://t.me/netflix4u" target="_blank" rel="noopener noreferrer" class="nm-ad-placeholder">' +
              '<span class="nm-ad-badge"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.8L20.2 19H3.8L12 5.8z"/></svg>Trending Shows</span>' +
              '<span class="truncate font-semibold text-white/90">Daily Hindi Dubbed &amp; Multi-Audio Web Series</span>' +
              '<span class="hidden sm:inline text-white/50 text-[11px] truncate">• Ultra HD 4K Cloud Streaming</span>' +
              '<span class="shrink-0 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] transition">Explore</span>' +
            '</a>' +
          '</div>' +
        '</div>';
      } else if (idx === 4) {
        adMarkup = '<div class="nm-ad-container max-w-5xl mx-auto my-6" data-ad-container="ad-slot-rail-mid-2">' +
          '<div class="nm-ad-label">Sponsored</div>' +
          '<div id="ad-slot-rail-mid-2" class="nm-ad-slot nm-ad-leaderboard">' +
            '<a href="https://t.me/netflix4u" target="_blank" rel="noopener noreferrer" class="nm-ad-placeholder">' +
              '<span class="nm-ad-badge"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.8L20.2 19H3.8L12 5.8z"/></svg>Fast CDN</span>' +
              '<span class="truncate font-semibold text-white/90">Direct High-Speed Cloud Downloads &amp; APKs</span>' +
              '<span class="hidden sm:inline text-white/50 text-[11px] truncate">• Join 45K+ Streamers</span>' +
              '<span class="shrink-0 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] transition">Join</span>' +
            '</a>' +
          '</div>' +
        '</div>';
      }

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
            innerHtml +
          '</div>' +
          '<button type="button" data-rail-next aria-label="Scroll right" class="rail-arrow rail-arrow-right rail-arrow-hidden">' +
            '<span class="rail-arrow-btn"><svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg></span>' +
          '</button>' +
        '</div>' +
      '</section>' + adMarkup;
    }).join('');

    if (window.Netflix4uAds) {
      window.Netflix4uAds.renderAll(railsView);
    }

    // Render Continue Watching Rail if on trending platform
    if (platform === 'trending') {
      renderContinueWatchingRail();
    }

    // Wire up scroll buttons and handle background revalidation / lazy loading
    configs.forEach(function(cfg, idx) {
      var railSection = railsView.querySelector('[data-rail-key="' + cfg.key + '"]');
      if (!railSection) return;

      var cached = cachedDataMap[cfg.key];
      if (cached) {
        initRailScrollButtons(railSection);
        if (cached.isFresh) {
          return; // Instant fresh cache hit - no network request needed
        }
      }

      var doLoad = async function() {
        var items = await fetchRailItems(cfg);
        if (items.length) {
          populateRailContent(cfg, railSection, items);
        } else if (!cached) {
          railSection.style.display = 'none';
        }
      };

      // Priority rails (first 2) load immediately; lower rails lazy load on scroll
      if (idx < 2 || !railObserver) {
        doLoad();
      } else {
        railSection._loadRail = doLoad;
        railObserver.observe(railSection);
      }
    });
  }

  function renderCard(item, options) {
    options = options || {};
    var title = item.title || 'Untitled';
    var canonicalId = item.canonicalId || item.id || item.tmdbId || '';
    var tmdbId = item.tmdbId || item.id || '';
    var imdbId = item.imdbId || '';
    var posterUrl = item.poster;
    if (posterUrl) {
      posterUrl = unwrapImageUrl(posterUrl);
    }
    if (!posterUrl || posterUrl.includes('placehold.co')) {
      posterUrl = getPosterFallback(title);
    }
    var isTv = item.type === 'tv' || item.type === 'series';
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
          '<button type="button" aria-label="Play" data-modal="watch" data-tmdbid="' + tmdbId + '" data-canonical-id="' + escapeHtml(canonicalId) + '" data-imdbid="' + escapeHtml(imdbId) + '" data-type="' + (isTv ? 'tv' : 'movie') + '" data-title="' + escapeHtml(title) + '" data-year="' + (item.year || '') + '" data-backdrop="' + (item.backdrop || '') + '" class="w-7 h-7 rounded-full bg-white flex items-center justify-center pointer-events-auto hover:scale-105 active:scale-95 transition shadow-lg cursor-pointer">' +
            '<svg class="w-3.5 h-3.5 ml-0.5 text-black" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
          '</button>' +
          '<button type="button" aria-label="More Info" data-modal="title" data-tmdbid="' + tmdbId + '" data-canonical-id="' + escapeHtml(canonicalId) + '" data-imdbid="' + escapeHtml(imdbId) + '" data-type="' + (isTv ? 'tv' : 'movie') + '" data-title="' + escapeHtml(title) + '" class="w-7 h-7 rounded-full bg-white/20 backdrop-blur flex items-center justify-center pointer-events-auto hover:bg-white/30 transition border border-white/20 cursor-pointer">' +
            '<svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>' +
          '</button>' +
          '<button type="button" aria-label="Add to My List" data-card-bookmark="' + tmdbId + '" class="nm-card-bookmark ' + (isBookmarked(tmdbId) ? 'is-bookmarked' : '') + ' w-7 h-7 rounded-full bg-white/20 backdrop-blur flex items-center justify-center pointer-events-auto hover:bg-white/30 transition border border-white/20 cursor-pointer" title="' + (isBookmarked(tmdbId) ? 'In My List' : 'Add to My List') + '">' +
            '<svg class="w-3.5 h-3.5 ' + (isBookmarked(tmdbId) ? 'text-white' : 'text-white/90') + '" viewBox="0 0 24 24" fill="' + (isBookmarked(tmdbId) ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2.5"><path d="M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="flex items-center gap-1.5 text-[10px] font-medium leading-tight">' +
          '<span class="text-green-400 shrink-0">' + matchScore + '</span>' +
          '<span class="text-white/70 truncate">' + (item.year ? item.year + ' • ' : '') + (isTv ? 'Series' : 'Movie') + '</span>' +
        '</div>' +
      '</div>';

    if (options.rank) {
      return '<a href="#" data-modal="title" data-tmdbid="' + tmdbId + '" data-canonical-id="' + escapeHtml(canonicalId) + '" data-imdbid="' + escapeHtml(imdbId) + '" data-type="' + (isTv ? 'tv' : 'movie') + '" class="nm-card card group block nm-card-ranked">' +
        '<div class="flex items-end relative overflow-visible">' +
          '<div class="rank-num shrink-0 self-end leading-none">' + options.rank + '</div>' +
          '<div class="nm-card-inner flex-1 relative aspect-[2/3] rounded-md overflow-hidden bg-white/5 ring-1 ring-white/10 group-hover:ring-2 group-hover:ring-red-600 transition">' +
            '<img src="' + posterUrl + '" loading="lazy" decoding="async" alt="' + escapeHtml(title) + '" class="w-full h-full object-cover" onerror="window.__healPoster(this);" />' +
            ratingBadge + typeBadge + hoverOverlay +
          '</div>' +
        '</div>' +
      '</a>';
    }

    return '<a href="#" data-modal="title" data-tmdbid="' + tmdbId + '" data-canonical-id="' + escapeHtml(canonicalId) + '" data-imdbid="' + escapeHtml(imdbId) + '" data-type="' + (isTv ? 'tv' : 'movie') + '" class="nm-card card group block">' +
      '<div class="nm-card-inner relative aspect-[2/3] rounded-lg overflow-hidden bg-white/5 ring-1 ring-white/10 group-hover:ring-2 group-hover:ring-red-600 transition">' +
        '<img src="' + posterUrl + '" loading="lazy" decoding="async" alt="' + escapeHtml(title) + '" class="w-full h-full object-cover" onerror="window.__healPoster(this);" />' +
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
        var poster = unwrapImageUrl(item.poster || item.backdrop) || getPosterFallback(item.title);
        var isTv = item.type === 'tv';
        var canonicalId = item.canonicalId || item.id || item.tmdbId || '';
        var imdbId = item.imdbId || '';
        var tmdbId = item.tmdbId || item.id || '';
        return '<a href="#" data-modal="title" data-tmdbid="' + tmdbId + '" data-canonical-id="' + escapeHtml(canonicalId) + '" data-imdbid="' + escapeHtml(imdbId) + '" data-type="' + (item.type || 'movie') + '" class="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.08] transition group block">' +
          '<div class="relative w-16 sm:w-20 aspect-video rounded-md overflow-hidden bg-white/5 shrink-0">' +
            '<img src="' + poster + '" alt="' + escapeHtml(item.title) + '" referrerpolicy="no-referrer" class="w-full h-full object-cover" loading="lazy" onerror="window.__healPoster(this);" />' +
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
      var cardsHtml = items.map(function(it, idx) {
        var card = renderCard(it);
        if (idx === 2 && items.length >= 4) {
          card += '<div class="nm-ad-container !m-0" data-ad-container="ad-slot-search-card">' +
            '<div id="ad-slot-search-card" class="nm-ad-slot nm-ad-card"></div>' +
          '</div>';
        }
        return card;
      }).join('');
      gridContent.innerHTML = cardsHtml;
      if (window.Netflix4uAds) {
        window.Netflix4uAds.renderAll(gridContent);
      }
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

    // 2. Policy / Legal Modal Pages (/about, /privacy, /terms, /dmca, /contact)
    var policyMatch = path.match(/^\/(about|privacy|terms|dmca|contact)(?:\.html)?$/i);
    if (policyMatch) {
      var tabKey = policyMatch[1].toLowerCase();
      setTimeout(function() {
        if (window.Netflix4uModal && window.Netflix4uModal.openPolicy) {
          window.Netflix4uModal.openPolicy(tabKey);
        }
      }, 300);
    }

    // 3. Hash Watch link (e.g. #w=1339713-movie-1-1)
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

    // 4. Query Params Deep Linking (e.g. ?id=1408162&type=movie or ?watch=1408162)
    try {
      var sp = new URLSearchParams(window.location.search);
      var qId = sp.get('id') || sp.get('tmdbId');
      var qWatch = sp.get('watch') || sp.get('w');
      var qType = sp.get('type') || 'movie';
      var qSe = sp.get('se') || sp.get('s') || 1;
      var qEp = sp.get('ep') || sp.get('e') || 1;
      if (qWatch) {
        setTimeout(function() {
          if (window.Netflix4uModal && window.Netflix4uModal.openWatch) {
            window.Netflix4uModal.openWatch(qWatch, qType, qSe, qEp, '');
          }
        }, 400);
      } else if (qId) {
        setTimeout(function() {
          if (window.Netflix4uModal && window.Netflix4uModal.openTitle) {
            window.Netflix4uModal.openTitle(qId, qType, false);
          }
        }, 400);
      }
    } catch(e) {}
  }

  // ─── Broken Poster Self-Healing ───
  function healPoster(imgEl) {
    if (!imgEl || imgEl.dataset.healed) return;
    imgEl.dataset.healed = '1';
    var title = imgEl.alt || '';

    imgEl.onerror = function() {
      imgEl.onerror = null;
      imgEl.src = getPosterFallback(title);
    };

    var card = imgEl.closest('[data-modal="title"]') || imgEl.closest('[data-modal="watch"]') || imgEl.closest('.card') || imgEl.closest('.nm-card');
    var tmdbId = card ? (card.dataset.tmdbid || '') : '';
    var imdbId = card ? (card.dataset.imdbid || '') : '';
    var canonicalId = card ? (card.dataset.canonicalId || '') : '';
    var type = card ? (card.dataset.type || 'movie') : 'movie';

    var apiUrl = '/api/poster-resolver?title=' + encodeURIComponent(title) +
      (tmdbId ? '&id=' + encodeURIComponent(tmdbId) : '') +
      (imdbId ? '&imdbId=' + encodeURIComponent(imdbId) : '') +
      (canonicalId ? '&canonicalId=' + encodeURIComponent(canonicalId) : '') +
      '&type=' + encodeURIComponent(type);

    fetch(apiUrl)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data && data.success && data.poster) {
          imgEl.src = data.poster;
        } else {
          imgEl.src = getPosterFallback(title);
        }
      })
      .catch(function() {
        imgEl.src = getPosterFallback(title);
      });
  }
  window.__healPoster = healPoster;

  function renderContinueWatchingRail() {
    if (currentPlatform !== 'trending' || !railsView) return;
    var existing = document.getElementById('continue-watching-rail');
    var items = getContinueWatching();
    if (!items.length) {
      if (existing) existing.remove();
      return;
    }

    var railHtml =
      '<section id="continue-watching-rail" class="mb-8">' +
        '<div class="flex items-center justify-between gap-3 mb-3 px-1">' +
          '<div class="flex items-center gap-2.5">' +
            '<div class="w-1.5 h-5 rounded-full bg-red-600 animate-pulse"></div>' +
            '<h2 class="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">' +
              'Continue Watching' +
              '<span class="text-[11px] font-normal text-white/50">(' + items.length + ')</span>' +
            '</h2>' +
          '</div>' +
        '</div>' +
        '<div class="relative rail-wrap">' +
          '<button type="button" data-rail-prev aria-label="Scroll left" class="rail-arrow rail-arrow-left rail-arrow-hidden">' +
            '<span class="rail-arrow-btn"><svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m15 18-6-6 6-6"/></svg></span>' +
          '</button>' +
          '<div class="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-none rail-scroll" data-rail-content>' +
            items.map(function(item) {
              var poster = item.poster ? unwrapImageUrl(item.poster) : getPosterFallback(item.title);
              var isTv = item.type === 'tv' || item.type === 'series';
              var epLabel = isTv ? 'S' + (item.se || 1) + ':E' + (item.ep || 1) : '';
              return '<div class="shrink-0 w-[160px] sm:w-[210px]">' +
                '<div class="nm-continue-card group cursor-pointer" data-modal="watch" data-tmdbid="' + item.tmdbId + '" data-canonical-id="' + escapeHtml(item.canonicalId || item.tmdbId) + '" data-type="' + (isTv ? 'tv' : 'movie') + '" data-title="' + escapeHtml(item.title) + '" data-year="' + (item.year || '') + '"' + (isTv ? ' data-se="' + (item.se || 1) + '" data-ep="' + (item.ep || 1) + '"' : '') + '>' +
                  '<button type="button" aria-label="Remove from Continue Watching" data-remove-cw="' + item.tmdbId + '" class="nm-continue-remove" title="Remove">✕</button>' +
                  '<div class="relative aspect-[16/9] sm:aspect-[2/3] overflow-hidden bg-white/5 rounded-t-lg">' +
                    '<img src="' + poster + '" alt="' + escapeHtml(item.title) + '" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" onerror="window.__healPoster(this);" />' +
                    '<div class="absolute inset-0 bg-black/30 group-hover:bg-black/10 flex items-center justify-center transition">' +
                      '<div class="w-10 h-10 rounded-full bg-white/90 group-hover:bg-white text-black flex items-center justify-center shadow-2xl group-hover:scale-110 transition">' +
                        '<svg class="w-5 h-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
                      '</div>' +
                    '</div>' +
                    '<div class="nm-continue-progress-wrap">' +
                      '<div class="nm-continue-progress-bar" style="width: ' + (item.progress || 50) + '%;"></div>' +
                    '</div>' +
                  '</div>' +
                  '<div class="p-2 bg-[#121218] rounded-b-lg flex items-center justify-between gap-1.5">' +
                    '<div class="truncate text-xs font-semibold text-white/90">' + escapeHtml(item.title) + '</div>' +
                    (epLabel ? '<span class="shrink-0 px-1.5 py-0.5 rounded bg-white/15 text-[10px] font-bold text-white/80">' + epLabel + '</span>' : '') +
                  '</div>' +
                '</div>' +
              '</div>';
            }).join('') +
          '</div>' +
          '<button type="button" data-rail-next aria-label="Scroll right" class="rail-arrow rail-arrow-right rail-arrow-hidden">' +
            '<span class="rail-arrow-btn"><svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg></span>' +
          '</button>' +
        '</div>' +
      '</section>';

    if (existing) {
      existing.outerHTML = railHtml;
    } else {
      railsView.insertAdjacentHTML('afterbegin', railHtml);
    }
    var newSec = document.getElementById('continue-watching-rail');
    if (newSec) initRailScrollButtons(newSec);
  }
  window.__renderContinueWatchingRail = renderContinueWatchingRail;

  // ─── Global Event Delegation for Bookmarks & Continue Watching ───
  document.addEventListener('click', function(e) {
    var bmBtn = e.target.closest('[data-card-bookmark]');
    if (bmBtn) {
      e.preventDefault();
      e.stopPropagation();
      var id = bmBtn.dataset.cardBookmark;
      var card = bmBtn.closest('.nm-card');
      var title = card ? (card.querySelector('img') ? card.querySelector('img').alt : '') : '';
      var img = card ? card.querySelector('img') : null;
      var poster = img ? img.src : '';
      var isTv = card && card.dataset.type === 'tv';
      var added = toggleMyList({
        tmdbId: id,
        title: title || 'Title',
        poster: poster,
        type: isTv ? 'tv' : 'movie'
      });
      bmBtn.classList.toggle('is-bookmarked', added);
      bmBtn.title = added ? 'In My List' : 'Add to My List';
      var svg = bmBtn.querySelector('svg');
      if (svg) svg.setAttribute('fill', added ? 'currentColor' : 'none');
      return;
    }

    var cwRemoveBtn = e.target.closest('[data-remove-cw]');
    if (cwRemoveBtn) {
      e.preventDefault();
      e.stopPropagation();
      var cwId = cwRemoveBtn.dataset.removeCw;
      removeContinueWatching(cwId);
      return;
    }
  });

  // ─── Movie Request Modal Handler ───
  var reqBtn = document.getElementById('header-request-btn');
  var reqModal = document.getElementById('request-modal');
  var reqClose = document.getElementById('request-modal-close');
  var reqForm = document.getElementById('request-form');

  function openReqModal() {
    if (!reqModal) return;
    reqModal.classList.remove('hidden');
    reqModal.classList.add('flex');
    document.body.classList.add('modal-open');
  }

  function closeReqModal() {
    if (!reqModal) return;
    reqModal.classList.add('hidden');
    reqModal.classList.remove('flex');
    document.body.classList.remove('modal-open');
  }

  if (reqBtn) reqBtn.addEventListener('click', openReqModal);
  if (reqClose) reqClose.addEventListener('click', closeReqModal);
  if (reqModal) {
    reqModal.addEventListener('click', function(e) {
      if (e.target === reqModal) closeReqModal();
    });
  }

  if (reqForm) {
    reqForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var title = (document.getElementById('req-title') || {}).value || '';
      var type = (document.getElementById('req-type') || {}).value || 'Movie';
      var year = (document.getElementById('req-year') || {}).value || '';
      var audio = (document.getElementById('req-audio') || {}).value || '';

      var msg = 'Request for Netflix4U: ' + title + (year ? ' (' + year + ')' : '') + ' [' + type + ']' + (audio ? ' - ' + audio : '');
      var tgUrl = 'https://t.me/netflix4u?text=' + encodeURIComponent(msg);
      window.open(tgUrl, '_blank', 'noopener,noreferrer');
      showToast('Request submitted! Our team will add it within 24h.', '🎉');
      reqForm.reset();
      closeReqModal();
    });
  }

  // ─── Viral Share Modal Handler ───
  var shareModal = document.getElementById('share-modal');
  var shareClose = document.getElementById('share-modal-close');
  var sharePreviewTitle = document.getElementById('share-preview-title');
  var shareWaBtn = document.getElementById('share-whatsapp-btn');
  var shareTgBtn = document.getElementById('share-telegram-btn');
  var shareCopyBtn = document.getElementById('share-copy-link-btn');
  var currentShareData = null;

  function openShareDialog(data) {
    currentShareData = data;
    var title = (data && data.title) || 'Movie';
    var url = (data && data.url) || window.location.href;
    var shareText = 'Watch ' + title + ' in 4K UHD with multi-audio on Netflix4U: ' + url;

    if (navigator.share && window.matchMedia('(max-width: 768px)').matches) {
      navigator.share({
        title: title + ' — Netflix4U',
        text: shareText,
        url: url
      }).catch(function() {});
      return;
    }

    if (!shareModal) return;
    if (sharePreviewTitle) sharePreviewTitle.textContent = title;
    if (shareWaBtn) shareWaBtn.href = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(shareText);
    if (shareTgBtn) shareTgBtn.href = 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent('Watch ' + title + ' on Netflix4U');
    shareModal.classList.remove('hidden');
    shareModal.classList.add('flex');
    document.body.classList.add('modal-open');
  }
  window.__openShareDialog = openShareDialog;

  function closeShareModal() {
    if (!shareModal) return;
    shareModal.classList.add('hidden');
    shareModal.classList.remove('flex');
    document.body.classList.remove('modal-open');
  }

  if (shareClose) shareClose.addEventListener('click', closeShareModal);
  if (shareModal) {
    shareModal.addEventListener('click', function(e) {
      if (e.target === shareModal) closeShareModal();
    });
  }
  if (shareCopyBtn) {
    shareCopyBtn.addEventListener('click', function() {
      var url = (currentShareData && currentShareData.url) || window.location.href;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function() {
          showToast('Link copied to clipboard!', '📋');
          closeShareModal();
        });
      } else {
        closeShareModal();
      }
    });
  }

  // ─── PWA beforeinstallprompt Handler ───
  var deferredPrompt = null;
  function showPwaInstallButtons() {
    var pwaBtn = document.getElementById('pwa-install-btn');
    if (pwaBtn) pwaBtn.classList.remove('hidden');
    var ctaBtn = document.getElementById('cta-install-btn');
    if (ctaBtn) ctaBtn.classList.remove('hidden');
  }

  function hidePwaInstallButtons() {
    var pwaBtn = document.getElementById('pwa-install-btn');
    if (pwaBtn) pwaBtn.classList.add('hidden');
    var ctaBtn = document.getElementById('cta-install-btn');
    if (ctaBtn) ctaBtn.classList.add('hidden');
  }

  function triggerPwaInstall() {
    if (!deferredPrompt) {
      showToast('App is ready to install via your browser menu (Add to Home Screen)', '📱');
      return;
    }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function(res) {
      if (res && res.outcome === 'accepted') {
        showToast('Netflix4U App installed successfully!', '🎉');
      }
      deferredPrompt = null;
      hidePwaInstallButtons();
    }).catch(function() {});
  }

  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    showPwaInstallButtons();
  });

  var installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) {
    installBtn.addEventListener('click', triggerPwaInstall);
  }
  var ctaInstallBtn = document.getElementById('cta-install-btn');
  if (ctaInstallBtn) {
    ctaInstallBtn.addEventListener('click', triggerPwaInstall);
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
    if (window.Netflix4uAds) window.Netflix4uAds.renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

