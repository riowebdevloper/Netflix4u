const https = require('https');

const options = {
  hostname: 'api2.imdb3.shop',
  path: '/api/tranding?id=14&items_per_page=5&cache=home&page=0',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Origin': 'https://netmirror.global',
    'Referer': 'https://netmirror.global/'
  }
};

https.get(options, res => {
  console.log('Status:', res.statusCode);
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Length:', d.length);
    try {
      const j = JSON.parse(d);
      console.log('Results:', j.results?.length, 'First:', j.results?.[0]?.title);
    } catch(e) {
      console.log('Error parsing:', e.message);
    }
  });
}).on('error', e => console.error('Req error:', e.message));
