const fs = require('fs');

['js/HomePage-mNJ_gjp9.js', 'assets/HomePage-mNJ_gjp9.js'].forEach(filePath => {
  let c = fs.readFileSync(filePath, 'utf8');

  // 1. Top number aria-hidden (Issues 82-91)
  const targetTop = 'className:"top-number top-number text-[120px] font-black leading-none select-none -mr-3 sm:-mr-5 relative z-10",style:{WebkitTextStroke:"3px rgba(255,255,255,0.2)",color:"transparent"},children:a+1';
  const replaceTop = 'className:"top-number top-number text-[120px] font-black leading-none select-none -mr-3 sm:-mr-5 relative z-10",style:{WebkitTextStroke:"3px rgba(255,255,255,0.4)",color:"transparent"},"aria-hidden":"true",children:a+1';

  if (c.includes(targetTop)) {
    c = c.replace(targetTop, replaceTop);
    console.log('✅ Added aria-hidden to top-number in', filePath);
  }

  // 2. Ensure carousel buttons have aria-label
  // Left button
  c = c.replaceAll(
    'className:"btn-icon pointer-events-auto",children:e.jsx(A,{className:"w-5 h-5"})',
    'className:"btn-icon pointer-events-auto","aria-label":"Scroll section left",children:e.jsx(A,{className:"w-5 h-5"})'
  );
  // Right button
  c = c.replaceAll(
    'className:"btn-icon pointer-events-auto",children:e.jsx(k,{className:"w-5 h-5"})',
    'className:"btn-icon pointer-events-auto","aria-label":"Scroll section right",children:e.jsx(k,{className:"w-5 h-5"})'
  );

  fs.writeFileSync(filePath, c);
  console.log('✅ Patched a11y in', filePath);
});
