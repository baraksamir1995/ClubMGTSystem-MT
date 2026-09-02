'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import AnnouncementDialog from './announcement-dialog';
import { AnnouncementThumb } from './announcement-media';
import type { Announcement } from '@/lib/types/announcement';

/**
 * "What's New" bell for the dashboard header.
 *
 * Owns all three surfaces so they share one source of truth and one
 * fetch: the unread badge, the history popover, and the auto-popup for
 * an announcement this user has never seen.
 *
 * Read state lives on the server (product_announcement_reads), not in
 * localStorage — a dismissal has to follow the user to another browser
 * or device. Local state here is only an optimistic mirror so the badge
 * updates without a round trip.
 */
export default function WhatsNewBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [active, setActive] = useState<Announcement | null>(null);
  /** Distinguishes the auto-popup from a click-through, which decides
   *  whether closing counts as a dismissal or just a read. */
  const [isAutoPopup, setIsAutoPopup] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);

  // ── Badge + auto-popup on mount ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [countRes, popupRes] = await Promise.all([
          fetch('/api/announcements/unread-count'),
          fetch('/api/announcements/popup'),
        ]);

        if (cancelled) return;

        if (countRes.ok) {
          const json = await countRes.json();
          setUnread(json.data?.unread ?? 0);
        }

        if (popupRes.ok) {
          const json = await popupRes.json();
          if (json.data && !cancelled) {
            setActive(json.data);
            setIsAutoPopup(true);
          }
        }
      } catch {
        // A failed badge fetch must never break the dashboard header —
        // the bell just renders without a count.
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── Close the popover on outside click / ESC ───────────────────────────
  useEffect(() => {
    if (!open) return;

    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };

    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/announcements');
      if (!res.ok) throw new Error('failed');
      const json = await res.json();
      setItems(json.data ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const togglePanel = () => {
    const next = !open;
    setOpen(next);
    // Fetch on first open only; reopening reuses what we have, and the
    // optimistic updates below keep it accurate.
    if (next && items === null) void loadItems();
  };

  /** Mark read locally + on the server. Safe to call repeatedly. */
  const markRead = useCallback(async (announcement: Announcement, dismiss: boolean) => {
    if (!announcement.is_read) {
      setUnread(n => Math.max(0, n - 1));
      setItems(prev => prev?.map(a => a.id === announcement.id ? { ...a, is_read: true } : a) ?? prev);
    }

    try {
      await fetch(`/api/announcements/${announcement.id}/${dismiss ? 'dismiss' : 'read'}`, { method: 'POST' });
    } catch {
      // Best effort. A missed write only means the popup may return on
      // the next load — never a broken screen.
    }
  }, []);

  const openItem = (announcement: Announcement) => {
    setActive(announcement);
    setIsAutoPopup(false);
    setOpen(false);
    void markRead(announcement, false);
  };

  const closeDialog = () => {
    const closing = active;
    setActive(null);
    // Closing the auto-popup is the dismissal the spec describes; closing
    // one opened from the panel was already marked read on open.
    if (closing && isAutoPopup) {
      void markRead(closing, true);
      // The popup bypassed the panel, so keep a loaded list in sync.
      setItems(prev => prev?.map(a => a.id === closing.id ? { ...a, is_read: true } : a) ?? prev);
    }
    setIsAutoPopup(false);
  };

  return (
    <>
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={togglePanel}
          aria-label={unread > 0 ? `What's New — ${unread} unread` : "What's New"}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cn(
            'relative inline-flex items-center justify-center w-11 h-11 rounded-lg transition-colors',
            'text-fg-muted hover:text-fg hover:bg-surface-3',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
            open && 'bg-surface-3 text-fg',
          )}
        >
          <Bell className="w-[18px] h-[18px]" aria-hidden />
          {/* No badge at zero — an empty "0" pill reads as a broken count. */}
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full
                         bg-brand-fill text-brand-ink border border-brand-edge
                         text-[10px] font-semibold leading-none
                         inline-flex items-center justify-center"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>

        {open && (
          <div
            role="dialog"
            aria-label="What's New"
            className="absolute end-0 mt-2 w-[min(22rem,calc(100vw-2rem))] z-40
                       bg-surface-2 border border-line rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-line">
              <h2 className="text-sm font-semibold text-fg">What&apos;s New</h2>
              {unread > 0 && (
                <span className="text-xs text-fg-muted">{unread} unread</span>
              )}
            </div>

            <div className="max-h-[26rem] overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-fg-muted">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Loading…
                </div>
              )}

              {!loading && error && (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-fg-muted mb-3">Couldn&apos;t load updates.</p>
                  <button
                    type="button"
                    onClick={() => void loadItems()}
                    className="text-sm text-brand hover:underline min-h-11 px-3"
                  >
                    Try again
                  </button>
                </div>
              )}

              {!loading && !error && items?.length === 0 && (
                <div className="px-4 py-10 text-center">
                  <Sparkles className="w-6 h-6 text-fg-faint mx-auto mb-2" aria-hidden />
                  <p className="text-sm font-medium text-fg">You&apos;re all caught up</p>
                  <p className="text-xs text-fg-muted mt-1">Product updates will show up here.</p>
                </div>
              )}

              {!loading && !error && items?.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-start border-b border-line
                             last:border-b-0 hover:bg-surface-3/60 transition-colors
                             focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
                >
                  <AnnouncementThumb
                    mediaType={item.media_type}
                    mediaUrl={item.media_url}
                    title={item.title}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start gap-2">
                      <span className={cn(
                        'text-sm line-clamp-2 flex-1',
                        item.is_read ? 'text-fg-muted font-normal' : 'text-fg font-semibold',
                      )}>
                        {item.title}
                      </span>
                      {!item.is_read && (
                        <span
                          aria-label="Unread"
                          className="mt-1.5 w-2 h-2 rounded-full bg-brand-fill flex-shrink-0"
                        />
                      )}
                    </span>
                    {item.published_at && (
                      <span className="block text-[11px] text-fg-faint mt-0.5">
                        {new Date(item.published_at).toLocaleDateString(undefined, {
                          year: 'numeric', month: 'short', day: 'numeric',
                        })}
                      </span>
                    )}
                    <span className="block text-xs text-fg-muted line-clamp-2 mt-1">
                      {item.excerpt}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {active && (
        <AnnouncementDialog announcement={active} onClose={closeDialog} />
      )}
    </>
  );
}
