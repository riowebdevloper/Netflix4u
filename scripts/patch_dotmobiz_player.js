const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.resolve(__dirname, '..', 'js', 'DetailPage-WPhzSGyt.js'),
  path.resolve(__dirname, '..', 'assets', 'DetailPage-WPhzSGyt.js')
];

for (const filePath of targetFiles) {
  if (!fs.existsSync(filePath)) continue;
  let code = fs.readFileSync(filePath, 'utf8');

  // 1. Check if switch(c) has allmovieland
  const oldSwitch = 'switch(c){case"vidlink":';
  const newSwitch = 'if(c==="allmovieland"&&i)return"https://slast430did.com/play/"+i;switch(c){case"allmovieland":return i?"https://slast430did.com/play/"+i:H(h,tmdb||s,o,r);case"vidlink":';

  if (code.includes(oldSwitch)) {
    code = code.replace(oldSwitch, newSwitch);
    console.log(`[${path.basename(filePath)}] Injected allmovieland into switch(c).`);
  } else if (code.includes('case"allmovieland":')) {
    console.log(`[${path.basename(filePath)}] Already has allmovieland in switch(c).`);
  }

  fs.writeFileSync(filePath, code, 'utf8');
}

console.log('✅ AllMovieLand switch statement patched.');
