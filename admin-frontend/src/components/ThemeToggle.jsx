import { useEffect, useState } from 'react';
import { applyTheme, readTheme, THEME_KEY } from '../utils/theme';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    const refresh = event => { if (event.key === THEME_KEY) setTheme(applyTheme(event.newValue)); };
    window.addEventListener('storage',refresh);
    return () => window.removeEventListener('storage',refresh);
  },[]);
  const dark = theme === 'dark';
  return <button type="button" className="theme-toggle" aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`} aria-pressed={dark} onClick={() => setTheme(applyTheme(dark ? 'light' : 'dark'))}>
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">{dark ? <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></> : <path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/>}</svg>
    <span>{dark ? 'Light mode' : 'Dark mode'}</span>
  </button>;
}
