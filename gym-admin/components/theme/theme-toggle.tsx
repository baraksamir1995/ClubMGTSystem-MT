'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { THEME_STORAGE_KEY } from './theme-script';

type Theme = 'light' | 'dark';

function readResolvedTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function readStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null; // localStorage can throw SecurityError when site data is blocked
  }
}

/**
 * ThemeToggle — switch between light and dark, overriding the OS
 * preference. The manual choice persists in localStorage and is
 * re-applied before first paint by <ThemeScript>.
 *
 * Accessibility: real <button> with `aria-pressed` (pressed = dark),
 * an explicit aria-label, and a visually-hidden `role="status"` region
 * that announces the change to screen readers. 44×44 target.
 */
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const t = useTranslations('layout');
  // null until mounted — the server can't know the resolved theme.
  const [theme, setTheme] = useState<Theme | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    setTheme(readResolvedTheme());
    // Follow live OS changes only while the user hasn't made a manual
    // choice — a stored preference always wins.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      if (readStoredTheme() !== null) return;
      const next: Theme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      setTheme(next);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = () => {
    const next: Theme = readResolvedTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* persist is best-effort; the toggle still works for the session */
    }
    setTheme(next);
    setAnnouncement(next === 'dark' ? t('themeDarkEnabled') : t('themeLightEnabled'));
  };

  const isDark = theme === 'dark';

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={theme === null ? undefined : isDark}
        aria-label={t('themeToggle')}
        title={t('themeToggle')}
        className={
          'inline-flex items-center justify-center min-w-11 min-h-11 rounded-lg ' +
          'text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors ' +
          className
        }
      >
        {/* Icon shows the CURRENT mode; label + aria-pressed carry the
            semantics, so the icon is decorative. */}
        {isDark ? <Moon className="w-5 h-5" aria-hidden /> : <Sun className="w-5 h-5" aria-hidden />}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  );
}
