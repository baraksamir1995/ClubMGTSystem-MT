'use client';

import { X, ExternalLink } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import AnnouncementMedia from './announcement-media';
import type { Announcement } from '@/lib/types/announcement';

/**
 * The announcement popup — media banner, title, rich-text body, optional
 * CTA, and a floating close button.
 *
 * Not built on <Modal> from components/ui: Modal's header renders the
 * announcement's own title, whereas this dialog's header is a fixed
 * "What's New?" label with the announcement title sitting below the
 * media. Everything else — portal, ESC, focus trap, scroll lock,
 * backdrop, and the surface/line/radius tokens — matches Modal
 * deliberately, so it still reads as the same dialog family.
 *
 * Used for the auto-popup, for opening an item from the What's New
 * panel, and for the super-admin's Preview.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Props {
  announcement: Announcement;
  onClose: () => void;
  /** Preview mode: renders the chrome but doesn't report a dismissal. */
  preview?: boolean;
}

export default function AnnouncementDialog({ announcement, onClose, preview = false }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // ESC closes — same contract as Modal.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Focus into the panel, trap Tab, and restore focus to the opener.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel) (panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel).focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    };
    window.addEventListener('keydown', trap);
    return () => { window.removeEventListener('keydown', trap); opener?.focus?.(); };
  }, []);

  // Lock background scroll.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, []);

  if (!mounted) return null;

  const publishedLabel = announcement.published_at
    ? new Date(announcement.published_at).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    : null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-title"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      // z-[60] rather than Modal's z-50: the super-admin Preview opens
      // from inside the Create/Edit modal, so it has to stack above it.
      // Relying on DOM order alone left the two overlapping.
      className={cn(
        'fixed inset-0 flex items-center justify-center p-4 bg-overlay/60 backdrop-blur-sm',
        preview ? 'z-[60]' : 'z-50',
      )}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        onMouseDown={e => e.stopPropagation()}
        className="w-full max-w-2xl bg-surface-2 border border-line rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header — "What's New?" centred, close button at the end.
            The heading is absolutely centred on the panel rather than
            flexed between spacers, so it stays on the true midline
            regardless of the close button's width. */}
        <div className="relative flex items-center justify-center px-4 py-3 border-b border-line flex-shrink-0">
          <p className="text-sm font-semibold text-fg">What&apos;s New?</p>
          <button
            type="button"
            onClick={onClose}
            aria-label={preview ? 'Close preview' : 'Dismiss update'}
            className="absolute end-2 inline-flex items-center justify-center w-11 h-11 rounded-lg
                       text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        {/* Media */}
        <div className="flex-shrink-0">
          <AnnouncementMedia
            mediaType={announcement.media_type}
            mediaUrl={announcement.media_url}
            title={announcement.title}
          />
        </div>

        {/* Content — padding and title step up with the panel so the
            text block doesn't look stranded in the wider layout. */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {publishedLabel && (
            <p className="text-xs text-fg-faint mb-2">{publishedLabel}</p>
          )}
          <h2 id="announcement-title" className="text-xl sm:text-2xl font-semibold text-fg mb-3 text-balance">
            {announcement.title}
          </h2>

          {/* Sanitised server-side against a tag allowlist in
              App\Services\HtmlSanitizer before it was ever stored, so
              there is no untrusted markup to render here. */}
          <div
            className="rich-text text-sm text-fg-muted"
            dangerouslySetInnerHTML={{ __html: announcement.content }}
          />

          {announcement.cta_label && announcement.cta_url && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="primary"
                // Full-width only on narrow screens; stretched across the
                // wide panel it stops reading as a button.
                className="w-full sm:w-auto sm:min-w-[12rem]"
                onClick={() => {
                  if (preview) return;
                  // Internal routes stay in the tab; external links open
                  // in a new one so the admin doesn't lose their place.
                  if (announcement.cta_url!.startsWith('/')) {
                    window.location.href = announcement.cta_url!;
                  } else {
                    window.open(announcement.cta_url!, '_blank', 'noopener,noreferrer');
                  }
                  onClose();
                }}
                rightIcon={
                  announcement.cta_url.startsWith('/')
                    ? undefined
                    : <ExternalLink className="w-4 h-4" aria-hidden />
                }
              >
                {announcement.cta_label}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
