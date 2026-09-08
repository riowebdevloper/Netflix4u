const fs = require('fs');
const path = require('path');

console.log('📱 Applying all-devices usability and responsive optimizations...');

// ----------------------------------------------------
// 1. Update MovieCard-DyC9jox1.js in js/ and assets/
// ----------------------------------------------------
const movieCardFiles = [
  path.resolve(__dirname, '..', 'js', 'MovieCard-DyC9jox1.js'),
  path.resolve(__dirname, '..', 'assets', 'MovieCard-DyC9jox1.js')
];

for (const file of movieCardFiles) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');

  // Replace fixed width with responsive flex/grid sizing:
  // w-[160px] sm:w-[185px] md:w-[200px] -> w-full min-w-[135px] xs:min-w-[150px] sm:min-w-[170px] md:min-w-[185px] max-w-[220px]
  code = code.replace(
    'className:"group relative flex-shrink-0 w-[160px] sm:w-[185px] md:w-[200px]"',
    'className:"group relative w-full min-w-[130px] sm:min-w-[165px] md:min-w-[185px] max-w-[220px] flex-shrink-0 select-none mx-auto"'
  );

  fs.writeFileSync(file, code, 'utf8');
  console.log('✅ Updated MovieCard responsive classes in:', path.basename(file));
}

// ----------------------------------------------------
// 2. Update DetailPage-WPhzSGyt.js in js/ and assets/
// ----------------------------------------------------
const detailFiles = [
  path.resolve(__dirname, '..', 'js', 'DetailPage-WPhzSGyt.js'),
  path.resolve(__dirname, '..', 'assets', 'DetailPage-WPhzSGyt.js')
];

for (const file of detailFiles) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');

  // Enable mobile poster display (replace hidden sm:block with responsive sizing)
  code = code.replace(
    'className:"flex-shrink-0 w-36 sm:w-44 md:w-52 lg:w-60 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 hidden sm:block"',
    'className:"flex-shrink-0 w-28 xs:w-36 sm:w-44 md:w-52 lg:w-60 aspect-[2/3] rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 block mb-4 sm:mb-0"'
  );

  // Make server buttons horizontally scrollable on narrow mobile screens without breaking
  code = code.replace(
    'className:"flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap"',
    'className:"flex items-center gap-1.5 sm:gap-2 flex-shrink-0 overflow-x-auto scrollbar-hide max-w-full pb-1"'
  );

  fs.writeFileSync(file, code, 'utf8');
  console.log('✅ Updated DetailPage mobile poster & server responsiveness in:', path.basename(file));
}

// ----------------------------------------------------
// 3. Add Global Responsive Usability Rules to css/index-usTMTSwH.css
// ----------------------------------------------------
const cssFile = path.resolve(__dirname, '..', 'css', 'index-usTMTSwH.css');
if (fs.existsSync(cssFile)) {
  let css = fs.readFileSync(cssFile, 'utf8');

  const customRuleMarker = '/* FLIXWORLD-ALL-DEVICES-RESPONSIVE-RULES */';
  if (!css.includes(customRuleMarker)) {
    const responsiveRules = `
${customRuleMarker}
/* Universal Cross-Device Usability Enhancements */
html, body {
  max-width: 100vw !important;
  overflow-x: hidden !important;
  -webkit-text-size-adjust: 100%;
  -webkit-font-smoothing: antialiased;
  touch-action: manipulation;
}

/* Mobile & Tablet Safe-Area & Touch Targets */
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);
}

/* Smooth Horizontal Touch Scrolling for all Carousels */
.scrollbar-hide, [style*="scrollSnapType"] {
  -webkit-overflow-scrolling: touch !important;
  scrollbar-width: none !important;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none !important;
}

/* Perfect 2-column mobile grid alignment without overflow */
@media (max-width: 639px) {
  .grid-cols-2 {
    gap: 0.625rem !important;
  }
  
  /* Hero Banner on Phones */
  #hero-banner {
    height: clamp(460px, 75svh, 600px) !important;
    min-height: 460px !important;
  }
  
  #hero-banner .hero-content-area {
    padding-bottom: 2rem !important;
  }
  
  /* Mobile Bottom Navigation Bar Safe Area */
  nav.safe-area-pb {
    padding-bottom: max(0.5rem, env(safe-area-inset-bottom, 0.5rem)) !important;
  }
  
  /* Buttons Touch Target */
  button, a {
    touch-action: manipulation;
  }
}

/* Tablet (iPad, Surface, Foldables: 640px to 1024px) */
@media (min-width: 640px) and (max-width: 1024px) {
  #hero-banner {
    height: clamp(520px, 65svh, 700px) !important;
  }
  
  .max-w-content {
    max-width: 95vw !important;
  }
}

/* Large Desktop (1440px to 4K Ultrawide) */
@media (min-width: 1440px) {
  .max-w-\\[1600px\\] {
    max-width: 1560px !important;
  }
}

/* Video Player Responsive 16:9 Guarantee */
#player, #player .aspect-video {
  width: 100% !important;
  max-width: 100% !important;
}
#player iframe {
  width: 100% !important;
  height: 100% !important;
}
`;
    css += responsiveRules;
    fs.writeFileSync(cssFile, css, 'utf8');
    console.log('✅ Added comprehensive all-device responsive CSS rules to index-usTMTSwH.css');
  }
}

console.log('🎉 All-device usability enhancements applied successfully!');
