'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  const transition = useRef<ViewTransition | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function applyTheme() {
    const next = document.documentElement.classList.toggle('dark');
    const theme = next ? 'dark' : 'light';
    document.documentElement.style.colorScheme = theme;
    setDark(next);
    window.dispatchEvent(new CustomEvent('design-jobs:theme-change', { detail: theme }));
    try { localStorage.setItem('design-jobs:theme', theme); }
    catch { /* The selected theme still applies to this visit. */ }
  }

  function toggle(event: MouseEvent<HTMLButtonElement>) {
    transition.current?.skipTransition();
    if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      applyTheme();
      return;
    }

    const button = event.currentTarget.getBoundingClientRect();
    const x = button.left + button.width / 2;
    const y = button.top + button.height / 2;
    const radius = Math.ceil(Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)));
    const root = document.documentElement;
    root.style.setProperty('--theme-x', x + 'px');
    root.style.setProperty('--theme-y', y + 'px');
    root.style.setProperty('--theme-radius', radius + 'px');
    root.classList.add('theme-reveal');
    const next = document.startViewTransition(applyTheme);
    transition.current = next;
    void next.finished.finally(() => {
      if (transition.current === next) {
        transition.current = null;
        root.classList.remove('theme-reveal');
      }
    });
  }

  return (
    <button type="button" className="theme-toggle" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggle}>
      <Sun className="theme-sun" size={17} aria-hidden="true" />
      <Moon className="theme-moon" size={17} aria-hidden="true" />
    </button>
  );
}
