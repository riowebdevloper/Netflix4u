/**
 * Centralized Category & Regional Cinema Filter Engine
 * Netflix4U — Authoritative Taxonomy & Data Filtering
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

/**
 * Authoritative Centralized Filter Taxonomy
 * Config source for all top rail chips & views
 */
const HOME_FILTERS = {
  trending: {
    type: 'ranking',
    filter: 'trending'
  },
  myList: {
    type: 'local',
    filter: 'watchlist'
  },
  latest: {
    type: 'release',
    filter: 'latest'
  },
  netflix: {
    type: 'provider',
    provider: 'netflix'
  },
  prime: {
    type: 'provider',
    provider: 'prime-video'
  },
  jiohotstar: {
    type: 'provider',
    provider: 'jiohotstar'
  },
  sonyliv: {
    type: 'provider',
    provider: 'sonyliv'
  },
  crunchyroll: {
    type: 'provider',
    provider: 'crunchyroll'
  },
  kids: {
    type: 'category',
    category: 'kids-family'
  },
  mx: {
    type: 'provider',
    provider: 'mx-player'
  }
};

/**
 * Authoritative Provider Aliases
 * Maps upstream/metadata string variations to canonical provider keys
 */
const PROVIDER_ALIASES = {
  netflix: [
    'Netflix'
  ],
  primeVideo: [
    'Amazon Prime Video',
    'Prime Video',
    'Amazon Video'
  ],
  jioHotstar: [
    'JioHotstar',
    'Disney+ Hotstar',
    'Hotstar'
  ],
  sonyLiv: [
    'Sony LIV',
    'SonyLIV'
  ],
  crunchyroll: [
    'Crunchyroll'
  ],
  mxPlayer: [
    'MX Player',
    'MX'
  ]
};

/**
 * Resolve any provider label/string to canonical provider key
 */
function normalizeProvider(name) {
  if (!name || typeof name !== 'string') return null;
  const clean = name.trim().toLowerCase();
  for (const [canonical, aliases] of Object.entries(PROVIDER_ALIASES)) {
    if (canonical.toLowerCase() === clean) return canonical;
    for (const alias of aliases) {
      if (alias.toLowerCase() === clean) return canonical;
    }
  }
  return clean;
}

/**
 * Authoritative category matching predicates
 * Based on real available fields: categories, rawTitle, title, type, rating
 */
