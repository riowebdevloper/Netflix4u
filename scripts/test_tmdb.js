const https = require('https');
const key = '445f2b5a8941c1d4bd5a869761a916e3';

async function testTitle(query, type = 'movie') {
  console.log('\n--- Testing TMDB for:', query, '---');
  return new Promise(resolve => {
    const searchUrl = `https://api.tmdb.org/3/search/${type}?api_key=${key}&query=${encodeURIComponent(query)}`;
    https.get(searchUrl, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => {
        const json = JSON.parse(d);
        console.log('Results count:', json.results ? json.results.length : 0);
        if (json.results && json.results[0]) {
          const first = json.results[0];
          console.log('First result:', first.id, first.title || first.name, first.release_date || first.first_air_date);
          
          // Get videos
          const vidUrl = `https://api.tmdb.org/3/${type}/${first.id}/videos?api_key=${key}`;
          https.get(vidUrl, vres => {
            let vd = ''; vres.on('data', c => vd += c);
            vres.on('end', () => {
              const vjson = JSON.parse(vd);
              console.log('Videos found:', vjson.results ? vjson.results.map(v => ({ name: v.name, type: v.type, site: v.site, key: v.key })) : []);
              resolve();
            });
          });
        } else {
          resolve();
        }
      });
    });
  });
}

async function run() {
  await testTitle('Gandhari');
  await testTitle('Avengers Endgame');
  await testTitle('Thukra Ke Mera Pyaar', 'tv');
}
run();
