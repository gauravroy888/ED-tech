/**
 * EDTECH ISLAND — IFP Performance Optimizer (SAFE)
 * Targets: 75" 4K Smartboard @ Octa-core A73/A53, 8GB DDR4
 *
 * IMPORTANT: This file must NEVER override native browser APIs like
 * window.addEventListener. That breaks all button/interaction logic.
 *
 * Safe responsibilities only:
 *  1. Detect 4K display and expose global pixel-ratio cap
 *  2. Touch hardening on canvas elements only (not the whole page)
 *  3. GPU memory disposer for Three.js scene teardown
 *  4. Page Visibility API flag for animate() loops
 *  5. Large hit-target CSS (without user-select interference)
 */
'use strict';

/* ── 1. RENDER-RESOLUTION BUDGET ──────────────────────────────────────
   The A73/A53 GPU cannot push 3840×2160 at 60fps in WebGL.
   We cap the WebGL pixel ratio so the canvas renders at ≤1080p equivalent,
   while CSS stretches it to fill the container — browser nearest-neighbour
   upscale is nearly free and maintains perceived sharpness on 75" screens. */
window.IFP_PIXEL_RATIO = (function () {
  var dpr  = window.devicePixelRatio || 1;
  var physW = window.screen.width * dpr;
  if (physW >= 3840) return 1.0;   // 4K panel → render at 1920×1080
  if (physW >= 2560) return 1.25;  // QHD panel → render at ~1440p
  return 1.5;                      // 1080p panel → small upscale
})();

/* ── 2. CANVAS TOUCH HARDENING ────────────────────────────────────────
   Applied ONLY to the WebGL canvas containers, not the whole page.
   Prevents pinch-zoom and browser scroll gestures from hijacking the
   3D drag-rotate interaction on a 40-point touch panel.
   We do NOT set touch-action on the body/html — that would break
   button taps on Android Chrome. */
document.addEventListener('DOMContentLoaded', function () {

  function hardenCanvas(el) {
    if (!el) return;
    el.style.touchAction = 'none';
    el.addEventListener('wheel', function (e) {
      e.preventDefault();
    }, { passive: false });
  }

  // Apply to canvas-container (index.html scene)
  var canvasContainer = document.getElementById('canvas-container');
  if (canvasContainer) hardenCanvas(canvasContainer);

  // Watch for dynamically added canvas elements (Chapter_experience_L_S.html)
  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (!node || node.nodeType !== 1) return;
        // Harden if it's a canvas directly, or its parent is a canvas container
        if (node.tagName === 'CANVAS') {
          hardenCanvas(node.parentElement);
        }
        if (node.querySelectorAll) {
          node.querySelectorAll('canvas').forEach(function (c) {
            hardenCanvas(c.parentElement);
          });
        }
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

}, { once: true });

/* ── 3. GPU MEMORY DISPOSER ───────────────────────────────────────────
   When navigating away from a chapter, Three.js GPU objects must be
   explicitly disposed. The Android WebView GC does NOT do this
   automatically → leads to OOM crashes after ~3 chapter switches. */
window.disposeThreeObject = function disposeThreeObject(obj) {
  if (!obj) return;

  // Recurse children first (copy array — disposal can mutate it)
  if (obj.children && obj.children.length) {
    obj.children.slice().forEach(disposeThreeObject);
  }

  // Dispose geometry
  if (obj.geometry) {
    obj.geometry.dispose();
  }

  // Dispose material(s) and their textures
  var mats = obj.material
    ? (Array.isArray(obj.material) ? obj.material : [obj.material])
    : [];

  mats.forEach(function (mat) {
    var textureSlots = [
      'map', 'lightMap', 'bumpMap', 'normalMap', 'specularMap', 'envMap',
      'alphaMap', 'aoMap', 'displacementMap', 'emissiveMap', 'gradientMap',
      'metalnessMap', 'roughnessMap'
    ];
    textureSlots.forEach(function (slot) {
      if (mat[slot]) { mat[slot].dispose(); mat[slot] = null; }
    });
    mat.dispose();
  });

  // Dispose render targets
  if (obj.isWebGLRenderTarget) obj.dispose();
};

/* ── 4. VISIBILITY API — PAUSE ANIMATION WHEN BACKGROUNDED ───────────
   Exposes window.IFP_VISIBLE so animate() loops can skip rendering
   when the Android smartboard locks / the tab is backgrounded.
   This alone saves significant battery and prevents background GPU load. */
window.IFP_VISIBLE = !document.hidden;
document.addEventListener('visibilitychange', function () {
  window.IFP_VISIBLE = !document.hidden;
});

/* ── 5. LARGE HIT-TARGET CSS ──────────────────────────────────────────
   On a 75" 4K display with thick glass, parallax offset can be ~3mm.
   Enforce minimum 52px tap targets. We deliberately do NOT set
   user-select:none globally as that can interfere with pointer events
   in some Chromium builds on Android. */
document.addEventListener('DOMContentLoaded', function () {
  var style = document.createElement('style');
  style.id = 'ifp-hit-target-style';
  style.textContent = [
    'button, .nav-btn, .sol-tab, .subject-card, .chapter-card, .experiment-card {',
    '  min-height: 52px;',
    '  min-width:  52px;',
    '}',
    '.carousel-nav {',
    '  min-width:  56px !important;',
    '  min-height: 56px !important;',
    '}'
  ].join('\n');
  document.head.appendChild(style);
}, { once: true });

/* ── 6. EXACT RATIO SCALING (Zoom-based responsive) ───────────────────
   Instead of squishing CSS, dynamically zoom the layout so it looks exactly 
   like 1080p, but fits into any display resolution (like 1280x720). */
document.addEventListener('DOMContentLoaded', function () {
  var applyExactRatioScale = function() {
    var winW = window.innerWidth;
    var winH = window.innerHeight;
    
    var baseW = 1920;
    var baseH = 1080;
    
    // How much do we need to scale to fit?
    var scaleRatio = Math.min(winW / baseW, winH / baseH);
    
    // Apply zoom on body to proportionally scale everything identically
    // Works perfectly in Chromium / WebViews on Smartboards
    if (scaleRatio < 1.0) {
      document.body.style.zoom = scaleRatio;
      document.documentElement.style.setProperty('--ifp-zoom', scaleRatio);
      document.body.style.height = (100 / scaleRatio) + 'vh';
    } else {
      document.body.style.zoom = 1.0;
      document.documentElement.style.setProperty('--ifp-zoom', 1.0);
      document.body.style.height = '100vh';
    }
  };
  
  window.addEventListener('resize', applyExactRatioScale);
  // Give it a tiny timeout on first load to ensure CSS is painted
  setTimeout(applyExactRatioScale, 10);
});

console.log(
  '%c⚡ IFP Optimizer v3 (safe + ratio-scale) | PixelRatio cap: ' + window.IFP_PIXEL_RATIO,
  'color:#22d3ee;font-weight:bold;'
);
