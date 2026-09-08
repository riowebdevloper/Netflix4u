const fs = require('fs');
const path = require('path');

const targetFiles = [
  path.resolve(__dirname, '../js/CategoryPage-BfDZg_n3.js'),
  path.resolve(__dirname, '../assets/CategoryPage-BfDZg_n3.js')
];

for (const file of targetFiles) {
  if (!fs.existsSync(file)) continue;
  let code = fs.readFileSync(file, 'utf8');

  // Search for the useState initialization of o
  // [o,w]=s.useState({genre:"All",year:"All",rating:"All",language:"All",quality:"All",sortBy:"relevance"})
  const oldState = '[o,w]=s.useState({genre:"All",year:"All",rating:"All",language:"All",quality:"All",sortBy:"relevance"})';
  const newState = '[o,w]=s.useState(()=>{const p=new URLSearchParams(typeof window!=="undefined"?window.location.search:"");return{genre:p.get("genre")||"All",year:"All",rating:"All",language:p.get("language")||"All",quality:"All",sortBy:"relevance"}});s.useEffect(()=>{const p=new URLSearchParams(window.location.search);const l=p.get("language")||"All",g=p.get("genre")||"All";w(prev=>({...prev,language:l,genre:g}))},[window.location.search])';

  if (code.includes(oldState)) {
    code = code.replace(oldState, newState);
    fs.writeFileSync(file, code, 'utf8');
    console.log('✅ Updated CategoryPage with URL search param sync in:', path.basename(file));
  } else {
    console.warn('Could not locate oldState in:', path.basename(file));
  }
}
