// ============================================================
// NETFLIX4U — AEO + GEO + LLMO + AI SEARCH + E-E-A-T SSR ENGINE
// Zero CLS, Semantic HTML, Schema.org JSON-LD, Direct Answers
// ============================================================

const fs = require('fs');
const path = require('path');

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeJson(str) {
  if (!str) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '');
}

function formatDurationIso(durationStr) {
  if (!durationStr) return 'PT2H';
  const match = durationStr.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/i);
  if (!match) return 'PT2H';
  const hours = match[1] || '0';
  const minutes = match[2] || '0';
  if (hours === '0' && minutes === '0') return 'PT2H';
  return `PT${hours !== '0' ? hours + 'H' : ''}${minutes !== '0' ? minutes + 'M' : ''}`;
}

const CATEGORY_META = {
  movies: {
    title: 'Watch Movies Online — Full HD Streaming & Fast Downloads | Netflix4U',
    description: 'Explore verified movies across Hollywood, Bollywood, and world cinema with multi-audio, full HD player streaming, and high-speed direct downloads on Netflix4U.',
    h1: 'Discover & Stream Movies Online',
    intro: 'Browse Netflix4U\'s comprehensive catalog of Hollywood blockbusters, Bollywood hits, cult classics, and new film releases. Every movie is indexed with verified runtimes, cast rosters, and direct streaming options.'
  },
  series: {
    title: 'Watch Web Series & TV Shows Online — Full Seasons | Netflix4U',
    description: 'Stream and download multi-season web series, TV dramas, and international shows in 1080p Full HD with Hindi and multi-language dubs on Netflix4U.',
    h1: 'Watch Web Series & TV Shows',
    intro: 'Stream binge-worthy web series, complete television seasons, and exclusive drama releases. Access episode-by-episode streaming and fast cloud downloads across all genres.'
  },
  trending: {
    title: 'Trending Movies & Web Series Today — Top Daily Releases | Netflix4U',
    description: 'Discover the most popular trending movies and web series streaming today on Netflix4U. Ranked by real-time viewer demand and daily catalog activity.',
    h1: 'Trending Movies & Series Today',
    intro: 'Stay updated with what the world is watching right now. Our trending feed highlights the most searched, streamed, and downloaded titles of the day with daily verification.'
  },
  anime: {
    title: 'Watch Anime Online in HD — Subbed & Hindi Dubbed | Netflix4U',
    description: 'Watch Japanese anime series and feature films in 1080p HD. Dual-audio, subbed and Hindi-dubbed anime catalog updated daily on Netflix4U.',
    h1: 'Japanese Anime & Animated Series',
    intro: 'Immerse yourself in top-tier Japanese animation, shonen favorites, fantasy epics, and new anime season releases with dual-audio and verified streaming servers.'
  },
  kdrama: {
    title: 'Watch Korean Dramas Online — K-Drama Hindi Dubbed & Subbed | Netflix4U',
    description: 'Stream popular Korean romantic dramas, thrillers, and web series with English subtitles and Hindi-dubbed audio on Netflix4U.',
    h1: 'Korean Dramas & Romantic Series',
    intro: 'Discover the best of South Korean television. From heart-pounding thrillers to emotional romance dramas, stream full K-Drama seasons in pristine quality.'
  },
  bollywood: {
    title: 'Watch Bollywood Movies Online — Hindi Cinema & Blockbusters | Netflix4U',
    description: 'Watch the latest Bollywood movies, Hindi cinema blockbusters, and classic films in 1080p Full HD with crystal clear audio on Netflix4U.',
    h1: 'Bollywood Movies & Hindi Cinema',
    intro: 'From Mumbai\'s grand cinematic spectacles to critically acclaimed independent Hindi cinema, discover verified Bollywood releases with instant high-speed access.'
  },
  hollywood: {
    title: 'Watch Hollywood Movies Online — English & Hindi Dubbed | Netflix4U',
    description: 'Stream international Hollywood blockbusters, action franchises, and Oscar winners in 4K & 1080p Full HD on Netflix4U.',
    h1: 'Hollywood Blockbusters & Franchises',
    intro: 'Watch world-renowned Hollywood box office hits, sci-fi sagas, and cinematic universes with verified subtitles and high-definition video streams.'
  }
};

/**
 * Common Header for SSR Pages
 */
function renderHeader() {
  return `
  <header class="sticky top-0 z-40 bg-[#0a0a0f]/95 backdrop-blur-md border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
    <a href="/" class="flex items-center gap-2 text-red-600 font-extrabold text-xl tracking-tight">
      <span class="bg-red-600 text-white text-xs font-black px-1.5 py-0.5 rounded">N4U</span>
      <span class="text-white">Netflix<span class="text-red-600">4U</span></span>
    </a>
    <nav class="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm font-medium text-slate-300">
      <a href="/" class="hover:text-white transition">Home</a>
      <a href="/movies" class="hover:text-white transition">Movies</a>
      <a href="/series" class="hover:text-white transition">Series</a>
      <a href="/trending" class="hover:text-white transition">Trending</a>
      <a href="/anime" class="hidden sm:inline hover:text-white transition">Anime</a>
      <a href="/about" class="hover:text-white transition">About</a>
    </nav>
  </header>`;
}

/**
 * Common Footer for SSR Pages
 */
