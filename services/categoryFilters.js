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
    const isBollyCat = cats.includes('Bollywood');
    if (!isBollyCat) {
      return /\b(bollywood|hindi\s*cinema|desi|mumbai|zee5|shemaroo|t-series|yash\s*raj|dharma)\b/i.test(raw);
    }
    // If tagged Bollywood, filter out titles that are Hollywood productions with only Hindi dubbing
    if (cats.includes('Hollywood') || cats.includes('Hollywood Series')) {
      return /\b(hindi\s*movie|bollywood|desi|dhurandhar|stree|jawan|pathaan|animal|fitoor|shona|raakaasa|sati\s*ki\s*golmaal|shiddat|badhaai|shubh|dangal|pk|bajrangi|sultan|dabangg|golmaal|housefull|baaghi|heropanti|bhool\s*bhulaiyaa|bhool|singham|gadar|drishyam|kashmir|cirkus|brahmastra|bhediya|omg|dream\s*girl|fukrey|chhatrapati|tu\s*jhoothi|satya\s*prem|zara\s*hatke|samrat\s*prithviraj|shamshera|vikram\s*vedha|lal\s*singh|raksha\s*bandhan|ek\s*villain|sooryavanshi|radhe|bell\s*bottom|antim|chandigarh|atrangi|jersey|heropanti\s*2|jayeshbhai|nikamma|hit\s*the\s*first|rashtra\s*kavach|shabaash|phone\s*bhoot|mili|govinda\s*naam|an_action_hero|an\s*action\s*hero|kuttey|mission\s*majnu|shehzada|selfiee|mrs\s*chatterjee|bheed|gumraah|kisi\s*ka\s*bhai|afwaah|the\s*kerala\s*story|ib71|bloody\s*daddy|neeyat|tarla|adipurush|bawaal|rocky\s*aur\s*rani|ghoomer|akelli|jaane\s*jaan|sukhee|the\s*great\s*indian\s*family|mission\s*raniganj|khufiya|thank\s*you\s*for\s*coming|ganapath|tejas|aankh\s*micholi|apoorva|khichdi\s*2|farrey|the\s*archies|salaar|merry\s*christmas|main\s*atal\s*hoon|fighter|teri\s*baaton\s*mein|crakk|article\s*370|laapataa\s*ladies|yodha|swatantrya\s*veer|crew|maidaan|bade\s*miyan|srikanth|mr\s*and\s*mrs\s*mahi|chandu\s*champion|ishq\s*vishk|kalki|kill|sarfira|bad\s*newz|auron\s*mein|ulajh|khel\s*khel\s*mein|vedaa|emergency|yudhra|devara|jigra|vicky\s*vidya|baby\s*john|welcome\s*to\s*the\s*jungle)\b/i.test(raw);
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
    const isSouthText = /\b(?:South\s*Indian|South\s*Hindi|Tamil|Telugu|Malayalam|Kannada|Tollywood|Kollywood|Mollywood|Sandalwood|Pushpa|KGF|Kalki|Devara|RRR|Baahubali|Srirastu|Thellavarithe|Aashiq\s*3|Varisu|Thunivu|Jailer|Leo|Ponniyin|Vikram|Kantara|Salaar|HanuMan|Captain\s*Miller|Ayalaan|Guntur\s*Kaaram|Saindhav|Eagle|Ooru\s*Peru|Tillu|Bhimaa|Gaami|The\s*GOAT|Vettaiyan|Kanguva|Amaran|Pushpa\s*2|Game\s*Changer|Viduthalai|Manjummel|Premalu|Aavesham|Aadujeevitham|Bramayugam|Turbo|ARM|Bougainvillea)\b/i.test(raw);
    const isExcluded = /\b(?:South\s*Park|South\s*Beach)\b/i.test(item.title || '');
    return (isSouthCat || isSouthText) && !isExcluded;
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
    return items.slice(0, 36);
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
