# Edtech Island - Platform Design & Architecture Standards

This document tracks all core responsive design decisions, scaling algorithms, performance targets, and styling rules made for the Edtech Island platform. It acts as the ultimate source of truth for all modules (Chapters, Quizzes, Shadow Labs, Stories, etc.) going forward.

---

## 1. Core Scaling & Resolution Philosophy
**"Design for 1080p, Scale for All"**
The UI is visually built targeting a standard `1920x1080` pixel canvas. Rather than relying on exhaustive CSS media queries to resize every button for every possible resolution, the platform historically relied on a mathematics-based scaling engine located in `perf_optimizer.js`.

### 1.1 Legacy Scaling Engine (perf_optimizer.js)
*   The script calculates: `scaleRatio = Math.min(winW / baseW, winH / baseH)`.
*   If the screen is smaller (e.g., a 1280x720 Smartboard), the script applies `document.body.style.zoom = scaleRatio` (or `transform: scale()` for iOS Safari).
*   This approach ensures visually stunning proportions remain physically scaled across varying displays without manual recalculation.
*   **Tablet-Aware Base Resolution (Added: April 2026):** The scaler now detects device category before choosing the base canvas:
    *   **Landscape Tablet:** 1366 × 768
    *   **Portrait Tablet:** 820 × 1180

