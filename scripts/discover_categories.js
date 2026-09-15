const https = require('https');

function get(id) {
  return new Promise(r => {
    https.get('https://api2.imdb3.shop/api/tranding?id=' + id + '&items_per_page=5&cache=home&page=0', { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        try {
          const j = JSON.parse(d);
          if (j?.results?.length > 0) {
            r({ id, title: j.results[0].info || j.results[0].title, count: j.results.length, sample: j.results[0].title });
          } else { r(null); }
        } catch(e) { r(null); }
      });
    }).on('error', () => r(null));
  });
}

async function run() {
  const ids = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,50,58,60,61];
  for (const id of ids) {
    const res = await get(id);
    if (res) console.log(JSON.stringify(res));
  }
}
run();
