const http = require('http');
const fs = require('fs');
const path = require('path');

function fetchJson(endpoint) {
  return new Promise(resolve => {
    http.get('http://localhost:4173' + endpoint, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

async function runContentIdentityAudit() {
  console.log('========================================================');
  console.log('AGENT 2 — DATA & CONTENT IDENTITY QA (100 TITLES AUDIT)');
  console.log('========================================================\n');

  const catalog = JSON.parse(fs.readFileSync('data/catalog_summary.json', 'utf8'));
  console.log(`Loaded complete catalog with ${catalog.length} items.`);

  // Curated sampling across categories:
  const popularSample = catalog.slice(0, 25);
  const dotmobizSample = catalog.filter(x => String(x.id).startsWith('dotmobiz-')).slice(25, 50);
  const seriesSample = catalog.filter(x => x.type === 'series').slice(0, 25);
  const animeAndKdrama = [
    ...catalog.filter(x => x.type === 'anime').slice(0, 15),
    ...catalog.filter(x => x.type === 'kdrama').slice(0, 15)
  ];

  const testBatch = [
    ...popularSample,
    ...dotmobizSample,
    ...seriesSample,
    ...animeAndKdrama
  ].slice(0, 105);

  console.log(`Testing batch size: ${testBatch.length} unique titles...\n`);

  let matches = 0;
  let mismatches = 0;
  const mismatchDetails = [];

  for (let i = 0; i < testBatch.length; i++) {
    const item = testBatch[i];
    const testId = item.id || item.slug;
    const detail = await fetchJson(`/api/title?id=${encodeURIComponent(testId)}`);

    if (!detail || !detail.success || !detail.title) {
      mismatches++;
      mismatchDetails.push({ id: testId, reason: 'Failed to load title via API' });
      continue;
    }

    // 1. Identity Consistency: Title
    const normReq = (item.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normResp = (detail.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const titleMatch = normReq === normResp || normReq.includes(normResp) || normResp.includes(normReq);

    // 2. Poster Identity Check: Ensure poster doesn't point to completely different movie file
    let posterMatch = true;
    const p = detail.poster || '';
    if (p.includes('/uploads/posts/covers/')) {
      const fn = p.split('/').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normReq.length >= 5 && !fn.includes(normReq.slice(0, 4)) && !normReq.includes(fn.slice(0, 4))) {
        posterMatch = false;
      }
    }

    // 3. Year Sanity
    const y = parseInt(detail.year, 10);
    const yearValid = !isNaN(y) && y >= 1920 && y <= 2027;

    // 4. Type Consistency
    const typeValid = ['movie', 'series', 'anime', 'kdrama'].includes(detail.type);

    if (titleMatch && posterMatch && yearValid && typeValid) {
      matches++;
    } else {
      mismatches++;
      mismatchDetails.push({
        id: testId,
        reqTitle: item.title,
        respTitle: detail.title,
        poster: detail.poster,
        year: detail.year,
        type: detail.type,
        issues: {
          titleMatch,
          posterMatch,
          yearValid,
          typeValid
        }
      });
    }

    if ((i + 1) % 25 === 0 || i === testBatch.length - 1) {
      console.log(`Processed ${i + 1}/${testBatch.length}... (Current Matches: ${matches}, Mismatches: ${mismatches})`);
    }
  }

  console.log('\n========================================================');
  console.log('CONTENT IDENTITY AUDIT RESULTS:');
  console.log(`Total Titles Sampled: ${testBatch.length}`);
  console.log(`Matches (100% Verified Consistent): ${matches}`);
  console.log(`Mismatches: ${mismatches}`);
  console.log('========================================================');

  if (mismatches > 0) {
    console.error('Mismatch details:', JSON.stringify(mismatchDetails, null, 2));
  }
}

runContentIdentityAudit();
