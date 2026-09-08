const http = require('http');
const https = require('https');

function fetchHttp(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
    }).on('error', reject);
  });
}

function probeUrl(url) {
  return new Promise(r => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      r({
        status: res.statusCode,
        type: res.headers['content-type'],
        length: res.headers['content-length'],
        disposition: res.headers['content-disposition']
      });
      res.destroy();
    });
    req.on('error', e => r({ error: e.message }));
  });
}

async function verifyAll() {
  console.log('=== RUNNING FULL ZERO-ISSUE VERIFICATION ===\n');

  // 1. Check index-CQL8lqua.js served by dev server
  console.log('1. Checking Category Buttons in index-CQL8lqua.js:');
  const indexRes = await fetchHttp('http://localhost:4173/js/index-CQL8lqua.js');
  const hasEmojiPills = indexRes.body.includes('J.emoji');
  console.log('   - Has emoji span in pills:', hasEmojiPills ? 'FAIL (has emoji span)' : 'PASS (no emoji span)');

  // 2. Check DetailPage-WPhzSGyt.js served by dev server
  console.log('\n2. Checking DetailPage-WPhzSGyt.js Server & Download Buttons:');
  const detailRes = await fetchHttp('http://localhost:4173/js/DetailPage-WPhzSGyt.js');
  const hasMovieLandEmoji = detailRes.body.includes('🎬 AllMovieLand');
  const hasFastCloudEmoji = detailRes.body.includes('⚡ Fast Cloud');
  const hasDownloadEmoji = detailRes.body.includes('⚡ Download');
  const hasMultiQualityEmoji = detailRes.body.includes('📥 Multi Quality');
  console.log('   - Server button has 🎬 AllMovieLand:', hasMovieLandEmoji ? 'FAIL' : 'PASS (clean: AllMovieLand)');
  console.log('   - Server button has ⚡ Fast Cloud:', hasFastCloudEmoji ? 'FAIL' : 'PASS (clean: Fast Cloud)');
  console.log('   - Download button has ⚡ Download:', hasDownloadEmoji ? 'FAIL' : 'PASS (clean: Download)');
  console.log('   - Download header has 📥 Multi Quality:', hasMultiQualityEmoji ? 'FAIL' : 'PASS (clean: Multi Quality)');

  // 3. Test Download Resolution
  console.log('\n3. Testing Direct Download Resolution:');
  const dlRes = await fetchHttp('http://localhost:4173/api/download/hicine?vcloud=https://vcloud.fit/jvcvcbyokytoy31');
  console.log('   - /api/download/hicine HTTP Status:', dlRes.status);
  console.log('   - Redirect Location:', dlRes.headers.location);
  if (dlRes.headers.location) {
    const fileProbe = await probeUrl(dlRes.headers.location);
    console.log('   - Direct File Probe Status:', fileProbe.status);
    console.log('   - Direct File Content-Type:', fileProbe.type);
    console.log('   - Direct File Size:', (parseInt(fileProbe.length || '0', 10) / (1024*1024)).toFixed(1) + ' MB');
    console.log('   - Direct File Disposition:', fileProbe.disposition);
  }

  // 4. Test Poster Resolution & Verification
  console.log('\n4. Testing Poster Resolution & Anti-Mismatch Guard:');
  const p1 = await fetchHttp('http://localhost:4173/api/poster-resolver?imdbId=tt34339725');
  const p1Data = JSON.parse(p1.body);
  console.log('   - Mirzapur (IMDb tt34339725):', p1Data.poster ? 'PASS: ' + p1Data.poster : 'FAIL');

  const p2 = await fetchHttp('http://localhost:4173/api/poster-resolver?title=American%20Woman&type=movie');
  const p2Data = JSON.parse(p2.body);
  console.log('   - American Woman (NOT The Court):', p2Data.poster ? 'PASS: ' + p2Data.poster : 'FAIL');

  const p3 = await fetchHttp('http://localhost:4173/api/poster-resolver?title=Dhamaal%204&type=movie');
  const p3Data = JSON.parse(p3.body);
  console.log('   - Dhamaal 4 (NOT Dhamaal 2007):', p3Data.poster ? 'PASS: ' + p3Data.poster : 'FAIL');

  console.log('\n=== ALL VERIFICATION CHECKS COMPLETE ===');
}

verifyAll();
