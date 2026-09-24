/**
 * Netflix4U Streaming Provider Adapters Master Registry
 * Clean-Room Implementation from saveweb2zip Architecture
 * Strict Rivestream / Fade Exclusion Enforced
 */

const { createAdapter, cleanTmdbId, cleanImdbId } = require('./adapter-base');

const LH_PARAMS = 'nextEpisode=true&autoplayNextEpisode=true&episodeSelector=true&color=#E50914';

// -----------------------------------------------------------------------------
// 1. ACTIVE NETFLIX4U CORE PROVIDERS
// -----------------------------------------------------------------------------

// Server 1: VidSrc Global (Direct TMDB • Worldwide Unblocked)
const vidsrcPm = createAdapter({
  id: 'vidsrc_sbs',
  name: 'VidSrc Global',
  label: 'Server 1 (VidSrc Global)',
  baseUrl: 'https://vidsrc.pm/embed',
  priority: 1,
  enabled: true,
  providerGroup: 'vidsrc_cluster',
  requiredIdentifier: 'tmdb',
  notes: 'Canonical TMDB-ID Primary Stream (Global unblocked mirror)'
});

// Server 2: Peachify Pro (Ad-Free HD • Multi-Audio Hindi Dub)
const peachify = createAdapter({
  id: 'peachify',
  name: 'Peachify Pro',
  label: 'Server 2 (Peachify Pro)',
  baseUrl: 'https://peachify.pro/embed',
  priority: 2,
  enabled: true,
  providerGroup: 'peachify_cluster',
  requiredIdentifier: 'either',
  notes: 'Ad-Free HD with Synchronized Multi-Audio & Dubbing Support',
  customMovieBuilder(baseUrl, input, options = {}) {
    const mediaId = cleanTmdbId(input.tmdbId) || cleanImdbId(input.imdbId);
    let url = `${baseUrl}/movie/${encodeURIComponent(mediaId)}?accent=E50914&autoPlay=true`;
    const dub = (options.lang === 'hi') ? 'Hindi' : (options.lang === 'ta' ? 'Tamil' : (options.lang === 'te' ? 'Telugu' : (options.lang === 'en' ? 'English' : '')));
    if (dub) url += '&dub=' + encodeURIComponent(dub);
    return url;
  },
  customTvBuilder(baseUrl, input, options = {}) {
    const mediaId = cleanTmdbId(input.tmdbId) || cleanImdbId(input.imdbId);
    const s = parseInt(input.season, 10);
    const e = parseInt(input.episode, 10);
    let url = `${baseUrl}/tv/${encodeURIComponent(mediaId)}/${s}/${e}?accent=E50914&autoPlay=true&autoNext=true&showNextBtn=true`;
    const dub = (options.lang === 'hi') ? 'Hindi' : (options.lang === 'ta' ? 'Tamil' : (options.lang === 'te' ? 'Telugu' : (options.lang === 'en' ? 'English' : '')));
    if (dub) url += '&dub=' + encodeURIComponent(dub);
    return url;
  }
});

// Server 3: AllMovieLand (Ultra HD Indian & Global Stream)
// Status: DISABLED / INCOMPATIBLE - Endpoints offline (404 on slast430did.com, 403 on allmovieland.link)
const allmovieland = createAdapter({
  id: 'allmovieland',
  name: 'AllMovieLand',
  label: 'Server 3 (AllMovieLand)',
  baseUrl: 'https://slast430did.com/play',
  priority: 3,
  enabled: false,
  providerGroup: 'allmovieland_cluster',
  requiredIdentifier: 'either',
  notes: 'DISABLED / INCOMPATIBLE: Provider endpoints offline (404 on slast430did.com, 403 Cloudflare challenge on allmovieland.link)',
  customMovieBuilder(baseUrl, input) {
    const mediaId = cleanImdbId(input.imdbId) || cleanTmdbId(input.tmdbId);
    return `${baseUrl}/${encodeURIComponent(mediaId)}`;
  },
  customTvBuilder(baseUrl, input) {
    const mediaId = cleanImdbId(input.imdbId) || cleanTmdbId(input.tmdbId);
    const s = parseInt(input.season, 10);
    const e = parseInt(input.episode, 10);
    return `${baseUrl}/${encodeURIComponent(mediaId)}?s=${s}&e=${e}`;
  },
  getCacheKey(input) {
    const mediaId = cleanImdbId(input.imdbId) || cleanTmdbId(input.tmdbId);
    if (input.type === 'tv' || input.season || input.episode) {
      return `allmovieland:tv:${mediaId}:s${input.season || 1}:e${input.episode || 1}`;
    }
    return `allmovieland:movie:${mediaId}`;
  }
});

