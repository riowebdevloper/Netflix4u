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
   * Inject HilltopAds Banner 300x250 script into target container
   */
  function loadHilltopBanner(slotEl) {
    if (!slotEl || slotEl.dataset.htLoaded) return;
    slotEl.dataset.htLoaded = 'true';
    try {
      var s = document.createElement('script');
      s.src = HILLTOP_BANNER_SRC;
      s.async = true;
      s.referrerPolicy = 'no-referrer-when-downgrade';
      s.onerror = function() {};
      var wrap = slotEl.querySelector('#hilltop-banner-inner-mid-2') || slotEl;
      wrap.appendChild(s);
    } catch(e) {}
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

      // Slot 1: Under Hero Carousel (#ad-slot-home-top) -> Strictly 1 Ad: Adsterra Native Banner
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

      // Slot 2: Between Rail 1 & Rail 2 (#ad-slot-rail-mid-1) -> Strictly 1 Ad: A-ADS Adaptive Unit
      if (slotId === 'ad-slot-rail-mid-1') {
        el.innerHTML = '<div style="width:100%;max-width:728px;margin:auto;position:relative;">' +
          '<iframe data-aa="' + AADS_UNIT_ID + '" title="Sponsored Advertisement" src="' + AADS_ADAPTIVE_URL + '" style="border:0;padding:0;width:100%;min-height:60px;max-height:90px;overflow:hidden;margin:auto;display:block;"></iframe>' +
        '</div>';
        return;
      }

      // Slot 3: Between Rail 4 & Rail 5 (#ad-slot-rail-mid-2) -> Strictly 1 Ad: HilltopAds 300x250 Banner
      if (slotId === 'ad-slot-rail-mid-2') {
        el.innerHTML = '<div id="hilltop-container-rail-mid-2" style="width:100%;max-width:728px;min-height:90px;margin:auto;display:flex;align-items:center;justify-content:center;">' +
          '<div id="hilltop-banner-inner-mid-2" style="width:100%;text-align:center;">' +
            DEFAULT_SPONSOR_HTML('Fast Cloud Servers', 'Direct High-Speed Cloud Downloads & APKs', 'Join') +
          '</div>' +
        '</div>';
        loadHilltopBanner(el);
        return;
      }

      // Slot 4: Bottom Billboard before Search CTA (#ad-slot-home-bottom) -> Strictly 1 Ad: High-CTR Verified Partner Billboard
      if (slotId === 'ad-slot-home-bottom') {
        el.innerHTML = DEFAULT_SPONSOR_HTML('Stream in 4K UHD & Dolby 5.1', 'No subscription required • Daily updated catalog', 'Explore');
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

      // Modal ad slots: Distinct single sponsor unit per modal section
      if (slotId === 'ad-slot-modal-top') {
        el.innerHTML = DEFAULT_SPONSOR_HTML('High-Speed Cloud Stream', 'Ultra-fast CDN playback with multi-audio support', 'Watch');
      } else if (slotId === 'ad-slot-modal-dotmovies') {
        el.innerHTML = DEFAULT_SPONSOR_HTML('Verified Direct Download Server', 'Original untouched prints & Dual Audio rips', 'Get Link');
      } else if (slotId === 'ad-slot-modal-cloud') {
        el.innerHTML = DEFAULT_SPONSOR_HTML('Lightning Cloud CDN Server', 'Zero-buffer direct video stream & instant access', 'Connect');
      } else if (slotId === 'ad-slot-modal-bottom') {
        el.innerHTML = DEFAULT_SPONSOR_HTML('Join Official Telegram Channel', 'Get daily movie releases & direct APK updates', 'Join 45K+');
      } else {
        el.innerHTML = DEFAULT_SPONSOR_HTML();
      }
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
     * Primary startup initialization
     */
    init: function() {
      AdsManager.renderAll();
      AdsManager.initStickyBanner();
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