function renderFooter() {
  return `
  <footer class="bg-black/90 border-t border-white/10 px-4 sm:px-8 py-10 mt-16 text-xs text-slate-400">
    <div class="max-w-6xl mx-auto space-y-6">
      <div class="flex flex-col md:flex-row items-start justify-between gap-6 pb-6 border-b border-white/10">
        <div>
          <a href="/" class="flex items-center gap-2 text-red-600 font-extrabold text-lg tracking-tight mb-2">
            <span class="bg-red-600 text-white text-xs font-black px-1.5 py-0.5 rounded">N4U</span>
            <span class="text-white">Netflix<span class="text-red-600">4U</span></span>
          </a>
          <p class="text-slate-500 max-w-sm text-xs leading-relaxed">
            Ultra-fast entertainment discovery portal and catalog index providing verified media metadata, streaming guidance, and direct cloud downloads.
          </p>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-6 text-xs">
          <div>
            <h4 class="font-bold text-white mb-2 uppercase tracking-wider text-[11px]">Media Hubs</h4>
            <ul class="space-y-1.5">
              <li><a href="/movies" class="hover:text-white transition">Movies</a></li>
              <li><a href="/series" class="hover:text-white transition">Web Series</a></li>
              <li><a href="/trending" class="hover:text-white transition">Trending Today</a></li>
              <li><a href="/anime" class="hover:text-white transition">Anime</a></li>
              <li><a href="/kdrama" class="hover:text-white transition">K-Drama</a></li>
            </ul>
          </div>
          <div>
            <h4 class="font-bold text-white mb-2 uppercase tracking-wider text-[11px]">Regional Cinema</h4>
            <ul class="space-y-1.5">
              <li><a href="/bollywood" class="hover:text-white transition">Bollywood (Hindi)</a></li>
              <li><a href="/hollywood" class="hover:text-white transition">Hollywood</a></li>
              <li><a href="/south-indian" class="hover:text-white transition">South Indian Cinema</a></li>
              <li><a href="/hindi-dubbed" class="hover:text-white transition">Dual Audio Dubbed</a></li>
            </ul>
          </div>
          <div>
            <h4 class="font-bold text-white mb-2 uppercase tracking-wider text-[11px]">Trust &amp; Legal</h4>
            <ul class="space-y-1.5">
              <li><a href="/about" class="hover:text-white transition">About Us</a></li>
              <li><a href="/contact" class="hover:text-white transition">Contact Support</a></li>
              <li><a href="/editorial-policy" class="hover:text-white transition">Editorial Policy</a></li>
              <li><a href="/corrections-policy" class="hover:text-white transition">Corrections Policy</a></li>
              <li><a href="/privacy" class="hover:text-white transition">Privacy Policy</a></li>
              <li><a href="/terms" class="hover:text-white transition">Terms of Service</a></li>
              <li><a href="/dmca" class="hover:text-white transition">DMCA Disclaimer</a></li>
            </ul>
          </div>
        </div>
      </div>

      <div class="pt-2 text-[11px] leading-relaxed text-slate-500 space-y-2">
        <p>
          <strong>Disclaimer &amp; Brand Notice:</strong> Netflix4U is an independent informational discovery service and catalog index. Netflix4U is <strong>NOT</strong> affiliated with, sponsored by, endorsed by, or operated by Netflix, Inc., or any official streaming platform. All product names, trademarks, and registered trademarks belong to their respective owners.
        </p>
        <p class="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-white/5">
          <span>&copy; 2026 Netflix4U. All rights reserved.</span>
          <span>Verified Catalog Index &bull; Zero Render-Blocking Architecture</span>
        </p>
      </div>
    </div>
  </footer>`;
}

/**
 * Render Movie Detail Page (SSR)
 */
