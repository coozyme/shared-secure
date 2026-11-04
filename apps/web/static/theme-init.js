// Applies a saved dark-theme preference before first paint. External file: CSP forbids inline scripts.
try {
  if (localStorage.getItem('shared-theme') === 'dark') {
    document.documentElement.dataset.theme = 'dark';
  }
} catch {
  // Storage blocked: keep the default light theme.
}
