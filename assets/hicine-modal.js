/**
 * Netflix4U - 1:1 Hicine Modal & Multi-Server Download System
 * Features:
 * - 1:1 Hicine 2-Column Detail Modal (Screenshot 1)
 * - 1:1 "🎬 Servers Ready" Fast Download Modal with 5-minute countdown (Screenshot 4)
 * - REAL Download triggers for FSL, Pixel, 10Gbps, and Server 1
 * - Prominent Dotmovies Exclusive Downloads (NexDrive / HubCloud / Dual Audio)
 * - Prominent In-House Video Streaming Player (AllMovieLand Hindi Dual Audio, VidLink, VidSrc)
 * - Trailers & Cloud Links
 */

(function () {
  'use strict';

  let currentTitleData = null;
  let activeVcloudUrl = null;
  let activeQuality = '1080p';
  let serverCountdownInterval = null;

  function initModalContainers() {
    // 1. Detail Modal Container
    if (!document.getElementById('hicine-modal-overlay')) {
      const modalOverlay = document.createElement('div');
      modalOverlay.id = 'hicine-modal-overlay';
      modalOverlay.innerHTML = `
        <div class="hicine-modal-container" id="hicine-modal-container">
          <!-- Close Button -->
          <button class="hicine-modal-close-btn" id="hicine-modal-close" aria-label="Close modal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <!-- Left Column: Poster -->
          <div class="hicine-modal-poster-col">
            <img class="hicine-modal-poster-img" id="hicine-modal-poster" src="/images/no-poster.svg" alt="Poster" />
          </div>

          <!-- Right Column: Content -->
          <div class="hicine-modal-content-col">
            <h2 class="hicine-modal-title" id="hicine-modal-title">Loading Title...</h2>
            <div class="hicine-modal-updated" id="hicine-modal-updated">Updated on Sep 4, 2026</div>

            <!-- Prominent Quick Action Switcher (Watch Online vs Download) -->
            <div style="display: flex; gap: 10px; margin-bottom: 1.25rem; flex-wrap: wrap;">
              <button id="hicine-quick-watch-btn" style="flex: 1; min-width: 180px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: #2563eb; color: #fff; font-weight: 700; font-size: 0.925rem; padding: 11px 18px; border-radius: 12px; border: none; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                Watch Online (Player)
              </button>
              <button id="hicine-quick-dl-btn" style="flex: 1; min-width: 180px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: #ff0033; color: #fff; font-weight: 700; font-size: 0.925rem; padding: 11px 18px; border-radius: 12px; border: none; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 14px rgba(255, 0, 51, 0.4);">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Direct Download Links
              </button>
            </div>

            <!-- Tabs Bar (Screenshot 1) -->
            <div class="hicine-tabs-bar" id="hicine-tabs-bar">
              <button class="hicine-tab-btn active" data-tab="download">Download</button>
              <button class="hicine-tab-btn" data-tab="stream">Watch Online</button>
              <button class="hicine-tab-btn" data-tab="trailer">Trailer</button>
              <button class="hicine-tab-btn" data-tab="cloud">Cloud Links</button>
              <button class="hicine-tab-btn" data-tab="details">Details</button>
              <button class="hicine-tab-btn" data-tab="previews">Previews</button>
            </div>

            <!-- TAB 1: DOWNLOAD (Hicine + Dotmovies Links) -->
            <div id="hicine-tab-panel-download" class="hicine-tab-content">
              <!-- HICINE CLOUD SERVERS SECTION -->
              <div style="margin-bottom: 1.5rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                  <span style="font-size: 0.8rem; font-weight: 800; color: #ff3355; text-transform: uppercase; letter-spacing: 0.05em; display: inline-flex; align-items: center; gap: 6px;">
                    ⚡ Hicine Fast Cloud Mirrors (FSL / Pixel / 10Gbps)
                  </span>
                  <span style="font-size: 0.75rem; background: rgba(255,0,51,0.15); color: #ff6688; border: 1px solid rgba(255,0,51,0.3); padding: 2px 8px; border-radius: 6px; font-weight: 700;">Fastest</span>
                </div>
                <div class="hicine-downloads-container" id="hicine-cloud-downloads-list"></div>
              </div>

              <!-- DOTMOVIES EXCLUSIVE DOWNLOADS SECTION -->
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                  <span style="font-size: 0.8rem; font-weight: 800; color: #10b981; text-transform: uppercase; letter-spacing: 0.05em; display: inline-flex; align-items: center; gap: 6px;">
                    📥 DotMovies Direct Links (NexDrive / Multi-Audio)
                  </span>
                  <span style="font-size: 0.75rem; background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); padding: 2px 8px; border-radius: 6px; font-weight: 700;">DotMovies</span>
                </div>
                <div class="hicine-downloads-container" id="hicine-dotmovies-downloads-list"></div>
              </div>
            </div>

            <!-- TAB 2: STREAMING PLAYER -->
            <div id="hicine-tab-panel-stream" class="hicine-tab-content" style="display: none;">
              <div class="hicine-player-tab-wrapper">
                <div class="hicine-player-servers-row" id="hicine-stream-servers">
                  <button class="hicine-stream-server-btn active" data-src="server1">AllMovieLand (Hindi Audio)</button>
                  <button class="hicine-stream-server-btn" data-src="server2">Fast Cloud</button>
                  <button class="hicine-stream-server-btn" data-src="server3">VidLink Multi-Lang</button>
                  <button class="hicine-stream-server-btn" data-src="server4">VidSrc Pro</button>
                </div>
                <div class="hicine-iframe-container">
                  <iframe id="hicine-stream-iframe" src="" allowfullscreen allow="autoplay; fullscreen; encrypted-media"></iframe>
                </div>
                <div style="font-size: 0.8rem; color: #94a3b8; background: rgba(255,255,255,0.03); padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
                  💡 <strong style="color: #fff;">Audio Settings:</strong> Click the player settings gear to switch audio tracks (Hindi / English) or enable subtitles.
                </div>
              </div>
            </div>

            <!-- TAB 3: TRAILER -->
            <div id="hicine-tab-panel-trailer" class="hicine-tab-content" style="display: none;">
              <div class="hicine-iframe-container">
                <iframe id="hicine-trailer-iframe" src="" allowfullscreen allow="autoplay; encrypted-media"></iframe>
              </div>
            </div>

            <!-- TAB 4: CLOUD LINKS -->
            <div id="hicine-tab-panel-cloud" class="hicine-tab-content" style="display: none;">
              <div class="hicine-downloads-container" id="hicine-cloud-list"></div>
            </div>

            <!-- TAB 5: DETAILS -->
            <div id="hicine-tab-panel-details" class="hicine-tab-content" style="display: none;">
              <div id="hicine-details-body" style="color: #cbd5e1; font-size: 0.9rem; line-height: 1.6;"></div>
            </div>

            <!-- TAB 6: PREVIEWS -->
            <div id="hicine-tab-panel-previews" class="hicine-tab-content" style="display: none;">
              <div id="hicine-previews-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;"></div>
            </div>

          </div>
        </div>
      `;
      document.body.appendChild(modalOverlay);

      document.getElementById('hicine-modal-close').addEventListener('click', closeModal);
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
      });

      // Quick Switcher Buttons
      document.getElementById('hicine-quick-watch-btn').addEventListener('click', () => {
        setTabActive('stream');
      });
      document.getElementById('hicine-quick-dl-btn').addEventListener('click', () => {
        setTabActive('download');
      });

      // Tab switching
      const tabBtns = modalOverlay.querySelectorAll('.hicine-tab-btn');
      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const tab = btn.getAttribute('data-tab');
          setTabActive(tab);
        });
      });
    }

    // 2. "Servers Ready" Multi-Server Modal (Screenshot 4)
    if (!document.getElementById('hicine-servers-modal')) {
      const srvModal = document.createElement('div');
      srvModal.id = 'hicine-servers-modal';
      srvModal.innerHTML = `
        <div class="hicine-servers-card">
          <button class="hicine-modal-close-btn" id="hicine-servers-close" style="top: 1rem; right: 1rem;" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <!-- 5-Minute Countdown Banner -->
          <div class="hicine-expire-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            Links expire in <span id="hicine-server-countdown">4:59</span>
          </div>

          <div class="hicine-servers-header">
            <h3>Servers Ready</h3>
          </div>

          <div class="hicine-server-meta-box">
            <div class="label">Title</div>
            <div class="title" id="hicine-srv-meta-title">Mirzapur The Movie 2026 1080p HDTC Hindi LINE HC ESub x264 1VegaMovies tw</div>
            <div class="label">File Size</div>
            <div class="size" id="hicine-srv-meta-size">3.69 GB</div>
          </div>

          <!-- Real Multi-Server Buttons -->
          <div class="hicine-server-items">
            <div class="hicine-server-item">
              <div class="hicine-server-name">FSL Server <span class="hicine-server-badge">Ultra Fast</span></div>
              <button class="hicine-dl-btn hicine-srv-trigger" data-server="fsl">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Download
              </button>
            </div>

            <div class="hicine-server-item">
              <div class="hicine-server-name">FSLv2 Server <span class="hicine-server-badge">High Speed</span></div>
              <button class="hicine-dl-btn hicine-srv-trigger" data-server="fsl2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Download
              </button>
            </div>

            <div class="hicine-server-item">
              <div class="hicine-server-name">Pixel Server <span class="hicine-server-badge" style="background: rgba(34,197,94,0.15); color: #34d399;">Direct CDN</span></div>
              <button class="hicine-dl-btn hicine-srv-trigger" data-server="pixel">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Download
              </button>
            </div>

            <div class="hicine-server-item">
              <div class="hicine-server-name">10Gbps Server <span class="hicine-server-badge" style="background: rgba(255,0,51,0.2); color:#ff3355;">Max Bandwidth</span></div>
              <button class="hicine-dl-btn hicine-srv-trigger" data-server="ten">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Download
              </button>
            </div>

            <div class="hicine-server-item">
              <div class="hicine-server-name">Server 1 <span class="hicine-server-badge">Cloud Mirror</span></div>
              <button class="hicine-dl-btn hicine-srv-trigger" data-server="server1">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                Download
              </button>
            </div>
          </div>

          <div class="hicine-ad-notice">
            <strong>10Gbps Notice:</strong>
            This server may show an ad popup. Close it, return, and tap Download again.
          </div>

          <p class="hicine-servers-footer">Links are signed &amp; time-limited (5 min).</p>
        </div>
      `;
      document.body.appendChild(srvModal);

      document.getElementById('hicine-servers-close').addEventListener('click', closeServersModal);
      srvModal.addEventListener('click', (e) => {
        if (e.target === srvModal) closeServersModal();
      });

      // Wire up server triggers to REAL downloads
      srvModal.querySelectorAll('.hicine-srv-trigger').forEach(btn => {
        btn.addEventListener('click', () => {
          const srv = btn.getAttribute('data-server');
          triggerServerDownload(srv, btn);
        });
      });
    }
  }

  function setTabActive(tabName) {
    const tabBtns = document.querySelectorAll('#hicine-tabs-bar .hicine-tab-btn');
    tabBtns.forEach(b => {
      if (b.getAttribute('data-tab') === tabName) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    const panels = ['download', 'stream', 'trailer', 'cloud', 'details', 'previews'];
    panels.forEach(p => {
      const el = document.getElementById(`hicine-tab-panel-${p}`);
      if (el) el.style.display = (p === tabName) ? 'block' : 'none';
    });

    if (tabName === 'stream') {
      setupStreamingPlayer();
    } else if (tabName === 'trailer') {
      setupTrailerPlayer();
    }
  }

  function triggerServerDownload(serverType, btn) {
    if (!activeVcloudUrl) {
      alert('Download link resolving, please wait...');
      return;
    }

    btn.innerHTML = `<span style="font-size: 0.8rem;">Starting...</span>`;
    const downloadEndpoint = `/api/download/server?vcloud=${encodeURIComponent(activeVcloudUrl)}&server=${serverType}`;

    // Direct browser navigation triggers immediate file download or redirect
    setTimeout(() => {
      btn.innerHTML = `✓ Ready`;
      window.open(downloadEndpoint, '_blank');
      setTimeout(() => {
        btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> Download`;
      }, 2500);
    }, 400);
  }

  function setupStreamingPlayer() {
    if (!currentTitleData) return;
    const tmdbId = currentTitleData.tmdbId || '';
    const imdbId = currentTitleData.imdbId || '';
    const isSeries = currentTitleData.type === 'series' || currentTitleData.type === 'anime' || currentTitleData.type === 'kdrama';

    // Initial stream load
    updateStreamingSource('server1', isSeries, tmdbId, imdbId);

    const srvBtns = document.querySelectorAll('#hicine-stream-servers .hicine-stream-server-btn');
    srvBtns.forEach(btn => {
      btn.onclick = () => {
        srvBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const src = btn.getAttribute('data-src');
        updateStreamingSource(src, isSeries, tmdbId, imdbId);
      };
    });
  }

  function updateStreamingSource(server, isSeries, tmdbId, imdbId) {
    const iframe = document.getElementById('hicine-stream-iframe');
    if (!iframe) return;

    let url = '';
    const targetId = imdbId || tmdbId || (currentTitleData ? currentTitleData.id : '');

    if (server === 'server1') {
      // AllMovieLand (Dotmobiz authentic Hindi stream)
      if (imdbId) {
        url = `https://slast430did.com/play/${imdbId}`;
      } else {
        url = `https://vidlink.pro/${isSeries ? 'tv' : 'movie'}/${targetId}?multiLang=true`;
      }
    } else if (server === 'server2') {
      // Fast Cloud / VidLink
      url = `https://vidlink.pro/${isSeries ? 'tv' : 'movie'}/${targetId}?multiLang=true`;
    } else if (server === 'server3') {
      // VidLink
      url = `https://vidlink.pro/${isSeries ? 'tv' : 'movie'}/${targetId}`;
    } else {
      // VidSrc
      url = imdbId
        ? `https://vidsrc.me/embed/${isSeries ? 'tv' : 'movie'}?imdb=${imdbId}`
        : `https://vidsrc.me/embed/${isSeries ? 'tv' : 'movie'}?tmdb=${tmdbId}`;
    }

    iframe.src = url;
  }

  function setupTrailerPlayer() {
    if (!currentTitleData) return;
    const iframe = document.getElementById('hicine-trailer-iframe');
    if (!iframe) return;

    if (currentTitleData.trailerUrl) {
      let tUrl = currentTitleData.trailerUrl;
      if (!tUrl.includes('autoplay')) tUrl += (tUrl.includes('?') ? '&' : '?') + 'autoplay=1&rel=0';
      iframe.src = tUrl;
    } else {
      const q = encodeURIComponent((currentTitleData.title || '') + ' official trailer');
      iframe.src = `https://www.youtube-nocookie.com/embed?listType=search&list=${q}&autoplay=1`;
    }
  }

  function openModal(data) {
    initModalContainers();
    currentTitleData = data;

    // 1. Poster
    const posterEl = document.getElementById('hicine-modal-poster');
    posterEl.src = data.poster || data.image || '/images/no-poster.svg';
    posterEl.onerror = () => { posterEl.src = '/images/no-poster.svg'; };

    // 2. Title & Date
    const titleEl = document.getElementById('hicine-modal-title');
    titleEl.textContent = `${data.title || 'Movie'} (${data.year || '2026'})`;

    const updatedEl = document.getElementById('hicine-modal-updated');
    updatedEl.textContent = data.updatedAt || 'Updated on Sep 4, 2026';

    // 3. Render Downloads (Both Hicine Cloud & Dotmovies Links)
    renderAllDownloadCards(data);

    // 4. Render Details & Previews
    renderDetailsTab(data);
    renderPreviewsTab(data);

    // 5. Default to Download tab
    setTabActive('download');

    // 6. Open Modal Overlay
    const overlay = document.getElementById('hicine-modal-overlay');
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const overlay = document.getElementById('hicine-modal-overlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';

    const sIframe = document.getElementById('hicine-stream-iframe');
    if (sIframe) sIframe.src = '';
    const tIframe = document.getElementById('hicine-trailer-iframe');
    if (tIframe) tIframe.src = '';
  }

  function renderAllDownloadCards(data) {
    const cloudContainer = document.getElementById('hicine-cloud-downloads-list');
    const dotContainer = document.getElementById('hicine-dotmovies-downloads-list');
    cloudContainer.innerHTML = '';
    dotContainer.innerHTML = '';

    const rawLinks = Array.isArray(data.links) ? data.links : [];
    const rawOptions = Array.isArray(data.downloadOptions) ? data.downloadOptions : [];

    // Filter Hicine / Fast Cloud links
    const hicineLinks = rawLinks.filter(l => l && (l.source === 'hicine' || l.isCloud || (l.url && (l.url.includes('vcloud') || l.url.includes('workers.dev')))));

    // Fallback if no specific hicine links: create standard quality tiers
    const cleanName = (data.title || 'Movie').replace(/\(\d{4}\)/g, '').trim();
    const year = data.year || '2026';

    const effectiveHicine = hicineLinks.length > 0 ? hicineLinks : [
      {
        quality: '480p',
        size: '800MB',
        label: `${cleanName} (${year}) Hindi-AAC2.0 HDTC 480p x264 [800MB]`,
        url: 'https://wild-sun-9376.oriue.workers.dev/?vcloud=https://vcloud.fit/jvcvcbyokytoy31'
      },
      {
        quality: '720p',
        size: '2GB',
        label: `${cleanName} (${year}) Hindi-AAC2.0 HDTC 720p x264 [2GB]`,
        url: 'https://wild-sun-9376.oriue.workers.dev/?vcloud=https://vcloud.fit/ikjxq-2bqaqxikk'
      },
      {
        quality: '1080p',
        size: '3.8GB',
        label: `${cleanName} (${year}) Hindi-AAC2.0 HDTC 1080p x264 [3.8GB]`,
        url: 'https://wild-sun-9376.oriue.workers.dev/?vcloud=https://vcloud.fit/e95thnzh550mpys'
      }
    ];

    effectiveHicine.forEach(item => {
      const q = (item.quality || '1080p').toUpperCase();
      const sz = item.size || '2GB';
      const fileInfo = item.label || `${cleanName} (${year}) Hindi-AAC2.0 HDTC ${q} x264 [${sz}]`;

      const card = document.createElement('div');
      card.className = 'hicine-dl-card';
      card.innerHTML = `
        <div class="hicine-dl-file-info">
          <strong>File Information:</strong>
          ${fileInfo}
        </div>
        <div class="hicine-dl-row">
          <div class="hicine-dl-meta-group">
            <span class="hicine-quality-pill">${q}</span>
            <span class="hicine-dl-size-label">${q} <span>|</span> ${sz}</span>
          </div>
          <button class="hicine-dl-btn" style="background: #ff0033;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download
          </button>
        </div>
      `;

      card.querySelector('.hicine-dl-btn').addEventListener('click', (e) => {
        e.preventDefault();
        activeQuality = q;
        activeVcloudUrl = item.url || 'https://wild-sun-9376.oriue.workers.dev/?vcloud=https://vcloud.fit/ikjxq-2bqaqxikk';
        openServersModal(q, sz, fileInfo);
      });

      cloudContainer.appendChild(card);
    });

    // RENDER DOTMOVIES EXCLUSIVE DOWNLOADS
    const dotLinks = rawOptions.length > 0 ? rawOptions : rawLinks.filter(l => l && (l.source === 'dotmobiz' || (!l.isCloud && l.url && l.url.includes('nexdrive'))));

    const effectiveDot = dotLinks.length > 0 ? dotLinks : [
      { quality: '480p', size: '630MB', label: 'Click Here To Download [630MB]', url: 'https://nexdrive.love/' },
      { quality: '720p x264', size: '1.5GB', label: 'Click Here To Download [1.5GB]', url: 'https://nexdrive.love/' },
      { quality: '1080p x264', size: '3.6GB', label: 'Click Here To Download [3.6GB]', url: 'https://nexdrive.love/' },
      { quality: '1080p HQ', size: '19GB', label: 'Click Here To Download [19GB]', url: 'https://nexdrive.love/' }
    ];

    effectiveDot.forEach(opt => {
      const q = opt.quality || 'HD';
      const sz = opt.size || '';
      const dotCard = document.createElement('div');
      dotCard.className = 'hicine-dl-card';
      dotCard.style.borderColor = 'rgba(16, 185, 129, 0.18)';
      dotCard.innerHTML = `
        <div class="hicine-dl-file-info">
          <strong style="color: #34d399;">DotMovies Dual Audio Release:</strong>
          ${cleanName} (${year}) Hindi Dual Audio [${q}] ${sz}
        </div>
        <div class="hicine-dl-row">
          <div class="hicine-dl-meta-group">
            <span class="hicine-quality-pill" style="border-color: rgba(16,185,129,0.35); color: #34d399; background: rgba(16,185,129,0.1);">${q}</span>
            <span class="hicine-dl-size-label">${q} ${sz ? `<span>|</span> ${sz}` : ''}</span>
          </div>
          <a href="${opt.url}" target="_blank" rel="noopener noreferrer" class="hicine-dl-btn" style="background: #10b981; box-shadow: 0 4px 14px rgba(16,185,129,0.35);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Download (NexDrive)
          </a>
        </div>
      `;
      dotContainer.appendChild(dotCard);
    });

    // Populate Cloud Tab
    const cloudEl = document.getElementById('hicine-cloud-list');
    cloudEl.innerHTML = `
      <div class="hicine-dl-card">
        <div class="hicine-dl-row">
          <div class="hicine-dl-meta-group">
            <span class="hicine-quality-pill" style="border-color: #3b82f6; color: #60a5fa;">G-Drive</span>
            <span class="hicine-dl-size-label">Google Drive High-Speed Direct Mirror</span>
          </div>
          <button class="hicine-dl-btn" style="background: #2563eb;" onclick="window.HicineModal.openServers('1080p')">Access G-Drive</button>
        </div>
      </div>
      <div class="hicine-dl-card">
        <div class="hicine-dl-row">
          <div class="hicine-dl-meta-group">
            <span class="hicine-quality-pill" style="border-color: #06b6d4; color: #67e8f9;">Telegram</span>
            <span class="hicine-dl-size-label">Direct Fast Download File (No Ads)</span>
          </div>
          <a href="https://t.me/" target="_blank" rel="noopener noreferrer" class="hicine-dl-btn" style="background: #0284c7;">Join &amp; Download</a>
        </div>
      </div>
    `;
  }

  function renderDetailsTab(data) {
    const bodyEl = document.getElementById('hicine-details-body');
    bodyEl.innerHTML = `
      <p style="margin-bottom: 12px; color: #f1f5f9; font-size: 0.95rem;">${data.description || data.overview || 'Watch and download the latest blockbuster with high speed multi-server download links.'}</p>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-top: 16px;">
        <div><strong style="color: #94a3b8; font-size: 0.8rem; display: block;">DIRECTOR</strong> <span style="color: #fff;">${data.director || 'Director'}</span></div>
        <div><strong style="color: #94a3b8; font-size: 0.8rem; display: block;">GENRES</strong> <span style="color: #fff;">${(data.genres || ['Action', 'Drama']).join(', ')}</span></div>
        <div><strong style="color: #94a3b8; font-size: 0.8rem; display: block;">IMDB RATING</strong> <span style="color: #facc15;">★ ${data.rating ? data.rating.toFixed(1) : '8.5'}/10</span></div>
        <div><strong style="color: #94a3b8; font-size: 0.8rem; display: block;">AUDIO</strong> <span style="color: #fff;">Hindi (Dual Audio / Multi-Lang)</span></div>
      </div>
    `;
  }

  function renderPreviewsTab(data) {
    const gridEl = document.getElementById('hicine-previews-grid');
    gridEl.innerHTML = '';
    const previews = Array.isArray(data.screenshots) && data.screenshots.length > 0
      ? data.screenshots
      : (data.backdrop ? [data.backdrop, data.poster] : ['/images/no-poster.svg']);

    previews.forEach(imgUrl => {
      const img = document.createElement('img');
      img.src = imgUrl;
      img.style.cssText = 'width: 100%; border-radius: 12px; aspect-ratio: 16/9; object-fit: cover; border: 1px solid rgba(255,255,255,0.08);';
      gridEl.appendChild(img);
    });
  }

  // 1:1 "Servers Ready" Modal (Screenshot 4)
  function openServersModal(quality, size, fileInfo) {
    initModalContainers();
    const modal = document.getElementById('hicine-servers-modal');
    const titleEl = document.getElementById('hicine-srv-meta-title');
    const sizeEl = document.getElementById('hicine-srv-meta-size');

    titleEl.textContent = fileInfo || `${currentTitleData?.title || 'Movie'} ${quality || '1080p'} HDTC Hindi LINE HC ESub x264 1VegaMovies`;
    sizeEl.textContent = size || '3.69 GB';

    let totalSecs = 299; // 4:59
    const timerEl = document.getElementById('hicine-server-countdown');
    if (serverCountdownInterval) clearInterval(serverCountdownInterval);

    const updateTimer = () => {
      const mins = Math.floor(totalSecs / 60);
      const secs = totalSecs % 60;
      if (timerEl) timerEl.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
      totalSecs--;
      if (totalSecs < 0) {
        clearInterval(serverCountdownInterval);
        if (timerEl) timerEl.textContent = 'Expired';
      }
    };
    updateTimer();
    serverCountdownInterval = setInterval(updateTimer, 1000);

    modal.classList.add('open');
  }

  function closeServersModal() {
    const modal = document.getElementById('hicine-servers-modal');
    if (modal) modal.classList.remove('open');
    if (serverCountdownInterval) clearInterval(serverCountdownInterval);
  }

  // Intercept movie clicks across the entire site
  function attachMovieCardListeners() {
    document.addEventListener('click', (e) => {
      const card = e.target.closest('a[href^="/movie/"], a[href^="/series/"], .movie-card, [data-movie-id]');
      if (!card) return;

      const href = card.getAttribute('href') || '';
      const match = href.match(/\/(movie|series)\/([^/?#]+)/);
      if (match) {
        e.preventDefault();
        const type = match[1];
        const id = match[2];

        const img = card.querySelector('img');
        const titleEl = card.querySelector('h3, p, .title');
        const fallbackData = {
          id: id,
          type: type,
          title: titleEl ? titleEl.textContent.trim() : 'Movie',
          poster: img ? img.src : '/images/no-poster.svg',
          year: '2026',
          quality: '1080p'
        };

        // Fetch fresh details with links
        fetch(`/api/details?id=${encodeURIComponent(id)}`)
          .then(r => r.ok ? r.json() : null)
          .then(json => {
            const data = json ? (json.data || json) : fallbackData;
            openModal(data);
          })
          .catch(() => {
            openModal(fallbackData);
          });
      }
    }, true);
  }

  window.HicineModal = {
    open: openModal,
    close: closeModal,
    openServers: openServersModal,
    closeServers: closeServersModal,
    switchTab: setTabActive
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initModalContainers();
      attachMovieCardListeners();
    });
  } else {
    initModalContainers();
    attachMovieCardListeners();
  }
})();
