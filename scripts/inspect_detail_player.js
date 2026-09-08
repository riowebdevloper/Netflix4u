const fs = require('fs');

const s = fs.readFileSync('js/DetailPage-WPhzSGyt.js', 'utf8');

// 1. Back button context
const backIdx = s.indexOf('Go back');
if (backIdx !== -1) {
  console.log('=== BACK BUTTON CONTEXT ===');
  console.log(s.slice(backIdx - 350, backIdx + 350));
}

// 2. Video Player context (search for #player, iframe, trailer, etc.)
const playerIdx = s.indexOf('id:"player"');
if (playerIdx !== -1) {
  console.log('=== PLAYER CONTEXT ===');
  console.log(s.slice(playerIdx - 300, playerIdx + 1200));
} else {
  console.log('id:"player" not found, searching for iframe');
  const ifIdx = s.indexOf('iframe');
  if (ifIdx !== -1) console.log(s.slice(ifIdx - 200, ifIdx + 500));
}

// 3. Trailer context
const trIdx = s.indexOf('trailerUrl');
if (trIdx !== -1) {
  console.log('=== TRAILER CONTEXT ===');
  console.log(s.slice(trIdx - 200, trIdx + 500));
}
