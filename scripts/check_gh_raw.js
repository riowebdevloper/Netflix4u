const https = require('https');

https.get('https://raw.githubusercontent.com/riowebdevloper/Netflix4u/main/index.html', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('GitHub Raw status:', res.statusCode);
    console.log('GitHub Raw includes 3.2.0:', d.includes('3.2.0'));
    const m = d.match(/site-quality\.js\?v=([^"']+)/);
    console.log('GitHub Raw site-quality version:', m ? m[1] : 'not found');
  });
});
