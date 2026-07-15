/**
 * ThemeScript — blocking inline script that stamps the resolved theme
 * onto <html data-theme="…"> before first paint, so there is never a
 * flash of the wrong theme.
 *
 * Resolution order: the user's stored manual choice (localStorage,
 * written by <ThemeToggle>) wins; otherwise the OS preference via
 * `prefers-color-scheme`. Rendered as the first child of <body> in the
 * root layout — inline scripts block rendering of everything after
 * them, which is exactly what we want here.
 *
 * localStorage access is wrapped in try/catch: it throws SecurityError
 * when cookies/site data are blocked (see AuthController fix history).
 */
export const THEME_STORAGE_KEY = 'clby-admin-theme';

const bootstrap = `(function () {
  try {
    var stored = null;
    try { stored = localStorage.getItem('${THEME_STORAGE_KEY}'); } catch (e) {}
    var theme = (stored === 'light' || stored === 'dark')
      ? stored
      : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {}
})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: bootstrap }} />;
}
