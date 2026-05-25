'use client';

import type { MouseEvent } from 'react';
import { useEffect, useState } from 'react';

const THEME_KEY = 'design-jobs:theme';

type Theme = 'light' | 'dark';
type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>;
  };
};

function getInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new CustomEvent('design-jobs:theme-change', { detail: theme }));
}

function applyThemeWithFallback(theme: Theme) {
  document.documentElement.classList.add('theme-fallback-changing');
  applyTheme(theme);
  window.setTimeout(() => {
    document.documentElement.classList.remove('theme-fallback-changing');
  }, 220);
}

function setWipeGeometry(source: HTMLElement | null) {
  const rect = source?.getBoundingClientRect();
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth - 32;
  const y = rect ? rect.top + rect.height / 2 : 26;
  const radius = Math.ceil(
    Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    ) + 96
  );

  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--theme-wipe-x', `${x}px`);
  rootStyle.setProperty('--theme-wipe-y', `${y}px`);
  rootStyle.setProperty('--theme-wipe-radius', `${radius}px`);
}

function finishWipe() {
  document.documentElement.classList.remove('theme-wipe-active');
  window.setTimeout(() => {
    document.documentElement.classList.remove('theme-changing');
  }, 20);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const nextTheme = getInitialTheme();
    setTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const isDark = theme === 'dark';

  const commitTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(THEME_KEY, nextTheme);
  };

  const toggleTheme = (event: MouseEvent<HTMLButtonElement>) => {
    const nextTheme: Theme = isDark ? 'light' : 'dark';
    const transitionDocument = document as ViewTransitionDocument;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!transitionDocument.startViewTransition || prefersReducedMotion) {
      setTheme(nextTheme);
      applyThemeWithFallback(nextTheme);
      window.localStorage.setItem(THEME_KEY, nextTheme);
      return;
    }

    setWipeGeometry(event.currentTarget);
    document.documentElement.classList.add('theme-changing', 'theme-wipe-active');

    const transition = transitionDocument.startViewTransition(() => {
      commitTheme(nextTheme);
    });

    transition.finished.finally(finishWipe);
  };

  return (
    <button
      type="button"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      onClick={toggleTheme}
      className="theme-toggle focus-ring"
    >
      <span className="theme-toggle-icon" data-theme-state={theme} aria-hidden="true" suppressHydrationWarning>
        <svg viewBox="0 0 24 24" width="18" height="18">
          <g className="theme-sun-layer" fill="currentColor">
            <path d="M12 0a1 1 0 0 1 1 1v4a1 1 0 1 1-2 0V1a1 1 0 0 1 1-1M4.929 3.515a1 1 0 0 0-1.414 1.414l2.828 2.828a1 1 0 0 0 1.414-1.414zM1 11a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2zm17 1a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2h-4a1 1 0 0 1-1-1m-.343 4.243a1 1 0 0 0-1.414 1.414l2.828 2.828a1 1 0 1 0 1.414-1.414zm-9.9 1.414a1 1 0 1 0-1.414-1.414L3.515 19.07a1 1 0 1 0 1.414 1.414zM20.485 4.929a1 1 0 0 0-1.414-1.414l-2.828 2.828a1 1 0 1 0 1.414 1.414zM13 19a1 1 0 1 0-2 0v4a1 1 0 1 0 2 0zm-1-3a4 4 0 1 0 0-8a4 4 0 0 0 0 8" />
          </g>
          <g className="theme-moon-layer">
            <g transform="translate(1.55 1.15) scale(0.028)">
              <path
                fill="currentColor"
                d="M732 392q3-2 7-1t3 5q-4 76-36 142t-84 114t-122 74t-147 23q-71-4-133-33t-109-77t-77-109T1 397q-4-78 23-147t74-122t114-84T354 8q4 0 6 3t-2 7q-31 40-46 90t-8 106q5 45 25 85t51 71t71 51t85 25q56 7 106-8t90-46"
              />
            </g>
          </g>
        </svg>
      </span>
    </button>
  );
}
