const fs = require('fs');
const path = require('path');

// 1. Fix css/index-usTMTSwH.css
const cssPath = path.join(__dirname, '..', 'css', 'index-usTMTSwH.css');
let css = fs.readFileSync(cssPath, 'utf8');

// Replace base body overflow
css = css.replace(
  'overscroll-behavior-y:none;overflow-x:hidden',
  'overscroll-behavior-y:auto;overflow-x:clip'
);

// Replace FLIXWORLD-ALL-DEVICES-RESPONSIVE-RULES
const badRule = `html, body {
  max-width: 100vw !important;
  overflow-x: hidden !important;
  -webkit-text-size-adjust: 100%;
  -webkit-font-smoothing: antialiased;
  touch-action: manipulation;
}`;

const goodRule = `html {
  overflow-x: clip !important;
  overflow-y: auto !important;
  scroll-behavior: smooth;
}
body {
  max-width: 100% !important;
  overflow-x: clip !important;
  overflow-y: visible !important;
  overscroll-behavior-y: auto !important;
  touch-action: pan-y !important;
  -webkit-text-size-adjust: 100%;
  -webkit-font-smoothing: antialiased;
}`;

css = css.replace(badRule, goodRule);
fs.writeFileSync(cssPath, css, 'utf8');
console.log('✅ Updated css/index-usTMTSwH.css with overflow-x: clip and touch-action: pan-y');

// 2. Fix index.html with inline style guarantee
const htmlPath = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const scrollStyle = `
    <!-- Global Ultra-Smooth Scroll Guarantee -->
    <style>
      html {
        overflow-x: clip !important;
        overflow-y: auto !important;
        scroll-behavior: smooth !important;
        height: auto !important;
      }
      body {
        max-width: 100% !important;
        min-height: 100vh !important;
        height: auto !important;
        overflow-x: clip !important;
        overflow-y: visible !important;
        overscroll-behavior-y: auto !important;
        touch-action: pan-y !important;
      }
      #root {
        min-height: 100vh !important;
        width: 100% !important;
        overflow: visible !important;
      }
    </style>
  </head>`;

if (!html.includes('Global Ultra-Smooth Scroll Guarantee')) {
  html = html.replace('</head>', scrollStyle);
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('✅ Updated index.html with global scroll style guarantee');
}

// 3. Fix HomePage-mNJ_gjp9.js in both js/ and assets/
const homePageFiles = [
  path.join(__dirname, '..', 'js', 'HomePage-mNJ_gjp9.js'),
  path.join(__dirname, '..', 'assets', 'HomePage-mNJ_gjp9.js')
];

const targetPattern = 'c.useEffect(()=>{(async()=>{d(!0);const[i,h,x,p,T,v,S,w,R,M]=await Promise.all([ne(),ie(),ce(),de(),me(),xe(),he(),pe(),ue(),fe()]);l({featured:i,trending:h,movies:x,series:p,anime:T,kdrama:v,topRated:S,recentlyAdded:w,popularMovies:R,popularSeries:M}),d(!1)})()},[])';

const robustPattern = 'c.useEffect(()=>{(async()=>{try{d(!0);const[i,h,x,p,T,v,S,w,R,M]=await Promise.all([ne(),ie(),ce(),de(),me(),xe(),he(),pe(),ue(),fe()]);l({featured:i,trending:h,movies:x,series:p,anime:T,kdrama:v,topRated:S,recentlyAdded:w,popularMovies:R,popularSeries:M})}catch(e){console.error("Home feed load failed:",e)}finally{d(!1)}})()},[])';

for (const hpFile of homePageFiles) {
  if (fs.existsSync(hpFile)) {
    let code = fs.readFileSync(hpFile, 'utf8');
    if (code.includes(targetPattern)) {
      code = code.replace(targetPattern, robustPattern);
      fs.writeFileSync(hpFile, code, 'utf8');
      console.log('✅ Updated HomePage with robust try/finally in:', hpFile);
    } else {
      console.log('⚠️ Target pattern not found in:', hpFile);
    }
  }
}
