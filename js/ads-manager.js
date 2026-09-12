/**
 * Netflix4U - Dedicated Isolated Advertisement Controller
 * Ensures ads run strictly inside designated containers without disturbing the user experience.
 * Supports Google AdSense, Adsterra, custom native banners, and sponsored partner placements.
 */
(function() {
  'use strict';

  var slotConfigs = {};
  var STICKY_DISMISSED_KEY = 'nm_sticky_ad_dismissed';

  var DEFAULT_SPONSOR_HTML = function(title, subtitle, cta) {
    return '<a href="https://t.me/netflix_mirror_apk" target="_blank" rel="noopener noreferrer" class="nm-ad-placeholder">' +
      '<span class="nm-ad-badge">' +
        '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L1 21h22L12 2zm0 3.8L20.2 19H3.8L12 5.8z"/></svg>' +
        'Verified Partner' +
      '</span>' +
      '<span class="truncate font-semibold text-white/90">' + (title || 'Stream Fast, Ad-Free & 4K') + '</span>' +
      '<span class="hidden sm:inline text-white/50 text-[11px] truncate">• ' + (subtitle || 'Official Telegram Channel & Fast CDN Mirrors') + '</span>' +
      '<span class="shrink-0 px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] transition">' + (cta || 'Explore') + '</span>' +
    '</a>';
  };

  var AdsManager = {
    /**
     * Configure a custom ad snippet or provider tag for any slot ID
     * @param {string} slotId e.g. 'ad-slot-home-top'
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
          // Trigger AdSense push if ins.adsbygoogle is present
          try {
            if (el.querySelector('.adsbygoogle') && window.adsbygoogle) {
              (window.adsbygoogle = window.adsbygoogle || []).push({});
            }
          } catch(e) {}
        }
      } else {
        // Render sleek default non-intrusive sponsor banner
        if (el.classList.contains('nm-ad-card')) {
          el.innerHTML = '<a href="https://t.me/netflix_mirror_apk" target="_blank" rel="noopener noreferrer" class="h-full w-full flex flex-col items-center justify-center p-4 text-center group block">' +
            '<div class="w-12 h-12 rounded-full bg-red-600/20 text-red-500 flex items-center justify-center mb-3 group-hover:scale-110 transition">' +
              '<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>' +
            '</div>' +
            '<div class="text-xs font-bold text-white mb-1">Sponsored Partner</div>' +
            '<div class="text-[11px] text-white/50 mb-3">Instant 4K Cloud Streaming & APK Downloads</div>' +
            '<span class="px-3 py-1 rounded-md bg-white/10 group-hover:bg-white/20 text-white text-[10px] font-bold transition">Visit Channel</span>' +
          '</a>';
        } else {
          el.innerHTML = DEFAULT_SPONSOR_HTML();
        }
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