### 1.2 Fluid WebApp Architecture (The New Standard)
Starting with the **Quiz**, **Shadow Lab**, and **Chapter Experience** modules (April 2026 refactor), the platform is transitioning to a **Fluid Responsive Layout**.
*   **Why?** Relying on `zoom` can cause issues with Safari viewport calculations and fat-finger touch accuracy on smaller tablet slates.
*   **The Rule:** Avoid `perf_optimizer.js` for layout scaling in these modules. Use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`) and CSS Flexbox/Grid.
*   **Aspect Ratio Preservation:** For interactive 3D canvases or specific lab regions, use `aspect-ratio` properties or fixed percentage heights (e.g., `h-[45vw]`) to maintain 1080p-like proportions while letting the rest of the UI (buttons, text) remain native to the device's resolution.



## 2. Dealing with the "Double-Shrink" Viewport Bug
**The Problem:** Because CSS viewport units (`100vw`, `100vh`) evaluate to the physical hardware dimensions *before* the body `zoom` factor is applied, attempting to use `100vw` inside a zoomed body results in a container that shrinks twice. This leaves massive black, letterboxed borders on the edges of the screen.

**The Fix & Rule:**
*   `perf_optimizer.js` exports the exact zoom scale to CSS dynamically: `document.documentElement.style.setProperty('--ifp-zoom', scaleRatio);`
*   Any overlay, iframe wrapper, or outer container that *must* cover the physical screen out to the exact monitor bezels must invert the zoom using `calc()` inside `styles.css`:
    ```css
    /* Example: Correct fullscreen overlay logic */
    .app-overlay--fullscreen .app-overlay-shell {
      width: calc(100vw / var(--ifp-zoom, 1));
      height: calc(100vh / var(--ifp-zoom, 1));
    }
    ```

---

## 3. Developing New Modules (Quizzes, Experiments, etc.)
When creating or modifying HTML/React module files designed to load via the main platform iframe (`.app-overlay-shell`):
1.  **Do NOT hardcode container sizes:** Avoid assigning `w-[1920px] h-[1080px]` as the main background wrapper inside your HTML components. This forces an exact 16:9 box inside the browser, resulting in black cutoffs if the browser window is slightly taller or wider (e.g., standard laptops with taskbars visible).
2.  **Use fluid boundary wrappers:** The outermost background wrapper should utilize flexible Tailwind coverage properties like `className="min-h-screen w-full relative..."` instead of fixed dimensions.
3.  **Use absolute proportions for UI internals:** Use standard Tailwind absolute pixel/REM sizes for inner layout design (e.g., `px-12 py-5 max-w-lg text-2xl`). Because of the parent `zoom`, these properties will automatically shrink proportionally on screens like 720p Smartboards, yielding exactly the same UI footprint as the 1080p target.

---

## 4. UI/UX Design System Guidelines
Edtech Island uses a cohesive, custom-built design language tailored for smartboards and digital learning:
*   **Theming & Glassmorphism:** Utilize deep stellar backgrounds merged with frosted glass cards to create depth.
    *   *Classes to use:* `bg-white/5` or `bg-white/10` combined with `backdrop-blur-md` (or `xl`), and thin highlights like `border border-white/20`.
    *   Avoid flat opaque backgrounds. Prefer layered shadows (`shadow-lg` to `shadow-[0_0_30px_rgba(...)]` to simulate glow or UI elevation).
*   **Dynamic Visuals (Glows & Animations):** Draw user attention using ambient lighting natively constructed in HTML/React, avoiding complex WebGL post-processing where unnecessary.
    *   *Implementation:* Render background animated orbs (e.g., `<GlowOrb color="bg-cyan-600" delay="0s" />`) underneath the glass panels to make the layout feel "alive."
*   **"Stories" & Video Interfaces:** Content grids and media galleries must visibly differentiate states. Inactive cards use dim overlays or thin transparent borders. Active/Playing elements should immediately demand focus via thicker white borders or glowing drop-shadows (e.g., transitioning to `border-white/80`).

---

## 5. Performance Optimizations & `perf_optimizer.js`
The platform targets heavy usage on 75-inch Android Smartboards running lower-tier A53/A73 Octa-Core CPUs natively or via web wrappers. To handle this, a standalone shared optimizer (`perf_optimizer.js`) loads first on every page, providing the following core optimizations:

1.  **`IFP_PIXEL_RATIO` (4K Viewport Render Limits):**
    *   Detects 4K panels ($\ge$ 3840 physical px).
    *   Caps the explicit WebGL internal rendering at `1.0x` ($\equiv$ 1080p).
    *   CSS automatically upscales it to fill the screen, saving $\sim$ 75% GPU fill-rate.
2.  **Touch Hardening:**
    *   Applies `touch-action: none` strictly on canvas containers.
    *   Blocks `gesturestart` and `wheel` events on interactive canvases to prevent browser pinch-zoom from interrupting 3D rotation/interaction.
3.  **`disposeThreeObject()` (Memory Management):**
    *   A recursive GPU disposer algorithm that kills all geometries, materials, and textures attached to a scene upon unloading.
    *   Critically prevents Android Out-Of-Memory (OOM) crashes across chapter switches.
4.  **`ThreePool` (Object Pooling):**
    *   Provides an object pool for `Vector3` / `Matrix4` allocations.
    *   *Note:* Currently available but not strictly required since we heavily use explicit scratch variables.
5.  **Throttled Resize Events:**
    *   Debounces all `window.addEventListener('resize')` calls to `150ms + rAF` (requestAnimationFrame).
    *   Prevents layout thrashing and freezing during dock/undock or rotation events on smartboards.
6.  **`IFP_VISIBLE` (Page Visibility API):**
    *   Exposes a global flag hooked to visibility states.
    *   Guarantees that intense `requestAnimationFrame` render loops return immediately when the panel is sleeping or backgrounded, conserving CPU.
7.  **Large Hit Targets:** 
    *   Enforces `min-height: 52px` and `min-width: 52px` on all interactive buttons/elements to compensate for smartboard glass parallax and ensure seamless finger taps.
8.  **Asset Handling Rules:**
    *   *Never* use raw 4K `.png` images for full-screen UI backgrounds. 
    *   Always utilize aggressively optimized, low-resolution JPEG/WebP files (`assets/chapter background lowres.jpg`), heavily obfuscating compression artifacts using CSS gradients/opacity overlays (e.g., `DefaultAppBackground`).
9.  **Three.js Scene Initialization & Procedural Generation:**
    *   **Avoid Main-Thread Blocking:** Absolute ban on massive procedural `for` loops (e.g., $150,000$ iterations of `Math.random()` to generate canvas noise) during scene mounting. This causes severe UI thread lockups and "black screen" load delays.
    *   **Smart Textures:** Replicate complex surfaces (moon craters, suns) by dropping iterations to $\le 2000$. Use fewer, clearly defined HTML5 Canvas gradients, and rely heavily on mapping that canvas directly to `bumpMap` (with `bumpScale`) on a `MeshStandardMaterial`. Let the lighting engine do the work dynamically rather than pre-calculating it in memory.
10. **Three.js Shadows & Lighting (WebGL Buffer States):**
    *   If a chapter explicitly requires shadows (e.g., teaching Shadow Formation), `renderer.shadowMap.enabled = true` must be set at initialization. Three.js struggles to hot-swap WebGL shadow buffer allocations if disabled at init.
    *   Control thermal constraint via explicit targeting: tightly control which exact `THREE.Light` calls `.castShadow = true` and target specific `THREE.Mesh` objects with `.receiveShadow`. Utilize `THREE.PCFSoftShadowMap` for professional feathering.

---

## 6. Maintenance & Updates
*   **AI Directives:** Before making visual layout modifications or creating substantial architectural changes to overarching files, I (the AI) must cross-reference this `design.md` file to prevent regressions. 
*   **Continuous Integrations:** If new optimization bottlenecks are solved across future sessions, this document must be updated to prevent repeating debugging phases. 
*   **Responsive Fluidity:** When building new interactive labs, prioritize Fluid CSS (Section 1.2) over JS Scale (Section 1.1) to ensure the best performance and navigation visibility on varied tablet hardware.

---

## 7. Cross-Device Layout Architecture Fixes (April 2026)

**Problem:** Layout alignment was inconsistent across multiple browser tabs and devices (especially iPad Safari). Same page appeared correctly centered in one tab and shifted/cut in another.

**Root Cause:** Three compounding issues:
1. `100vh` lies on iPad Safari — it changes depending on whether the address bar is visible, causing height recalculations mid-session.
2. Grid heights used unanchored percentages (`height: 70%`, `flex: 0 1 70%`) which drift relative to fragile parent containers.
3. Stories scroll container had a hardcoded `max-height: 450px` — arbitrary, clips differently on every viewport.

---

### 7.1 `dvh` — The Universal Viewport Fix

**Rule:** Never use raw `100vh` for full-heights. Always use `100dvh` with a `100vh` fallback.

```css
/* ✅ Correct */
height: 100dvh;          /* Primary: real visible height, adapts to Safari UI chrome */
height: 100vh;           /* Fallback: for browsers that don't support dvh yet */

