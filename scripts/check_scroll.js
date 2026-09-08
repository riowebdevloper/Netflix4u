const fs = require('fs');
const path = require('path');

const jsDir = path.join(__dirname, '..', 'js');
fs.readdirSync(jsDir).forEach(f => {
  if (f.endsWith('.js') && !f.endsWith('.bak')) {
    const c = fs.readFileSync(path.join(jsDir, f), 'utf8');
    
    // check style.overflow
    const overflowMatches = c.match(/overflow[^;,\{\}\(\)]{0,50}/gi);
    const theaterMatches = c.match(/theater[^;,\{\}\(\)]{0,50}/gi);
    const fixedInset = c.match(/fixed\s+inset-0[^"]*/gi);
    
    if (theaterMatches || overflowMatches || fixedInset) {
      console.log('=== File:', f, '===');
      if (theaterMatches) console.log('  Theater:', theaterMatches.slice(0, 5));
      if (fixedInset) console.log('  Fixed inset-0:', fixedInset.slice(0, 5));
      const bodyOverflow = c.match(/body[^{]*\{[^}]*overflow[^}]*\}/gi);
      if (bodyOverflow) console.log('  Body overflow:', bodyOverflow);
      // check wheel and touch listeners
      const listenerMatches = c.match(/addEventListener\(['"](wheel|touchmove|scroll|keydown|pointerdown)['"][^)]+\)/gi);
      if (listenerMatches) {
        console.log('  Event listeners in ' + f + ':', listenerMatches);
      }
      
      // check preventDefault
      const preventMatches = c.match(/[a-zA-Z0-9_$.]+\.preventDefault\(\)/gi);
      if (preventMatches && f.includes('HomePage')) {
        console.log('  preventDefault in ' + f + ':', preventMatches.length);
      }
    }
  }
});
