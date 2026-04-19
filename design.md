# Edtech Island — Platform Design & Architecture Standards

The **single source of truth** for all UI layout, scaling, styling, and performance rules across every module (Chapters, Quizzes, Shadow Labs, Stories, etc.).

> **AI Rule:** Cross-reference this file before making any visual or architectural change to shared files (`styles.css`, `index.html`, `script.js`).

---

## 1. Scaling Philosophy — "Design for 1080p, Scale for All"

### 1.1 Legacy JS Scaling (perf_optimizer.js)
- Calculates `scaleRatio = Math.min(winW / baseW, winH / baseH)` and applies `body.style.zoom`.
- Base canvas: **1920×1080** standard, **1366×768** landscape tablet, **820×1180** portrait tablet.
- Exports `--ifp-zoom` CSS variable for overlay inversion: `calc(100vw / var(--ifp-zoom, 1))`.

### 1.2 Fluid CSS Architecture (New Standard — April 2026+)
- **Use for:** Quiz, Shadow Lab, Chapter Experience, and all new modules.
- **Avoid** `perf_optimizer.js` zoom for layout; use CSS Flexbox/Grid + container queries instead.
- For 3D canvases, use `aspect-ratio` or `flex: 0 0 58%` to preserve proportions.

---

## 2. CSS Reset Foundation (`@layer reset`)

Always at the **very top** of `styles.css`. Uses `@layer` for lowest cascade specificity — never overrides component styles.

```css
@layer reset {
  :where(*, *::before, *::after) { box-sizing: border-box; min-width: 0; }
  :where(html) {
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
    scrollbar-gutter: stable;
    interpolate-size: allow-keywords;
  }
  :where(body) { min-block-size: 100dvh; overflow-x: clip; }
  :where(img, svg, video, canvas, iframe) { display: block; max-inline-size: 100%; block-size: auto; }
}
```

---

## 3. Layout Rules

### 3.1 Viewport Height — always use `dvh`
```css
height: 100dvh; /* primary */
height: 100vh;  /* fallback */
```
Never use raw `100vh` — it lies on iPad Safari when the address bar is visible.

### 3.2 Flex Grid Height — `flex: 1; min-height: 0`
```css
.subjects-grid, .chapters-grid { flex: 1; min-height: 0; }
```
Never use `height: 70%` or `flex: 0 1 70%` — percentage heights break on Safari.

### 3.3 Grid Tracks — always `minmax(0, 1fr)`
```css
grid-template-columns: repeat(4, minmax(0, 1fr));
```
Plain `1fr` = `minmax(auto, 1fr)` which ignores container bounds and blows out layouts.

### 3.4 `min-width: 0` on all flex/grid children
Required on: `.subject-card`, `.chapter-card`, `.app-overlay-shell`, `.tab-panels-area`, `.sol-canvas-wrap`, `.screen-content`, `.experiments-carousel`.

### 3.5 Scroll containers — `overflow: clip` not `overflow: hidden`
- `overflow: hidden` creates a scroll container → breaks `position: sticky` children.
- `overflow: clip` clips visually without creating a scroll container.
- Pair with `overflow-clip-margin: 4px–12px` on cards to prevent box-shadow severing.

### 3.6 Scroll container max-heights
```css
.stories-scroll-container { max-height: calc(100dvh - 380px); }
```
Never hardcode arbitrary `max-height` pixel values.

### 3.7 Spacing tokens — no raw `px` values
```css
:root {
  --space-xs: 4px;  --space-sm: 8px;
  --space-md: 16px; --space-lg: 24px; --space-xl: 40px;
}
```

---

## 4. Safe Area & Viewport Meta

### 4.1 `viewport-fit=cover` — required in `index.html`
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0,
      maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```
Without this, all `env(safe-area-inset-*)` values return `0px` on iOS.

### 4.2 Safe-area padding — always use `max()`
```css
.screen-content {
  padding-bottom: max(calc(var(--nav-height) + 32px),
                      calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + 32px));
}
```

### 4.3 `theme-color` meta
```html
<meta name="theme-color" content="#03071a" />
```
Prevents white/grey chrome flash during fullscreen transitions on Android WebView.

---

## 5. Global Navigation Architecture

### 5.1 Single Global Nav Rule
The `#global-bottom-nav` must exist **once** at the end of `<body>`, outside all `.screen` divs. Never duplicated inside screen containers.

**z-index hierarchy:**

| Layer | z-index | Element |
|---|---|---|
| Screens | 10 | `.screen.active` |
| Bottom Nav | 150 | `#global-bottom-nav` |
| Sub-App Overlay | 200 | `#app-overlay` |
| Global Buttons | 1000 | `.curriculum-badge`, `#theme-toggle`, `#fullscreen-toggle` |

