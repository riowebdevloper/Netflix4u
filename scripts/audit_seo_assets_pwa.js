const http = require('http');
const fs = require('fs');
const path = require('path');

function probeUrl(urlPath) {
  return new Promise(resolve => {
    http.get('http://localhost:4173' + urlPath, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
    }).on('error', err => resolve({ status: 500, error: err.message }));
  });
}

async function runSeoAssetsPwaAudit() {
  console.log('========================================================');
  console.log('AGENT 8 — SEO, ASSETS & PWA QA AUDIT');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  // 1. Index.html & Core SEO tags
  console.log('1. Auditing index.html for SEO & Meta Tags...');
  const indexRes = await probeUrl('/');
  if (indexRes.status === 200) {
    const html = indexRes.body;
    
    const checks = [
      { name: '<title> Tag', pass: /<title>[^<]+<\/title>/i.test(html) },
      { name: 'Meta Description', pass: /<meta\s+name=["']description["']/i.test(html) },
      { name: 'Canonical Link', pass: /<link\s+rel=["']canonical["']/i.test(html) },
      { name: 'OG Title', pass: /<meta\s+property=["']og:title["']/i.test(html) },
      { name: 'OG Image', pass: /<meta\s+property=["']og:image["']/i.test(html) },
      { name: 'Twitter Card', pass: /<meta\s+name=["']twitter:card["']/i.test(html) },
      { name: 'Favicon Link', pass: /<link\s+[^>]*rel=["'](?:icon|shortcut icon)["']/i.test(html) },
      { name: 'Manifest Link', pass: /<link\s+[^>]*rel=["']manifest["']/i.test(html) },
      { name: 'JSON-LD Structured Data', pass: /<script\s+type=["']application\/ld\+json["']/i.test(html) }
    ];

    for (const c of checks) {
      if (c.pass) {
        console.log(`  ✅ ${c.name} Present`);
        passed++;
      } else {
        console.log(`  ❌ ${c.name} MISSING`);
        failed++;
      }
    }
  } else {
    console.log(`  ❌ Failed to fetch index.html: HTTP ${indexRes.status}`);
    failed++;
  }

  // 2. Robots.txt
  console.log('\n2. Auditing /robots.txt...');
  const robotsRes = await probeUrl('/robots.txt');
  if (robotsRes.status === 200 && robotsRes.body.includes('User-agent')) {
    console.log('  ✅ /robots.txt accessible and valid');
    passed++;
  } else {
    console.log(`  ❌ /robots.txt invalid or missing: HTTP ${robotsRes.status}`);
    failed++;
  }

  // 3. Sitemap.xml
  console.log('\n3. Auditing /sitemap.xml...');
  const sitemapRes = await probeUrl('/sitemap.xml');
  if (sitemapRes.status === 200 && sitemapRes.body.includes('<?xml') && sitemapRes.body.includes('<urlset')) {
    console.log('  ✅ /sitemap.xml accessible and valid XML');
    passed++;
  } else {
    console.log(`  ❌ /sitemap.xml invalid or missing: HTTP ${sitemapRes.status}`);
    failed++;
  }

  // 4. Web App Manifest
  console.log('\n4. Auditing PWA Manifest...');
  // Find manifest path from index.html or check common paths
  const manifestPaths = ['/js/manifest.json', '/manifest.json', '/manifest.webmanifest'];
  let manifestFound = false;
  for (const mp of manifestPaths) {
    const mRes = await probeUrl(mp);
    if (mRes.status === 200) {
      try {
        const mJson = JSON.parse(mRes.body);
        if (mJson.name && mJson.icons) {
          console.log(`  ✅ Manifest verified at ${mp}: Name = "${mJson.name}", Icons = ${mJson.icons.length}`);
          manifestFound = true;
          passed++;

          // Check manifest icons exist
          for (const icon of mJson.icons) {
            const iconRes = await probeUrl(icon.src);
            if (iconRes.status === 200) {
              console.log(`    ✅ Manifest Icon exists: ${icon.src}`);
              passed++;
            } else {
              console.log(`    ❌ Manifest Icon missing: ${icon.src} (HTTP ${iconRes.status})`);
              failed++;
            }
          }
          break;
        }
      } catch(e) {}
    }
  }

  if (!manifestFound) {
    console.log('  ❌ No valid manifest found at probed paths');
    failed++;
  }

  // 5. Favicon
  console.log('\n5. Auditing Favicon...');
  const faviconRes = await probeUrl('/images/favicon.svg');
  if (faviconRes.status === 200) {
    console.log('  ✅ /images/favicon.svg accessible');
    passed++;
  } else {
    console.log(`  ❌ /images/favicon.svg missing: HTTP ${faviconRes.status}`);
    failed++;
  }

  console.log('\n========================================================');
  console.log(`SEO, ASSETS & PWA RESULTS: Passed: ${passed}, Failed: ${failed}`);
  console.log('========================================================\n');
}

runSeoAssetsPwaAudit();
