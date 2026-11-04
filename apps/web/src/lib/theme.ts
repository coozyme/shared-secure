export type Theme = 'light' | 'dark';

/** Same key as static/theme-init.js, which applies a saved dark theme before first paint. */
const THEME_STORAGE_KEY = 'shared-theme';

/** Light is the default (design spec). Only an explicit choice switches to dark. */
export function currentTheme(): Theme {
  return document.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'light';
}

export function setTheme(theme: Theme): void {
  if (theme === 'dark') document.documentElement.dataset['theme'] = 'dark';
  else delete document.documentElement.dataset['theme'];
  try {
    if (theme === 'dark') window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    else window.localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
}
