const http = require('http');

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(d), headers: res.headers });
        } catch(e) {
          resolve({ status: res.statusCode, raw: d, headers: res.headers });
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('🧪 Starting Cast & Downloads Validation Suite...\n');
  let passed = 0;
  let total = 5;

  // 1. Test Movie Cast
  try {
    const res = await get('http://localhost:4173/api/details/18025');
    if (res.status === 200 && res.data.data && Array.isArray(res.data.data.cast) && res.data.data.cast.length > 0) {
      console.log(`✅ [1/5] Movie Cast Resolved: ${res.data.data.title} (${res.data.data.cast.length} actors)`);
      passed++;
    } else {
      console.error('❌ [1/5] Movie cast failed:', res.status, res.data);
    }
  } catch(e) {
    console.error('❌ [1/5] Error:', e.message);
  }

  // 2. Test Series Cast
  try {
    const res = await get('http://localhost:4173/api/details/301134');
    if (res.status === 200 && res.data.data && Array.isArray(res.data.data.cast) && res.data.data.cast.length > 0) {
      console.log(`✅ [2/5] Series Cast Resolved: ${res.data.data.title} (${res.data.data.cast.length} actors)`);
      passed++;
    } else {
      console.error('❌ [2/5] Series cast failed:', res.status, res.data);
    }
  } catch(e) {
    console.error('❌ [2/5] Error:', e.message);
  }

  // 3. Test Static Details Cast
  try {
    const res = await get('http://localhost:4173/data/details/18025.json');
    if (res.status === 200 && Array.isArray(res.data.cast) && res.data.cast.length > 0) {
      console.log(`✅ [3/5] Static Details Cast: ${res.data.title} (${res.data.cast.length} actors)`);
      passed++;
    } else {
      console.error('❌ [3/5] Static details cast failed:', res.status);
    }
  } catch(e) {
    console.error('❌ [3/5] Error:', e.message);
  }

  // 4. Test Image Proxy
  try {
    const imgUrl = encodeURIComponent('https://image.tmdb.org/t/p/w185/43e24aeOC8AZITo6ShaKKG9aV0Y.jpg');
    const res = await get(`http://localhost:4173/api/image-proxy?url=${imgUrl}`);
    if (res.status === 200 && res.headers['content-type']?.includes('image')) {
      console.log(`✅ [4/5] Image Proxy Working: 200 OK (${res.headers['content-type']})`);
      passed++;
    } else {
      console.error('❌ [4/5] Image proxy failed:', res.status, res.headers);
    }
  } catch(e) {
    console.error('❌ [4/5] Error:', e.message);
  }

  // 5. Test Hicine Download Link Resolver
  try {
    const vcloudUrl = encodeURIComponent('https://crimson-sea-a1e5.hekoy.workers.dev/?vcloud=https://vcloud.fit/kfkzkrlqpmhpk2l');
    const res = await new Promise(resolve => {
      http.get(`http://localhost:4173/api/download/hicine?vcloud=${vcloudUrl}`, r => {
        resolve({ status: r.statusCode, location: r.headers.location });
      });
    });
    if (res.status === 302 && res.location && (res.location.includes('pixeldrain') || res.location.includes('vcloud'))) {
      console.log(`✅ [5/5] Hicine Fast Cloud 302 Redirect: -> ${res.location}`);
      passed++;
    } else {
      console.error('❌ [5/5] Hicine download resolver failed:', res.status, res.location);
    }
  } catch(e) {
    console.error('❌ [5/5] Error:', e.message);
  }

  console.log(`\n========================================`);
  console.log(`RESULT: ${passed}/${total} Tests Passed!`);
  console.log(`========================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

run();