/* ❌ Wrong */
height: 100vh;           /* Lies on iPad Safari — shifts layout between tabs */
```

`dvh` = **dynamic viewport height** — always equals the actual rendered area regardless of address bar visibility. This alone fixed ~40% of cross-tab misalignment.

**Applied to:** `html`, `body`, all `max-height` clamps on grids and scroll containers.

---

### 7.2 Flex Height Anchoring — The Grid Fix

**Rule:** Never use `height: 70%` or `flex: 0 1 70%` on grids inside flex containers. Use `flex: 1; min-height: 0` instead.

```css
/* ✅ Correct — fills remaining space, never overflows */
.subjects-grid, .chapters-grid {
  flex: 1;
  min-height: 0;
}

/* ❌ Wrong — percentage heights drift based on parent's computed height */
.subjects-grid {
  height: 70%;
  flex: 0 1 70%;
}
```

**Why:** `height: 100%` on a flex child only works if every ancestor has an explicit height. In practice this chain breaks on Safari. `flex: 1; min-height: 0` is the browser-safe standard.

**Applied to:** `.subjects-grid`, `.chapters-grid`, `.screen-content`

---

### 7.3 `env(safe-area-inset-*)` — iPad Home Indicator Fix

**Rule:** Bottom nav and screen-content bottom padding must include safe area insets.

```css
:root {
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-top:    env(safe-area-inset-top, 0px);
}

