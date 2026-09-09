const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://netflix4u.in';
const ROOT = path.resolve(__dirname, '..');
const catalogPath = path.join(ROOT, 'data', 'catalog_summary.json');

console.log('🗺️ Generating dynamic sitemap.xml and robots.txt for Netflix4U.in...');

const today = new Date().toISOString().split('T')[0];

const staticPages = [
  { url: '', priority: '1.0', changefreq: 'daily' },
  { url: '/movies', priority: '0.9', changefreq: 'daily' },
  { url: '/series', priority: '0.9', changefreq: 'daily' },
  { url: '/anime', priority: '0.9', changefreq: 'daily' },
  { url: '/kdrama', priority: '0.8', changefreq: 'daily' },
  { url: '/trending', priority: '0.9', changefreq: 'daily' },
  { url: '/genres', priority: '0.7', changefreq: 'weekly' },
  { url: '/about', priority: '0.4', changefreq: 'monthly' },
  { url: '/dmca', priority: '0.4', changefreq: 'monthly' },
  { url: '/privacy', priority: '0.3', changefreq: 'monthly' },
  { url: '/terms', priority: '0.3', changefreq: 'monthly' },
  { url: '/contact', priority: '0.4', changefreq: 'monthly' }
];

let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;

// Add static pages
for (const page of staticPages) {
  xml += `  <url>
    <loc>${SITE_URL}${page.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>\n`;
}

// Add verified catalog titles (GATE: exclude titles without verified real posters)
if (fs.existsSync(catalogPath)) {
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  console.log(`Inspecting ${catalog.length} titles in catalog for verified real posters...`);

  let added = 0;
  let skipped = 0;

  for (const item of catalog) {
    // Quality Gate: Only index content with verified real posters
    if (!item.poster || item.poster.includes('no-poster') || item.poster.includes('placeholder') || item.poster.includes('data:image')) {
      skipped++;
      continue;
    }

    const type = item.type || 'movie';
    const id = item.id;
    const lastmod = item.date ? item.date.split('T')[0] : today;

    xml += `  <url>
    <loc>${SITE_URL}/${type}/${id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${item.quality === '4K' ? '0.8' : '0.7'}</priority>
  </url>\n`;
    added++;
  }

  console.log(`Added ${added} verified titles to sitemap (skipped ${skipped} unverified/placeholder items).`);
}

xml += `</urlset>`;

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml, 'utf8');
console.log(`✅ Successfully generated sitemap.xml with full verified URL coverage.`);

// Generate robots.txt
const robotsTxt = `# Netflix4U Robots.txt
# Optimized for Google, Bing, Perplexity, GPTBot, ClaudeBot, and AI Search Engines

User-agent: *
Allow: /
Disallow: /data/details_map.json
Disallow: /data/movies.json
Disallow: /data/series.json
Disallow: /api/admin
Disallow: /private/

# AI Search & Answer Engine Crawlers (Full Allowed)
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Applebot
Allow: /

# Sitemap Location
Sitemap: ${SITE_URL}/sitemap.xml
`;

fs.writeFileSync(path.join(ROOT, 'robots.txt'), robotsTxt, 'utf8');
console.log(`✅ Successfully generated robots.txt.`);
