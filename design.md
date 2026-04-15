# Edtech Island - Platform Design & Architecture Standards

This document tracks all core responsive design decisions, scaling algorithms, performance targets, and styling rules made for the Edtech Island platform. It acts as the ultimate source of truth for all modules (Chapters, Quizzes, Shadow Labs, Stories, etc.) going forward.

---

## 1. Core Scaling & Resolution Philosophy
**"Design for 1080p, Scale for All"**
The UI is visually built targeting a standard `1920x1080` pixel canvas. Rather than relying on exhaustive CSS media queries to resize every button for every possible resolution, the platform relies on a mathematics-based scaling engine located in `perf_optimizer.js`.
*   The script calculates: `scaleRatio = Math.min(winW / baseW, winH / baseH)`.
*   If the screen is smaller (e.g., a 1280x720 Smartboard), the script applies `document.body.style.zoom = scaleRatio`.
*   This approach ensures visually stunning proportions remain physically scaled across varying displays without manual recalculation.

### 1.1 Tablet-Aware Base Resolution (Added: April 2026)
The scaler in `perf_optimizer.js` now detects device category before choosing the base canvas, so the zoom ratio lands perfectly for each device class:

| Device Category | Detection Rule | Base Canvas | Typical Scale |
|---|---|---|---|
| **16:9 Smartboard / Desktop** | Default (none of below) | 1920 × 1080 | ~0.67 on 720p |
| **Landscape Tablet (4:3 / 16:10)** | Height 700–950px AND Width 700–1280px AND aspect < 1.65 | **1366 × 768** | ~0.96–1.0 ✅ |
| **Portrait Tablet (iPad, Lenovo)** | Portrait orientation AND width 600–1100px | **820 × 1180** | ~1.0 ✅ |

**Targeted tablet models:**
*   OnePlus Pad Lite / Pad Go 2 (~1200×753 CSS landscape)
*   Redmi Pad 2 (~1200×750 CSS landscape)
*   Apple iPad 11" (~1190×834 landscape, 834×1190 portrait)
*   Lenovo IdeaTab (~1200×752 landscape)
*   Xiaomi Pad 8 (~1200×753 landscape)



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