// Server 4: VidLink Pro (Multi-Audio Global)
const vidlink = createAdapter({
  id: 'vidlink',
  name: 'VidLink Pro',
  label: 'Server 4 (VidLink Pro)',
  baseUrl: 'https://vidlink.pro',
  priority: 4,
  enabled: true,
  providerGroup: 'vidlink_cluster',
  requiredIdentifier: 'tmdb',
  notes: 'Multi-Language Global Player with MultiLang toggle',
  customMovieBuilder(baseUrl, input, options = {}) {
    const tid = cleanTmdbId(input.tmdbId);
    let url = `${baseUrl}/movie/${encodeURIComponent(tid)}?multiLang=true`;
    if (options.lang && options.lang !== 'multi') url += '&lang=' + encodeURIComponent(options.lang);
    return url;
  },
  customTvBuilder(baseUrl, input, options = {}) {
    const tid = cleanTmdbId(input.tmdbId);
    const s = parseInt(input.season, 10);
    const e = parseInt(input.episode, 10);
    let url = `${baseUrl}/tv/${encodeURIComponent(tid)}/${s}/${e}?primaryColor=63b8bc&secondaryColor=a2a2a2&iconColor=eefdec&icons=default&player=default&title=true&poster=true&autoplay=true&nextbutton=true&multiLang=true`;
    if (options.lang && options.lang !== 'multi') url += '&lang=' + encodeURIComponent(options.lang);
    return url;
  }
});

// Server 5: PvrPlay / ReelsDownload (Native Multi-Audio & Hindi Dubbed HD)
const reelsdownload = createAdapter({
  id: 'reelsdownload',
  name: 'PvrPlay (Hindi Dub)',
  label: 'Server 5 (PvrPlay Hindi Dub)',
  baseUrl: 'https://embed.reelsdownload.online/player',
  priority: 2,
  enabled: true,
  providerGroup: 'pvrplay_cluster',
  requiredIdentifier: 'tmdb',
  notes: 'Native Multi-Audio Hindi Dubbed Player from PvrPlay engine (saveweb2zip extracted)',
  customMovieBuilder(baseUrl, input) {
    const tid = cleanTmdbId(input.tmdbId);
    return `${baseUrl}/${encodeURIComponent(tid)}?key=k_bf0ab0853bce46e3d90b256b`;
  },
  customTvBuilder(baseUrl, input) {
    const tid = cleanTmdbId(input.tmdbId);
    const s = parseInt(input.season || 1, 10);
    const e = parseInt(input.episode || 1, 10);
    return `${baseUrl}/${encodeURIComponent(tid)}/${s}/${e}?key=k_bf0ab0853bce46e3d90b256b`;
  }
});

// -----------------------------------------------------------------------------
// 2. EXTRACTED PROVIDERS (FROM SOURCE ZIP) - COMPLIANT & ENABLED
// -----------------------------------------------------------------------------

// Wootly (#1 in ZIP)
const wootly = createAdapter({
  id: 'wootly',
  name: 'Wootly',
  label: 'Wootly (VidSrc Party)',
  baseUrl: 'https://www.vidsrc.party',
  priority: 10,
  enabled: true,
  providerGroup: 'vidsrc_cluster',
  requiredIdentifier: 'tmdb'
});

