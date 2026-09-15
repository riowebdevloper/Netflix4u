/**
 * Netflix4U - Dedicated Isolated Advertisement Controller
 * Distributes active ad networks (Adsterra, A-ADS, HilltopAds, Monetag)
 * one-by-one into isolated, dedicated sections across the website.
 * - Under Hero (#ad-slot-home-top): Strictly 1 Ad (Adsterra Native Banner)
 * - Mid-Rail 1 (#ad-slot-rail-mid-1): Strictly 1 Ad (A-ADS Adaptive Unit 2455136)
 * - Mid-Rail 2 (#ad-slot-rail-mid-2): Strictly 1 Ad (HilltopAds 300x250 Banner)
 * - Bottom Billboard (#ad-slot-home-bottom): Strictly 1 Ad (Verified 4K Partner Billboard)
 * - Sticky Bottom (#aads-sticky-wrap): Dismissible Sticky Ad Unit
 * - Modals (#ad-slot-modal-*): Dedicated single sponsor units
 */
(function() {
  'use strict';

  var slotConfigs = {};
  var STICKY_DISMISSED_KEY = 'nm_sticky_ad_dismissed';

  var ADSTERRA_NATIVE_SRC = 'https://pl31315274.profitableratecpmnetwork.com/bb6db87840ef2c647140600c50c30ab2/invoke.js';
  var ADSTERRA_CONTAINER_ID = 'container-bb6db87840ef2c647140600c50c30ab2';
  var HILLTOP_BANNER_SRC = '//untimely-hello.com/b-X.VMsrdsGml/0CYPWfcM/JeVm/9euyZRUqlKkuPVToc/0AMFj/E_2-N/D/UftxNqzTQ/yYMST/YK0POXQY';
  var AADS_UNIT_ID = '2455136';
  var AADS_ADAPTIVE_URL = 'https://acceptable.a-ads.com/2455136/?size=Adaptive';

  var DEFAULT_SPONSOR_HTML = function(title, subtitle, cta) {
    return '<a href="https://t.me/netflix4u_website" target="_blank" rel="noopener noreferrer" class="nm-ad-placeholder">' +
      '<span class="nm-ad-badge">' +
        '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.8L20.2 19H3.8L12 5.8z"/></svg>' +
        'Verified Partner' +
      '</span>' +
      '<span class="truncate font-semibold text-white/90">' + (title || 'Stream Fast, Ad-Free & 4K') + '</span>' +
      '<span class="hidden sm:inline text-white/50 text-[11px] truncate">• ' + (subtitle || 'Official Telegram Channel & Fast Cloud CDN') + '</span>' +
      '<span class="shrink-0 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] transition">' + (cta || 'Explore') + '</span>' +
    '</a>';
  };

  /**
   * Monitor Adsterra native container in #ad-slot-home-top.
   * If AdBlock blocks it or no ad is filled after timeout, show fallback so slot is NEVER blank.
   */
  function setupAdsterraFallbackMonitor() {
    var container = document.getElementById(ADSTERRA_CONTAINER_ID);
    var parentSlot = document.getElementById('ad-slot-home-top');
    if (!container || !parentSlot) return;

    var filled = false;
    var observer = new MutationObserver(function(mutations) {
      if (container.children.length > 0 && !container.querySelector('.nm-ad-placeholder')) {
        filled = true;
        observer.disconnect();
      }
    });
    observer.observe(container, { childList: true, subtree: true });

    setTimeout(function() {
      if (!filled && (container.children.length === 0 || !container.querySelector('iframe, div[class*="native"], a:not(.nm-ad-placeholder)'))) {
        if (!container.querySelector('.nm-ad-placeholder')) {
          container.innerHTML = DEFAULT_SPONSOR_HTML('Featured Streaming Sponsor', 'Direct 4K Servers & Fast Downloads', 'Join');
        }
      }
      observer.disconnect();
    }, 2800);
  }

  /**
   * Inject Adsterra Native Banner invocation script
   */
  function loadAdsterraScript() {
    if (document.getElementById('adsterra-invoke-script')) return;
    try {
      var script = document.createElement('script');
      script.id = 'adsterra-invoke-script';
      script.async = true;
      script.dataset.cfasync = 'false';
      script.src = ADSTERRA_NATIVE_SRC;
      script.onerror = function() {};
      document.body.appendChild(script);
    } catch(e) {}
  }

  /**
   * Render A-ADS Adaptive Unit inside a responsive, bounded container
   */
  function renderAadsUnit(slotEl, minH, maxH) {
    if (!slotEl) return;
    var hMin = minH || 60;
    var hMax = maxH || 90;
    slotEl.innerHTML = '<div style="width:100%;max-width:728px;margin:auto;position:relative;border-radius:10px;overflow:hidden;background:rgba(255,255,255,0.02);">' +
      '<iframe data-aa="' + AADS_UNIT_ID + '" title="Sponsored Advertisement" src="' + AADS_ADAPTIVE_URL + '" style="border:0;padding:0;width:100%;min-height:' + hMin + 'px;max-height:' + hMax + 'px;overflow:hidden;margin:auto;display:block;background:transparent;"></iframe>' +
    '</div>';
  }

  /**
   * Render Adsterra Native Banner inside an isolated sandboxed iframe to allow multiple placements without ID clash
   */
  function renderAdsterraSandboxed(slotEl) {
    if (!slotEl) return;
    var iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.minHeight = '90px';
    iframe.style.border = 'none';
    iframe.style.overflow = 'hidden';
    iframe.scrolling = 'no';
    iframe.setAttribute('title', 'Advertisement');
    iframe.setAttribute('loading', 'lazy');

    var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
      '<style>' +
        'body { margin: 0; padding: 4px; background: transparent; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow: hidden; }' +
        '#' + ADSTERRA_CONTAINER_ID + ' { width: 100%; display: flex; justify-content: center; }' +
      '</style>' +
      '</head><body>' +
      '<script async="async" data-cfasync="false" src="' + ADSTERRA_NATIVE_SRC + '"><\/script>' +
      '<div id="' + ADSTERRA_CONTAINER_ID + '"></div>' +
      '</body></html>';

    iframe.srcdoc = html;
    slotEl.innerHTML = '';
    slotEl.appendChild(iframe);

    // Fallback if blocked
    setTimeout(function() {
      try {
        if (!iframe.contentDocument || !iframe.contentDocument.body || iframe.contentDocument.body.children.length <= 1) {
          slotEl.innerHTML = DEFAULT_SPONSOR_HTML('Featured Cloud Partner', 'Ultra-fast CDN playback & multi-audio support', 'Explore');
        }
      } catch(e) {}
    }, 2800);
  }

  /**
   * Render HilltopAds 300x250 Banner in an isolated sandbox with fallback
   */
  function renderHilltopBanner(slotEl) {
    if (!slotEl) return;
    var iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.maxWidth = '728px';
    iframe.style.minHeight = '90px';
    iframe.style.border = 'none';
    iframe.style.overflow = 'hidden';
    iframe.scrolling = 'no';
    iframe.setAttribute('title', 'Sponsored');
    iframe.setAttribute('loading', 'lazy');

    var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
      '<style>' +
        'body { margin: 0; padding: 0; background: transparent; display: flex; align-items: center; justify-content: center; overflow: hidden; }' +
      '</style>' +
      '</head><body>' +
      '<script src="' + HILLTOP_BANNER_SRC + '" async referrerpolicy="no-referrer-when-downgrade"><\/script>' +
      '</body></html>';

    iframe.srcdoc = html;
    slotEl.innerHTML = '';
    slotEl.appendChild(iframe);

    setTimeout(function() {
      try {
        if (!iframe.contentDocument || !iframe.contentDocument.body || iframe.contentDocument.body.children.length <= 1) {
          slotEl.innerHTML = DEFAULT_SPONSOR_HTML('Fast Cloud Servers', 'Direct High-Speed Cloud Downloads & APKs', 'Join');
        }
      } catch(e) {}
    }, 2800);
  }

  var AdsManager = {
    /**
     * Configure a custom ad snippet or provider tag for any slot ID
     * @param {string} slotId e.g. 'ad-slot-home-bottom'
     * @param {string|Function} adContent HTML snippet or generator function
     */
    registerSlot: function(slotId, adContent) {
      slotConfigs[slotId] = adContent;
      AdsManager.renderSlot(slotId);
    },

    /**
     * Batch configure slots
     * @param {Object} map { [slotId]: htmlOrFunction }
     */
    configure: function(map) {
      if (!map || typeof map !== 'object') return;
      Object.keys(map).forEach(function(key) {
        slotConfigs[key] = map[key];
        AdsManager.renderSlot(key);
      });
    },

    /**
     * Generate HTML for an ad slot container
     * @param {string} slotId
     * @param {string} sizeClass 'nm-ad-leaderboard' | 'nm-ad-billboard' | 'nm-ad-modal' | 'nm-ad-card'
     * @param {string} label optional label like 'Sponsored' or 'Advertisement'
     */
    createSlotMarkup: function(slotId, sizeClass, label) {
      var displayLabel = label !== undefined ? label : 'Advertisement';
      var labelHtml = displayLabel ? '<div class="nm-ad-label">' + displayLabel + '</div>' : '';
      return '<div class="nm-ad-container" data-ad-container="' + slotId + '">' +
        labelHtml +
        '<div id="' + slotId + '" class="nm-ad-slot ' + (sizeClass || 'nm-ad-leaderboard') + '"></div>' +
      '</div>';
    },

    /**
     * Render the ad content into a specific slot element
     * @param {string|HTMLElement} target Element or slot ID
     */
    renderSlot: function(target) {
      var el = typeof target === 'string' ? document.getElementById(target) : target;
      if (!el) return;

      var slotId = el.id || el.getAttribute('data-ad-slot');
      var customContent = slotConfigs[slotId];

      if (customContent) {
        if (typeof customContent === 'function') {
          el.innerHTML = customContent(slotId);
        } else {
          el.innerHTML = customContent;
          try {
            if (el.querySelector('.adsbygoogle') && window.adsbygoogle) {
              (window.adsbygoogle = window.adsbygoogle || []).push({});
            }
          } catch(e) {}
        }
        return;
      }

      // ─── HOMEPAGE AD PLACEMENTS ───

      // 1. Under Hero Carousel (#ad-slot-home-top) -> Adsterra Native Banner
      if (slotId === 'ad-slot-home-top') {
        if (!el.querySelector('#' + ADSTERRA_CONTAINER_ID)) {
          el.innerHTML = '<div id="' + ADSTERRA_CONTAINER_ID + '">' +
            DEFAULT_SPONSOR_HTML('Featured Streaming Sponsor', 'Direct 4K Servers & Fast Downloads', 'Join') +
          '</div>';
        }
        loadAdsterraScript();
        setupAdsterraFallbackMonitor();
        return;
      }

      // 2. Between Rail 1 & Rail 2 (#ad-slot-rail-mid-1) -> A-ADS Adaptive Unit 2455136
      if (slotId === 'ad-slot-rail-mid-1') {
        renderAadsUnit(el, 60, 90);
        return;
      }

      // 3. Between Rail 4 & Rail 5 (#ad-slot-rail-mid-2) -> A-ADS Adaptive Unit 2455136
      if (slotId === 'ad-slot-rail-mid-2') {
        renderAadsUnit(el, 60, 90);
        return;
      }

      // 4. Between Rail 7 & Rail 8 (#ad-slot-rail-mid-3) -> A-ADS Adaptive Unit 2455136
      if (slotId === 'ad-slot-rail-mid-3') {
        renderAadsUnit(el, 60, 90);
        return;
      }

      // 5. Bottom Billboard before Search CTA (#ad-slot-home-bottom) -> A-ADS Adaptive Billboard Unit
      if (slotId === 'ad-slot-home-bottom') {
        renderAadsUnit(el, 75, 100);
        return;
      }

      // 6. Dismissible Bottom Sticky Bar (#ad-slot-sticky-bottom) -> A-ADS Adaptive Unit
      if (slotId === 'ad-slot-sticky-bottom') {
        renderAadsUnit(el, 50, 75);
        return;
      }

      // ─── MORE INFO PAGE (TITLE MODAL) AD PLACEMENTS ───

      // 1. In-Modal Top Sponsor (#ad-slot-modal-top) -> A-ADS Adaptive Unit
      if (slotId === 'ad-slot-modal-top') {
        renderAadsUnit(el, 55, 75);
        return;
      }

      // 2. In-Modal Pre-Dotmovies Downloads Sponsor (#ad-slot-modal-dotmovies) -> A-ADS Adaptive Unit
      if (slotId === 'ad-slot-modal-dotmovies') {
        renderAadsUnit(el, 60, 85);
        return;
      }

      // 3. In-Modal Cloud Server Sponsor (#ad-slot-modal-cloud) -> A-ADS Adaptive Unit
      if (slotId === 'ad-slot-modal-cloud') {
        renderAadsUnit(el, 55, 75);
        return;
      }

      // 4. In-Modal Bottom Recommendations Sponsor (#ad-slot-modal-bottom) -> A-ADS Adaptive Unit
      if (slotId === 'ad-slot-modal-bottom') {
        renderAadsUnit(el, 60, 85);
        return;
      }

      // Native card in search results
      if (el.classList.contains('nm-ad-card')) {
        el.innerHTML = '<a href="https://t.me/netflix4u_website" target="_blank" rel="noopener noreferrer" class="h-full w-full flex flex-col items-center justify-center p-4 text-center group block">' +
          '<div class="w-12 h-12 rounded-full bg-red-600/20 text-red-500 flex items-center justify-center mb-3 group-hover:scale-110 transition">' +
            '<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>' +
          '</div>' +
          '<div class="text-xs font-bold text-white mb-1">Sponsored Partner</div>' +
          '<div class="text-[11px] text-white/50 mb-3">Instant 4K Cloud Streaming & APK Downloads</div>' +
          '<span class="px-3 py-1 rounded-md bg-white/10 group-hover:bg-white/20 text-white text-[10px] font-bold transition">Visit Channel</span>' +
        '</a>';
        return;
      }

      el.innerHTML = DEFAULT_SPONSOR_HTML();
    },

    /**
     * Render all currently mounted ad slots in the DOM
     */
    renderAll: function(rootEl) {
      var root = rootEl || document;
      var slots = root.querySelectorAll('.nm-ad-slot');
      slots.forEach(function(slot) {
        AdsManager.renderSlot(slot);
      });
    },

    /**
     * Initialize the dismissible bottom sticky ad banner
     */
    initStickyBanner: function() {
      var bar = document.getElementById('nm-sticky-ad-bar');
      var closeBtn = document.getElementById('nm-sticky-ad-close');
      if (!bar) return;

      try {
        if (sessionStorage.getItem(STICKY_DISMISSED_KEY) === '1') {
          bar.classList.add('nm-sticky-hidden');
          return;
        }
      } catch(e) {}

      if (closeBtn) {
        closeBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          bar.classList.add('nm-sticky-hidden');
          try {
            sessionStorage.setItem(STICKY_DISMISSED_KEY, '1');
          } catch(err) {}
        });
      }

      AdsManager.renderSlot('ad-slot-sticky-bottom');
    },

    /**
     * Suppress intrusive third-party floating push notification popups and banners
     * so they never float on top or disturb user experience.
     */
    initPopunderAdDocker: function() {
      var dockerObserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          mutation.addedNodes.forEach(function(node) {
            if (node.nodeType === 1 && node.tagName === 'DIV') {
              var nid = (node.id || '').toLowerCase();
              if (nid === 'watch-modal' || nid === 'title-modal' || nid === 'home-header' || nid === 'watch-top-bar' || nid === 'theme-wash' || nid === 'progress-bar' || nid === 'trailer-modal' || nid === 'policy-modal' || nid === 'nm-loader' || nid === 'aads-sticky-wrap') {
                return;
              }

              var styleAttr = node.getAttribute('style') || '';
              var isFixed = styleAttr.includes('position: fixed') || styleAttr.includes('position:fixed');
              var isTop = styleAttr.includes('top: 0') || styleAttr.includes('top:0') || styleAttr.includes('top: 5') || styleAttr.includes('top:5') || styleAttr.includes('top: 10');
              var isPushAd = nid.includes('push') || nid.includes('banner') || (node.className && typeof node.className === 'string' && (node.className.includes('push') || node.className.includes('inpage')));
              var hasAdFrame = Boolean(node.querySelector('iframe[src*="untimely"], iframe[src*="bony"], a[href*="untimely"], a[href*="bony"], a[href*="hilltop"]'));

              if ((isFixed && isTop) || isPushAd || hasAdFrame) {
                try {
                  node.style.display = 'none';
                  node.remove();
                } catch(e) {}
              }
            }
          });
        });
      });

      dockerObserver.observe(document.body, { childList: true, subtree: false });
    },

    /**
     * Primary startup initialization
     */
    init: function() {
      AdsManager.renderAll();
      AdsManager.initStickyBanner();
      AdsManager.initPopunderAdDocker();
      loadAdsterraScript();
      setupAdsterraFallbackMonitor();
    }
  };

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', AdsManager.init);
  } else {
    setTimeout(AdsManager.init, 50);
  }

  window.Netflix4uAds = AdsManager;
})();
