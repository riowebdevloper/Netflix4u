const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const jsIndexPath = path.join(ROOT, 'js', 'index-CQL8lqua.js');
const assetsIndexPath = path.join(ROOT, 'assets', 'index-CQL8lqua.js');
const jsDetailPath = path.join(ROOT, 'js', 'DetailPage-WPhzSGyt.js');
const assetsDetailPath = path.join(ROOT, 'assets', 'DetailPage-WPhzSGyt.js');
const cssPath = path.join(ROOT, 'css', 'netflix4u-exact.css');

console.log('--- Applying Final Mobile UI & Download Requirements ---');

// ============================================================================
// 1. UPDATE CSS WITH RELEVANT STYLES
// ============================================================================
let cssContent = fs.readFileSync(cssPath, 'utf8');

const additionalCss = `
/* ==========================================================================
   MOBILE UI & DOWNLOAD REORGANIZATION ENHANCEMENTS
   ========================================================================== */

/* Two-column Mobile Footer Layout */
.footer-mobile-columns {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: 1.5rem;
  width: 100%;
  max-width: 100%;
  margin-top: 2rem;
}
.footer-column-left,
.footer-column-right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.footer-column-right .footer-info-section {
  margin-top: 1.75rem;
}

/* Category Carousel Smooth Swipe & Momentum */
.category-carousel-container {
  display: flex;
  align-items: center;
  position: relative;
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  overflow: hidden;
  padding: 0 0.5rem 0.75rem;
}
.category-carousel-track {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
  touch-action: pan-x pan-y;
  overscroll-behavior-x: contain;
  padding: 0 0.25rem;
}
.category-carousel-track::-webkit-scrollbar {
  display: none;
}
.category-arrow-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 5;
}
.category-arrow-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

/* Sticky Streaming Controls Bar */
.sticky-server-bar {
  position: fixed;
  top: 3.5rem;
  left: 0;
  right: 0;
  z-index: 40;
  background: rgba(6, 8, 22, 0.95);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding: 0.5rem 1rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.7);
  animation: slideDownBar 0.25s ease-out;
}
@media (min-width: 640px) {
  .sticky-server-bar {
    top: 4rem;
  }
}
@keyframes slideDownBar {
  from { transform: translateY(-100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* Downloads Accordion */
.download-season-accordion {
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  margin-bottom: 0.75rem;
  transition: border-color 0.2s;
}
.download-season-accordion[data-open="true"] {
  border-color: rgba(229, 9, 20, 0.35);
  background: rgba(255, 255, 255, 0.05);
}
.download-season-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1.25rem;
  background: transparent;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.95rem;
  color: #fff;
  text-align: left;
  transition: background-color 0.2s;
}
.download-season-header:hover {
  background: rgba(255, 255, 255, 0.04);
}
.download-episode-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.875rem 1.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}
@media (min-width: 640px) {
  .download-episode-row {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

/* Narrow Viewport (320px) Safety Guards */
@media (max-width: 360px) {
  #nav-logo img {
    height: 1.65rem !important;
  }
  .mobile-nav-item span:last-child {
    font-size: 8.5px !important;
  }
  .mobile-nav-item {
    padding-left: 2px !important;
    padding-right: 2px !important;
  }
}
`;

if (!cssContent.includes('footer-mobile-columns')) {
  cssContent += '\n' + additionalCss;
  fs.writeFileSync(cssPath, cssContent, 'utf8');
  console.log('✓ Updated css/netflix4u-exact.css');
}

console.log('Ready to patch index and DetailPage JS modules.');
