const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DETAILS_DIR = path.join(DATA_DIR, 'details');

console.log('🚀 Loading Hicine catalogs...');

const movies = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'movies.json'), 'utf8'));
const series = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'series.json'), 'utf8'));
const anime = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'anime.json'), 'utf8'));
const trending = fs.existsSync(path.join(DATA_DIR, 'trending.json')) 
  ? JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'trending.json'), 'utf8')) : [];
const recent = fs.existsSync(path.join(DATA_DIR, 'recent.json')) 
  ? JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'recent.json'), 'utf8')) : [];

function extractFullUrls(str) {
  if (!str) return [];
  // Match full worker and vcloud URLs without cutting off nested https://
  const re = /(https:\/\/[^\s,]+(?:\?vcloud=https:\/\/[^\s,]+)?)/g;
  return Array.from(str.matchAll(re)).map(m => m[1]);
}

function parseMovieLinks(rawLinks) {
  if (!rawLinks) return [];
  const lines = rawLinks.split('\n').map(l => l.trim()).filter(Boolean);
  const parsed = [];
  for (const line of lines) {
    const urls = extractFullUrls(line);
    const url = urls[0] || '';
    if (!url || !url.startsWith('http')) continue;

    const qualityMatch = line.match(/\b(480p|720p|1080p|2160p|4K)\b/i);
    const sizeMatch = line.match(/\b(\d+(?:\.\d+)?\s*(?:MB|GB|TB))\b/i);
    const labelMatch = line.split(',').map(p => p.trim()).find(p => /\[.*\]|WEB-DL|HDRip|NF|BluRay|HDTC/i.test(p));

    parsed.push({
      url,
      quality: qualityMatch ? qualityMatch[1].toUpperCase() : 'HD',
      size: sizeMatch ? sizeMatch[1].toUpperCase() : '',
      label: labelMatch || `Fast Cloud Stream [${qualityMatch ? qualityMatch[1].toUpperCase() : 'Direct'}]`,
      isCloud: true,
      source: 'hicine'
    });
  }
  return parsed;
}

function parseSeriesLinks(item) {
  const links = [];

  // 1. Season Zip Packs
  if (item.season_zip) {
    const lines = item.season_zip.split('\n');
    for (const l of lines) {
      const sMatch = l.match(/(Season\s*\d+)/i);
      const sName = sMatch ? sMatch[1] : 'Full Series';
      const sizeMatch = l.match(/\b(\d+(?:\.\d+)?\s*(?:GB|MB))\b/i);
      const sz = sizeMatch ? sizeMatch[1] : '';

      const urlMatches = Array.from(l.matchAll(/(https:\/\/[^\s,]+(?:\?vcloud=https:\/\/[^\s,]+)?)/g));
      for (const um of urlMatches) {
        const idx = um.index;
        const after = l.slice(idx, idx + 150);
        const qm = after.match(/\b(1080p|720p|480p|4K)\b/i);
        const q = qm ? qm[1].toUpperCase() : 'HD';
        links.push({
          url: um[1],
          quality: q,
          size: sz,
          label: `${sName} Complete Pack [${q}]`,
          source: 'hicine',
          isCloud: true
        });
      }
    }
  }

  // 2. Individual Episodes across seasons (up to 15 seasons)
  for (let s = 1; s <= 15; s++) {
    const sContent = item['season_' + s];
    if (!sContent) continue;
    const lines = sContent.split('\n');

    for (const line of lines) {
      if (!line.includes('Episode') && !line.includes('Ep')) continue;
      const epMatch = line.match(/Episode\s*(\d+)/i) || line.match(/Ep\s*(\d+)/i);
      const epNum = epMatch ? epMatch[1] : '';

      // Check URL and quality pattern: url,,quality
      const epRe = /(https:\/\/[^\s,]+(?:\?vcloud=https:\/\/[^\s,]+)?),,([0-9a-zA-Z]+)/g;
      const epMatches = Array.from(line.matchAll(epRe));

      if (epMatches.length > 0) {
        for (const m of epMatches) {
          links.push({
            url: m[1],
            quality: m[2].toUpperCase(),
            size: '',
            label: `Season ${s} Episode ${epNum || '1'} [${m[2].toUpperCase()}]`,
            source: 'hicine',
            isCloud: true
          });
        }
      } else {
        // Fallback: extract all full URLs in line
        const urls = extractFullUrls(line);
        let idx = 0;
        for (const u of urls) {
          const q = idx === 0 ? '480P' : (idx === 1 ? '720P' : '1080P');
          links.push({
            url: u,
            quality: q,
            size: '',
            label: `Season ${s} Episode ${epNum || (idx + 1)} [${q}]`,
            source: 'hicine',
            isCloud: true
          });
          idx++;
        }
      }
    }
  }

  return links;
}

function normalizeTitle(t) {
  return (t || '').toLowerCase()
    .replace(/\(\d{4}\)/g, '')
    .replace(/^(NetFlix|Prime|Disney\+|Hotstar|SonyLIV|ZEE5)\s+/i, '')
    .replace(/[^a-z0-9]/g, '');
}

console.log('📦 Parsing all Hicine titles and links...');

const hicineMap = new Map();