### 5.2 Floating Pill Nav
```css
.glass-nav {
  border-radius: 22px;
  bottom: max(env(safe-area-inset-bottom, 0px) + 12px, 12px) !important;
}
```
Floats 12px above safe area — always visible above iOS Safari toolbar.

### 5.3 Fullscreen Button Position
```css
bottom: calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + 12px);
```

### 5.4 Nav Visibility Rules
```css
/* Hidden when iframe overlay is open */
body.fullscreen-overlay-open #global-bottom-nav,
body.fullscreen-overlay-open #fullscreen-toggle,
body.fullscreen-overlay-open #theme-toggle { opacity: 0; visibility: hidden; pointer-events: none; }

/* Hidden when inside a chapter (main-menu-only nav) */
body.chapter-detail-open #global-bottom-nav,
body.chapter-detail-open #fullscreen-toggle,
body.chapter-detail-open #theme-toggle { opacity: 0; visibility: hidden; pointer-events: none; }
```
`chapter-detail-open` is toggled by `navigateTo()` in `script.js`.

---

## 6. Container Queries

Use `container-type: inline-size` for all components placed inside variable-width parents. Use `@container` queries instead of `@media` queries for component-level breakpoints.

| Container | `container-name` |
|---|---|
| `.subjects-grid` | `subjects-grid` |
| `.chapters-grid` | `chapters-grid` |
| `.screen-content` | `screen-content` |
| `.tab-panels-area` | `tab-panels` |

Use `cqi` units inside container queries (not `vw`).

---

## 7. Performance Rules (Smartboard / ARM CPUs)

| Rule | Detail |
|---|---|
| **4K pixel ratio cap** | `IFP_PIXEL_RATIO` caps WebGL at `1.0x` on ≥3840px panels, saving ~75% GPU fill-rate |
| **Touch hardening** | `touch-action: none` on canvases; block `gesturestart` + `wheel` on 3D containers |
| **Memory management** | `disposeThreeObject()` — recursive GPU disposer on every chapter unload to prevent OOM crashes |
| **Resize debounce** | All `resize` listeners debounced at `150ms + rAF` |
| **Page Visibility** | `IFP_VISIBLE` flag — rAF loops return immediately when panel is backgrounded |
| **Hit targets** | `min-height: 52px; min-width: 52px` on all interactive buttons |
| **Asset sizes** | Never use raw 4K PNGs for backgrounds — always optimised JPEG/WebP + CSS gradient overlay |
| **content-visibility** | Apply `content-visibility: auto` + `contain-intrinsic-size: auto 180px` on all grid cards |
| **Transitions** | Never `transition: all` — enumerate only `transform`, `box-shadow`, `border-color` |
| **will-change** | `will-change: transform` on hover-animated cards only |

### Three.js Specific
- **No giant `for` loops** at scene mount — cap procedural iterations at ≤ 2000.
- **Shadows:** `renderer.shadowMap.enabled = true` must be set at init, not hot-swapped. Use `THREE.PCFSoftShadowMap`.
- **Smart textures:** Use HTML5 Canvas gradients → `bumpMap` on `MeshStandardMaterial` instead of pre-computed noise.

---

## 8. Typography

```css
html {
  -webkit-text-size-adjust: 100%; /* Suppresses Android WebView font-boosting */
  text-size-adjust: 100%;
  scrollbar-gutter: stable;       /* Prevents 15–17px layout shift on Windows */
  interpolate-size: allow-keywords; /* Enables height:auto CSS transitions */
}
```

For wrapping inline highlights:
```css
mark, .inline-highlight {
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}
```

---

## 9. UI/UX Design Language

- **Glassmorphism:** `rgba(0,0,0,0.45)` background + `backdrop-filter: blur(8–10px)` + `border: 1px solid rgba(255,255,255,0.42)`.
- **Glow shadows:** `box-shadow: 0 0 30px rgba(...)` — never flat opaque backgrounds.
- **Accent colors:** Cyan `#40e0d0`, Gold `#f0c060`.
- **Font:** `Inter, Segoe UI, -apple-system, sans-serif`.
- **Active card states:** Increase border opacity to `0.65–0.80`, add `drop-shadow` glow.
- **Animations:** Ambient orbs under glass panels. Disable particle animations on `pointer: coarse` devices.

---

## 10. New Module Checklist

Before building any new module:
- [ ] Outermost wrapper uses `min-h-screen w-full` — **no** fixed `1920×1080` containers
- [ ] All grid tracks use `minmax(0, 1fr)`
- [ ] All flex children have `min-width: 0`
- [ ] Scrollable regions use `overflow: auto` / `scroll`, clipped regions use `overflow: clip`
- [ ] `content-visibility: auto` on all card lists
- [ ] `transition` enumerates specific properties — no `transition: all`
- [ ] Safe-area padding uses `max()` pattern
- [ ] `container-type: inline-size` set on resizable containers
- [ ] No `100vh` — use `100dvh` with `100vh` fallback
- [ ] Hit targets ≥ `52×52px`
