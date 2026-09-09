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
    }
  `;
  document.head.append(style);
  const observe = () => { syncMetadata(); repairDom(); };
  addEventListener('popstate', observe);
  addEventListener('DOMContentLoaded', () => { observe(); new MutationObserver(repairDom).observe(document.body, { childList: true, subtree: true }); });
})();