// Braflix (#2 in ZIP)
const braflix = createAdapter({
  id: 'braflix',
  name: 'Braflix',
  label: 'Braflix (Cineby)',
  baseUrl: 'https://api.cineby.homes/embed',
  priority: 11,
  enabled: true,
  providerGroup: 'cineby_cluster',
  requiredIdentifier: 'tmdb',
  customTvBuilder(baseUrl, input) {
    const tid = cleanTmdbId(input.tmdbId);
    const s = parseInt(input.season, 10);
    const e = parseInt(input.episode, 10);
    return `${baseUrl}/tv/${encodeURIComponent(tid)}/${s}/${e}?autonext=1&ds_lang=en`;
  }
});

// Bolt (#3 in ZIP) & Flix (#37 in ZIP) - Deduplicated under vidbolt
const vidbolt = createAdapter({
  id: 'vidbolt',
  name: 'Bolt',
  label: 'Bolt Stream',
  baseUrl: 'https://vidbolt.xyz',
  priority: 12,
  enabled: true,
  providerGroup: 'vidbolt_cluster',
  requiredIdentifier: 'tmdb',
  notes: 'Deduplicated mirror of Flix in ZIP'
});

// Azute (#4 in ZIP)
const vidrock = createAdapter({
  id: 'vidrock',
  name: 'Azute',
  label: 'Azute (Vidrock)',
  baseUrl: 'https://vidrock.ru',
  priority: 13,
  enabled: true,
  providerGroup: 'vidrock_cluster',
  requiredIdentifier: 'tmdb'
});

// 4K (#5 in ZIP)
const videasy = createAdapter({
  id: 'videasy',
  name: '4K',
  label: '4K (Videasy)',
  baseUrl: 'https://player.videasy.net',
  priority: 14,
  enabled: true,
  providerGroup: 'videasy_cluster',
  requiredIdentifier: 'tmdb',
  customTvBuilder(baseUrl, input) {
    const tid = cleanTmdbId(input.tmdbId);
    const s = parseInt(input.season, 10);
    const e = parseInt(input.episode, 10);
    return `${baseUrl}/tv/${encodeURIComponent(tid)}/${s}/${e}?${LH_PARAMS}`;
  }
});

// Vid (#6 in ZIP)
const wplay = createAdapter({
  id: 'wplay',
  name: 'Vid',
  label: 'Vid (WPlay)',
  baseUrl: 'https://embed.wplay.me/embed',
  priority: 15,
  enabled: true,
  providerGroup: 'wplay_cluster',
  requiredIdentifier: 'tmdb'
});

// Mist (#7 in ZIP)
const xpass = createAdapter({
  id: 'xpass',
  name: 'Mist',
  label: 'Mist (XPass)',
  baseUrl: 'https://play.xpass.top/e',
  priority: 16,
  enabled: true,
  providerGroup: 'xpass_cluster',
  requiredIdentifier: 'tmdb'
});

// Nest (#9 in ZIP)
const vidnest = createAdapter({
  id: 'vidnest',
  name: 'Nest',
  label: 'Nest (Vidnest)',
  baseUrl: 'https://vidnest.fun',
  priority: 17,
  enabled: true,
  providerGroup: 'vidnest_cluster',
  requiredIdentifier: 'tmdb'
});

// Pass (#10 in ZIP)
const vidcore = createAdapter({
  id: 'vidcore',
  name: 'Pass',
  label: 'Pass (Vidcore)',
  baseUrl: 'https://vidcore.net',
  priority: 18,
  enabled: true,
  providerGroup: 'vidcore_cluster',
  requiredIdentifier: 'tmdb'
});

