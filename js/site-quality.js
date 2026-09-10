/* Netflix-Style Production UI/UX & Mobile Responsive Quality Layer */
(() => {
  const routes = {
    '/': ['Netflix4U — Watch Movies, TV Series, Anime & K-Dramas', 'Watch and discover verified movies, series, anime, and K-dramas on Netflix4U.'],
    '/movies': ['Movies | Netflix4U', 'Stream and download verified movies on Netflix4U.'],
    '/series': ['Web Series | Netflix4U', 'Stream and download verified TV web series on Netflix4U.'],
    '/anime': ['Anime | Netflix4U', 'Watch high quality anime series with multi-audio on Netflix4U.'],
    '/kdrama': ['K-Drama | Netflix4U', 'Watch trending Korean dramas with subtitles on Netflix4U.'],
    '/bollywood': ['Bollywood Movies | Netflix4U', 'Discover top Bollywood Hindi movies on Netflix4U.'],
    '/hollywood': ['Hollywood Movies | Netflix4U', 'Discover top Hollywood English & Dubbed movies on Netflix4U.'],
    '/south-indian': ['South Indian Movies | Netflix4U', 'Discover top South Indian Hindi Dubbed movies on Netflix4U.'],
    '/hindi-dubbed': ['Hindi Dubbed Movies | Netflix4U', 'Discover Hindi Dubbed movies and series on Netflix4U.'],
    '/trending': ['Trending Now | Netflix4U', 'The most watched movies and shows today on Netflix4U.'],
    '/genres': ['Browse Genres | Netflix4U', 'Explore movies and series by genre on Netflix4U.'],
    '/watchlist': ['My Watchlist | Netflix4U', 'Your saved movies and series to watch later.'],
    '/about': ['About Us | Netflix4U', 'About the Netflix4U entertainment platform.'],
    '/contact': ['Contact Us | Netflix4U', 'Contact the Netflix4U team.'],
    '/privacy': ['Privacy Policy | Netflix4U', 'Privacy policy for Netflix4U users.'],
    '/dmca': ['DMCA Disclaimer | Netflix4U', 'DMCA copyright policy and content disclaimer.']
  };

  function syncMetadata() {
    const entry = routes[location.pathname] || ['Netflix4U — Entertainment Catalog', 'Discover verified entertainment on Netflix4U.'];
    document.title = entry[0];
    let description = document.querySelector('meta[name="description"]');
    if (!description) { 
      description = document.createElement('meta'); 
      description.name = 'description'; 
      document.head.append(description); 
    }
    description.content = entry[1];
  }

  function repairDom() {
    // 1. Strict logo sizing and src enforcement
    document.querySelectorAll('#nav-logo').forEach(logo => {
      logo.style.display = 'flex';
      logo.style.alignItems = 'center';
      logo.style.overflow = 'hidden';
      const img = logo.querySelector('img');
      if (img) {
        if (!img.src.includes('netflix4u-logo-nav.svg')) {
          img.src = '/images/netflix4u-logo-nav.svg';
        }
        img.alt = 'Netflix4U';
        img.style.objectFit = 'contain';
        img.style.display = 'block';
      }
    });

    // 2. Footer logo
    document.querySelectorAll('footer img[alt="Netflix4U"]').forEach(img => {
      if (!img.src.includes('netflix4u-logo.svg')) {
        img.src = '/images/netflix4u-logo.svg';
      }
    });

    // 3. Clean empty hash links
    document.querySelectorAll('a[href="#"], a[href=""]').forEach(link => {
      if (!link.getAttribute('onClick') && !link.id) {
        link.setAttribute('href', 'javascript:void(0)');
      }
    });

    // 4. Default alt and decoding
    document.querySelectorAll('img:not([alt])').forEach(img => {
      img.alt = 'Netflix4U media';
      img.decoding = 'async';
    });
  }

  const style = document.createElement('style');
  style.id = 'netflix4u-theme-engine';
  style.textContent = `
    /* =========================================================
       🎬 AUTHENTIC NETFLIX DESIGN SYSTEM TOKENS
       ========================================================= */
    :root {
      --color-accent: #E50914 !important;
      --color-accent-hover: #b80710 !important;
      --color-navy-950: #141414 !important;
      --color-navy-900: #181818 !important;
      --color-card: #181818 !important;
      --color-card-hover: #232323 !important;
      --netflix-red: #E50914 !important;
      --netflix-black: #141414 !important;
      --netflix-dark: #000000 !important;
      --netflix-gray: #808080 !important;
      --netflix-white: #ffffff !important;
    }

    body {
      background-color: #141414 !important;
      background-image: none !important;
      color: #ffffff !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
      -webkit-font-smoothing: antialiased !important;
    }

    /* =========================================================
       1. HEADER & LOGO MOBILE STABILITY (Zero Explosion)
       ========================================================= */
    header {
      background: linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 60%, transparent 100%) !important;
      border: none !important;
      box-shadow: none !important;
    }
    header.bg-\\[var\\(--color-navy-950\\)\\]\\/95,
    header.backdrop-blur-xl {
      background-color: rgba(20, 20, 20, 0.95) !important;
      backdrop-filter: blur(12px) !important;
      border-bottom: 1px solid rgba(255,255,255,0.08) !important;
    }

    #nav-logo {
      display: flex !important;
      align-items: center !important;
      height: 32px !important;
      max-width: 125px !important;
      flex-shrink: 0 !important;
      overflow: hidden !important;
      cursor: pointer !important;
    }

    #nav-logo img,
    header nav img {
      width: auto !important;
      height: 28px !important;
      max-height: 28px !important;
      max-width: 120px !important;
      object-fit: contain !important;
      display: block !important;
    }

    @media (max-width: 640px) {
      #nav-logo {
        max-width: 95px !important;
        height: 24px !important;
      }
      #nav-logo img,
      header nav img {
        max-width: 95px !important;
        height: 22px !important;
        max-height: 22px !important;
      }
    }

    /* =========================================================
       2. NETFLIX BILLBOARD HERO (White Play, Gray Info)
       ========================================================= */
    #hero-banner {
      position: relative !important;
      box-shadow: inset 0 -90px 80px -40px #141414 !important;
      border: none !important;
    }
    .hero-gradient-desktop {
      background: linear-gradient(to right, #141414 0%, rgba(20,20,20,0.85) 25%, rgba(20,20,20,0.4) 55%, transparent 100%),
                  linear-gradient(to top, #141414 0%, rgba(20,20,20,0.6) 20%, transparent 50%) !important;
    }
    .hero-gradient-bottom {
      background: linear-gradient(to top, #141414 0%, rgba(20,20,20,0.8) 35%, transparent 100%) !important;
    }

    /* Netflix Official White Play Button */
    .hero-buttons-row .btn-primary,
    #hero-banner .btn-primary {
      background-color: #ffffff !important;
      color: #000000 !important;
      font-weight: 700 !important;
      border-radius: 4px !important;
      border: none !important;
      box-shadow: 0 4px 14px rgba(0,0,0,0.4) !important;
      transition: background-color 0.2s ease, transform 0.15s ease !important;
    }
    .hero-buttons-row .btn-primary svg,
    #hero-banner .btn-primary svg {
      fill: #000000 !important;
      color: #000000 !important;
    }
    .hero-buttons-row .btn-primary:hover,
    #hero-banner .btn-primary:hover {
      background-color: rgba(255, 255, 255, 0.75) !important;
      color: #000000 !important;
      transform: scale(1.03) !important;
    }

    /* Netflix Official Translucent Gray Info Button */
    .hero-buttons-row .btn-secondary,
    #hero-banner .btn-secondary {
      background-color: rgba(109, 109, 110, 0.7) !important;
      color: #ffffff !important;
      font-weight: 600 !important;
      border-radius: 4px !important;
      border: none !important;
      backdrop-filter: blur(8px) !important;
      transition: background-color 0.2s ease, transform 0.15s ease !important;
    }
    .hero-buttons-row .btn-secondary:hover,
    #hero-banner .btn-secondary:hover {
      background-color: rgba(109, 109, 110, 0.45) !important;
      transform: scale(1.03) !important;
    }

    /* =========================================================
       3. NETFLIX TOP 10 NUMBERED CARDS
       ========================================================= */
    #top-10-section .top-number {
      font-family: 'Impact', 'Arial Black', sans-serif !important;
      font-size: 110px !important;
      font-weight: 900 !important;
      line-height: 0.75 !important;
      color: #000000 !important;
      -webkit-text-stroke: 4px #8c8c8c !important;
      filter: drop-shadow(2px 4px 8px rgba(0,0,0,0.9)) !important;
      text-shadow: 0 0 12px rgba(0,0,0,0.9) !important;
    }
    @media (max-width: 640px) {
      #top-10-section .top-number {
        font-size: 80px !important;
        -webkit-text-stroke: 3px #8c8c8c !important;
      }
    }

    /* =========================================================
       4. CARDS & HOVER EFFECTS (Netflix Card Scaling)
       ========================================================= */
    .group\\/card,
    .group.relative.flex-shrink-0 {
      border-radius: 4px !important;
      transition: transform 0.25s cubic-bezier(0.2, 0, 0.2, 1), box-shadow 0.25s ease !important;
    }
    .group\\/card .rounded-xl,
    .group\\/card a,
    .group.relative.flex-shrink-0 a,
    .group.relative.flex-shrink-0 .rounded-xl {
      border-radius: 4px !important;
    }
    @media (hover: hover) {
      .group\\/card:hover,
      .group.relative.flex-shrink-0:hover {
        transform: scale(1.06) !important;
        z-index: 20 !important;
        box-shadow: 0 10px 25px rgba(0,0,0,0.8) !important;
      }
    }

    /* =========================================================
       5. ORGANIZED MOBILE FOOTER (Clean 2-Column Netflix Layout)
       ========================================================= */
    footer {
      background: #0f0f0f !important;
      border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
      margin-top: 4rem !important;
    }
    footer a {
      color: #808080 !important;
      transition: color 0.15s ease !important;
    }
    footer a:hover {
      color: #ffffff !important;
      text-decoration: underline !important;
    }

    @media (max-width: 767.98px) {
      footer {
        padding-top: 2rem !important;
        padding-bottom: 5.5rem !important; /* Clears mobile bottom navigation bar */
      }
      footer > div {
        padding: 0 1.25rem !important;
      }
      footer .grid {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 1.5rem 1rem !important;
      }
      footer .grid > div:first-child {
        grid-column: 1 / -1 !important;
        padding-bottom: 0.75rem !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06) !important;
      }
      footer .grid > div:first-child img {
        height: 24px !important;
        width: auto !important;
        margin-bottom: 0.5rem !important;
      }
      footer .grid > div:first-child p {
        font-size: 0.8rem !important;
        line-height: 1.35 !important;
        color: #808080 !important;
        margin-bottom: 0.75rem !important;
      }
      footer .grid h3 {
        font-size: 0.75rem !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.06em !important;
        color: #ffffff !important;
        margin-bottom: 0.65rem !important;
      }
      footer .grid ul {
        display: flex !important;
        flex-direction: column !important;
        gap: 0.4rem !important;
      }
      footer .grid li a {
        font-size: 0.8rem !important;
        color: #808080 !important;
      }
      footer .border-t {
        margin-top: 1.5rem !important;
        padding-top: 1rem !important;
        flex-direction: column !important;
        gap: 0.5rem !important;
        text-align: center !important;
      }
      footer .border-t p,
      footer .border-t span {
        font-size: 0.75rem !important;
        color: #666666 !important;
      }
    }

    /* =========================================================
       6. MOBILE NAVIGATION BAR (Netflix Clean Red Highlights)
       ========================================================= */
    .mobile-nav-item {
      touch-action: manipulation !important;
    }
    nav.fixed.bottom-0 {
      background-color: rgba(18, 18, 18, 0.96) !important;
      backdrop-filter: blur(16px) !important;
      border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
    }

    /* =========================================================
       7. GLOBAL SCROLLBAR & OVERFLOW LOCK
       ========================================================= */
    html, body {
      overflow-x: clip !important;
      max-width: 100vw !important;
    }
    #root {
      overflow-x: clip !important;
      max-width: 100vw !important;
    }
    .scrollbar-hide {
      -ms-overflow-style: none !important;
      scrollbar-width: none !important;
      overflow-x: auto !important;
      overscroll-behavior-x: contain !important;
    }
    .scrollbar-hide::-webkit-scrollbar {
      display: none !important;
    }
  `;

  document.head.append(style);

  const observe = () => {
    syncMetadata();
    repairDom();
  };

  addEventListener('popstate', observe);
  if (document.readyState === 'loading') {
    addEventListener('DOMContentLoaded', () => {
      observe();
      new MutationObserver(repairDom).observe(document.body, { childList: true, subtree: true });
    });
  } else {
    observe();
    new MutationObserver(repairDom).observe(document.body, { childList: true, subtree: true });
  }
})();
