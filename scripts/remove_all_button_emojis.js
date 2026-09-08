const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function patchFile(relPath, replacements) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`[Skip] File not found: ${relPath}`);
    return;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  let changed = false;

  for (const [target, replacement] of replacements) {
    if (content.includes(target)) {
      content = content.split(target).join(replacement);
      changed = true;
      console.log(`[Patched] in ${relPath}: "${target.slice(0, 30)}..." -> "${replacement.slice(0, 30)}..."`);
    } else {
      console.warn(`[NotFound] in ${relPath}: "${target.slice(0, 30)}..."`);
    }
  }

  if (changed) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Saved ${relPath}`);
  }
}

// 1. DetailPage: Remove emojis from server buttons, download buttons, headers
const detailPageReplacements = [
  ['label:"🎬 AllMovieLand"', 'label:"AllMovieLand"'],
  ['label:"⚡ Fast Cloud"', 'label:"Fast Cloud"'],
  [' ⚡ Download (', ' Download ('],
  ['" ⚡ Download Links"', '"Download Links"'],
  ['children:"⚡ Direct High-Speed Download Links"', 'children:"Direct High-Speed Download Links"'],
  ['children:"⚡ Fast Cloud Direct Links"', 'children:"Fast Cloud Direct Links"'],
  ['children:"📥 Multi Quality Downloads"', 'children:"Multi Quality Downloads"'],
  ['settings gear (⚙️)', 'settings gear']
];

patchFile('js/DetailPage-WPhzSGyt.js', detailPageReplacements);
patchFile('assets/DetailPage-WPhzSGyt.js', detailPageReplacements);

// 2. Index / Header / Navbar: Remove emojis from category pills & auth buttons
const indexReplacements = [
  ['emoji:"🔥"', 'emoji:""'],
  ['emoji:"🪔"', 'emoji:""'],
  ['emoji:"🌴"', 'emoji:""'],
  ['emoji:"⚡"', 'emoji:""'],
  ['emoji:"🍿"', 'emoji:""'],
  ['emoji:"🎬"', 'emoji:""'],
  ['emoji:"📺"', 'emoji:""'],
  ['emoji:"💖"', 'emoji:""'],
  ['emoji:"⚔️"', 'emoji:""'],
  ['emoji:"🎭"', 'emoji:""'],
  // In eg.map: remove the emoji span element
  [
    'children:[o.jsx("span",{className:"text-sm",children:J.emoji}),o.jsx("span",{children:J.label})]',
    'children:o.jsx("span",{children:J.label})'
  ],
  // In drawer/modal auth buttons:
  [
    'children:[o.jsx("span",{className:"text-base",children:"🚪"}),o.jsx("span",{children:"Sign Out"})]',
    'children:o.jsx("span",{children:"Sign Out"})'
  ],
  [
    'children:[o.jsx("span",{className:"text-base",children:"🔑"}),o.jsx("span",{children:"Sign In / Join VIP"})]',
    'children:o.jsx("span",{children:"Sign In / Join VIP"})'
  ]
];

patchFile('js/index-CQL8lqua.js', indexReplacements);
patchFile('assets/index-CQL8lqua.js', indexReplacements);

// 3. GenresPage: Remove emojis from genre buttons
const genresReplacements = [
  ['children:[e.jsx("span",{children:"🎬"})," All"]', 'children:"All"'],
  ['children:[e.jsx("span",{children:a.emoji}),r]', 'children:r']
];

patchFile('js/GenresPage-CUYl4f4q.js', genresReplacements);
patchFile('assets/GenresPage-CUYl4f4q.js', genresReplacements);

// 4. HomePage: Remove emojis from Hero tags
const homeReplacements = [
  ['children:[e.jsx("span",{children:"✨"})," NEW RELEASE"]', 'children:"NEW RELEASE"']
];

patchFile('js/HomePage-mNJ_gjp9.js', homeReplacements);
patchFile('assets/HomePage-mNJ_gjp9.js', homeReplacements);

// 5. hicine-modal.js: Remove emojis from server switcher and modal
const modalReplacements = [
  ['⚡ AllMovieLand (Hindi Audio)', 'AllMovieLand (Hindi Audio)'],
  ['🎬 Fast Cloud', 'Fast Cloud'],
  ['🌐 VidLink Multi-Lang', 'VidLink Multi-Lang'],
  ['📡 VidSrc Pro', 'VidSrc Pro'],
  ['⚡ Hicine Fast Cloud Mirrors (Fast)', 'Hicine Fast Cloud Mirrors (Fast)'],
  ['📥 DotMovies Direct Links (NexDrive)', 'DotMovies Direct Links (NexDrive)'],
  ['<h3>🎬 Servers Ready</h3>', '<h3>Servers Ready</h3>'],
  ['settings gear (⚙️)', 'settings gear']
];

patchFile('js/hicine-modal.js', modalReplacements);
if (fs.existsSync(path.join(ROOT, 'assets', 'hicine-modal.js'))) {
  patchFile('assets/hicine-modal.js', modalReplacements);
}

console.log('🎉 Emoji strip complete across all clickable buttons!');
