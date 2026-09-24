/**
 * Netflix4U Client-Side Version & Auto-Update Engine
 * Ensures users always see the latest website version without stale cache issues.
 *
 * Capabilities:
 *  1. Background polling against /version.json with cache-busting.
 *  2. Instant check on tab focus & visibility change.
 *  3. Service Worker controllerchange listener for instant PWA updates.
 *  4. Intelligent reload: Auto-refreshes if browsing, or shows a floating "Update Now" pill if playing video.
 *  5. Anti-loop protection (enforces minimum cooldown between auto-reloads).
 */

(function() {
  'use strict';

  var CURRENT_VERSION = '3.5.0';
  window.__NETFLIX4U_VERSION = CURRENT_VERSION;

  var POLL_INTERVAL_MS = 60 * 1000; // Check every 60 seconds
  var RELOAD_COOLDOWN_MS = 20 * 1000; // Minimum 20s between reloads
  var isChecking = false;
  var hasReloadPrompt = false;

  function isUserWatchingVideo() {
    var watchModal = document.getElementById('watch-modal');
    if (watchModal && !watchModal.classList.contains('hidden') && watchModal.classList.contains('flex')) {
      return true;
    }
    var artPlayer = document.querySelector('.art-video-player, video, iframe[src*="play"], iframe[src*="watch"]');
    return !!artPlayer && (watchModal && !watchModal.classList.contains('hidden'));
  }

  function showUpdatePill() {
    if (hasReloadPrompt) return;
    hasReloadPrompt = true;

    var pill = document.createElement('div');
    pill.id = 'netflix4u-update-pill';
    pill.setAttribute('role', 'alert');
    pill.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:99999;display:flex;align-items:center;gap:12px;padding:12px 18px;background:rgba(20,20,20,0.95);color:#fff;border-radius:9999px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.8),0 0 0 1px rgba(229,9,20,0.6);backdrop-filter:blur(12px);font-family:inherit;font-size:13px;font-weight:600;animation:n4uSlideIn 0.3s cubic-bezier(0.16,1,0.3,1);';
    pill.innerHTML = '<span style="display:inline-flex;align-items:center;gap:6px;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 8px #22c55e;"></span>New Update Available</span>' +
      '<button id="netflix4u-update-btn" type="button" style="background:#e50914;color:#fff;border:none;border-radius:9999px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;transition:transform 0.15s,background 0.15s;">Update Now</button>' +
      '<button id="netflix4u-update-dismiss" type="button" aria-label="Dismiss" style="background:transparent;border:none;color:#888;cursor:pointer;font-size:16px;line-height:1;padding:2px 6px;">&times;</button>';

    var style = document.createElement('style');
    style.textContent = '@keyframes n4uSlideIn{from{transform:translateY(30px);opacity:0}to{transform:translateY(0);opacity:1}} #netflix4u-update-btn:hover{background:#b80710;transform:scale(1.05);}';
    document.head.appendChild(style);
    document.body.appendChild(pill);

    document.getElementById('netflix4u-update-btn').addEventListener('click', function() {
      executeReload();
    });
    document.getElementById('netflix4u-update-dismiss').addEventListener('click', function() {
      if (pill && pill.parentNode) pill.parentNode.removeChild(pill);
    });
  }

  function executeReload() {
    var now = Date.now();
    var lastReload = parseInt(sessionStorage.getItem('n4u_last_auto_reload') || '0', 10);
    if (now - lastReload < RELOAD_COOLDOWN_MS) {
      return;
    }
    sessionStorage.setItem('n4u_last_auto_reload', String(now));

    // Clear caches in Service Worker if possible
    if ('caches' in window) {
      caches.keys().then(function(names) {
        return Promise.all(names.map(function(name) {
          return caches.delete(name);
        }));
      }).catch(function() {}).then(function() {
        window.location.reload(true);
      });
    } else {
      window.location.reload(true);
    }
  }

  function checkVersion() {
    if (isChecking) return;
    isChecking = true;

    var url = '/version.json?_t=' + Date.now();
    fetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    })
    .then(function(res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function(data) {
      isChecking = false;
      if (!data || !data.version) return;

      var serverVersion = String(data.version).trim();
      if (serverVersion !== CURRENT_VERSION) {
        console.log('[Netflix4U] Client version out of date (Client:', CURRENT_VERSION, ', Server:', serverVersion, ')');
        
        if (isUserWatchingVideo()) {
          showUpdatePill();
        } else {
          // User is browsing, auto-reload smoothly
          if (window.__showToast) {
            window.__showToast('✨ New updates detected! Refreshing website...', '🚀');
          }
          setTimeout(function() {
            executeReload();
          }, 800);
        }
      }
    })
    .catch(function(err) {
      isChecking = false;
      // Fail silently on network offline
    });
  }

  // 1. Initial check shortly after load
  if (document.readyState === 'complete') {
    setTimeout(checkVersion, 2500);
  } else {
    window.addEventListener('load', function() {
      setTimeout(checkVersion, 2500);
    });
  }

  // 2. Periodic background check
  setInterval(checkVersion, POLL_INTERVAL_MS);

  // 3. Tab visibility change (when user returns to the website)
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      checkVersion();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(function(reg) {
          if (reg) reg.update();
        }).catch(function() {});
      }
    }
  });

  // 4. Window focus
  window.addEventListener('focus', function() {
    checkVersion();
  });

  // 5. Service Worker controller change & message handling
  if ('serviceWorker' in navigator) {
    let isControlledOnLoad = !!navigator.serviceWorker.controller;

    navigator.serviceWorker.addEventListener('message', function(event) {
      if (event.data && (event.data.type === 'SW_UPDATED' || event.data.type === 'NEW_VERSION')) {
        console.log('[Netflix4U] Service Worker updated broadcast received.');
        if (!isControlledOnLoad) return; // Do not reload on very first install
        if (!isUserWatchingVideo()) {
          executeReload();
        } else {
          showUpdatePill();
        }
      }
    });

    navigator.serviceWorker.addEventListener('controllerchange', function() {
      console.log('[Netflix4U] Service Worker controller changed.');
      if (!isControlledOnLoad) {
        // This is the first time the SW claimed this client (initial visit)
        isControlledOnLoad = true;
        return;
      }
      if (!isUserWatchingVideo()) {
        executeReload();
      } else {
        showUpdatePill();
      }
    });
  }
})();
