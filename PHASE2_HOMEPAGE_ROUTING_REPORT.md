# Phase 2: Homepage Routing — Executive Verification Report

**Project:** Netflix4U (`https://netflix4u.in/`)  
**Mission:** Execute **PHASE 2 — HOMEPAGE ROUTING**  
**Active Branch:** `recovery/phase2-homepage-routing`  
**Rollback Tag:** `phase2-rollback-checkpoint` (`8fac8f5`)  
**Execution Date:** 2026-09-28  
**Verification Status:** **100% PASS (ALL 8 SCENARIOS VERIFIED VIA HEADLESS CHROMIUM)**

---

## 1. Executive Summary

Phase 2 enforces strict isolation between the Homepage (`/`), Title Details Modal (`#title=...`), and Watch Modal (`#w=...`). Under all browser cold start, warm start, browser back/forward, and storage persistence conditions, the homepage never leaks player components, never auto-triggers playback, and guarantees instantaneous back-navigation without subframe history traps.

---

## 2. Root Cause Analysis & Engineering Solutions

### Root Cause 1: Chromium Subframe History Pollution ("Double-Back" Trap)
- **Defect:** Setting `iframe.src = targetUrl` or `iframe.src = 'about:blank'` on an existing iframe element causes Chromium to push a subframe navigation entry to the top window's joint session history stack. When a user clicked Back, Chromium navigated the subframe history instead of the application route, leaving the player modal stuck on screen.
- **Solution:** Implemented `setWatchIframeSrc(url)` in `js/net27-modal.js`. It performs a clean DOM node replacement (`cloneNode(false)` + `parentNode.replaceChild`). This guarantees Chromium treats the iframe as a newly created element, recording zero subframe entries in the window session history.

### Root Cause 2: In-Player Back Button Routing Confusion
- **Defect:** `#watch-back-btn`, `.player-inframe-back-btn`, `#watch-modal-close`, and Escape were hardcoded to `closeWatchAndReturnToDetails()`. When a user directly opened a watch route from the homepage or an external URL without visiting details, clicking back erroneously forced the title details modal to open over the homepage.
- **Solution:** Implemented `handleInPlayerBack()`. If the user arrived from details (`wasTitleModalOpenBeforeWatch`), it returns to Details; otherwise, it closes the modal, clears the hash, unlocks scroll, removes `watch-active`, and restores the clean homepage.

### Root Cause 3: Direct One-Tap Logo Navigation
- **Defect:** Users viewing a stream had no single-tap action to return immediately to the Homepage without repeatedly pressing back.
- **Solution:** Added `<a href="/" id="watch-home-logo">` in `index.html` and `public/index.html`. Attached a direct handler that closes all player state, clears hash without reload, and scrolls smoothly to the top of the homepage.

### Root Cause 4: Movie vs TV Hash Representation Mismatch
- **Defect:** Movies were being assigned `-1-1` season and episode suffixes (`#w=tmdbId-movie-1-1`), which violated canonical movie identity and triggered duplicate hash changes and pushState entries.
- **Solution:** Restricted `-season-episode` suffix appending strictly behind `if (isTv)`. Movies now strictly use `#w=tmdbId-movie`.

### Root Cause 5: Persisted Playback State Isolation
- **Defect:** Persisted items in `localStorage` (`n4u_continue_watching`, `n4u_my_list`) could trigger auto-play or modal display if route guards were not strictly scoped.
- **Solution:** Enforced that continue-watching state populates the homepage rail while keeping `#watch-modal` strictly `display: none !important;` with zero iframe activity.

---

## 3. Automated Browser Verification Matrix

Full suite executed via `node scripts/test_phase2_homepage_routing.js` on Headless Chromium (CDP port 9266, iPhone 14 / Desktop viewport):

| Scenario | Objective | Status | Empirical Observations |
| :--- | :--- | :---: | :--- |
| **Test 1: Fresh Browser (`/`)** | Initial load on clean root route | **PASS** | `hasHeader: true`, `hasHero: true`, `#watch-modal` display `none !important`, `body.watch-active: false` |
| **Test 2: Watch Route Activation** | Direct `#w=1399-tv-1-1` navigation | **PASS** | Player embed loaded, `#watch-modal` display `flex`, episode list rendered |
| **Test 3: Browser Back from Watch to Home** | Single `history.back()` returns to `/` | **PASS** | `history.length: 2`, `currentHash: ''`, `iframe: about:blank`, Hero height > 100px |
| **Test 4: Page Refresh on Homepage** | `location.reload()` on `/` | **PASS** | `pathname: '/'`, `hash: ''`, `#watch-modal` display `none !important` |
| **Test 5: Returning Browser w/ LocalStorage** | Reload with persisted progress & list | **PASS** | Continue Watching rail renders, player modal remains 100% dormant |
| **Test 6: Details -> Watch -> Multi-Step Back** | 4-step nested history stack | **PASS** | Step 1 Details (PASS) -> Step 2 Watch (PASS) -> Step 3 Details (PASS) -> Step 4 Home (PASS) |
| **Test 7: In-Player Brand Logo Click** | Click `#watch-home-logo` during playback | **PASS** | Modal closes, hash cleared, homepage restored instantly |
| **Test 8: Query Parameters Isolation** | Navigate to `/?ref=twitter&utm_source=...` | **PASS** | Query parameters do not trigger modals; standard hero renders |

---

## 4. Regression & Build Verification

- **Build Pipeline (`npm run build`):** Exit code 0 (9 category HTML pages generated, all assets synchronized to `public/`).
- **All Integration Tests (`npm test`):** 86 / 86 tests passed (100% success).
- **Homepage Route Regression (`test_homepage_route_regression.js`):** 100% pass across static HTML, CSS isolation, and live routes.
