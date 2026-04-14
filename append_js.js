const fs = require('fs');

const jsCode = `
// --- Theme Toggle Logic ---
window.toggleTheme = window.toggleTheme || function() {
  const isLight = document.body.classList.toggle('light-theme');
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    if (isLight) {
      themeBtn.innerHTML = '<span class="theme-icon">☀️</span> Light';
    } else {
      themeBtn.innerHTML = '<span class="theme-icon">🌙</span> Dark';
    }
  }
};
`;

fs.appendFileSync('script.js', jsCode);
