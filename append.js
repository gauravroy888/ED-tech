const fs = require('fs');

const css = `
/* --- LIGHT THEME OVERRIDES --- */
body.light-theme {
  --glass-bg:            rgba(255, 255, 255, 0.22);
  --glass-bg-hover:      rgba(255, 255, 255, 0.30);
  --glass-bg-strong:     rgba(255, 255, 255, 0.18);
  --glass-shadow:        0 8px 32px rgba(31, 38, 135, 0.15), 0 2px 10px rgba(0,0,0,0.06);
  --glass-shadow-hover:  0 12px 48px rgba(31, 38, 135, 0.25), 0 4px 18px rgba(0,0,0,0.12);
  --glass-border:        rgba(255, 255, 255, 0.42);
  --glass-border-bright: rgba(255, 255, 255, 0.65);
}

body.light-theme .glass-card { background: rgba(255, 255, 255, 0.16); }
body.light-theme .glass-pill { background: rgba(255, 255, 255, 0.20); }
body.light-theme .glass-mini { background: rgba(255, 255, 255, 0.16); }
body.light-theme .curriculum-badge { background: rgba(255, 255, 255, 0.22); }
body.light-theme .logo-pill { background: rgba(255, 255, 255, 0.22); }
body.light-theme .btn-primary { background: rgba(255, 255, 255, 0.22); }
body.light-theme .btn-primary:hover { background: rgba(255, 255, 255, 0.35); }
body.light-theme .btn-secondary { background: rgba(255, 255, 255, 0.14); }
body.light-theme .btn-secondary:hover { background: rgba(255, 255, 255, 0.28); }
body.light-theme .sol-tab { background: rgba(255, 255, 255, 0.20); }
body.light-theme .sol-tab:hover { background: rgba(255, 255, 255, 0.30); }
body.light-theme .sol-tab.active-tab { background: rgba(255, 255, 255, 0.28); }
body.light-theme .sol-start-btn { background: rgba(255, 255, 255, 0.22); }
body.light-theme .sol-start-btn:hover { background: rgba(255, 255, 255, 0.38); border-color: rgba(255, 255, 255, 0.60); }
body.light-theme .carousel-nav { background: rgba(255, 255, 255, 0.22); }
body.light-theme .carousel-nav:hover { background: rgba(255, 255, 255, 0.35); border-color: rgba(255, 255, 255, 0.70); }
body.light-theme .sol-locked-panel { background: rgba(255, 255, 255, 0.14); }
body.light-theme .sol-nav-btn { background: rgba(255, 255, 255, 0.22); }
body.light-theme .sol-nav-btn:hover { background: rgba(255, 255, 255, 0.25); }

/* Text overrides */
body.light-theme .btn-primary { color: rgba(15, 15, 25, 0.88); }
body.light-theme .btn-secondary { color: rgba(20, 20, 30, 0.70); }
body.light-theme .btn-secondary:hover { color: rgba(10, 10, 20, 0.90); }
body.light-theme .page-title-text { color: rgba(30, 30, 40, 0.92); }
body.light-theme .breadcrumb-label { color: rgba(30, 30, 40, 0.60); }
body.light-theme .subject-card { color: rgba(20, 20, 30, 0.90); }
body.light-theme .subject-card-name { color: rgba(15, 15, 25, 0.90); }
body.light-theme .subject-card-stat { color: rgba(30, 30, 40, 0.58); }
body.light-theme .chapter-card { color: rgba(20, 20, 30, 0.90); }
body.light-theme .chapter-card-number { color: rgba(15, 15, 25, 0.90); }
body.light-theme .chapter-card-page { color: rgba(30, 30, 40, 0.50); }
body.light-theme .sol-start-btn { color: rgba(20, 20, 30, 0.82); }
body.light-theme .carousel-nav { color: rgba(20, 20, 30, 0.80); }
body.light-theme .carousel-nav:hover { color: rgba(10, 10, 20, 0.95); }
body.light-theme .subject-card-divider { background: linear-gradient(90deg, transparent, rgba(0,0,0,0.18), transparent); }

/* Border / Shadow resets */
body.light-theme .glass-card { border: 1px solid rgba(255, 255, 255, 0.42); }
body.light-theme .glass-pill { border: 1px solid rgba(255, 255, 255, 0.38); }
body.light-theme .glass-mini { border: 1px solid rgba(255, 255, 255, 0.38); }
`;
fs.appendFileSync('styles.css', css);