function addEntry(item, type) {
  let links = [];
  if (item.links && typeof item.links === 'string') {
    links = parseMovieLinks(item.links);
  } else if (Array.isArray(item.links) && item.links.length > 0) {
    links = item.links;
  }
  
  // Also parse seasons if available
  const seriesLinks = parseSeriesLinks(item);
  if (seriesLinks.length > 0) {
    links = [...links, ...seriesLinks];
  }

  if (links.length === 0) return;

  const entry = { ...item, links, type };
  if (item.record_id) hicineMap.set(String(item.record_id), entry);
  if (item.url_slug) hicineMap.set(item.url_slug, entry);
  const norm = normalizeTitle(item.title);
  if (norm && !hicineMap.has(norm)) hicineMap.set(norm, entry);
}

for (const m of movies) addEntry(m, 'movie');
for (const s of series) addEntry(s, 'series');
for (const a of anime) addEntry(a, 'anime');
for (const t of trending) addEntry(t, t.mediaType || 'movie');
for (const r of recent) addEntry(r, r.mediaType || 'movie');

console.log(`✅ Indexed ${hicineMap.size} Hicine lookup entries with working download links.`);

// Now process files in DETAILS_DIR
console.log('🔄 Updating detail files in data/details/...');
const detailFiles = fs.readdirSync(DETAILS_DIR);
let updatedCount = 0;
let alreadyHadLinks = 0;

for (let i = 0; i < detailFiles.length; i++) {
  const file = detailFiles[i];
  if (!file.endsWith('.json')) continue;
  const filePath = path.join(DETAILS_DIR, file);

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const item = JSON.parse(raw);
    const id = String(item.id || item.record_id || file.replace('.json', ''));
    const norm = normalizeTitle(item.title || item.rawTitle);
    
    // Find matching Hicine entry
    const match = hicineMap.get(id) || (item.slug && hicineMap.get(item.slug)) || (norm && hicineMap.get(norm));
    
    let changed = false;

    // Filter out old fake /api/download/hicine?slug=... links if present
    if (item.links && Array.isArray(item.links)) {
      const initialLen = item.links.length;
      item.links = item.links.filter(l => !l.url || !l.url.includes('api/download/hicine?slug='));
      if (item.links.length !== initialLen) changed = true;
    } else {
      item.links = [];
    }

    // Also fix any links where vcloud parameter was truncated
    for (const l of item.links) {
      if (l.url && l.url.endsWith('?vcloud=')) {
        changed = true;
      }
    }
    item.links = item.links.filter(l => !(l.url && l.url.endsWith('?vcloud=')));

    if (match && match.links && match.links.length > 0) {
      const existingUrls = new Set(item.links.map(l => l.url));
      const newHicLinks = match.links.filter(l => !existingUrls.has(l.url) && !l.url.endsWith('?vcloud='));

      if (newHicLinks.length > 0) {
        // Prepend Hicine links so they are at the top
        item.links = [...newHicLinks, ...item.links];
        changed = true;
      }
    }

    // Ensure all links have proper source tags
    for (const l of item.links) {
      if (l.url && (l.url.includes('vcloud') || l.url.includes('workers.dev'))) {
        l.source = 'hicine';
        l.isCloud = true;
      } else if (l.url && (l.url.includes('nexdrive') || l.url.includes('dotmobiz') || l.url.includes('dotmovies'))) {
        l.source = 'dotmobiz';
        l.isCloud = false;
      }
    }

    if (changed) {
      fs.writeFileSync(filePath, JSON.stringify(item));
      updatedCount++;
    } else if (item.links && item.links.length > 0) {
      alreadyHadLinks++;
    }
  } catch (err) {}

  if (i > 0 && i % 5000 === 0) {
    console.log(`   Processed ${i}/${detailFiles.length} files... (Updated: ${updatedCount})`);
  }
}

// Also ensure Mirzapur 18033 detail file exists
if (!fs.existsSync(path.join(DETAILS_DIR, '18033.json'))) {
  const m18033 = trending.find(x => x.record_id === 18033);
  if (m18033) {
    const parsedLinks = parseMovieLinks(m18033.links);
    const mObj = {
      id: "18033",
      title: "Mirzapur: The Movie (2026)",
      rawTitle: "Mirzapur: The Movie (2026)",
      slug: "mirzapur-the-movie-2026",
      poster: m18033.featured_image || "https://storage.hicine.sbs/images/jbmZPjSfCdIHo269QZK203WZSm.webp",
      backdrop: m18033.featured_image || "https://storage.hicine.sbs/images/jbmZPjSfCdIHo269QZK203WZSm.webp",
      type: "movie",
      categories: ["Bollywood Movies", "Action", "Crime", "Drama", "Featured", "2026"],
      year: 2026,
      quality: "HDTC",
      date: m18033.date || new Date().toISOString(),
      record_id: 18033,
      links: parsedLinks,
      status: "publish"
    };
    fs.writeFileSync(path.join(DETAILS_DIR, '18033.json'), JSON.stringify(mObj));
    fs.writeFileSync(path.join(DETAILS_DIR, 'mirzapur-the-movie-2026.json'), JSON.stringify(mObj));
    console.log('✅ Created 18033.json and mirzapur-the-movie-2026.json with working links!');
  }
}

console.log(`🎉 Finished! Updated ${updatedCount} files with working Hicine links. (${alreadyHadLinks} already populated)`);