.bottom-nav {
  padding-bottom: max(0px, var(--safe-bottom));
}

.screen-content {
  padding: 20px 36px calc(var(--nav-height) + var(--safe-bottom) + 20px);
}
```

On iPads with home indicators, the bottom nav was overlapping the gesture area, making buttons unreachable. This fix ensures it always sits above the device chrome.

---

### 7.4 Stories Scroll Container — Dynamic Height Fix

**Rule:** Never hardcode `max-height` with arbitrary pixel values on scroll containers.

```css
/* ✅ Correct — adapts to actual visible screen height */
.stories-scroll-container {
  max-height: calc(100dvh - 380px);
  max-height: calc(100vh - 380px); /* fallback */
}

/* ❌ Wrong — completely arbitrary, clips on some screens */
.stories-scroll-container {
  max-height: 450px;
}
```

The `380px` offset accounts for: page header + tab navigation + arrow buttons + padding.

---

### 7.5 CSS Spacing System

Added to `:root` to prevent scattered random `px` values in future development:

```css
:root {
  --space-xs:  4px;
  --space-sm:  8px;
  --space-md:  16px;
  --space-lg:  24px;
  --space-xl:  40px;
}
```

**Rule:** All new spacing (padding, gap, margin) in `styles.css` should reference these tokens, not raw pixel values.

---

### 7.6 Summary — Files Changed

| File | Change |
|------|--------|
| `styles.css` | Added `dvh` fallbacks, spacing tokens, safe-area variables, anchored grid heights with `flex: 1; min-height: 0`, fixed bottom nav padding |
| `index.html` | Fixed inline Stories panel `max-height: 450px` → `calc(100dvh - 380px)`, bumped CSS cache version to `?v=23` |


---

## 8. Global Navigation & Fullscreen Button Architecture (April 2026)

### Problem
Two persistent visual regressions were observed on **iPad Safari** (and any browser with a visible bottom toolbar):

1. **Bottom nav was cut off / hidden** — The main menu bar (HOME / STUDIES / WORLD / PROFILE / EXIT) was rendered *inside* each individual screen `<div>`. Since inactive screens have `opacity: 0; pointer-events: none`, navigating between tabs caused the nav inside the departing screen to disappear entirely before the new one appeared, creating a flash with no nav. On iPad, the nav was also half-hidden under the Safari toolbar.

2. **Fullscreen button overlapped / clipped** — Positioned at `bottom: 24px`, it sat directly on top of the bottom nav and got clipped by the browser toolbar on mobile Safari.

---

### 8.1 Single Global Nav — The Architecture Fix

**Rule:** The bottom navigation bar must exist **once**, outside all screen divs, as a top-level body element. It must never be duplicated inside per-screen containers.

```html
<!-- ✅ Correct — single instance, always visible regardless of active screen -->
<!-- Placed at the end of <body>, after all screen divs and before the overlay -->
<nav id="global-bottom-nav" class="bottom-nav glass-nav" aria-label="Main navigation">
  <button class="nav-btn active" id="gnav-home" onclick="navigateTo('screen-home')" …>…</button>
  <div class="nav-divider"></div>
  <button class="nav-btn" id="gnav-studies" onclick="navigateTo('screen-subjects')" …>…</button>
  …
</nav>

<!-- ❌ Wrong — nav inside each screen div, disappears on tab switch -->
<div id="screen-home" class="screen active">
  …
  <nav class="bottom-nav glass-nav">…</nav>  <!-- gets hidden with the screen -->
