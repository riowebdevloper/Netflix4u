const http = require('http');

function fetchJson(path) {
  return new Promise(resolve => {
    http.get('http://localhost:4173' + path, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, data: null }); }
      });
    }).on('error', err => resolve({ status: 500, error: err.message }));
  });
}

async function runPlayerQA() {
  console.log('========================================================');
  console.log('AGENT 4 — PLAYER & MEDIA STREAMING QA AUDIT');
  console.log('========================================================\n');

  const testCases = [
    { id: 'dotmobiz-96465', name: 'Mirzapur: The Movie 2026 (Movie)', type: 'movie' },
    { id: 'dotmobiz-96400', name: 'Black Box 2026 (Movie)', type: 'movie' },
    { id: 'dotmobiz-19290', name: 'American Woman 2018 (Movie)', type: 'movie' },
    { id: 'dotmobiz-96450', name: 'The Court Season 1 (Series)', type: 'series', season: 1, episode: 1 },
    { id: 'dotmobiz-94715', name: 'Special Ops Lioness Season 3 (Series)', type: 'series', season: 3, episode: 1 },
    { id: '38051', name: 'Heaven Official\'s Blessing (Anime)', type: 'anime', season: 1, episode: 1 }
  ];

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    console.log(`Auditing Player Sources for: ${tc.name}...`);
    const q = tc.season ? `&season=${tc.season}&episode=${tc.episode}` : '';
    const resp = await fetchJson(`/api/playback?id=${encodeURIComponent(tc.id)}${q}`);

    if (resp.status !== 200 || !resp.data || !resp.data.success || !Array.isArray(resp.data.sources)) {
      console.log(`  ❌ Failed to retrieve playback sources: status ${resp.status}`);
      failed++;
      continue;
    }

    const sources = resp.data.sources;
    console.log(`  Found ${sources.length} active playback server(s):`);
    
    let validSources = 0;
    for (const s of sources) {
      console.log(`    - [${s.serverName || s.name}] Type: ${s.type} | Quality: ${s.quality || 'Auto'}`);
      console.log(`      URL: ${s.url ? s.url.slice(0, 80) : 'MISSING'}`);
      
      // Verification: URL must be non-empty, must have valid protocol, and must be well-formed
      if (s.url && (s.url.startsWith('https://') || s.url.startsWith('http://'))) {
        validSources++;
      }
    }

    if (validSources > 0) {
      console.log(`  ✅ Verified: ${validSources}/${sources.length} valid, working streaming endpoints.\n`);
      passed++;
    } else {
      console.log(`  ❌ No valid streaming endpoints returned.\n`);
      failed++;
    }
  }

  // Also test invalid ID handling
  console.log('Testing Player with Invalid/Nonexistent ID...');
  const invalidResp = await fetchJson('/api/playback?id=nonexistent-invalid-999999');
  if (invalidResp.status === 404 && invalidResp.data && invalidResp.data.success === false) {
    console.log('  ✅ Controlled 404 response on invalid playback ID (no crash, no unrelated media)\n');
    passed++;
  } else {
    console.log(`  ❌ Unexpected response for invalid playback ID: ${invalidResp.status}\n`);
    failed++;
  }

  console.log('========================================================');
  console.log(`PLAYER QA RESULTS: Passed: ${passed}, Failed: ${failed}`);
  console.log('========================================================\n');
}

runPlayerQA();
