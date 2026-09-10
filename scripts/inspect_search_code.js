const fs = require('fs');
const content = fs.readFileSync('js/index-CQL8lqua.js', 'utf8');
const exportPart = content.slice(-500);
console.log('Export part:', exportPart);

// Find what is exported as 'v'
const match = exportPart.match(/(\w+)\s+as\s+v/);
if (match) {
  const funcName = match[1];
  console.log('Function exported as v is:', funcName);

  // Find definition of this function
  const defRegex = new RegExp('(?:const|let|var|function|async function)\\s+' + funcName + '\\s*=[^;]+;', 'g');
  const m = content.match(defRegex);
  if (m) {
    console.log('Definition:', m[0]);
  } else {
    const idx = content.indexOf(funcName);
    console.log('First occurrences:');
    let p = 0;
    while ((p = content.indexOf(funcName, p)) !== -1) {
      console.log('--- at', p, '---');
      console.log(content.slice(Math.max(0, p - 50), p + 250));
      p += funcName.length + 1;
      if (p > 50000) break;
    }
  }
}
