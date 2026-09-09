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
  const observe = () => { syncMetadata(); repairDom(); };
  addEventListener('popstate', observe);
  addEventListener('DOMContentLoaded', () => { observe(); new MutationObserver(repairDom).observe(document.body, { childList: true, subtree: true }); });
})();
