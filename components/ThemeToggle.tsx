'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = document.documentElement.classList.toggle('dark');
    const theme = next ? 'dark' : 'light';
    document.documentElement.style.colorScheme = theme;
    setDark(next);
    window.dispatchEvent(new CustomEvent('design-jobs:theme-change', { detail: theme }));
    try { localStorage.setItem('design-jobs:theme', theme); }
    catch { /* The selected theme still applies to this visit. */ }
  }

  return (
    <button type="button" className="theme-toggle" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggle}>
      <Sun className="theme-sun" size={17} aria-hidden="true" />
      <Moon className="theme-moon" size={17} aria-hidden="true" />
    </button>
  );
}
