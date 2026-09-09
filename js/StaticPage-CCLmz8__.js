import{j as t}from"./vendor-framer-BGQgIPyw.js";import{c,r as d}from"./vendor-react-h5WnBHGl.js";import{o as m}from"./vendor-ui-BbvII91P.js";const u={"/about":{title:"About Us",content:`
      ## Welcome to Netflix4U

      Netflix4U is your ultimate destination for discovering movies, web series, anime, and K-dramas. We provide an extensive database powered by TMDB, offering high-quality trailers, cast information, and trending insights.

      ### Our Mission

      We aim to provide a seamless, beautiful, and ad-free experience for entertainment enthusiasts to explore the vast world of cinema and television.

      *Note: Netflix4U is an informational database and does not host any video files on its servers.*
    `},"/contact":{title:"Contact Us",content:`
      ## Get in Touch

      Have a question, feedback, or a feature request? We'd love to hear from you!

      - **Email (Support)**: [support@netflix4u.in](mailto:support@netflix4u.in)
      - **Customer Support Phone**: [+1 (800) 354-9967](tel:+18003549967)
      - **Helpline (Toll-Free)**: [+91 8000 123 456](tel:+918000123456)
      - **Twitter / X**: [@Netflix4UFun](https://twitter.com/Netflix4UFun)
      - **Discord Community**: [Join Our Discord Server](https://discord.gg/netflix4u)

      *We aim to respond to all inquiries within 24 to 48 hours.*
    `},"/privacy":{title:"Privacy Policy",content:`
      **Last updated: September 2026**

      At Netflix4U, we take your privacy seriously. This policy describes what information we collect and how it is used.

      ### 1. Data Collection

      We do not collect any personally identifiable information without your explicit consent. Features like the "Watchlist" are stored entirely locally on your device (in your browser's Local Storage).

      ### 2. Third-Party APIs

      We use The Movie Database (TMDB) API for movie metadata and YouTube for trailer embeds. These services may collect anonymous usage data as per their respective privacy policies.
    `},"/terms":{title:"Terms of Service",content:`
      **Last updated: September 2026**

      By accessing Netflix4U, you agree to these Terms of Service.

      ### 1. Usage

      Netflix4U is an informational portal. You agree to use the site for personal, non-commercial purposes only.

      ### 2. Content

      All movie metadata, posters, and cast information are provided by TMDB. All video trailers are embedded from YouTube. We do not claim ownership of these materials.
    `},"/dmca":{title:"DMCA Disclaimer",content:`
      Netflix4U is an **informational database** only. 

      We **do not** host, upload, or store any video files, media, or copyrighted content on our servers. All metadata and images are provided by the public TMDB API, and all video trailers are embedded using official YouTube iframe embeds.

      If you believe any content linked on our site infringes upon your copyright, please contact the respective media host (e.g., YouTube) to have it removed from the internet. Once removed by the host, it will automatically disappear from Netflix4U.
    `}};function r(s){return s.split(/(\*\*.*?\*\*|\*.*?\*|\[.*?\]\(.*?\))/g).map((e,i)=>{if(e.startsWith("**")&&e.endsWith("**"))return t.jsx("strong",{className:"font-bold text-white",children:e.slice(2,-2)},i);if(e.startsWith("*")&&e.endsWith("*"))return t.jsx("em",{className:"italic",children:e.slice(1,-1)},i);const o=e.match(/^\[(.*?)\]\((.*?)\)$/);if(o){const[,a,l]=o;return t.jsx("a",{href:l,target:"_blank",rel:"noopener noreferrer",className:"text-[var(--color-accent)] hover:underline",children:a},i)}return e})}function p(){const s=c(),n=u[s.pathname]||{title:"Page Not Found",content:"The page you are looking for does not exist."};return d.useEffect(()=>{window.scrollTo(0,0)},[s.pathname]),t.jsxs("div",{className:"min-h-screen pt-24 pb-12 px-4 lg:px-8 max-w-[800px] mx-auto",children:[t.jsx(m,{children:t.jsxs("title",{children:[n.title," | netflix4u.in"]})}),t.jsxs("div",{className:"bg-[var(--color-navy-900)] rounded-2xl p-8 md:p-12 border border-white/10 shadow-2xl",children:[t.jsx("h1",{className:"text-3xl font-bold text-white mb-8 pb-4 border-b border-white/10",children:n.title}),t.jsx("div",{className:"prose prose-invert prose-red max-w-none prose-p:leading-relaxed prose-headings:text-white prose-a:text-[var(--color-accent)]",children:n.content.split(`

`).map((e,i)=>e.trim().startsWith("## ")?t.jsx("h2",{className:"text-2xl font-semibold mt-8 mb-4 text-white",children:r(e.replace("## ",""))},i):e.trim().startsWith("### ")?t.jsx("h3",{className:"text-xl font-medium mt-6 mb-3 text-gray-200",children:r(e.replace("### ",""))},i):e.trim().startsWith("- ")?t.jsx("ul",{className:"list-disc pl-5 my-4 space-y-2 text-gray-400",children:e.split(`
`).filter(o=>o.trim().startsWith("- ")).map((o,a)=>{const l=o.trim().replace(/^- /,"");return t.jsx("li",{children:r(l)},a)})},i):e.trim().startsWith("*")&&e.trim().endsWith("*")?t.jsx("p",{className:"text-gray-500 italic my-4",children:r(e.replace(/\*/g,""))},i):e.trim()?t.jsx("p",{className:"text-gray-400 my-4 leading-relaxed",children:r(e)},i):null)})]})]})}export{p as default};
