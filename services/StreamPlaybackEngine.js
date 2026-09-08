/**
 * Production HLS Playback Engine with Mirror Failover & Absolute Failure Handling
 * Handles multi-CDN .m3u8 mirrors, cleans up buffer memory, and recovers from fatal errors.
 */
export class StreamPlaybackEngine {
  constructor(videoElement, containerElement, options = {}) {
    this.video = videoElement;
    this.container = containerElement;
    this.options = {
      mirrors: options.mirrors || [],
      onMirrorSwitch: options.onMirrorSwitch || (() => {}),
      onFatalFailure: options.onFatalFailure || (() => {}),
      maxRetriesPerMirror: options.maxRetriesPerMirror || 2,
      ...options
    };

    this.hls = null;
    this.currentMirrorIndex = 0;
    this.currentRetryCount = 0;
    this.isDestroyed = false;
  }

  init() {
    if (!this.options.mirrors.length) {
      this.handleAbsoluteFailure(new Error('No playback mirrors provided'));
      return;
    }
    this.loadCurrentMirror();
  }

  loadCurrentMirror() {
    if (this.isDestroyed) return;

    const sourceUrl = this.options.mirrors[this.currentMirrorIndex];
    this.options.onMirrorSwitch(this.currentMirrorIndex, sourceUrl);

    // Teardown previous HLS instance if active
    this.destroyHlsInstance();

    if (window.Hls && window.Hls.isSupported()) {
      this.hls = new window.Hls({
        enableWorker: true,
        lowLatencyMode: true,
        manifestLoadingTimeOut: 8000,
        manifestLoadingMaxRetry: 1,
        fragLoadingTimeOut: 10000,
        fragLoadingMaxRetry: 2
      });

      this.hls.attachMedia(this.video);

      this.hls.on(window.Hls.Events.MEDIA_ATTACHED, () => {
        if (!this.isDestroyed && this.hls) {
          this.hls.loadSource(sourceUrl);
        }
      });

      this.hls.on(window.Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          this.handleFatalError(data);
        }
      });
    } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari iOS HLS playback
      this.video.src = sourceUrl;
      this.video.onerror = () => this.handleFatalError({ type: 'NATIVE_HLS_ERROR' });
    } else {
      this.handleAbsoluteFailure(new Error('HLS playback is not supported on this browser'));
    }
  }

  handleFatalError(errorData) {
    if (this.isDestroyed) return;

    console.warn(`[StreamEngine] Mirror ${this.currentMirrorIndex} failed:`, errorData);

    if (this.currentRetryCount < this.options.maxRetriesPerMirror) {
      this.currentRetryCount++;
      if (this.hls) {
        this.hls.startLoad();
      } else {
        this.loadCurrentMirror();
      }
      return;
    }

    // Mirror exhausted -> advance to next mirror
    this.currentRetryCount = 0;
    this.currentMirrorIndex++;

    if (this.currentMirrorIndex < this.options.mirrors.length) {
      console.log(`[StreamEngine] Switching to fallback mirror [${this.currentMirrorIndex}]`);
      this.loadCurrentMirror();
    } else {
      // ==========================================
      // 🚨 ABSOLUTE FAILURE STATE: ALL MIRRORS DEAD
      // ==========================================
      this.handleAbsoluteFailure(errorData);
    }
  }

  handleAbsoluteFailure(errorData) {
    console.error('[StreamEngine] Fatal: All streaming mirrors exhausted.', errorData);

    // 1. Purge all media pipelines & worker threads
    this.destroyHlsInstance();

    // 2. Tear down HTML5 Video Element & free GPU buffer
    if (this.video) {
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
    }

    // 3. Render In-Player Recovery View in DOM
    if (this.container) {
      this.renderFailureCard();
    }

    // 4. Trigger consumer callback (e.g. switch UI to Server 1 / VidLink)
    this.options.onFatalFailure({
      mirrorsAttempted: this.options.mirrors.length,
      lastError: errorData
    });
  }

  renderFailureCard() {
    const errorOverlay = document.createElement('div');
    errorOverlay.className = 'absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center text-white';
    errorOverlay.innerHTML = `
      <div class="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 mb-3 text-2xl font-black">⚠️</div>
      <h3 class="text-base font-bold mb-1">Stream Temporarily Unavailable</h3>
      <p class="text-xs text-gray-400 max-w-sm mb-4">All direct cloud mirrors for this title are currently unresponsive. Please switch to an alternate streaming server.</p>
      <div class="flex items-center gap-3">
        <button id="btn-fallback-server1" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg cursor-pointer">Switch to Server 1</button>
        <button id="btn-retry-all" class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer">Retry All</button>
      </div>
    `;

    this.container.appendChild(errorOverlay);

    errorOverlay.querySelector('#btn-fallback-server1')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('switch_playback_server', { detail: { serverId: 'vidlink' } }));
    });

    errorOverlay.querySelector('#btn-retry-all')?.addEventListener('click', () => {
      errorOverlay.remove();
      this.currentMirrorIndex = 0;
      this.currentRetryCount = 0;
      this.loadCurrentMirror();
    });
  }

  destroyHlsInstance() {
    if (this.hls) {
      try {
        this.hls.stopLoad();
        this.hls.detachMedia();
        this.hls.destroy();
      } catch (e) {
        console.warn('[StreamEngine] Error destroying HLS instance:', e);
      }
      this.hls = null;
    }
  }

  destroy() {
    this.isDestroyed = true;
    this.destroyHlsInstance();
    if (this.video) {
      this.video.onerror = null;
      this.video.pause();
      this.video.removeAttribute('src');
    }
  }
}
