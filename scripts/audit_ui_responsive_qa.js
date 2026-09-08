const fs = require('fs');
const path = require('path');

function runUiResponsiveQA() {
  console.log('========================================================');
  console.log('AGENT 7 — UI, RESPONSIVE & BUTTON AUDIT');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  // 1. Audit CSS for responsive breakpoints
  console.log('1. Auditing Responsive Breakpoints in CSS files...');
  const cssDir = 'css';
  let hasMobileBreakpoint = false;
  let hasTabletBreakpoint = false;
  let hasDesktopRules = false;

  if (fs.existsSync(cssDir)) {
    const cssFiles = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
    for (const f of cssFiles) {
      const content = fs.readFileSync(path.join(cssDir, f), 'utf8');
      if (/@media[^{]*(?:max-width:\s*(?:480|600|639|640|768)px|40rem)/i.test(content)) {
        hasMobileBreakpoint = true;
      }
      if (/@media[^{]*(?:max-width:\s*(?:768|800|900|1024)px|48rem)/i.test(content)) {
        hasTabletBreakpoint = true;
      }
      if (/@media[^{]*(?:min-width:\s*(?:1024|1200|1280|1440|1920)px|64rem|80rem|96rem)/i.test(content)) {
        hasDesktopRules = true;
      }
    }
  }

  if (hasMobileBreakpoint) {
    console.log('  ✅ Mobile Breakpoint rules verified in CSS');
    passed++;
  } else {
    console.log('  ❌ Mobile Breakpoint missing in CSS');
    failed++;
  }

  if (hasTabletBreakpoint) {
    console.log('  ✅ Tablet Breakpoint rules verified in CSS');
    passed++;
  } else {
    console.log('  ❌ Tablet Breakpoint missing in CSS');
    failed++;
  }

  if (hasDesktopRules) {
    console.log('  ✅ Desktop / Large Screen rules verified in CSS');
    passed++;
  } else {
    console.log('  ❌ Desktop rules missing in CSS');
    failed++;
  }

  // 2. Audit for emojis in action buttons and UI controls
  console.log('\n2. Auditing Action Buttons and Controls for Emojis...');
  const emojiRegex = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;

  const targetFiles = [
    'index.html',
    'js/index-CQL8lqua.js',
    'assets/index-CQL8lqua.js'
  ];

  let buttonEmojiFound = 0;
  for (const rel of targetFiles) {
    if (!fs.existsSync(rel)) continue;
    const content = fs.readFileSync(rel, 'utf8');
    
    // Check buttons specifically
    const btnMatches = content.match(/<button[^>]*>([\s\S]*?)<\/button>/gi) || [];
    for (const b of btnMatches) {
      if (emojiRegex.test(b)) {
        console.log(`  ❌ Button contains emoji in ${rel}: ${b.slice(0, 60)}`);
        buttonEmojiFound++;
      }
    }

    // Check download button labels and server labels
    const serverBtnMatches = content.match(/['"`][^'"`]*(?:Fast Cloud|AllMovieLand|VidLink|VidSrc)[^'"`]*['"`]/gi) || [];
    for (const sb of serverBtnMatches) {
      if (emojiRegex.test(sb)) {
        console.log(`  ❌ Server selector button label contains emoji in ${rel}: ${sb}`);
        buttonEmojiFound++;
      }
    }
  }

  if (buttonEmojiFound === 0) {
    console.log('  ✅ Zero emojis found in clickable action buttons and server selectors');
    passed++;
  } else {
    console.log(`  ❌ Found ${buttonEmojiFound} emoji occurrences in action buttons`);
    failed++;
  }

  console.log('\n========================================================');
  console.log(`UI, RESPONSIVE & BUTTON RESULTS: Passed: ${passed}, Failed: ${failed}`);
  console.log('========================================================\n');
}

runUiResponsiveQA();