const CATEGORY_FILTERS = {
  movies: (item) => {
    if (!item) return false;
    const type = (item.type || item.contentType || '').toLowerCase();
    if (type === 'movie') return true;
    if (type === 'series' || type === 'tv') return false;
    const cats = item.categories || [];
    return (cats.includes('Movies') || cats.includes('Hollywood') || cats.includes('Bollywood')) &&
           !cats.includes('Hollywood Series') &&
           !cats.includes('Web Series') &&
           !cats.includes('TV Shows');
  },

  series: (item) => {
    if (!item) return false;
    const type = (item.type || item.contentType || '').toLowerCase();
    if (type === 'series' || type === 'tv') return true;
    const cats = item.categories || [];
    const raw = (item.rawTitle || '') + ' ' + (item.title || '');
    return cats.includes('Web Series') ||
           cats.includes('TV Shows') ||
           cats.includes('Hollywood Series') ||
           cats.includes('Dual Audio Series') ||
           cats.includes('Anime Series') ||
           cats.includes('Korean Series') ||
           /\b(?:Season\s*\d+|S\d{1,2}|Complete\s*Series|All\s*Episodes)\b/i.test(raw);
  },

  trending: (item) => {
    if (!item) return false;
    const cats = item.categories || [];
    const rating = typeof item.rating === 'number' ? item.rating : parseFloat(item.rating) || 0;
    return cats.includes('Featured') || rating >= 8.2;
  },

  anime: (item) => {
    if (!item) return false;
    const cats = item.categories || [];
    const raw = (item.rawTitle || '') + ' ' + (item.title || '');
    const isAnimeCat = cats.includes('Anime Series') || cats.includes('Animation');
    const isAnimeTitle = /\b(?:Anime|Donghua|Gundam|Demon\s*Slayer|Jujutsu|Naruto|Attack\s*on\s*Titan|Bleach|Dragon\s*Ball|One\s*Piece|Solo\s*Leveling|Chainsaw\s*Man)\b/i.test(raw);
    const isLiveBollywood = cats.includes('Bollywood') && !cats.includes('Animation');
    return (isAnimeCat || isAnimeTitle) && !isLiveBollywood;
  },

  kdrama: (item) => {
    if (!item) return false;
    const cats = item.categories || [];
    const raw = (item.rawTitle || '') + ' ' + (item.title || '');
    return cats.includes('Korean Series') ||
           cats.some(c => /korean/i.test(c)) ||
           /\b(?:K-?Drama|Korean|Aka\s*Ssang|Kdrama|Hangul)\b/i.test(raw);
  },

  bollywood: (item) => {
    if (!item) return false;
    const cats = item.categories || [];
    const raw = (item.rawTitle || '') + ' ' + (item.title || '');
    const isBollyCat = cats.includes('Bollywood') || cats.includes('Bollywood Movies') || cats.includes('Bollywood Series');
    if (!isBollyCat) {
      return /\b(?:bollywood|hindi\s*cinema|desi|mumbai|zee5|shemaroo|t-series|yash\s*raj|dharma)\b/i.test(raw);
    }
    // If tagged Bollywood alongside Hollywood or English, verify it is an authentic Hindi production rather than a dubbed Western release
    const isHollywood = cats.includes('Hollywood') || cats.includes('Hollywood Series') || cats.includes('English');
    if (isHollywood) {
      return cats.includes('Bollywood Movies') || /\b(?:bollywood|hindi\s*movie|hindi\s*cinema)\b/i.test(raw);
    }
    return true;
  },

  hollywood: (item) => {
    if (!item) return false;
    const cats = item.categories || [];
    const raw = (item.rawTitle || '') + ' ' + (item.title || '');
    const isHolly = cats.includes('Hollywood') || cats.includes('Hollywood Series') || cats.includes('English');
    const isPureBolly = cats.includes('Bollywood') && !cats.includes('Hollywood');
    return isHolly && !isPureBolly;
  },

  'south-indian': (item) => {
    if (!item) return false;
    const cats = item.categories || [];
    const raw = (item.rawTitle || '') + ' ' + (item.title || '');
    const isSouthCat = cats.some(c => /south|tamil|telugu|malayalam|kannada/i.test(c));
    const isSouthLang = /\b(?:South\s*Indian|South\s*Hindi|Tamil|Telugu|Malayalam|Kannada|Tollywood|Kollywood|Mollywood|Sandalwood)\b/i.test(raw);
    const isExcluded = /\b(?:South\s*Park|South\s*Beach)\b/i.test(item.title || '');
    return (isSouthCat || isSouthLang) && !isExcluded;
  },

  'hindi-dubbed': (item) => {
    if (!item) return false;
    const cats = item.categories || [];
    const raw = (item.rawTitle || '') + ' ' + (item.title || '');
    return cats.includes('Dual Audio Movies') ||
           cats.includes('Dual Audio Series') ||
           cats.includes('Hindi Dubbed Movies') ||
           /\b(?:Dual\s*Audio|Hindi\s*Dubbed|Multi\s*Audio|Hindi\s*Dub|HQStudio\s*Dub)\b/i.test(raw);
  }
};

/**
 * Filter a catalog array by category key
 */
function filterCatalogByCategory(items, categoryKey) {
  if (!Array.isArray(items)) return [];
  const normalizedKey = String(categoryKey || '').toLowerCase().trim();
  const filterFn = CATEGORY_FILTERS[normalizedKey];
  if (!filterFn) {
    return [];
  }
  return items.filter(filterFn);
}

module.exports = {
  HOME_FILTERS,
  PROVIDER_ALIASES,
  normalizeProvider,
  CATEGORY_FILTERS,
  filterCatalogByCategory
};
