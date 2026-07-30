'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Menu, X } from 'lucide-react';

/**
 * MobileSidebar — hamburger trigger + slide-over drawer for viewports
 * below `lg`. The drawer re-renders the same sidebar content the
 * desktop rail shows (passed as children from the server layout), so
 * nav permissions and gym identity stay single-sourced.
 */
export default function MobileSidebar({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const t = useTranslations('layout');

  // Close the drawer when a nav link navigates.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock background scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  // ESC closes the drawer, matching the Modal component's behavior.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('openNav')}
        aria-expanded={open}
        className="lg:hidden min-w-11 min-h-11 -ms-2 inline-flex items-center justify-center rounded-lg text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
      >
        <Menu className="w-5 h-5" aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={t('navDrawer')}>
          <div
            className="absolute inset-0 bg-overlay/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 start-0 w-72 max-w-[85vw] bg-surface border-e border-line shadow-2xl flex flex-col overflow-y-auto">
            {/* In-flow close row so the gym identity block below never
                truncates underneath the button. */}
            <div className="flex justify-end px-2 pt-2 -mb-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('closeNav')}
                className="min-w-11 min-h-11 inline-flex items-center justify-center rounded-lg text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            </div>
            {children}
          </aside>
        </div>
      )}
    </>
  );
}