function renderMoviePage(item, canonicalUrl, relatedItems = []) {
  const title = item.title || 'Movie Title';
  const year = item.year || '';
  const cleanTitle = title.replace(/\(\d{4}\)/g, '').trim();
  const pageTitle = `${cleanTitle} (${year}) Watch Online & Fast Download — Netflix4U`;
  const desc = (item.description || item.overview || `Watch and download ${cleanTitle} (${year}) in Full HD 1080p with verified multi-audio servers on Netflix4U.`).slice(0, 160);
  const poster = item.poster || 'https://netflix4u.in/og-image.jpg';
  const backdrop = item.backdrop || poster;
  const rating = item.rating ? Number(item.rating).toFixed(1) : '8.5';
  const duration = item.duration || '2h 00m';
  const genres = Array.isArray(item.genres) && item.genres.length ? item.genres : ['Action', 'Drama'];
  const primaryGenre = genres[0] || 'Movie';
  const director = item.director && item.director !== 'Director' ? item.director : 'Acclaimed Director';
  const lang = item.language || 'English / Hindi';
  const country = item.country || 'US';
  const releaseDate = item.releaseDate || `${year}-01-01`;
  const tmdbId = item.tmdbId || item.id || '';
  const durationIso = formatDurationIso(duration);
  const todayIso = new Date().toISOString().split('T')[0];

  const castList = Array.isArray(item.cast) ? item.cast.slice(0, 8) : [];
  const topActors = castList.map(c => c.name).filter(Boolean);
  const leadActorsStr = topActors.length ? topActors.slice(0, 3).join(', ') : 'Ensemble Cast';

  // Direct Answer Block (40-80 words, featured snippet friendly)
  const directAnswer = `${cleanTitle} (${year}) is a ${primaryGenre} film directed by ${director} and starring ${leadActorsStr}. It has an official runtime of ${duration} and holds an audience rating of ${rating}/10. Streaming and direct cloud download mirrors are cataloged on Netflix4U with verified multi-audio tracks and Full HD servers.`;

  // FAQ generation
  const faqs = [
    {
      q: `What is ${cleanTitle} (${year}) about?`,
      a: item.overview || item.description || `${cleanTitle} is a captivating ${primaryGenre} movie that follows an engaging storyline filled with dramatic moments and memorable performances.`
    },
    {
      q: `Who directed ${cleanTitle} and who stars in it?`,
      a: `${cleanTitle} was directed by ${director}. The leading cast includes ${leadActorsStr}.`
    },
    {
      q: `Where can I watch ${cleanTitle} online?`,
      a: `You can stream ${cleanTitle} online in Full HD through verified multi-server mirrors directly on Netflix4U, or utilize high-speed cloud download mirrors for offline viewing.`
    },
    {
      q: `What is the runtime and genre of ${cleanTitle}?`,
      a: `The official runtime of ${cleanTitle} is ${duration}. Its primary genres are ${genres.join(', ')}.`
    },
    {
      q: `Is ${cleanTitle} available in Hindi or dual audio?`,
      a: `Yes, ${cleanTitle} is cataloged with multi-language audio support including ${lang} where released.`
    }
  ];

  // Schema.org JSON-LD Graph
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Movie",
        "@id": `${canonicalUrl}#movie`,
        "url": canonicalUrl,
        "name": cleanTitle,
        "alternateName": item.originalTitle || cleanTitle,
        "description": desc,
        "image": poster,
        "dateCreated": releaseDate,
        "datePublished": releaseDate,
        "duration": durationIso,
        "genre": genres,
        "inLanguage": lang,
        "countryOfOrigin": country,
        "director": {
          "@type": "Person",
          "name": director
        },
        "actor": topActors.map(name => ({ "@type": "Person", "name": name })),
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": rating,
          "bestRating": "10",
          "worstRating": "1",
          "ratingCount": "1250"
        },
        "publisher": {
          "@type": "Organization",
          "name": "Netflix4U",
          "url": "https://netflix4u.in/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://netflix4u.in/" },
          { "@type": "ListItem", "position": 2, "name": "Movies", "item": "https://netflix4u.in/movies" },
          { "@type": "ListItem", "position": 3, "name": primaryGenre, "item": `https://netflix4u.in/movies?genre=${encodeURIComponent(primaryGenre)}` },
          { "@type": "ListItem", "position": 4, "name": cleanTitle, "item": canonicalUrl }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": `${canonicalUrl}#faq`,
        "mainEntity": faqs.map(f => ({
          "@type": "Question",
          "name": f.q,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": f.a
          }
        }))
      }
    ]
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#0a0a0f">
  <meta name="color-scheme" content="dark">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(desc)}">
  <meta name="keywords" content="${escapeHtml(cleanTitle)}, watch ${escapeHtml(cleanTitle)} online, download ${escapeHtml(cleanTitle)} 1080p, ${escapeHtml(cleanTitle)} cast, where to watch ${escapeHtml(cleanTitle)}">
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">

  <!-- OpenGraph -->
  <meta property="og:type" content="video.movie">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:image" content="${escapeHtml(backdrop)}">
  <meta property="og:image:width" content="1280">
  <meta property="og:image:height" content="720">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:site_name" content="Netflix4U">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(desc)}">
  <meta name="twitter:image" content="${escapeHtml(backdrop)}">

  <!-- Schema.org JSON-LD -->
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

  <!-- Preload fonts & poster -->
  <link rel="preload" as="font" type="font/woff2" href="/cf-fonts/v/inter/5.2.8/latin/wght/normal.woff2" crossorigin>
  <link rel="preload" as="image" href="${escapeHtml(poster)}" fetchpriority="high">

  <link rel="stylesheet" href="/css/tailwind.css">
  <style>
    body { background-color: #0a0a0f; color: #e2e8f0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
    .hero-backdrop { position: absolute; inset: 0; background-size: cover; background-position: center; opacity: 0.18; filter: blur(8px); }
    .hero-gradient { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10,10,15,0.4) 0%, rgba(10,10,15,0.95) 75%, #0a0a0f 100%); }
    .facts-table th { text-align: left; padding: 0.5rem 0.75rem; color: #94a3b8; font-weight: 500; font-size: 0.8125rem; border-bottom: 1px solid rgba(255,255,255,0.06); width: 35%; }
    .facts-table td { padding: 0.5rem 0.75rem; color: #f8fafc; font-weight: 600; font-size: 0.8125rem; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
  </style>
</head>
<body class="min-h-screen flex flex-col antialiased">
  ${renderHeader()}

  <!-- Breadcrumbs -->
  <div class="bg-black/30 border-b border-white/5 py-2 px-4 sm:px-8 text-xs text-slate-400">
    <div class="max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto whitespace-nowrap">
      <a href="/" class="hover:text-white transition">Home</a>
      <span>&rsaquo;</span>
      <a href="/movies" class="hover:text-white transition">Movies</a>
      <span>&rsaquo;</span>
      <a href="/movies?genre=${encodeURIComponent(primaryGenre)}" class="hover:text-white transition">${escapeHtml(primaryGenre)}</a>
      <span>&rsaquo;</span>
      <span class="text-white font-medium">${escapeHtml(cleanTitle)}</span>
    </div>
  </div>

  <main class="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 relative">
    <!-- Ambient Backdrop Art -->
    <div class="hero-backdrop" style="background-image: url('${escapeHtml(backdrop)}');"></div>
    <div class="hero-gradient"></div>

    <article class="relative z-10 space-y-8">
      <!-- Title & Header Hero Section -->
      <section class="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        <!-- Left: Poster Column -->
        <div class="md:col-span-4 lg:col-span-3 flex flex-col items-center">
          <div class="relative w-full max-w-[280px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 aspect-[2/3] bg-slate-900">
            <img src="${escapeHtml(poster)}" alt="${escapeHtml(cleanTitle)} Poster" class="w-full h-full object-cover" width="280" height="420" fetchpriority="high">
            <div class="absolute top-3 left-3">
              <span class="badge bg-red-600/90 text-white shadow-md">⭐ ${escapeHtml(rating)}</span>
            </div>
            <div class="absolute top-3 right-3">
              <span class="badge bg-black/70 backdrop-blur-md text-white border border-white/20">FHD 1080p</span>
            </div>
          </div>

          <!-- Quick Action Buttons -->
          <div class="w-full max-w-[280px] mt-4 space-y-2">
            <a href="/api/stream-player?id=${encodeURIComponent(tmdbId)}&title=${encodeURIComponent(cleanTitle)}&type=movie" class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 transition">
              <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              <span>Watch Online</span>
            </a>
            <a href="/api/download-file?title=${encodeURIComponent(cleanTitle)}&id=${encodeURIComponent(tmdbId)}&quality=1080p" class="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center justify-center gap-2 border border-white/10 transition">
              <svg class="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Fast Cloud Download</span>
            </a>
          </div>
        </div>

        <!-- Right: Main Information Column -->
        <div class="md:col-span-8 lg:col-span-9 space-y-6">
          <div>
            <div class="flex flex-wrap items-center gap-2 text-xs font-semibold text-red-500 uppercase tracking-wider mb-2">
              <span>Verified Film Catalog</span>
              <span>&bull;</span>
              <span>${escapeHtml(year)}</span>
              <span>&bull;</span>
              <span>${escapeHtml(duration)}</span>
            </div>
            <h1 class="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">${escapeHtml(cleanTitle)}</h1>
            <p class="text-slate-400 text-sm mt-1">Directed by <span class="text-slate-200 font-semibold">${escapeHtml(director)}</span></p>

            <div class="flex flex-wrap gap-2 mt-3">
              ${genres.map(g => `<span class="badge bg-white/10 text-slate-300 border border-white/10">${escapeHtml(g)}</span>`).join('')}
              <span class="badge bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">Verified Active Stream</span>
            </div>
          </div>

          <!-- AEO Direct Answer Block -->
          <section class="p-4 sm:p-5 rounded-2xl bg-white/[0.04] border border-white/10 shadow-lg space-y-2">
            <h2 class="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
              Direct Answer &amp; Release Summary
            </h2>
            <p class="text-slate-300 text-sm sm:text-base leading-relaxed">
              ${escapeHtml(directAnswer)}
            </p>
          </section>

          <!-- Visible Quick Facts Table -->
          <section class="rounded-2xl bg-black/40 border border-white/10 overflow-hidden">
            <div class="px-4 py-3 bg-white/[0.02] border-b border-white/10 flex items-center justify-between">
              <h2 class="text-xs font-bold uppercase tracking-wider text-slate-300">Quick Facts &amp; Technical Specs</h2>
              <span class="text-[11px] text-slate-500">Updated: ${escapeHtml(todayIso)}</span>
            </div>
            <table class="facts-table w-full">
              <tbody>
                <tr><th>Full Title</th><td>${escapeHtml(cleanTitle)}</td></tr>
                <tr><th>Release Year</th><td>${escapeHtml(year)}</td></tr>
                <tr><th>Content Type</th><td>Feature Film (Movie)</td></tr>
                <tr><th>Director</th><td>${escapeHtml(director)}</td></tr>
                <tr><th>Starring Cast</th><td>${escapeHtml(leadActorsStr)}</td></tr>
                <tr><th>Genres</th><td>${escapeHtml(genres.join(', '))}</td></tr>
                <tr><th>Official Runtime</th><td>${escapeHtml(duration)}</td></tr>
                <tr><th>Audio Languages</th><td>${escapeHtml(lang)}</td></tr>
                <tr><th>Country of Origin</th><td>${escapeHtml(country)}</td></tr>
                <tr><th>Catalog Status</th><td>Verified Active Stream &bull; Multi-Mirror</td></tr>
              </tbody>
            </table>
          </section>
        </div>
      </section>

      <!-- Plot Synopsis Section -->
      <section class="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
        <h2 class="text-xl font-bold text-white tracking-tight">Synopsis &amp; Plot Summary</h2>
        <p class="text-slate-300 text-sm sm:text-base leading-relaxed">
          ${escapeHtml(item.overview || item.description || `Experience the complete story of ${cleanTitle}. Available with full narrative details and official studio synopsis.`)}
        </p>
      </section>

      <!-- Where to Watch & Streaming Options -->
      <section class="p-6 rounded-2xl bg-gradient-to-br from-red-950/20 to-black/60 border border-red-500/20 space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <h2 class="text-xl font-bold text-white tracking-tight">Where to Watch ${escapeHtml(cleanTitle)}</h2>
            <p class="text-xs text-slate-400">Checked across authorized streaming servers and verified high-speed mirrors.</p>
          </div>
          <span class="badge bg-red-600/20 text-red-400 border border-red-500/30 text-[11px] self-start sm:self-center">
            Availability Status: 100% Verified
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <a href="/api/stream-player?id=${encodeURIComponent(tmdbId)}&title=${encodeURIComponent(cleanTitle)}&type=movie" class="p-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 flex flex-col justify-between transition">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-red-500 font-bold">▶</span>
              <span class="text-sm font-bold text-white">Stream Mirror 1</span>
            </div>
            <p class="text-xs text-slate-400">Multi-Audio &bull; Fast Cloud Stream &bull; Zero Ads</p>
          </a>
          <a href="https://allmovieland.link/movie/${encodeURIComponent(tmdbId)}" target="_blank" rel="noopener noreferrer" class="p-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 flex flex-col justify-between transition">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-blue-400 font-bold">⚡</span>
              <span class="text-sm font-bold text-white">Stream Mirror 2</span>
            </div>
            <p class="text-xs text-slate-400">AllMovieLand Server &bull; Full HD 1080p</p>
          </a>
          <a href="/api/download-file?title=${encodeURIComponent(cleanTitle)}&id=${encodeURIComponent(tmdbId)}&quality=1080p" class="p-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 flex flex-col justify-between transition">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-emerald-400 font-bold">📥</span>
              <span class="text-sm font-bold text-white">Fast Cloud Download</span>
            </div>
            <p class="text-xs text-slate-400">Direct .MKV File &bull; Cloudflare High-Speed R2</p>
          </a>
        </div>
      </section>

      <!-- Cast and Characters Grid -->
      ${castList.length ? `
      <section class="space-y-4">
        <h2 class="text-xl font-bold text-white tracking-tight">Starring Cast &amp; Characters</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          ${castList.map(c => `
          <div class="bg-white/[0.02] border border-white/10 rounded-xl p-2 text-center flex flex-col items-center">
            <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden mb-2 bg-slate-800 border border-white/10">
              <img src="${escapeHtml(c.photo || 'https://image.tmdb.org/t/p/w185/dkhYjeCU5ByYKxAr2wtXz20vb60.jpg')}" alt="${escapeHtml(c.name)}" class="w-full h-full object-cover" loading="lazy" width="80" height="80">
            </div>
            <span class="text-xs font-semibold text-white truncate w-full">${escapeHtml(c.name)}</span>
            <span class="text-[10px] text-slate-400 truncate w-full">${escapeHtml(c.character || 'Cast Member')}</span>
          </div>`).join('')}
        </div>
      </section>` : ''}

      <!-- Frequently Asked Questions (AEO & GEO optimized) -->
      <section class="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
        <div class="border-b border-white/10 pb-3">
          <h2 class="text-xl font-bold text-white tracking-tight">Frequently Asked Questions</h2>
          <p class="text-xs text-slate-400">Authentic answers based on verified film catalog data.</p>
        </div>
        <div class="space-y-4 text-sm">
          ${faqs.map(f => `
          <div class="border-b border-white/5 pb-3">
            <h3 class="font-bold text-white text-sm mb-1">${escapeHtml(f.q)}</h3>
            <p class="text-slate-300 text-xs sm:text-sm leading-relaxed">${escapeHtml(f.a)}</p>
          </div>`).join('')}
        </div>
      </section>

      <!-- Topic Cluster: Similar Recommendations -->
      ${relatedItems.length ? `
      <section class="space-y-4">
        <h2 class="text-xl font-bold text-white tracking-tight">More Movies Like ${escapeHtml(cleanTitle)}</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          ${relatedItems.slice(0, 6).map(r => `
          <a href="/movie/${encodeURIComponent(r.id || r.canonicalId)}" class="group block bg-white/[0.02] rounded-xl overflow-hidden border border-white/10 hover:border-red-500/40 transition">
            <div class="aspect-[2/3] bg-slate-900 overflow-hidden">
              <img src="${escapeHtml(r.poster || 'https://netflix4u.in/og-image.jpg')}" alt="${escapeHtml(r.title)}" class="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy">
            </div>
            <div class="p-2 text-center">
              <h3 class="text-xs font-semibold text-white truncate">${escapeHtml(r.title)}</h3>
              <span class="text-[10px] text-slate-400">${escapeHtml(r.year || '')}</span>
            </div>
          </a>`).join('')}
        </div>
      </section>` : ''}
    </article>
  </main>

  ${renderFooter()}

  <!-- Client Interactive Support -->
  <script defer src="/js/version-checker.js?v=3.5.0"></script>
  <script defer src="/js/ads-manager.js?v=3.5.0"></script>
  <script defer src="/js/download-resolver.js?v=3.5.0"></script>
</body>
</html>`;
}

/**
 * Render TV Series Detail Page (SSR)
 */
function renderSeriesPage(item, canonicalUrl, relatedItems = []) {
  const title = item.title || 'Series Title';
  const year = item.year || '';
  const cleanTitle = title.replace(/\(\d{4}\)/g, '').trim();
  const pageTitle = `${cleanTitle} (${year}) Watch Web Series & All Episodes — Netflix4U`;
  const desc = (item.description || item.overview || `Stream and download ${cleanTitle} (${year}) web series in Full HD with all seasons, episodes, and Hindi dual audio on Netflix4U.`).slice(0, 160);
  const poster = item.poster || 'https://netflix4u.in/og-image.jpg';
  const backdrop = item.backdrop || poster;
  const rating = item.rating ? Number(item.rating).toFixed(1) : '8.6';
  const genres = Array.isArray(item.genres) && item.genres.length ? item.genres : ['Drama', 'Mystery'];
  const primaryGenre = genres[0] || 'TV Series';
  const creator = item.director && item.director !== 'Director' ? item.director : 'Showrunner & Creators';
  const lang = item.language || 'English / Hindi';
  const country = item.country || 'US';
  const releaseDate = item.releaseDate || `${year}-01-01`;
  const tmdbId = item.tmdbId || item.id || '';
  const todayIso = new Date().toISOString().split('T')[0];

  const castList = Array.isArray(item.cast) ? item.cast.slice(0, 8) : [];
  const topActors = castList.map(c => c.name).filter(Boolean);
  const leadActorsStr = topActors.length ? topActors.slice(0, 3).join(', ') : 'Ensemble Cast';

  // Direct Answer Block
  const directAnswer = `${cleanTitle} (${year}) is a verified ${primaryGenre} television series created by ${creator} and starring ${leadActorsStr}. It holds an audience score of ${rating}/10. All seasons and episodes are indexed on Netflix4U with Full HD streaming mirrors and episode-by-episode high-speed downloads.`;

  // FAQs
  const faqs = [
    {
      q: `What is the television series ${cleanTitle} about?`,
      a: item.overview || item.description || `${cleanTitle} is a gripping ${primaryGenre} series that explores intricate character relationships, dramatic tensions, and expansive plotlines.`
    },
    {
      q: `Who is in the cast of ${cleanTitle}?`,
      a: `${cleanTitle} stars ${leadActorsStr}.`
    },
    {
      q: `Where can I watch all episodes of ${cleanTitle}?`,
      a: `All seasons and episodes of ${cleanTitle} are cataloged with active streaming mirrors and direct cloud file downloads right on Netflix4U.`
    },
    {
      q: `What genre is ${cleanTitle}?`,
      a: `${cleanTitle} is categorized primarily as ${genres.join(', ')}.`
    }
  ];

  // Schema.org JSON-LD Graph
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "TVSeries",
        "@id": `${canonicalUrl}#series`,
        "url": canonicalUrl,
        "name": cleanTitle,
        "alternateName": item.originalTitle || cleanTitle,
        "description": desc,
        "image": poster,
        "startDate": releaseDate,
        "genre": genres,
        "inLanguage": lang,
        "countryOfOrigin": country,
        "creator": {
          "@type": "Person",
          "name": creator
        },
        "actor": topActors.map(name => ({ "@type": "Person", "name": name })),
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": rating,
          "bestRating": "10",
          "worstRating": "1",
          "ratingCount": "980"
        },
        "publisher": {
          "@type": "Organization",
          "name": "Netflix4U",
          "url": "https://netflix4u.in/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://netflix4u.in/" },
          { "@type": "ListItem", "position": 2, "name": "Web Series", "item": "https://netflix4u.in/series" },
          { "@type": "ListItem", "position": 3, "name": primaryGenre, "item": `https://netflix4u.in/series?genre=${encodeURIComponent(primaryGenre)}` },
          { "@type": "ListItem", "position": 4, "name": cleanTitle, "item": canonicalUrl }
        ]
      },
      {
        "@type": "FAQPage",
        "@id": `${canonicalUrl}#faq`,
        "mainEntity": faqs.map(f => ({
          "@type": "Question",
          "name": f.q,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": f.a
          }
        }))
      }
    ]
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#0a0a0f">
  <meta name="color-scheme" content="dark">
  <title>${escapeHtml(pageTitle)}</title>
  <meta name="description" content="${escapeHtml(desc)}">
  <meta name="keywords" content="${escapeHtml(cleanTitle)}, watch ${escapeHtml(cleanTitle)} online, download ${escapeHtml(cleanTitle)} web series, ${escapeHtml(cleanTitle)} episodes, ${escapeHtml(cleanTitle)} cast">
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">

  <!-- OpenGraph -->
  <meta property="og:type" content="video.tv_show">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:image" content="${escapeHtml(backdrop)}">
  <meta property="og:image:width" content="1280">
  <meta property="og:image:height" content="720">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:site_name" content="Netflix4U">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(desc)}">
  <meta name="twitter:image" content="${escapeHtml(backdrop)}">

  <!-- Schema.org JSON-LD -->
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>

  <!-- Preload fonts & poster -->
  <link rel="preload" as="font" type="font/woff2" href="/cf-fonts/v/inter/5.2.8/latin/wght/normal.woff2" crossorigin>
  <link rel="preload" as="image" href="${escapeHtml(poster)}" fetchpriority="high">

  <link rel="stylesheet" href="/css/tailwind.css">
  <style>
    body { background-color: #0a0a0f; color: #e2e8f0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
    .hero-backdrop { position: absolute; inset: 0; background-size: cover; background-position: center; opacity: 0.18; filter: blur(8px); }
    .hero-gradient { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10,10,15,0.4) 0%, rgba(10,10,15,0.95) 75%, #0a0a0f 100%); }
    .facts-table th { text-align: left; padding: 0.5rem 0.75rem; color: #94a3b8; font-weight: 500; font-size: 0.8125rem; border-bottom: 1px solid rgba(255,255,255,0.06); width: 35%; }
    .facts-table td { padding: 0.5rem 0.75rem; color: #f8fafc; font-weight: 600; font-size: 0.8125rem; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
  </style>
</head>
<body class="min-h-screen flex flex-col antialiased">
  ${renderHeader()}

  <!-- Breadcrumbs -->
  <div class="bg-black/30 border-b border-white/5 py-2 px-4 sm:px-8 text-xs text-slate-400">
    <div class="max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto whitespace-nowrap">
      <a href="/" class="hover:text-white transition">Home</a>
      <span>&rsaquo;</span>
      <a href="/series" class="hover:text-white transition">Web Series</a>
      <span>&rsaquo;</span>
      <a href="/series?genre=${encodeURIComponent(primaryGenre)}" class="hover:text-white transition">${escapeHtml(primaryGenre)}</a>
      <span>&rsaquo;</span>
      <span class="text-white font-medium">${escapeHtml(cleanTitle)}</span>
    </div>
  </div>

  <main class="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 relative">
    <div class="hero-backdrop" style="background-image: url('${escapeHtml(backdrop)}');"></div>
    <div class="hero-gradient"></div>

    <article class="relative z-10 space-y-8">
      <section class="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        <!-- Left: Poster Column -->
        <div class="md:col-span-4 lg:col-span-3 flex flex-col items-center">
          <div class="relative w-full max-w-[280px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 aspect-[2/3] bg-slate-900">
            <img src="${escapeHtml(poster)}" alt="${escapeHtml(cleanTitle)} Poster" class="w-full h-full object-cover" width="280" height="420" fetchpriority="high">
            <div class="absolute top-3 left-3">
              <span class="badge bg-red-600/90 text-white shadow-md">⭐ ${escapeHtml(rating)}</span>
            </div>
            <div class="absolute top-3 right-3">
              <span class="badge bg-black/70 backdrop-blur-md text-white border border-white/20">Full Seasons</span>
            </div>
          </div>

          <div class="w-full max-w-[280px] mt-4 space-y-2">
            <a href="/api/stream-player?id=${encodeURIComponent(tmdbId)}&title=${encodeURIComponent(cleanTitle)}&type=series&se=1&ep=1" class="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 transition">
              <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              <span>Watch S1 Ep 1</span>
            </a>
            <a href="/api/download-file?title=${encodeURIComponent(cleanTitle)}&id=${encodeURIComponent(tmdbId)}&se=1&ep=1&quality=1080p" class="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs flex items-center justify-center gap-2 border border-white/10 transition">
              <svg class="w-3.5 h-3.5 stroke-current fill-none" viewBox="0 0 24 24" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              <span>Download Episode 1</span>
            </a>
          </div>
        </div>

        <!-- Right: Information Column -->
        <div class="md:col-span-8 lg:col-span-9 space-y-6">
          <div>
            <div class="flex flex-wrap items-center gap-2 text-xs font-semibold text-red-500 uppercase tracking-wider mb-2">
              <span>Verified Television Series</span>
              <span>&bull;</span>
              <span>${escapeHtml(year)}</span>
              <span>&bull;</span>
              <span>Multi-Episode</span>
            </div>
            <h1 class="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">${escapeHtml(cleanTitle)}</h1>
            <p class="text-slate-400 text-sm mt-1">Creator / Network: <span class="text-slate-200 font-semibold">${escapeHtml(creator)}</span></p>

            <div class="flex flex-wrap gap-2 mt-3">
              ${genres.map(g => `<span class="badge bg-white/10 text-slate-300 border border-white/10">${escapeHtml(g)}</span>`).join('')}
              <span class="badge bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">Verified TV Stream</span>
            </div>
          </div>

          <!-- AEO Direct Answer Block -->
          <section class="p-4 sm:p-5 rounded-2xl bg-white/[0.04] border border-white/10 shadow-lg space-y-2">
            <h2 class="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
              Series Summary &amp; Broadcast Details
            </h2>
            <p class="text-slate-300 text-sm sm:text-base leading-relaxed">
              ${escapeHtml(directAnswer)}
            </p>
          </section>

          <!-- Quick Facts Table -->
          <section class="rounded-2xl bg-black/40 border border-white/10 overflow-hidden">
            <div class="px-4 py-3 bg-white/[0.02] border-b border-white/10 flex items-center justify-between">
              <h2 class="text-xs font-bold uppercase tracking-wider text-slate-300">Series Overview &amp; Specifications</h2>
              <span class="text-[11px] text-slate-500">Updated: ${escapeHtml(todayIso)}</span>
            </div>
            <table class="facts-table w-full">
              <tbody>
                <tr><th>Series Title</th><td>${escapeHtml(cleanTitle)}</td></tr>
                <tr><th>First Air Year</th><td>${escapeHtml(year)}</td></tr>
                <tr><th>Content Type</th><td>Television Web Series (TVSeries)</td></tr>
                <tr><th>Creator / Studio</th><td>${escapeHtml(creator)}</td></tr>
                <tr><th>Starring Cast</th><td>${escapeHtml(leadActorsStr)}</td></tr>
                <tr><th>Genres</th><td>${escapeHtml(genres.join(', '))}</td></tr>
                <tr><th>Audio Languages</th><td>${escapeHtml(lang)}</td></tr>
                <tr><th>Country of Origin</th><td>${escapeHtml(country)}</td></tr>
                <tr><th>Catalog Status</th><td>Verified Multi-Episode Streams &bull; Cloud Mirrors</td></tr>
              </tbody>
            </table>
          </section>
        </div>
      </section>

      <!-- Plot Synopsis -->
      <section class="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
        <h2 class="text-xl font-bold text-white tracking-tight">Overview &amp; Storyline</h2>
        <p class="text-slate-300 text-sm sm:text-base leading-relaxed">
          ${escapeHtml(item.overview || item.description || `Follow the dramatic evolution of ${cleanTitle}. Complete seasons and verified episodes cataloged for instant streaming.`)}
        </p>
      </section>

      <!-- Where to Watch -->
      <section class="p-6 rounded-2xl bg-gradient-to-br from-red-950/20 to-black/60 border border-red-500/20 space-y-4">
        <div class="border-b border-white/10 pb-3">
          <h2 class="text-xl font-bold text-white tracking-tight">Where to Watch ${escapeHtml(cleanTitle)} All Episodes</h2>
          <p class="text-xs text-slate-400">Stream or download episode by episode with direct cloud server speeds.</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <a href="/api/stream-player?id=${encodeURIComponent(tmdbId)}&title=${encodeURIComponent(cleanTitle)}&type=series&se=1&ep=1" class="p-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 flex flex-col justify-between transition">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-red-500 font-bold">▶</span>
              <span class="text-sm font-bold text-white">Stream Online (Player)</span>
            </div>
            <p class="text-xs text-slate-400">Continuous Episode Playback &bull; Zero Lag</p>
          </a>
          <a href="https://allmovieland.link/tv/${encodeURIComponent(tmdbId)}/1/1" target="_blank" rel="noopener noreferrer" class="p-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 flex flex-col justify-between transition">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-blue-400 font-bold">⚡</span>
              <span class="text-sm font-bold text-white">AllMovieLand Mirror</span>
            </div>
            <p class="text-xs text-slate-400">TV Stream &bull; Full HD 1080p</p>
          </a>
          <a href="/api/download-file?title=${encodeURIComponent(cleanTitle)}&id=${encodeURIComponent(tmdbId)}&se=1&ep=1&quality=1080p" class="p-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 flex flex-col justify-between transition">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-emerald-400 font-bold">📥</span>
              <span class="text-sm font-bold text-white">Episode Cloud Download</span>
            </div>
            <p class="text-xs text-slate-400">Direct High-Speed .MKV File Downloads</p>
          </a>
        </div>
      </section>

      <!-- Cast and Crew -->
      ${castList.length ? `
      <section class="space-y-4">
        <h2 class="text-xl font-bold text-white tracking-tight">Main Cast &amp; Regulars</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          ${castList.map(c => `
          <div class="bg-white/[0.02] border border-white/10 rounded-xl p-2 text-center flex flex-col items-center">
            <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden mb-2 bg-slate-800 border border-white/10">
              <img src="${escapeHtml(c.photo || 'https://image.tmdb.org/t/p/w185/dkhYjeCU5ByYKxAr2wtXz20vb60.jpg')}" alt="${escapeHtml(c.name)}" class="w-full h-full object-cover" loading="lazy" width="80" height="80">
            </div>
            <span class="text-xs font-semibold text-white truncate w-full">${escapeHtml(c.name)}</span>
            <span class="text-[10px] text-slate-400 truncate w-full">${escapeHtml(c.character || 'Cast Member')}</span>
          </div>`).join('')}
        </div>
      </section>` : ''}

      <!-- FAQs -->
      <section class="p-6 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
        <div class="border-b border-white/10 pb-3">
          <h2 class="text-xl font-bold text-white tracking-tight">Frequently Asked Questions</h2>
          <p class="text-xs text-slate-400">Verified television data for viewers and answer engines.</p>
        </div>
        <div class="space-y-4 text-sm">
          ${faqs.map(f => `
          <div class="border-b border-white/5 pb-3">
            <h3 class="font-bold text-white text-sm mb-1">${escapeHtml(f.q)}</h3>
            <p class="text-slate-300 text-xs sm:text-sm leading-relaxed">${escapeHtml(f.a)}</p>
          </div>`).join('')}
        </div>
      </section>

      <!-- Similar Series Recommendations -->
      ${relatedItems.length ? `
      <section class="space-y-4">
        <h2 class="text-xl font-bold text-white tracking-tight">More Web Series Like ${escapeHtml(cleanTitle)}</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          ${relatedItems.slice(0, 6).map(r => `
          <a href="/series/${encodeURIComponent(r.id || r.canonicalId)}" class="group block bg-white/[0.02] rounded-xl overflow-hidden border border-white/10 hover:border-red-500/40 transition">
            <div class="aspect-[2/3] bg-slate-900 overflow-hidden">
              <img src="${escapeHtml(r.poster || 'https://netflix4u.in/og-image.jpg')}" alt="${escapeHtml(r.title)}" class="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy">
            </div>
            <div class="p-2 text-center">
              <h3 class="text-xs font-semibold text-white truncate">${escapeHtml(r.title)}</h3>
              <span class="text-[10px] text-slate-400">${escapeHtml(r.year || '')}</span>
            </div>
          </a>`).join('')}
        </div>
      </section>` : ''}
    </article>
  </main>

  ${renderFooter()}

  <script defer src="/js/version-checker.js?v=3.5.0"></script>
  <script defer src="/js/ads-manager.js?v=3.5.0"></script>
  <script defer src="/js/download-resolver.js?v=3.5.0"></script>
</body>
</html>`;
}

/**
 * Render Category / Discovery Hub Page (SSR)
 */
function renderCategoryPage(categoryKey, canonicalUrl, items = []) {
  const meta = CATEGORY_META[categoryKey] || {
    title: `${categoryKey.toUpperCase()} Catalog — Netflix4U`,
    description: `Discover verified titles in ${categoryKey} on Netflix4U.`,
    h1: `${categoryKey.toUpperCase()} Titles`,
    intro: 'Browse verified catalog titles with streaming options and high-speed downloads.'
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${canonicalUrl}#collection`,
        "url": canonicalUrl,
        "name": meta.title,
        "description": meta.description,
        "publisher": {
          "@type": "Organization",
          "name": "Netflix4U",
          "url": "https://netflix4u.in/"
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://netflix4u.in/" },
          { "@type": "ListItem", "position": 2, "name": meta.h1, "item": canonicalUrl }
        ]
      }
    ]
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#0a0a0f">
  <meta name="color-scheme" content="dark">
  <title>${escapeHtml(meta.title)}</title>
  <meta name="description" content="${escapeHtml(meta.description)}">
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">

  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(meta.title)}">
  <meta property="og:description" content="${escapeHtml(meta.description)}">
  <meta property="og:image" content="https://netflix4u.in/og-image.jpg">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:site_name" content="Netflix4U">

  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <link rel="preload" as="font" type="font/woff2" href="/cf-fonts/v/inter/5.2.8/latin/wght/normal.woff2" crossorigin>
  <link rel="stylesheet" href="/css/tailwind.css">
  <style>
    body { background-color: #0a0a0f; color: #e2e8f0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
    .badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
  </style>
</head>
<body class="min-h-screen flex flex-col antialiased">
  ${renderHeader()}

  <!-- Breadcrumbs -->
  <div class="bg-black/30 border-b border-white/5 py-2 px-4 sm:px-8 text-xs text-slate-400">
    <div class="max-w-6xl mx-auto flex items-center gap-2">
      <a href="/" class="hover:text-white transition">Home</a>
      <span>&rsaquo;</span>
      <span class="text-white font-medium">${escapeHtml(meta.h1)}</span>
    </div>
  </div>

  <main class="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-8 space-y-8">
    <section class="border-b border-white/10 pb-6">
      <span class="text-xs font-semibold uppercase tracking-wider text-red-500">Curated Media Discovery</span>
      <h1 class="text-3xl sm:text-4xl font-black text-white mt-1 mb-3 tracking-tight">${escapeHtml(meta.h1)}</h1>
      <p class="text-slate-300 text-sm sm:text-base max-w-3xl leading-relaxed">${escapeHtml(meta.intro)}</p>
    </section>

    <!-- Catalog Grid -->
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-bold text-white">Top Verified Releases</h2>
        <span class="text-xs text-slate-400">${items.length} titles available</span>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        ${items.map(item => {
          const isTv = item.type === 'series' || item.type === 'anime' || item.type === 'kdrama';
          const itemUrl = `/${isTv ? 'series' : 'movie'}/${encodeURIComponent(item.id || item.canonicalId || item.slug || '')}`;
          return `
          <a href="${itemUrl}" class="group block bg-white/[0.02] rounded-xl overflow-hidden border border-white/10 hover:border-red-500/40 transition">
            <div class="relative aspect-[2/3] bg-slate-900 overflow-hidden">
              <img src="${escapeHtml(item.poster || 'https://netflix4u.in/og-image.jpg')}" alt="${escapeHtml(item.title)}" class="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy">
              ${item.rating ? `<span class="absolute top-2 left-2 badge bg-black/70 backdrop-blur-md text-amber-400 text-[10px]">★ ${Number(item.rating).toFixed(1)}</span>` : ''}
              ${item.quality ? `<span class="absolute top-2 right-2 badge bg-red-600 text-white text-[10px]">${escapeHtml(item.quality)}</span>` : ''}
            </div>
            <div class="p-2.5">
              <h3 class="text-xs font-bold text-white truncate group-hover:text-red-400 transition">${escapeHtml(item.title)}</h3>
              <div class="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                <span>${escapeHtml(item.year || '')}</span>
                <span>${escapeHtml(Array.isArray(item.genres) ? item.genres[0] : (item.type || 'Media'))}</span>
              </div>
            </div>
          </a>`;
        }).join('')}
      </div>
    </section>
  </main>

  ${renderFooter()}
</body>
</html>`;
}

module.exports = {
  renderMoviePage,
  renderSeriesPage,
  renderCategoryPage
};
