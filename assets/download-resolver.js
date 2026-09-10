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

  window.getFastCloudDownloadHref = function(rawUrl) {
    if (!rawUrl) return '#';
    var vcloud = extractVcloudUrl(rawUrl);

    // If it's a direct external download link (like nexdrive, google drive, direct mp4, etc.)
    if (vcloud.indexOf('vcloud') === -1 && vcloud.indexOf('workers.dev') === -1 && (vcloud.indexOf('http://') === 0 || vcloud.indexOf('https://') === 0)) {
      return vcloud;
    }

    if (vcloud.indexOf('vcloud') !== -1 || vcloud.indexOf('workers.dev') !== -1) {
      // Ensure clean unwrapped vcloud URL for the worker
      var cleanTarget = vcloud;
      if (cleanTarget.indexOf('vcloud=') !== -1) {
        var m = cleanTarget.match(/vcloud=([^&#]+)/);
        if (m) cleanTarget = decodeURIComponent(m[1]);
      }
      return WORKER_HOSTS[0] + '/?vcloud=' + encodeURIComponent(cleanTarget);
    }

    // Safety guard: Never return internal /api/download path
    if (rawUrl.indexOf('/api/download') === 0 || rawUrl.indexOf('api/download') === 0) {
      return WORKER_HOSTS[0] + '/?vcloud=' + encodeURIComponent(rawUrl);
    }

    return rawUrl;
  };

  window.handleFastCloudDownload = async function(event, rawUrl) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    var targetEl = event && (event.currentTarget || (event.target && event.target.closest('a')));
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
        '<span style="font-weight:600;font-size:12px;letter-spacing:0.3px;">Connecting High-Speed Stream...</span>' +
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

    // If direct link (not vcloud or workers), open directly
    if (cleanVcloud.indexOf('vcloud') === -1 && cleanVcloud.indexOf('workers.dev') === -1 && (cleanVcloud.indexOf('http://') === 0 || cleanVcloud.indexOf('https://') === 0)) {
      window.open(cleanVcloud, '_blank', 'noopener,noreferrer');
      restore();
      return;
    }

    // Ensure we have the raw target for workers
    if (cleanVcloud.indexOf('vcloud=') !== -1) {
      var m = cleanVcloud.match(/vcloud=([^&#]+)/);
      if (m) cleanVcloud = decodeURIComponent(m[1]);
    }

    // Try high-speed direct resolution via Workers
    for (var i = 0; i < WORKER_HOSTS.length; i++) {
      var host = WORKER_HOSTS[i];
      try {
        var apiUrl = host + '/api/links?vcloud=' + encodeURIComponent(cleanVcloud);
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timeoutId = controller ? setTimeout(function() { controller.abort(); }, 3500) : null;

        var res = await fetch(apiUrl, { signal: controller ? controller.signal : undefined });
        if (timeoutId) clearTimeout(timeoutId);

        if (!res.ok) continue;
        var json = await res.json();
        if (!json || !json.tokens) continue;

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

        // Trigger download directly in browser
        var dlLink = document.createElement('a');
        dlLink.href = goUrl;
        dlLink.target = '_blank';
        dlLink.rel = 'noopener noreferrer';
        document.body.appendChild(dlLink);
        dlLink.click();
        document.body.removeChild(dlLink);

        restore();
        return;
      } catch(e) {}
    }

    // Fallback: If direct worker API is unreachable or timed out, open fallback worker interface
    var fallback = WORKER_HOSTS[0] + '/?vcloud=' + encodeURIComponent(cleanVcloud);
    window.open(fallback, '_blank', 'noopener,noreferrer');
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
