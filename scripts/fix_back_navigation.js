const fs = require('fs');

// 1. Update index.html with global CSS ensuring Back button has z-index 9999 and pointer-events: auto
let html = fs.readFileSync('index.html', 'utf8');
const cssRule = `
      /* Back navigation button clickability & top layering */
      .back-btn-container, [aria-label="Go back"] {
        z-index: 9999 !important;
        pointer-events: auto !important;
        cursor: pointer !important;
      }
      .back-btn-container {
        position: absolute !important;
      }
`;

if (!html.includes('back-btn-container')) {
  html = html.replace('</style>', cssRule + '\n    </style>');
  fs.writeFileSync('index.html', html);
  console.log('✅ Added back button CSS to index.html');
}

// 2. Patch DetailPage in both js/ and assets/
const files = ['js/DetailPage-WPhzSGyt.js', 'assets/DetailPage-WPhzSGyt.js'];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let c = fs.readFileSync(file, 'utf8');

  // Search for the wrapper around "Go back"
  // It starts with e.jsx("div",{className:"absolute top-20 left-4 lg:left-8
  const pattern = /e\.jsx\("div",\{className:"absolute top-20 left-4 lg:left-8[^}]+z-30",children:e\.jsxs\([a-zA-Z0-9_$]+,\{[^}]+"aria-label":"Go back",children:\[e\.jsx\([a-zA-Z0-9_$]+,\{className:"w-4 h-4"\}\)," Back"\]\}\)\}\)/;

  const replacement = 'e.jsx("div",{className:"absolute top-20 left-4 lg:left-8 back-btn-container",style:{zIndex:9999,position:"absolute"},children:e.jsxs("a",{href:"/",onClick:ev=>{ev.preventDefault();ev.stopPropagation();if(window.history.state&&typeof window.history.state.idx==="number"&&window.history.state.idx>0){window.history.back()}else if(window.history.length>1&&document.referrer&&document.referrer.includes(window.location.host)){window.history.back()}else{window.location.href="/"}},className:"btn-secondary shadow-xl cursor-pointer no-underline back-btn-wrapper",style:{zIndex:9999,position:"relative",pointerEvents:"auto"},"aria-label":"Go back",children:[e.jsx(T,{className:"w-4 h-4"})," Back"]})})';

  if (pattern.test(c)) {
    c = c.replace(pattern, replacement);
    fs.writeFileSync(file, c);
    console.log('✅ Patched Back button in', file);
  } else {
    // Try simpler replace if pattern didn't match
    const simpleIdx = c.indexOf('"aria-label":"Go back"');
    if (simpleIdx !== -1) {
      console.log('Found aria-label at', simpleIdx);
      const startDiv = c.lastIndexOf('e.jsx("div",{className:"absolute top-20', simpleIdx);
      const endDiv = c.indexOf('})})', simpleIdx) + 4;
      if (startDiv !== -1 && endDiv !== -1) {
        c = c.slice(0, startDiv) + replacement + c.slice(endDiv);
        fs.writeFileSync(file, c);
        console.log('✅ Replaced using slice in', file);
      }
    }
  }
});
