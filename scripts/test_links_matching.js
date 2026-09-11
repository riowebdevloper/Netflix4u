const fs = require('fs');
const path = require('path');

const dMap = JSON.parse(fs.readFileSync('data/details_map.json', 'utf8'));
const titleIndex = new Map();
let totalLinks = 0;

for (const [k, v] of Object.entries(dMap)) {
  if (v && v.title && Array.isArray(v.links) && v.links.length > 0) {
    totalLinks += v.links.length;
    const clean = v.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!titleIndex.has(clean)) {
      titleIndex.set(clean, v);
    }
  }
}

console.log('Total entries in details_map with valid links:', titleIndex.size);
console.log('Total link items:', totalLinks);

const testQueries = ['stree2', 'pushpa2', 'toxic', 'thepitt', 'squidgame', 'mirzapur', 'moneyheist', 'sandman'];
for (const q of testQueries) {
  const match = titleIndex.get(q) || Array.from(titleIndex.entries()).find(([k]) => k.includes(q))?.[1];
  console.log(`Query "${q}": found?`, !!match, match ? `(${match.title}, ${match.links.length} links)` : '');
}