// Mistify (#11 in ZIP)
const vaplayer = createAdapter({
  id: 'vaplayer',
  name: 'Mistify',
  label: 'Mistify (VAPlayer)',
  baseUrl: 'https://vaplayer.ru/embed',
  priority: 19,
  enabled: true,
  providerGroup: 'vaplayer_cluster',
  requiredIdentifier: 'tmdb'
});

// Simplify (#12 in ZIP)
const zxcstream = createAdapter({
  id: 'zxcstream',
  name: 'Simplify',
  label: 'Simplify Stream',
  baseUrl: 'https://zxcstream.xyz/player',
  priority: 20,
  enabled: true,
  providerGroup: 'zxcstream_cluster',
  requiredIdentifier: 'tmdb',
  customMovieBuilder(baseUrl, input) {
    const tid = cleanTmdbId(input.tmdbId);
    return `${baseUrl}/movie/${encodeURIComponent(tid)}?autoplay=true&color=addc35&back=false&domainAd=braflix.win`;
  },
  customTvBuilder(baseUrl, input) {
    const tid = cleanTmdbId(input.tmdbId);
    const s = parseInt(input.season, 10);
    const e = parseInt(input.episode, 10);
    return `${baseUrl}/tv/${encodeURIComponent(tid)}/${s}/${e}?autoplay=true&color=addc35&back=false&domainAd=braflix.win`;
  }
});

// Asia (#13 in ZIP)
const oneembed = createAdapter({
  id: 'oneembed',
  name: 'Asia',
  label: 'Asia (1Embed)',
  baseUrl: 'https://1embed.cc/embed',
  priority: 21,
  enabled: true,
  providerGroup: 'oneembed_cluster',
  requiredIdentifier: 'tmdb'
});

// Cine (#14 in ZIP)
const cinesrc = createAdapter({
  id: 'cinesrc',
  name: 'Cine',
  label: 'Cine (CineSrc)',
  baseUrl: 'https://cinesrc.st/embed',
  priority: 22,
  enabled: true,
  providerGroup: 'cinesrc_cluster',
  requiredIdentifier: 'tmdb'
});

// Vidmux (#15 in ZIP)
const vidlux = createAdapter({
  id: 'vidlux',
  name: 'Vidmux',
  label: 'Vidmux (Vidlux)',
  baseUrl: 'https://vidlux.site/embed',
  priority: 23,
  enabled: true,
  providerGroup: 'vidlux_cluster',
  requiredIdentifier: 'tmdb'
});

// Diablo (#16 in ZIP)
const vsembed = createAdapter({
  id: 'vsembed',
  name: 'Diablo',
  label: 'Diablo (VSEmbed)',
  baseUrl: 'https://vsembed.ru/embed',
  priority: 24,
  enabled: true,
  providerGroup: 'vsembed_cluster',
  requiredIdentifier: 'tmdb'
});

// Italian (#17 in ZIP)
const vixsrc = createAdapter({
  id: 'vixsrc',
  name: 'Italian',
  label: 'Italian (VixSrc)',
  baseUrl: 'https://vixsrc.to',
  priority: 25,
  enabled: true,
  providerGroup: 'vixsrc_cluster',
  requiredIdentifier: 'tmdb',
  customMovieBuilder(baseUrl, input) {
    const tid = cleanTmdbId(input.tmdbId);
    return `${baseUrl}/movie/${encodeURIComponent(tid)}?autoplay=true&lang=it`;
  },
  customTvBuilder(baseUrl, input) {
    const tid = cleanTmdbId(input.tmdbId);
    const s = parseInt(input.season, 10);
    const e = parseInt(input.episode, 10);
    return `${baseUrl}/tv/${encodeURIComponent(tid)}/${s}/${e}?autoplay=true&lang=it`;
  }
});

// Vidind (#18 in ZIP)
const vidify = createAdapter({
  id: 'vidify',
  name: 'Vidind',
  label: 'Vidind (Vidify)',
  baseUrl: 'https://player.vidify.top/embed',
  priority: 26,
  enabled: true,
  providerGroup: 'vidify_cluster',
  requiredIdentifier: 'tmdb'
});

