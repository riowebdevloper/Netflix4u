# Netflix4U — cPanel Deployment Guide

This guide provides step-by-step instructions to deploy Netflix4U on any cPanel hosting environment.

---

## Option 1: cPanel "Setup Node.js App" (Recommended)
This option runs the built-in Node.js server with all features: dynamic TMDB trailer & cast resolution, fast direct cloud downloads, and API endpoints.

### Step 1: Upload the Zip File
1. Log in to your **cPanel**.
2. Open **File Manager** and navigate to your desired directory:
   - For primary domain: `/home/username/public_html` (or create a folder like `/home/username/netflix4u` if using reverse proxy / Passenger).
3. Click **Upload** and select `netflix4u_cpanel_release.zip`.
4. Once uploaded, right-click the zip file and click **Extract**.

### Step 2: Configure Node.js in cPanel
1. In cPanel, search for **"Setup Node.js App"** (under the *Software* section).
2. Click **Create Application**.
3. Fill in the following details:
   - **Node.js version**: Select `18.x`, `20.x`, or higher.
   - **Application mode**: `Production`
   - **Application root**: Path where files were extracted (e.g., `netflix4u` or `public_html`).
   - **Application URL**: Your domain (e.g., `netflix4u.fun` or `yourdomain.com`).
   - **Application startup file**: `server.js` (or `app.js`).
4. (Optional) Under **Environment variables**, you can add:
   - `PORT`: Leave default or let cPanel assign port/socket automatically.
   - `NODE_ENV`: `production`
   - `TMDB_API_KEY`: `445f2b5a8941c1d4bd5a869761a916e3` (or your own TMDB key).
5. Click **Create**.
6. If asked to run `npm install`, you don't need external packages because Netflix4U runs completely on native Node.js core modules.
7. Click **Restart Application**.
8. Visit your domain in the browser to verify!

---

## Option 2: LiteSpeed / Apache Hosting with Native PHP Fallback
If your cPanel plan runs on standard LiteSpeed or Apache shared hosting without Node.js:
1. Extract all files into `public_html/` (ensure "Show Hidden Files" is enabled in cPanel File Manager so `.htaccess` is present).
2. The included `.htaccess` and `api/` directory automatically handle:
   - **High-Speed Direct Downloads**: Clicking any Fast Cloud download button resolves the direct Cloudflare R2 high-speed stream directly in the browser via `js/download-resolver.js` in ~400ms!
   - **PHP Server-Side Download Resolver**: Direct requests, IDM, download managers, and external links to `/api/download/hicine` are routed to `api/download.php`, which redirects immediately to the high-speed stream with HTTP 302!
   - **SPA Routing**: Client-side URLs (e.g. `/movie/...`, `/series/...`) route smoothly to `index.html`.
   - **Static Asset Caching & Gzip**: Ultra-fast load times with pre-configured caching policies.
   - **Security Shields**: Direct unauthorized access to sensitive configs and raw database files is blocked with HTTP 403.
3. All movies, web series, video players, cast images, search, and direct downloads work immediately out of the box!

---

## Included Files in Release Package
- `index.html` — Main SPA application shell with high-performance CSS and SEO meta tags.
- `server.js` & `app.js` — Phusion Passenger / cPanel Node.js entry points.
- `dev-server.js` — High-speed API router, TMDB metadata/cast resolver, and download streaming handler.
- `.htaccess` — Production Apache routing, security shields, and gzip compression.
- `package.json` — Application manifest and startup scripts.
- `js/` & `assets/` — Production-optimized JavaScript bundles.
- `css/` — Optimized global stylesheets.
- `data/` — Complete catalog databases, genre feeds, and individual detail files.
- `images/`, `fonts/`, `uploads/` — Static branding, typography, and poster assets.
- `robots.txt` & `sitemap.xml` — Production search engine indexing assets.

---

## Verification Checklist After Deployment
- [ ] Visit `https://yourdomain.com/` — Homepage loads with hero carousel, posters, and category rows.
- [ ] Visit `https://yourdomain.com/health` (if Node.js is running) — Returns `{"status":"ok"}`.
- [ ] Click on any movie or series — Detail page displays title, metadata, player, and cast photos.
- [ ] Click "Download Links" — Direct cloud download mirrors open and stream correctly.
