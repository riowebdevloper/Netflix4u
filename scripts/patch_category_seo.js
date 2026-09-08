const fs = require('fs');
const path = require('path');

const files = [
  path.resolve(__dirname, '..', 'js', 'CategoryPage-BfDZg_n3.js'),
  path.resolve(__dirname, '..', 'assets', 'CategoryPage-BfDZg_n3.js')
];

const oldI = 'const I={movie:{title:"Movies",icon:e.jsx(p,{className:"w-6 h-6 text-[var(--color-accent)]"}),description:"Discover thousands of movies from blockbusters to indie gems"},series:{title:"Web Series",icon:e.jsx(F,{className:"w-6 h-6 text-[var(--color-accent)]"}),description:"Binge-worthy shows from around the world"},anime:{title:"Anime",icon:e.jsx(C,{className:"w-6 h-6 text-[var(--color-accent)]"}),description:"The best anime from Japan and beyond"},kdrama:{title:"K-Drama",icon:e.jsx(A,{className:"w-6 h-6 text-[var(--color-accent)]"}),description:"Top Korean dramas to fall in love with"},bollywood:{title:"Bollywood Movies",icon:e.jsx(p,{className:"w-6 h-6 text-[var(--color-accent)]"}),description:"Stream latest and classic Bollywood blockbusters in Full HD"},hollywood:{title:"Hollywood Movies",icon:e.jsx(p,{className:"w-6 h-6 text-[var(--color-accent)]"}),description:"Discover top Hollywood action, sci-fi, and blockbuster movies"},"south-indian":{title:"South Indian Movies",icon:e.jsx(p,{className:"w-6 h-6 text-[var(--color-accent)]"}),description:"Watch high-octane South Indian movies in Tamil, Telugu, Malayalam & Kannada"},"hindi-dubbed":{title:"Hindi Dubbed Movies",icon:e.jsx(p,{className:"w-6 h-6 text-[var(--color-accent)]"}),description:"Enjoy Hollywood & South blockbusters in Hindi audio"}};';

const newI = 'const I={movie:{title:"Movies",seoTitle:"Stream & Download HD Movies Free | FlixWorld",icon:e.jsx(p,{className:"w-6 h-6 text-[var(--color-accent)]"}),description:"Discover thousands of movies from blockbusters to indie gems with direct high-speed download mirrors and buffer-free HD streaming."},series:{title:"Web Series",seoTitle:"Watch Latest Web Series & TV Shows Free | FlixWorld",icon:e.jsx(F,{className:"w-6 h-6 text-[var(--color-accent)]"}),description:"Binge-worthy shows and full seasons from around the world in HD and 4K quality with multi-audio support."},anime:{title:"Anime",seoTitle:"Watch Anime Online in HD with English Subtitles & Dub | FlixWorld",icon:e.jsx(C,{className:"w-6 h-6 text-[var(--color-accent)]"}),description:"The best anime series and movies from Japan and beyond with crisp English subtitles and dual audio."},kdrama:{title:"K-Drama",seoTitle:"Watch Korean Dramas (K-Drama) Free with English Subtitles | FlixWorld",icon:e.jsx(A,{className:"w-6 h-6 text-[var(--color-accent)]"}),description:"Top trending Korean dramas to fall in love with, featuring full seasons and fast cloud streaming."},bollywood:{title:"Bollywood Movies",seoTitle:"Watch Bollywood Movies Online Free in HD & 4K | FlixWorld",icon:e.jsx(p,{className:"w-6 h-6 text-[var(--color-accent)]"}),description:"Stream and download the latest Hindi Bollywood blockbuster movies, new releases, and classics with high-speed download mirrors."},hollywood:{title:"Hollywood Movies",seoTitle:"Watch Hollywood Movies in HD & 4K Dual Audio | FlixWorld",icon:e.jsx(p,{className:"w-6 h-6 text-[var(--color-accent)]"}),description:"Discover top Hollywood action, sci-fi, Marvel, and Oscar-winning blockbusters with multi-audio support."},\"south-indian\":{title:\"South Indian Movies\",seoTitle:\"Watch South Indian Movies in Hindi Dubbed (HD & 4K) | FlixWorld\",icon:e.jsx(p,{className:\"w-6 h-6 text-[var(--color-accent)]\"}),description:\"Stream high-octane South Indian movies in Hindi Dubbed, Tamil, Telugu, Malayalam, and Kannada with fast download links.\"},\"hindi-dubbed\":{title:\"Hindi Dubbed Movies\",seoTitle:\"Watch Hindi Dubbed Movies Online Free in Full HD | FlixWorld\",icon:e.jsx(p,{className:\"w-6 h-6 text-[var(--color-accent)]\"}),description:\"Enjoy top Hollywood and South blockbusters dubbed in Hindi with multiple server options and direct downloads.\"}};';

const oldTitleMeta = 'e.jsxs(y,{children:[e.jsxs("title",{children:[l.title," | FlixWorld.fun"]}),e.jsx("meta",{name:"description",content:l.description})]})';
const newTitleMeta = 'e.jsxs(y,{children:[e.jsx("title",{children:l.seoTitle||`${l.title} | FlixWorld.fun`}),e.jsx("meta",{name:"description",content:l.description})]})';

for (const fp of files) {
  if (!fs.existsSync(fp)) continue;
  let code = fs.readFileSync(fp, 'utf8');
  if (code.includes(oldI)) {
    code = code.replace(oldI, newI);
    console.log('✅ Updated SEO titles and descriptions mapping in', path.basename(fp));
  }
  if (code.includes(oldTitleMeta)) {
    code = code.replace(oldTitleMeta, newTitleMeta);
    console.log('✅ Updated title & meta tag rendering in', path.basename(fp));
  }
  fs.writeFileSync(fp, code, 'utf8');
}
