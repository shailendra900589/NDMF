export const THEME_KEY = 'smartstaff-theme';
export function readTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* Storage can be disabled in private browsers. */ }
  if (typeof document !== 'undefined' && document.documentElement.dataset.theme) return document.documentElement.dataset.theme;
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
export function applyTheme(theme) {
  const value = theme === 'dark' ? 'dark' : 'light';
  try { localStorage.setItem(THEME_KEY, value); } catch { /* Theme still works without persistence. */ }
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = value;
    document.documentElement.style.colorScheme = value;
  }
  return value;
}
