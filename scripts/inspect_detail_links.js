const fs = require('fs');
const path = require('path');

const code = fs.readFileSync('js/DetailPage-WPhzSGyt.js', 'utf8');
const searchStr = 's.links&&s.links.length>0&&e.jsxs("div",{className:"mt-6';
const start = code.indexOf(searchStr);
console.log('Start index:', start);

if (start !== -1) {
  // Find the end of this JSX block
  // It starts with e.jsxs("div",{className:"mt-6 p-4...
  // and ends with ...group/btn:translate-y-0.5"})]})]}))})]})
  const targetEnd = 'group/btn:translate-y-0.5"})]})]}))})]})';
  const end = code.indexOf(targetEnd, start);
  console.log('End index:', end);
  if (end !== -1) {
    const fullSnippet = code.slice(start, end + targetEnd.length);
    console.log('Full snippet length:', fullSnippet.length);
    console.log('Ends with:', code.slice(end, end + targetEnd.length + 20));
  }
}