// 4KHD (#22 in ZIP)
const mapple = createAdapter({
  id: 'mapple',
  name: '4KHD',
  label: '4KHD (Mapple)',
  baseUrl: 'https://mapple.rip/watch',
  priority: 27,
  enabled: true,
  providerGroup: 'mapple_cluster',
  requiredIdentifier: 'tmdb',
  customMovieBuilder(baseUrl, input) {
    const tid = cleanTmdbId(input.tmdbId);
    return `${baseUrl}/movie/${encodeURIComponent(tid)}?autoPlay=true&theme=addc35`;
  },
  customTvBuilder(baseUrl, input) {
    const tid = cleanTmdbId(input.tmdbId);
    const s = parseInt(input.season, 10);
    const e = parseInt(input.episode, 10);
    return `${baseUrl}/tv/${encodeURIComponent(tid)}/${s}/${e}?autoPlay=true&theme=addc35`;
  }
});

// Nero (#25 in ZIP)
const vidfast = createAdapter({
  id: 'vidfast',
  name: 'Nero',
  label: 'Nero (Vidfast)',
  baseUrl: 'https://vidfast.pro',
  priority: 28,
  enabled: true,
  providerGroup: 'vidfast_cluster',
  requiredIdentifier: 'tmdb'
});

// Flixify (#26 in ZIP)
const vidflix = createAdapter({
  id: 'vidflix',
  name: 'Flixify',
  label: 'Flixify (Vidflix)',
  baseUrl: 'https://vidflix.club',
  priority: 29,
  enabled: true,
  providerGroup: 'vidflix_cluster',
  requiredIdentifier: 'tmdb'
});

// Astra (#27 in ZIP)
const vidsrcSu = createAdapter({
  id: 'vidsrc_su',
  name: 'Astra',
  label: 'Astra (VidSrc SU)',
  baseUrl: 'https://vidsrc.su/embed',
  priority: 30,
  enabled: true,
  providerGroup: 'vidsrc_cluster',
  requiredIdentifier: 'tmdb'
});

// Hindi (#29 in ZIP)
const viduki = createAdapter({
  id: 'viduki',
  name: 'Hindi',
  label: 'Hindi (Viduki)',
  baseUrl: 'https://www.viduki.net/1',
  priority: 31,
  enabled: true,
  providerGroup: 'viduki_cluster',
  requiredIdentifier: 'tmdb',
  customMovieBuilder(baseUrl, input) {
    const tid = cleanTmdbId(input.tmdbId);
    return `${baseUrl}/movie/?id=${encodeURIComponent(tid)}&s=undefined&e=undefined&poster=https://image.tmdb.org/t/p/w780/enNubozHn9pXi0ycTVYUWfpHZm.jpg&color=ffffff`;
  },
  customTvBuilder(baseUrl, input) {
    const tid = cleanTmdbId(input.tmdbId);
    const s = parseInt(input.season, 10);
    const e = parseInt(input.episode, 10);
    return `${baseUrl}/tv/?id=${encodeURIComponent(tid)}&s=${s}&e=${e}&next-ep=${e + 1}&poster=https://image.tmdb.org/t/p/w780/yQw23xxmVBFVHPCF6V68TAIIfno.jpg&color=ffffff`;
  }
});

// Vidsrc2 (#30 in ZIP)
const vidsrc2 = createAdapter({
  id: 'vidsrc2',
  name: 'Vidsrc',
  label: 'Vidsrc2 (RU)',
  baseUrl: 'https://vidsrc2.ru/embed',
  priority: 32,
  enabled: true,
  providerGroup: 'vidsrc_cluster',
  requiredIdentifier: 'tmdb'
});

