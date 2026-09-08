const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.resolve(__dirname, '../js/DetailPage-WPhzSGyt.js'),
  path.resolve(__dirname, '../assets/DetailPage-WPhzSGyt.js')
];

for (const file of targetFiles) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');

  // Search for the Back button
  const oldBackRegex = /e\.jsx\("div",\{className:"absolute top-20 left-4 lg:left-8 z-30",children:e\.jsxs\("a",\{href:"\/",onClick:ev=>\{ev\.preventDefault\(\);[^}]+window\.location\.href="\/[^\}]+\},className:"([^"]+)",["']aria-label["']:"Go back",children:\[e\.jsx\(T,\{className:"w-4 h-4"\}\)," Back"\]\}\)\}\)/;

  const match = code.match(oldBackRegex);
  if (match) {
    const classNames = match[1];
    const newBack = `e.jsx("div",{className:"absolute top-20 left-4 lg:left-8 z-30",children:e.jsxs(ae,{to:(typeof sessionStorage!=="undefined"&&sessionStorage.getItem("flix_last_catalog"))||"/",className:"${classNames}","aria-label":"Go back",children:[e.jsx(T,{className:"w-4 h-4"})," Back"]})})`;
    code = code.replace(oldBackRegex, newBack);
    fs.writeFileSync(file, code, 'utf8');
    console.log('✅ Replaced fragile window.history.back with robust React Router Link in:', path.basename(file));
  } else {
    // Alternative match if structure slightly differs
    const altRegex = /e\.jsxs\("a",\{href:"\/",onClick:ev=>\{ev\.preventDefault\(\);[\s\S]*?window\.location\.href="\/"\}\},className:"([^"]+)",["']aria-label["']:"Go back",children:\[e\.jsx\(T,\{className:"w-4 h-4"\}\)," Back"\]\}\)/;
    const altMatch = code.match(altRegex);
    if (altMatch) {
      const classNames = altMatch[1];
      const newBack = `e.jsxs(ae,{to:(typeof sessionStorage!=="undefined"&&sessionStorage.getItem("flix_last_catalog"))||"/",className:"${classNames}","aria-label":"Go back",children:[e.jsx(T,{className:"w-4 h-4"})," Back"]})`;
      code = code.replace(altRegex, newBack);
      fs.writeFileSync(file, code, 'utf8');
      console.log('✅ Replaced via alt regex in:', path.basename(file));
    } else {
      console.warn('⚠️ Back button pattern not found in:', path.basename(file));
    }
  }
}
