const fs = require('fs');
const files = ['js/index-CQL8lqua.js', 'assets/index-CQL8lqua.js'];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');

  // 1. Ensure item.tmdbId is copied to mapped in Kg
  const oldKgMap = 'const mapped = mapHicineItem(item, v);\n      if (!mapped.trailerUrl) {';
  const newKgMap = 'const mapped = mapHicineItem(item, v);\n      if (item.tmdbId) mapped.tmdbId = item.tmdbId;\n      if (!mapped.trailerUrl) {';
  if (code.includes(oldKgMap)) {
    code = code.replace(oldKgMap, newKgMap);
    console.log('Added tmdbId copy to Kg in', file);
  } else {
    // Check single line version
    const altOld = 'const mapped = mapHicineItem(item, v); if (!mapped.trailerUrl) {';
    const altNew = 'const mapped = mapHicineItem(item, v); if (item.tmdbId) mapped.tmdbId = item.tmdbId; if (!mapped.trailerUrl) {';
    if (code.includes(altOld)) {
      code = code.replace(altOld, altNew);
      console.log('Added tmdbId copy (single line) to Kg in', file);
    } else {
      console.warn('Could not find oldKgMap in', file);
    }
  }

  // 2. Remove broken listType=search fallback in getTrailerForTitle
  const oldTrailerFallback = 'return "https://www.youtube.com/embed?listType=search&list=" + encodeURIComponent(clean + " official trailer");';
  const newTrailerFallback = 'return "";';
  if (code.includes(oldTrailerFallback)) {
    code = code.replace(oldTrailerFallback, newTrailerFallback);
    console.log('Removed broken listType=search fallback in', file);
  } else {
    console.warn('Could not find oldTrailerFallback in', file);
  }

  fs.writeFileSync(file, code, 'utf8');
}
console.log('✅ index-CQL8lqua.js patches complete.');
