/* Small framework-agnostic production quality layer for the bundled UI. */
(() => {
  const routes = {
    '/': ['Netflix4U — Movies, Series, Anime & K-Drama', 'Discover verified movies, series, anime, and K-dramas on Netflix4U.'],
    '/movies': ['Movies | Netflix4U', 'Browse verified movie information on Netflix4U.'],
    '/series': ['Web Series | Netflix4U', 'Browse verified web-series information on Netflix4U.'],
    '/anime': ['Anime | Netflix4U', 'Browse verified anime information on Netflix4U.'],
    '/kdrama': ['K-Drama | Netflix4U', 'Browse verified K-drama information on Netflix4U.'],
    '/contact': ['Contact Netflix4U', 'Contact the Netflix4U support team.'],
    '/401': ['Access Restricted | Netflix4U', 'This page requires an authorized Netflix4U account.']
  };
  function syncMetadata() {
    const entry = routes[location.pathname] || ['Netflix4U — Entertainment Catalog', 'Discover verified entertainment information on Netflix4U.'];
    document.title = entry[0];
    let description = document.querySelector('meta[name="description"]');
    if (!description) { description = document.createElement('meta'); description.name = 'description'; document.head.append(description); }
    description.content = entry[1];
  }
  function repairDom() {
    document.querySelectorAll('#nav-logo img').forEach((image) => {
      image.src = '/images/netflix4u-logo-nav.svg';
      image.alt = 'Netflix4U home';
    });
    document.querySelectorAll('footer img[alt="Netflix4U"]').forEach((image) => {
      image.src = '/images/netflix4u-logo.svg';
    });
    document.querySelectorAll('a[href="/bollywood"], a[href="/hollywood"], a[href="/south-indian"], a[href="/hindi-dubbed"]').forEach((link) => {
      link.href = '/movies';
      link.setAttribute('aria-label', `${link.textContent.trim() || 'Movies'} movies`);
    });
    document.querySelectorAll('a[href="#"], a[href=""]').forEach((link) => link.remove());
    document.querySelectorAll('img').forEach((image) => {
      if (!image.alt) image.alt = 'Netflix4U artwork';
      image.decoding = 'async';
    });
  }
  const style = document.createElement('style');
  style.textContent = `
    :root { --color-accent: #e11d48; --color-accent-hover: #be123c; --color-navy-950: #08090d; --color-navy-900: #101116; --color-card: #17181f; --color-card-hover: #242630; }
    body { background: radial-gradient(1000px 520px at 80% -10%, rgba(225,29,72,.17), transparent 55%), #08090d !important; }
    header { background: linear-gradient(180deg, rgba(8,9,13,.98), rgba(8,9,13,.84) 70%, transparent) !important; border: 0 !important; }
    header nav { max-width: 1720px !important; height: 72px !important; }
    header .btn-icon, header button { border-radius: 999px !important; }
    header a.btn-pill { background: rgba(255,255,255,.07) !important; border: 1px solid rgba(255,255,255,.08) !important; }
    header a.btn-pill:hover, header a.btn-pill:focus-visible { background: rgba(255,255,255,.14) !important; color: white !important; }
    #hero-banner { border-bottom: 1px solid rgba(255,255,255,.06); box-shadow: inset 0 -100px 100px -80px #08090d; }
    #hero-banner .btn-primary { border-radius: .6rem !important; box-shadow: 0 10px 28px rgba(225,29,72,.24); }
    #hero-banner .btn-secondary { border-radius: .6rem !important; background: rgba(255,255,255,.12) !important; }
    main > div > section, main section { scroll-margin-top: 6rem; }
    section h2 { letter-spacing: -.025em; }
    .group\/card > a, .group\/card .rounded-xl { border-radius: .65rem !important; }
    .group\/card { transition: transform .22s ease, filter .22s ease !important; }
    @media (hover:hover) { .group\/card:hover { transform: scale(1.045); z-index: 2; filter: brightness(1.08); } }
    footer { margin-top: 4rem !important; background: linear-gradient(180deg, #111217, #08090d 70%) !important; }
    footer a { color: #9ca3af !important; } footer a:hover { color: white !important; }
    .safe-area-pb { padding-bottom: max(.75rem, env(safe-area-inset-bottom, 0px)) !important; }
    header img, #nav-logo img { width: auto !important; max-width: min(132px, 38vw) !important; height: auto !important; max-height: 34px !important; object-fit: contain !important; }
    @media (max-width: 639px) {
      footer > div { padding: 2.25rem 1rem 6rem !important; }
      footer .grid { grid-template-columns: 1fr 1fr !important; gap: 2rem 1.25rem !important; }
      footer .grid > :first-child { grid-column: 1 / -1; }
      footer .grid > :not(:first-child) { min-width: 0 !important; }
      footer .grid h3 { margin-bottom: .65rem !important; }
      footer .grid li { margin-bottom: .35rem; }
      header nav { padding-left: .75rem !important; padding-right: .75rem !important; gap: .5rem !important; }
      header nav > * { min-width: 0; }
      body, #root { overflow-x: clip !important; max-width: 100vw !important; }
      #hero-banner, #hero-banner * { max-width: 100vw; }
      #hero-banner { min-height: 530px !important; height: min(78svh, 650px) !important; }
      #hero-banner h1 { font-size: clamp(2rem, 9vw, 3.1rem) !important; line-height: 1.04 !important; }
      .mobile-nav-item { min-width: 0 !important; padding-inline: .3rem !important; }
      .mobile-nav-item span:last-child { font-size: 9px !important; white-space: nowrap; }
    }
  `;
  document.head.append(style);
  const observe = () => { syncMetadata(); repairDom(); };
  addEventListener('popstate', observe);
  addEventListener('DOMContentLoaded', () => { observe(); new MutationObserver(repairDom).observe(document.body, { childList: true, subtree: true }); });
})();
