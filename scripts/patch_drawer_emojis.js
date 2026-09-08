const fs = require('fs');

['js/index-CQL8lqua.js', 'assets/index-CQL8lqua.js'].forEach(fp => {
  let s = fs.readFileSync(fp, 'utf8');
  const target = 'children:[o.jsx("span",{className:"text-base",children:J.emoji}),o.jsx("span",{children:J.label})]';
  const replacement = 'children:o.jsx("span",{children:J.label})';

  if (s.includes(target)) {
    s = s.split(target).join(replacement);
    fs.writeFileSync(fp, s, 'utf8');
    console.log('✅ Patched drawer menu in', fp);
  } else {
    console.warn('⚠️ target not found in', fp);
  }
});