// 2embed (#31 in ZIP)
const twoembed = createAdapter({
  id: 'twoembed',
  name: '2embed',
  label: '2Embed Stream',
  baseUrl: 'https://www.2embed.stream/embed',
  priority: 33,
  enabled: true,
  providerGroup: 'twoembed_cluster',
  requiredIdentifier: 'tmdb'
});

// French (#33 in ZIP)
const frembed = createAdapter({
  id: 'frembed',
  name: 'French',
  label: 'French (FrEmbed)',
  baseUrl: 'https://frembed.asia/api',
  priority: 34,
  enabled: true,
  providerGroup: 'frembed_cluster',
  requiredIdentifier: 'tmdb',
  customMovieBuilder(baseUrl, input) {
    const tid = cleanTmdbId(input.tmdbId);
    return `${baseUrl}/film.php?id=${encodeURIComponent(tid)}`;
  },
  customTvBuilder(baseUrl, input) {
    const tid = cleanTmdbId(input.tmdbId);
    const s = parseInt(input.season, 10);
    const e = parseInt(input.episode, 10);
    return `${baseUrl}/serie.php?id=${encodeURIComponent(tid)}&sa=${s}&epi=${e}`;
  }
});

// Club (#34 in ZIP)
const moviesapi = createAdapter({
  id: 'moviesapi',
  name: 'Club',
  label: 'Club (MoviesAPI)',
  baseUrl: 'https://moviesapi.to',
  priority: 35,
  enabled: true,
  providerGroup: 'moviesapi_cluster',
  requiredIdentifier: 'tmdb',
  customTvBuilder(baseUrl, input) {
    const tid = cleanTmdbId(input.tmdbId);
    const s = parseInt(input.season, 10);
    const e = parseInt(input.episode, 10);
    return `${baseUrl}/tv/${encodeURIComponent(tid)}-${s}-${e}`;
  }
});

// Sage (#35 in ZIP)
const movies111 = createAdapter({
  id: 'movies111',
  name: 'Sage',
  label: 'Sage (111Movies)',
  baseUrl: 'https://111movies.com',
  priority: 36,
  enabled: true,
  providerGroup: 'movies111_cluster',
  requiredIdentifier: 'tmdb'
});

// Portuguese (#38 in ZIP)
const superflix = createAdapter({
  id: 'superflix',
  name: 'Portuguese',
  label: 'Portuguese (Superflix)',
  baseUrl: 'https://superflixapi.beer',
  priority: 37,
  enabled: true,
  providerGroup: 'superflix_cluster',
  requiredIdentifier: 'tmdb',
  customMovieBuilder(baseUrl, input) {
    const tid = cleanTmdbId(input.tmdbId);
    return `${baseUrl}/filme/${encodeURIComponent(tid)}`;
  },
  customTvBuilder(baseUrl, input) {
    const tid = cleanTmdbId(input.tmdbId);
    const s = parseInt(input.season, 10);
    const e = parseInt(input.episode, 10);
    return `${baseUrl}/serie/${encodeURIComponent(tid)}/${s}/${e}`;
  }
});

// -----------------------------------------------------------------------------
// 3. EXTRACTED PROVIDERS (FROM SOURCE ZIP) - DISABLED / NOT COMPATIBLE
// -----------------------------------------------------------------------------

// 4K2 (#19 in ZIP) - Disabled: DNS resolution failed (ENOTFOUND)
const vidking = createAdapter({
  id: 'vidking',
  name: '4K2',
  label: '4K2 (Vidking)',
  baseUrl: 'https://www.vidking.net/embed',
  priority: 90,
  enabled: false,
  providerGroup: 'vidking_cluster',
  requiredIdentifier: 'tmdb',
  notes: 'DISABLED: DNS resolution failure (ENOTFOUND)'
});

// Prime (#20 in ZIP) - Disabled: 500 Internal Server Error
const cinemaos = createAdapter({
  id: 'cinemaos',
  name: 'Prime',
  label: 'Prime (CinemaOS)',
  baseUrl: 'https://cinemaos.tech/player',
  priority: 91,
  enabled: false,
  providerGroup: 'cinemaos_cluster',
  requiredIdentifier: 'tmdb',
  notes: 'DISABLED: 500 Internal Server Error'
});

