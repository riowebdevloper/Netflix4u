/**
 * Netflix4U - 1:1 Hicine Human Verification Gate
 * Replicating Screenshot 2: "Welcome Back!" & Anti-Bot Protection
 * - Daily token valid until midnight
 * - Live countdown timer "Resets in: HH:MM:SS"
 * - Human verification slider challenge (blocks AI/crawlers)
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'fw_hicine_gate_token';
  const TIME_KEY = 'fw_hicine_gate_time';

  // Helper: Format 12-hour time (e.g. 03:24 PM)
  function formatTime12(date) {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const strMinutes = minutes < 10 ? '0' + minutes : minutes;
    const strHours = hours < 10 ? '0' + hours : hours;
    return `${strHours}:${strMinutes} ${ampm}`;
  }

  // Helper: Calculate seconds remaining until midnight tonight
  function getTimeUntilMidnight() {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const diffMs = Math.max(0, midnight.getTime() - now.getTime());
    const totalSecs = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    return {
      hours: String(hours).padStart(2, '0'),
      minutes: String(minutes).padStart(2, '0'),
      seconds: String(seconds).padStart(2, '0'),
      expired: totalSecs <= 0
    };
  }

  // Check verification state
  function isTokenValid() {
    try {
      const token = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('hicine_token_received');
      const timestamp = localStorage.getItem(TIME_KEY) || localStorage.getItem('hicine_token_timestamp');
      if (!token || !timestamp) return false;

      const tokenDate = new Date(parseInt(timestamp, 10));
      const nowDate = new Date();
      // Must be same calendar day
      if (
        tokenDate.getFullYear() !== nowDate.getFullYear() ||
        tokenDate.getMonth() !== nowDate.getMonth() ||
        tokenDate.getDate() !== nowDate.getDate()
      ) {
        // Expired at midnight
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TIME_KEY);
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function setVerifiedToken() {
    try {
      const now = Date.now();
      localStorage.setItem(STORAGE_KEY, 'verified_' + now);
      localStorage.setItem(TIME_KEY, String(now));
      localStorage.setItem('hicine_token_received', 'true');
      localStorage.setItem('hicine_token_timestamp', String(now));
      sessionStorage.setItem('hiiCineSessionValidated', '1');
      document.cookie = `fw_gate_verified=1; path=/; max-age=86400; SameSite=Lax`;
    } catch (e) {}
  }

  // Build and render the gate HTML
  function initGate() {
    let overlay = document.getElementById('hicine-gate-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'hicine-gate-overlay';
      document.body.appendChild(overlay);
    }

    const verified = isTokenValid();
    const storedTime = localStorage.getItem(TIME_KEY);
    const accessDate = storedTime ? new Date(parseInt(storedTime, 10)) : new Date();
    const accessTimeStr = formatTime12(accessDate);

    if (verified) {
      renderWelcomeBackScreen(overlay, accessTimeStr);
    } else {
      renderChallengeScreen(overlay);
    }
  }

  // 1:1 Rendering of Screenshot 2 (Welcome Back Screen)
  function renderWelcomeBackScreen(overlay, accessTimeStr) {
    let redirectSeconds = 2;

    overlay.innerHTML = `
      <div class="hicine-gate-card">
        <!-- Glowing Green Checkmark Circle -->
        <div class="hicine-check-ring-wrapper">
          <div class="hicine-check-ring-outer"></div>
          <div class="hicine-check-ring-inner"></div>
          <div class="hicine-check-circle">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>

        <!-- Already Verified Badge -->
        <div>
          <span class="hicine-status-badge">
            <span class="hicine-status-dot"></span>
            ALREADY VERIFIED
          </span>
        </div>

        <!-- Heading & Subtitle -->
        <h2 class="hicine-gate-title">Welcome Back!</h2>
        <p class="hicine-gate-subtitle">
          You've already accessed Netflix4U today. Redirecting you automatically.
        </p>

        <!-- Access Timestamp -->
        <div class="hicine-accessed-time">
          ✓ Accessed at ${accessTimeStr}
        </div>

        <!-- Redirect countdown -->
        <div class="hicine-redirecting-text" id="hicine-redirect-text">
          Redirecting in <strong id="hicine-redirect-sec">${redirectSeconds}</strong> s
        </div>

        <!-- Big Green Button -->
        <button class="hicine-gate-btn" id="hicine-enter-now-btn">
          Enter Netflix4U Now &rarr;
        </button>

        <!-- Bottom Expiry & Reset Countdown Box -->
        <div class="hicine-gate-expiry">
          <p>Your free access is valid until midnight tonight.</p>
          <div>Resets in: <span class="hicine-countdown-yellow" id="hicine-midnight-timer">00:00:00</span></div>
        </div>
      </div>
    `;

    // Unlock action
    const unlockSite = () => {
      overlay.classList.add('hidden');
      setTimeout(() => {
        if (overlay.parentNode) overlay.style.display = 'none';
      }, 400);
    };

    const enterBtn = document.getElementById('hicine-enter-now-btn');
    if (enterBtn) enterBtn.addEventListener('click', unlockSite);

    // Live countdown to midnight
    const updateMidnightTimer = () => {
      const timerEl = document.getElementById('hicine-midnight-timer');
      if (!timerEl) return;
      const t = getTimeUntilMidnight();
      timerEl.textContent = `${t.hours}:${t.minutes}:${t.seconds}`;
    };
    updateMidnightTimer();
    const midnightInterval = setInterval(updateMidnightTimer, 1000);

    // Auto-redirect countdown
    const secEl = document.getElementById('hicine-redirect-sec');
    const autoInterval = setInterval(() => {
      redirectSeconds--;
      if (secEl) secEl.textContent = redirectSeconds;
      if (redirectSeconds <= 0) {
        clearInterval(autoInterval);
        clearInterval(midnightInterval);
        unlockSite();
      }
    }, 1000);
  }

  // Anti-Bot Challenge Screen (Unverified First Visit)
  function renderChallengeScreen(overlay) {
    overlay.innerHTML = `
      <div class="hicine-gate-card">
        <!-- Shield Icon -->
        <div class="hicine-check-ring-wrapper">
          <div class="hicine-check-ring-outer"></div>
          <div class="hicine-check-circle" style="background: #3b82f6; box-shadow: 0 0 24px rgba(59, 130, 246, 0.55);">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>
        </div>

        <div>
          <span class="hicine-status-badge" style="background: rgba(59, 130, 246, 0.12); color: #60a5fa; border-color: rgba(59, 130, 246, 0.3);">
            <span class="hicine-status-dot" style="background: #3b82f6; box-shadow: 0 0 8px #3b82f6;"></span>
            HUMAN VERIFICATION GATE
          </span>
        </div>

        <h2 class="hicine-gate-title">Security Check</h2>
        <p class="hicine-gate-subtitle">
          Slide the button to verify you are a human. Access will remain unlocked until midnight.
        </p>

        <!-- Interactive Drag-to-Verify Slider Challenge -->
        <div class="hicine-challenge-box">
          <div class="hicine-slider-track" id="hicine-slider-track">
            <span class="hicine-slider-label" id="hicine-slider-label">Slide to Verify &rarr;</span>
            <div class="hicine-slider-thumb" id="hicine-slider-thumb">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </div>
        </div>

        <div class="hicine-gate-expiry">
          <p>Protected by Netflix4U Anti-Bot Gateway.</p>
          <div>Access is free & reset daily at midnight.</div>
        </div>
      </div>
    `;

    setupSliderInteraction(overlay);
  }

  function setupSliderInteraction(overlay) {
    const track = document.getElementById('hicine-slider-track');
    const thumb = document.getElementById('hicine-slider-thumb');
    const label = document.getElementById('hicine-slider-label');
    if (!track || !thumb) return;

    let isDragging = false;
    let startX = 0;
    const maxSlide = track.offsetWidth - thumb.offsetWidth - 6;

    const onStart = (clientX) => {
      isDragging = true;
      startX = clientX;
    };

    const onMove = (clientX) => {
      if (!isDragging) return;
      const deltaX = Math.max(0, Math.min(clientX - startX, maxSlide));
      thumb.style.transform = `translateX(${deltaX}px)`;
      if (label) {
        label.style.opacity = String(1 - deltaX / maxSlide);
      }
      // Trigger threshold: 90%
      if (deltaX >= maxSlide * 0.88) {
        isDragging = false;
        completeVerification(overlay);
      }
    };

    const onEnd = () => {
      if (!isDragging) return;
      isDragging = false;
      thumb.style.transition = 'transform 0.25s ease';
      thumb.style.transform = 'translateX(0px)';
      if (label) label.style.opacity = '1';
      setTimeout(() => {
        thumb.style.transition = '';
      }, 250);
    };

    // Mouse events
    thumb.addEventListener('mousedown', (e) => onStart(e.clientX));
    window.addEventListener('mousemove', (e) => onMove(e.clientX));
    window.addEventListener('mouseup', onEnd);

    // Touch events for mobile
    thumb.addEventListener('touchstart', (e) => onStart(e.touches[0].clientX), { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (isDragging && e.touches[0]) onMove(e.touches[0].clientX);
    }, { passive: true });
    window.addEventListener('touchend', onEnd);
  }

  function completeVerification(overlay) {
    setVerifiedToken();
    const accessTimeStr = formatTime12(new Date());
    renderWelcomeBackScreen(overlay, accessTimeStr);
  }

  // Global exports for dev/testing
  window.HicineGate = {
    isVerified: isTokenValid,
    setVerified: setVerifiedToken,
    reset: function () {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TIME_KEY);
      localStorage.removeItem('hicine_token_received');
      sessionStorage.removeItem('hiiCineSessionValidated');
      initGate();
    }
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGate);
  } else {
    initGate();
  }
})();
