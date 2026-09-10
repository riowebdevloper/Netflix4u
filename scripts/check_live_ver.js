const https = require('https');

https.get('https://www.netflix4u.in/', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const has320 = d.includes('3.2.0');
    console.log('Includes 3.2.0:', has320);
    const m = d.match(/site-quality\.js\?v=([^"]+)/);
    console.log('Live site-quality version:', m ? m[1] : 'not found');
  });
});