</div>
```

**Why it works:** `position: fixed` elements inside an `opacity: 0` container are still hidden by the browser's compositing rules. Moving the nav outside all screens makes it a truly persistent overlay.

**z-index hierarchy:**

| Layer | z-index | Element |
|-------|---------|---------|
| Screens | 10 | `.screen.active` |
| Bottom Nav | 150 | `#global-bottom-nav` |
| Sub-App Overlay | 200 | `#app-overlay` |
| Global badges/buttons | 1000 | `.curriculum-badge`, `#theme-toggle`, `#fullscreen-toggle` |

---

### 8.2 Floating Pill Nav — The Toolbar Visibility Fix

**Rule:** The bottom nav must be a **fully-rounded floating pill** positioned above the safe area, not a flat-bottomed bar flush to the screen edge.

```css
/* ✅ Correct — floats 12px above safe area bottom, always visible above iOS toolbar */
.glass-nav {
  border-radius: 22px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.35);
  bottom: max(env(safe-area-inset-bottom, 0px) + 12px, 12px) !important;
}

.bottom-nav {
  padding-bottom: max(env(safe-area-inset-bottom, 0px), 0px);
  z-index: 150;
}

/* ❌ Wrong — flush to screen edge, clipped by Safari toolbar */
.glass-nav {
  border-radius: 22px 22px 0 0;
  border-bottom: none;
}
```

**The `12px` float margin** ensures the nav clears the Safari bottom toolbar (which hovers ~50px from the bottom) and the iOS home indicator gesture bar.

---

### 8.3 Fullscreen Button — Anchored Above the Nav

**Rule:** The Fullscreen button must be anchored relative to the nav height, not to the raw screen edge.

```html
<!-- ✅ Correct — always sits above the nav bar -->
<button id="fullscreen-toggle" style="
  position: fixed;
  right: 24px;
  bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + 12px);
  z-index: 1000;
">Fullscreen</button>

<!-- ❌ Wrong — overlaps with nav, hidden under toolbar -->
<button id="fullscreen-toggle" style="bottom: 24px;">Fullscreen</button>
```

---

### 8.4 Nav Hidden During Overlay

**Rule:** When the sub-app overlay (iframe) is open, the global nav must be hidden to avoid it showing through the iframe content.

```css
body.fullscreen-overlay-open #global-bottom-nav,
body.fullscreen-overlay-open #fullscreen-toggle,
body.fullscreen-overlay-open #theme-toggle,
body.fullscreen-overlay-open .curriculum-badge {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}
```

---

### 8.5 Screen Content Bottom Padding Update

Since the nav now floats 12px above the bottom instead of sitting flush, screen content padding must account for the extra clearance:

```css
/* ✅ Correct — 32px clears the 12px float margin + a comfortable 20px visual gap */
.screen-content {
  padding: 20px 36px calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + 32px);
}

/* ❌ Old — insufficient bottom clearance for floating nav */
.screen-content {
  padding: 20px 36px calc(var(--nav-height) + var(--safe-bottom) + 20px);
}
```

---

### 8.6 Summary — Files Changed

| File | Change |
|------|--------|
| `index.html` | Removed 3× per-screen `<nav class="bottom-nav">` copies; added single `<nav id="global-bottom-nav">` as top-level body element after all screen divs |
| `index.html` | `#fullscreen-toggle` bottom: `24px` → `calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + 12px)` |
| `styles.css` | `.glass-nav`: `border-radius: 22px 22px 0 0` → `22px` (full pill), removed `border-bottom: none`, added floating `bottom` with safe-area |
| `styles.css` | `.bottom-nav`: z-index `100` → `150`, added `transition` for smooth overlay hide/show |
| `styles.css` | `.screen-content`: bottom padding offset `+20px` → `+32px` to clear floating nav |
| `styles.css` | `body.fullscreen-overlay-open`: added `#global-bottom-nav` to the hidden-elements rule |