// Main (#21 in ZIP) - Disabled: SAMEORIGIN header blocks iframe embedding
const vidzee = createAdapter({
  id: 'vidzee',
  name: 'Main',
  label: 'Main (Vidzee)',
  baseUrl: 'https://player.vidzee.wtf/embed',
  priority: 92,
  enabled: false,
  providerGroup: 'vidzee_cluster',
  requiredIdentifier: 'tmdb',
  notes: 'DISABLED: X-Frame-Options SAMEORIGIN blocks embedding'
});

// Vidplay (#28 in ZIP) - Disabled: HTTP 403 & SAMEORIGIN header
const vidsrcCc = createAdapter({
  id: 'vidsrc_cc',
  name: 'Vidplay',
  label: 'Vidplay (VidSrc CC)',
  baseUrl: 'https://vidsrc.cc/v2/embed',
  priority: 93,
  enabled: false,
  providerGroup: 'vidsrc_cluster',
  requiredIdentifier: 'tmdb',
  notes: 'DISABLED: 403 and X-Frame-Options SAMEORIGIN'
});

// PrimeWire (#32 in ZIP) - Disabled: HTTP 404 endpoint not found
const primesrc = createAdapter({
  id: 'primesrc',
  name: 'PrimeWire',
  label: 'PrimeWire',
  baseUrl: 'https://primesrc.me/embed',
  priority: 94,
  enabled: false,
  providerGroup: 'primesrc_cluster',
  requiredIdentifier: 'imdb',
  notes: 'DISABLED: 404 Not Found'
});

// Aura (#36 in ZIP) - Disabled: Gateway Timeout
const autoembed = createAdapter({
  id: 'autoembed',
  name: 'Aura',
  label: 'Aura (AutoEmbed)',
  baseUrl: 'https://player.autoembed.app/embed',
  priority: 95,
  enabled: false,
  providerGroup: 'autoembed_cluster',
  requiredIdentifier: 'tmdb',
  notes: 'DISABLED: Gateway timeout'
});

// NOTE: RIVESTREAM / FADE IS ABSOLUTELY EXCLUDED. ZERO REGISTRATION OR ADAPTER.

const allAdapters = [
  // Netflix4U Primary Core
  vidsrcPm,
  peachify,
  allmovieland,
  vidlink,
  reelsdownload,
  // ZIP Verified Active
  wootly,
  braflix,
  vidbolt,
  vidrock,
  videasy,
  wplay,
  xpass,
  vidnest,
  vidcore,
  vaplayer,
  zxcstream,
  oneembed,
  cinesrc,
  vidlux,
  vsembed,
  vixsrc,
  vidify,
  mapple,
  vidfast,
  vidflix,
  vidsrcSu,
  viduki,
  vidsrc2,
  twoembed,
  frembed,
  moviesapi,
  movies111,
  superflix,
  // ZIP Disabled / Incompatible
  vidking,
  cinemaos,
  vidzee,
  vidsrcCc,
  primesrc,
  autoembed
];

module.exports = {
  allAdapters,
  vidsrcPm,
  peachify,
  allmovieland,
  vidlink,
  reelsdownload,
  wootly,
  braflix,
  vidbolt,
  vidrock,
  videasy,
  wplay,
  xpass,
  vidnest,
  vidcore,
  vaplayer,
  zxcstream,
  oneembed,
  cinesrc,
  vidlux,
  vsembed,
  vixsrc,
  vidify,
  mapple,
  vidfast,
  vidflix,
  vidsrcSu,
  viduki,
  vidsrc2,
  twoembed,
  frembed,
  moviesapi,
  movies111,
  superflix,
  vidking,
  cinemaos,
  vidzee,
  vidsrcCc,
  primesrc,
  autoembed
};
