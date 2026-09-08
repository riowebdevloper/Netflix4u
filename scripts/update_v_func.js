const fs = require('fs');
const files = ['js/DetailPage-WPhzSGyt.js', 'assets/DetailPage-WPhzSGyt.js'];
for (const file of files) {
  let code = fs.readFileSync(file, 'utf8');
  const target = 'V=()=>{const t=i||s,m=!!i;if(c==="hicine"){const cl=(Y_links||[]).find(l=>l.isCloud)||(Y_links||[])[0];if(cl)return cl.url;}switch(c){case"vidlink":return H(h,s,o,r);case"vidsrcme":return h?m?`https://vidsrc.me/embed/tv?imdb=${t}&season=${o}&episode=${r}`:`https://vidsrc.me/embed/tv?tmdb=${t}&season=${o}&episode=${r}`:m?`https://vidsrc.me/embed/movie?imdb=${t}`:`https://vidsrc.me/embed/movie?tmdb=${t}`;case"vidsrcxyz":return h?m?`https://vidsrc.xyz/embed/tv?imdb=${t}&season=${o}&episode=${r}`:`https://vidsrc.xyz/embed/tv?tmdb=${t}&season=${o}&episode=${r}`:m?`https://vidsrc.xyz/embed/movie?imdb=${t}`:`https://vidsrc.xyz/embed/movie?tmdb=${t}`;default:return H(h,s,o,r)}}';
  const repl = 'V=()=>{const t=tmdb||i||s,m=!tmdb&&!!i;if(c==="hicine"){const cl=(Y_links||[]).find(l=>/1080/i.test(l.quality))||(Y_links||[]).find(l=>/720|HD/i.test(l.quality))||(Y_links||[]).find(l=>l.isCloud)||(Y_links||[])[0];if(cl)return cl.url;}switch(c){case"vidlink":return H(h,tmdb||s,o,r);case"vidsrcme":return h?m?`https://vidsrc.me/embed/tv?imdb=${t}&season=${o}&episode=${r}`:`https://vidsrc.me/embed/tv?tmdb=${t}&season=${o}&episode=${r}`:m?`https://vidsrc.me/embed/movie?imdb=${t}`:`https://vidsrc.me/embed/movie?tmdb=${t}`;case"vidsrcxyz":return h?m?`https://vidsrc.xyz/embed/tv?imdb=${t}&season=${o}&episode=${r}`:`https://vidsrc.xyz/embed/tv?tmdb=${t}&season=${o}&episode=${r}`:m?`https://vidsrc.xyz/embed/movie?imdb=${t}`:`https://vidsrc.xyz/embed/movie?tmdb=${t}`;default:return H(h,tmdb||s,o,r)}}';
  if (code.includes(target)) {
    code = code.replace(target, repl);
    fs.writeFileSync(file, code, 'utf8');
    console.log('Successfully updated V() in', file);
  } else {
    console.error('Failed to find target in', file);
  }
}
