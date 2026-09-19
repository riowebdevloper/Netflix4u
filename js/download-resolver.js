/**
 * Netflix4U Universal Direct Download Resolver
 * Resolves high-speed streaming links directly on the client side with 0 dependencies.
 * Works seamlessly on cPanel static hosting, LiteSpeed, Apache, Nginx, and Node.js.
 */
(function() {
  'use strict';

  var WORKER_HOSTS = [
    'https://wild-sun-9376.oriue.workers.dev',
    'https://crimson-sea-a1e5.hekoy.workers.dev'
  ];

  function extractVcloudUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    var cur = rawUrl;
    while (cur.indexOf('vcloud=') !== -1 || cur.indexOf('url=') !== -1) {
      var m = cur.match(/[?&](?:vcloud|url)=([^&#]+)/);
      if (m) {
        cur = decodeURIComponent(m[1]);
      } else {
        break;
      }
    }
    return cur;
  }

  function getActiveTitle(targetEl) {
    if (targetEl && targetEl.dataset && targetEl.dataset.title) {
      return targetEl.dataset.title.trim();
    }
    if (targetEl) {
      var cardParent = targetEl.closest('[data-title], [data-modal-title]');
      if (cardParent && (cardParent.dataset.title || cardParent.dataset.modalTitle)) {
        return (cardParent.dataset.title || cardParent.dataset.modalTitle).trim();
      }
    }
    var modalTitleEl = document.getElementById('modal-title') ||
      document.querySelector('#title-modal h2') ||
      document.querySelector('#title-modal-body h2') ||
      document.querySelector('.title-text') ||
      document.querySelector('#hicine-srv-meta-title');
    var raw = modalTitleEl ? modalTitleEl.textContent.trim() : '';
    if (raw) {
      return raw.replace(/[:\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
    }
    // Strictly do NOT read page h1 if title modal is active
    var isModalOpen = document.getElementById('title-modal') && !document.getElementById('title-modal').classList.contains('hidden');
    if (!isModalOpen) {
      var h1 = document.querySelector('h1');
      if (h1 && h1.textContent.trim()) {
        return h1.textContent.trim().replace(/[:\-–—]/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }
    return '';
  }

  window.getFastCloudDownloadHref = function(rawUrl, meta) {
    if (!rawUrl) return '#';
    var isExternal = /nexdrive|hubcloud|dotmobiz|drivehub/i.test(rawUrl);
    if (isExternal) {
      return rawUrl;
    }

    if (rawUrl.indexOf('/api/download-file') === 0) {
      return rawUrl;
    }

    var qs = 'url=' + encodeURIComponent(rawUrl);
    if (meta) {
      if (meta.title) qs += '&title=' + encodeURIComponent(meta.title);
      if (meta.tmdbId) qs += '&id=' + encodeURIComponent(meta.tmdbId);
      if (meta.se) qs += '&se=' + encodeURIComponent(meta.se);
      if (meta.ep) qs += '&ep=' + encodeURIComponent(meta.ep);
      if (meta.quality) qs += '&quality=' + encodeURIComponent(meta.quality);
    }
    return '/api/download-file?' + qs;
  };

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
      targetEl.style.opacity = '0.9';
      targetEl.innerHTML = '<div style="display:flex;align-items:center;gap:8px;justify-content:center;width:100%;">' +
        '<svg style="animation:fw-spin 1s linear infinite;width:16px;height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">' +
          '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25"></circle>' +
          '<path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-linecap="round"></path>' +
        '</svg>' +
        '<span style="font-weight:600;font-size:12px;letter-spacing:0.3px;">Connecting Stream...</span>' +
      '</div>';
    }

    var restore = function() {
      if (targetEl && originalHtml) {
        setTimeout(function() {
          targetEl.innerHTML = originalHtml;
          targetEl.style.pointerEvents = 'auto';
          targetEl.style.opacity = '1';
        }, 2200);
      }
    };

    var cleanVcloud = extractVcloudUrl(rawUrl);
    var isExternal = /nexdrive|hubcloud|dotmobiz|drivehub/i.test(cleanVcloud) || /nexdrive|hubcloud|dotmobiz|drivehub/i.test(rawUrl);

    // If external mirror (Dotmovies, Nexdrive, Hubcloud), open directly in new tab
    if (isExternal) {
      if (window.__showToast) {
        window.__showToast('🚀 Opening high-speed direct download mirror...', '⚡');
      }
      window.open(cleanVcloud || rawUrl, '_blank', 'noopener,noreferrer');
      restore();
      return;
    }

    // First try our own universal API endpoint with JSON mode
    try {
      var directApi = '/api/download-file?url=' + encodeURIComponent(cleanVcloud || rawUrl) + '&json=1';
      var controller0 = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timeoutId0 = controller0 ? setTimeout(function() { controller0.abort(); }, 3500) : null;
      var res0 = await fetch(directApi, { signal: controller0 ? controller0.signal : undefined });
      if (timeoutId0) clearTimeout(timeoutId0);
      if (res0.ok) {
        var json0 = await res0.json();
        if (json0 && json0.ok && json0.directUrl && !json0.directUrl.includes('workers.dev')) {
          if (targetEl) {
            targetEl.innerHTML = '<div style="display:flex;align-items:center;gap:8px;justify-content:center;width:100%;">' +
              '<span style="color:#4ade80;font-weight:700;font-size:12px;">✓ Starting Download...</span>' +
            '</div>';
          }
          if (window.__showToast) {
            window.__showToast('📥 High-speed direct file download starting...', '⚡');
          }
          try {
            window.location.assign(json0.directUrl);
          } catch(e) {
            window.open(json0.directUrl, '_blank');
          }
          restore();
          return;
        }
      }
    } catch(e) {}

    // Next try high-speed direct resolution via Workers
    for (var i = 0; i < WORKER_HOSTS.length; i++) {
      var host = WORKER_HOSTS[i];
      try {
        var apiUrl = host + '/api/links?vcloud=' + encodeURIComponent(cleanVcloud);
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timeoutId = controller ? setTimeout(function() { controller.abort(); }, 3000) : null;

        var res = await fetch(apiUrl, { signal: controller ? controller.signal : undefined });
        if (timeoutId) clearTimeout(timeoutId);

        if (!res.ok) continue;
        var json = await res.json();
        if (!json || !json.tokens || Object.keys(json.tokens).length === 0 || json.title === null) continue;

        var preferred = ['fsl', 'fsl2', 'server1', 'ten', 'gofile'];
        var type = null;
        for (var p = 0; p < preferred.length; p++) {
          if (json.tokens[preferred[p]]) {
            type = preferred[p];
            break;
          }
        }
        if (!type) {
          var tokenKeys = Object.keys(json.tokens);
          for (var k = 0; k < tokenKeys.length; k++) {
            if (tokenKeys[k] !== 'pixel') {
              type = tokenKeys[k];
              break;
            }
          }
        }
        if (!type) continue;

        var tok = json.tokens[type];
        var goUrl = host + '/go?type=' + type + '&vcloud=' + encodeURIComponent(cleanVcloud) + '&ts=' + tok.ts + '&sig=' + tok.sig;

        if (targetEl) {
          targetEl.innerHTML = '<div style="display:flex;align-items:center;gap:8px;justify-content:center;width:100%;">' +
            '<span style="color:#4ade80;font-weight:700;font-size:12px;">✓ Starting Download...</span>' +
          '</div>';
        }
        if (window.__showToast) {
          window.__showToast('📥 High-speed direct file download starting...', '⚡');
        }

        // Trigger download directly in browser
        try {
          window.location.assign(goUrl);
        } catch(e) {
          var dlLink = document.createElement('a');
          dlLink.href = goUrl;
          dlLink.target = '_blank';
          dlLink.rel = 'noopener noreferrer';
          document.body.appendChild(dlLink);
          dlLink.click();
          document.body.removeChild(dlLink);
        }

        restore();
        return;
      } catch(e) {}
    }

    // Direct High-Speed Download Trigger: NEVER redirect to Dotmovies search page!
    var title = getActiveTitle(targetEl);
    var tmdbId = (targetEl && targetEl.dataset && targetEl.dataset.tmdbid) || '';
    var se = (targetEl && targetEl.dataset && targetEl.dataset.se) || '';
    var ep = (targetEl && targetEl.dataset && targetEl.dataset.ep) || '';
    var quality = (targetEl && targetEl.dataset && targetEl.dataset.quality) || '';

    var queryParts = [];
    if (cleanVcloud || rawUrl) queryParts.push('url=' + encodeURIComponent(cleanVcloud || rawUrl));
    if (title) queryParts.push('title=' + encodeURIComponent(title));
    if (tmdbId) queryParts.push('id=' + encodeURIComponent(tmdbId));
    if (se) queryParts.push('se=' + encodeURIComponent(se));
    if (ep) queryParts.push('ep=' + encodeURIComponent(ep));
    if (quality) queryParts.push('quality=' + encodeURIComponent(quality));
    queryParts.push('download=1');

    var directFallbackUrl = '/api/download-file?' + queryParts.join('&');

    if (window.__showToast) {
      window.__showToast('📥 Starting Direct High-Speed File Download...', '⚡');
    }
    if (targetEl) {
      targetEl.innerHTML = '<div style="display:flex;align-items:center;gap:8px;justify-content:center;width:100%;">' +
        '<span style="color:#4ade80;font-weight:700;font-size:12px;">✓ Starting Download...</span>' +
      '</div>';
    }

    try {
      window.location.assign(directFallbackUrl);
    } catch(e) {
      var a = document.createElement('a');
      a.href = directFallbackUrl;
      a.setAttribute('download', (title ? title.replace(/[^a-zA-Z0-9.\-_ ]/g, '') : 'Netflix4U_Download') + '.mkv');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    restore();
  };

  // Inject spinner animation if not present
  if (typeof document !== 'undefined' && !document.getElementById('fw-spin-style')) {
    var st = document.createElement('style');
    st.id = 'fw-spin-style';
    st.textContent = '@keyframes fw-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
    document.head.appendChild(st);
  }
})();
