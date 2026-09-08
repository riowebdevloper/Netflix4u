const https = require('https');

function searchYouTube(query) {
  return new Promise(resolve => {
    const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const match = d.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
        if (match) {
          resolve('https://www.youtube.com/embed/' + match[1]);
        } else {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

searchYouTube('Gandhari Netflix official trailer').then(url => console.log('Resolved YouTube URL for Gandhari:', url));
