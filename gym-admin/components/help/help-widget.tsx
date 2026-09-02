'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { HelpCircle, X, ChevronLeft, ChevronRight, Search, LifeBuoy } from 'lucide-react';
import { cn } from '@/lib/cn';
import { getArticles, CATEGORY_ORDER, CATEGORY_ICONS } from '@/lib/help/articles';
import { searchHelp, suggestFallback, relatedArticles } from '@/lib/help/search';
import type { HelpArticle, HelpCategory } from '@/lib/help/types';
import { isRtl } from '@/i18n/config';

/**
 * Help widget — a chat-style launcher in the corner of every dashboard
 * page that answers "how do I …" from an authored article library.
 *
 * It LOOKS like a chat bot on purpose (bubble launcher, question-shaped
 * titles, conversational panel) but there is no model behind it: search
 * is deterministic and every answer is a reviewed click-path. That
 * keeps it honest — it can only ever name buttons that really exist —
 * and costs nothing per query.
 *
 * Two views inside one panel: a browse/search list, and a single
 * article. `active` decides which.
 */
export default function HelpWidget() {
  const t = useTranslations('help');
  const locale = useLocale();
  const rtl = isRtl(locale);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<HelpArticle | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const articles = useMemo(() => getArticles(locale), [locale]);

  const results = useMemo(
    () => (query.trim() ? searchHelp(articles, query) : []),
    [articles, query],
  );
  const isSearching = query.trim().length > 0;
  const noMatches = isSearching && results.length === 0;

  // Only computed on a dead end, so the "still stuck?" path always has
  // something better than an empty state to show.
  const fallbacks = useMemo(
    () => (noMatches ? suggestFallback(articles, query) : []),
    [noMatches, articles, query],
  );

  const grouped = useMemo(() => {
    const map = new Map<HelpCategory, HelpArticle[]>();
    for (const a of articles) {
      const list = map.get(a.category);
      if (list) list.push(a);
      else map.set(a.category, [a]);
    }
    return CATEGORY_ORDER
      .map(c => [c, map.get(c) ?? []] as const)
      .filter(([, list]) => list.length > 0);
  }, [articles]);

  const related = useMemo(
    () => (active ? relatedArticles(articles, active) : []),
    [articles, active],
  );

  // ── Close on ESC / outside click ───────────────────────────────────────
  // ESC backs out of an article first, so a mis-click doesn't lose the
  // user's place in a search they just typed.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (active) setActive(null);
      else setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (launcherRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open, active]);

  // Focus the search box on open — the widget's whole point is typing a
  // question, so make that possible without a second click.
  useEffect(() => {
    if (open && !active) inputRef.current?.focus();
  }, [open, active]);

  // Opening an article should start at its first step, not wherever the
  // list happened to be scrolled to.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [active]);

  const closePanel = useCallback(() => {
    setOpen(false);
    // Returning focus to the launcher keeps keyboard users where they
    // were instead of dumping focus at the top of the document.
    launcherRef.current?.focus();
  }, []);

  const openArticle = (a: HelpArticle) => setActive(a);

  const Back = rtl ? ChevronRight : ChevronLeft;

  return (
    <>
      {/* ── Launcher ──────────────────────────────────────────────────── */}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={t('launcherLabel')}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          'fixed bottom-5 end-5 z-40 inline-flex items-center justify-center',
          'w-14 h-14 rounded-full shadow-2xl transition-all',
          'bg-brand-fill text-brand-ink border border-brand-edge',
          'hover:scale-105 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          // Hidden while the panel is open on small screens, where the
          // panel covers the launcher's spot anyway.
          open && 'sm:flex hidden',
        )}
      >
        {open
          ? <X className="w-6 h-6" aria-hidden />
          : <HelpCircle className="w-6 h-6" aria-hidden />}
      </button>

      {/* ── Panel ────────────────────────────────────────────────────── */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t('title')}
          className={cn(
            'fixed z-40 flex flex-col bg-surface-2 border border-line shadow-2xl',
            // Full-screen sheet on phones; anchored card from sm up.
            'inset-0 rounded-none',
            'sm:inset-auto sm:bottom-24 sm:end-5 sm:w-[min(24rem,calc(100vw-2.5rem))]',
            'sm:h-[min(34rem,calc(100vh-8rem))] sm:rounded-2xl',
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-line flex-shrink-0">
            {active ? (
              <button
                type="button"
                onClick={() => setActive(null)}
                className="min-w-11 min-h-11 -m-2 inline-flex items-center justify-center rounded-lg
                           text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label={t('back')}
              >
                <Back className="w-4 h-4" aria-hidden />
              </button>
            ) : (
              <LifeBuoy className="w-4 h-4 text-brand flex-shrink-0" aria-hidden />
            )}

            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-fg truncate">
                {active ? active.title : t('title')}
              </h2>
              {!active && (
                <p className="text-xs text-fg-muted truncate">{t('subtitle')}</p>
              )}
            </div>

            <button
              type="button"
              onClick={closePanel}
              className="min-w-11 min-h-11 -m-2 inline-flex items-center justify-center rounded-lg
                         text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              aria-label={t('close')}
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
          </div>

          {/* Search — hidden while reading an article to give the steps
              the full panel height. */}
          {!active && (
            <div className="px-4 py-3 border-b border-line flex-shrink-0">
              <div className="relative">
                <Search
                  className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-fg-faint pointer-events-none"
                  aria-hidden
                />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={t('searchPlaceholder')}
                  aria-label={t('searchPlaceholder')}
                  className={cn(
                    'w-full min-h-11 ps-9 pe-3 rounded-lg text-sm',
                    'bg-surface border border-line text-fg placeholder:text-fg-faint',
                    'focus:outline-none focus:ring-2 focus:ring-focus focus:border-transparent',
                    // Safari renders its own clear button on type=search
                    // and it collides with our padding.
                    '[&::-webkit-search-cancel-button]:appearance-none',
                  )}
                />
              </div>
            </div>
          )}

          {/* Body */}
          <div ref={bodyRef} className="flex-1 overflow-y-auto overscroll-contain">
            {active
              ? <ArticleView article={active} related={related} onOpen={openArticle} />
              : isSearching
                ? <ResultsList
                    results={results.map(r => r.article)}
                    fallbacks={fallbacks}
                    query={query}
                    onOpen={openArticle}
                  />
                : <BrowseList grouped={grouped} onOpen={openArticle} />}
          </div>

          {/* Footer — the escape hatch when no article fits. */}
          <div className="px-4 py-2.5 border-t border-line flex-shrink-0">
            <p className="text-[11px] text-fg-faint">
              {t('footerHint')}{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-brand hover:underline font-medium"
              >
                {t('contactSupport')}
              </a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/** Where the "still stuck" links point. */
const SUPPORT_EMAIL = 'support@clbyapp.com';

// ── Sub-views ─────────────────────────────────────────────────────────────

function CategoryHeading({ category }: { category: HelpCategory }) {
  const t = useTranslations('help');
  const Icon = CATEGORY_ICONS[category];
  return (
    <div className="flex items-center gap-2 px-4 pt-4 pb-1.5">
      <Icon className="w-3.5 h-3.5 text-fg-faint" aria-hidden />
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
        {t(`categories.${category}`)}
      </h3>
    </div>
  );
}

function ArticleRow({ article, onOpen }: { article: HelpArticle; onOpen: (a: HelpArticle) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(article)}
      className={cn(
        'w-full text-start px-4 py-2.5 border-b border-line last:border-b-0',
        'hover:bg-surface-3/60 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
      )}
    >
      <span className="block text-sm font-medium text-fg">{article.title}</span>
      <span className="block text-xs text-fg-muted line-clamp-2 mt-0.5">{article.summary}</span>
    </button>
  );
}

function BrowseList({
  grouped,
  onOpen,
}: {
  grouped: ReadonlyArray<readonly [HelpCategory, HelpArticle[]]>;
  onOpen: (a: HelpArticle) => void;
}) {
  return (
    <div className="pb-2">
      {grouped.map(([category, list]) => (
        <div key={category}>
          <CategoryHeading category={category} />
          {list.map(a => <ArticleRow key={a.id} article={a} onOpen={onOpen} />)}
        </div>
      ))}
    </div>
  );
}

function ResultsList({
  results,
  fallbacks,
  query,
  onOpen,
}: {
  results: HelpArticle[];
  fallbacks: HelpArticle[];
  query: string;
  onOpen: (a: HelpArticle) => void;
}) {
  const t = useTranslations('help');

  if (results.length > 0) {
    return (
      <div className="pb-2">
        <p className="px-4 pt-3 pb-1 text-[11px] text-fg-faint" aria-live="polite">
          {t('resultCount', { count: results.length })}
        </p>
        {results.map(a => <ArticleRow key={a.id} article={a} onOpen={onOpen} />)}
      </div>
    );
  }

  // Dead end — never just "no results". Offer the closest topic plus a
  // way to reach a human.
  return (
    <div className="pb-2">
      <div className="px-4 py-5 text-center" aria-live="polite">
        <p className="text-sm font-medium text-fg">{t('noMatchTitle')}</p>
        <p className="text-xs text-fg-muted mt-1">
          {t('noMatchBody', { query: query.trim() })}
        </p>
      </div>

      {fallbacks.length > 0 && (
        <>
          <div className="px-4 pt-1 pb-1.5">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
              {t('noMatchSuggestions')}
            </h3>
          </div>
          {fallbacks.map(a => <ArticleRow key={a.id} article={a} onOpen={onOpen} />)}
        </>
      )}

      <div className="px-4 py-4">
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Help: ${query.trim()}`)}`}
          className={cn(
            'flex items-center justify-center gap-2 w-full min-h-11 px-3 rounded-lg text-sm font-medium',
            'bg-surface-3 text-fg border border-line hover:bg-surface-3/70 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
          )}
        >
          <LifeBuoy className="w-4 h-4" aria-hidden />
          {t('askSupport')}
        </a>
      </div>
    </div>
  );
}

function ArticleView({
  article,
  related,
  onOpen,
}: {
  article: HelpArticle;
  related: HelpArticle[];
  onOpen: (a: HelpArticle) => void;
}) {
  const t = useTranslations('help');

  return (
    <div className="px-4 py-4">
      <p className="text-sm text-fg-muted">{article.summary}</p>

      {/* Numbered click path. <ol> so screen readers announce position
          and the count — "step 3 of 5" is the useful part. */}
      <ol className="mt-4 space-y-2.5">
        {article.steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span
              aria-hidden
              className="flex-shrink-0 w-5 h-5 mt-0.5 rounded-full bg-brand-fill text-brand-ink
                         border border-brand-edge text-[11px] font-semibold
                         inline-flex items-center justify-center"
            >
              {i + 1}
            </span>
            <span className="text-sm text-fg leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>

      {article.notes && article.notes.length > 0 && (
        <div className="mt-4 rounded-lg border border-line bg-surface p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted mb-1.5">
            {t('goodToKnow')}
          </h3>
          <ul className="space-y-1.5 list-disc list-outside ps-4">
            {article.notes.map((note, i) => (
              <li key={i} className="text-xs text-fg-muted leading-relaxed">{note}</li>
            ))}
          </ul>
        </div>
      )}

      {article.href && (
        <a
          href={article.href}
          className={cn(
            'mt-4 flex items-center justify-center gap-2 w-full min-h-11 px-3 rounded-lg text-sm font-medium',
            'bg-brand-fill text-brand-ink border border-brand-edge hover:opacity-90 transition-opacity',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
          )}
        >
          {t('takeMeThere')}
        </a>
      )}

      {related.length > 0 && (
        <div className="mt-5 pt-4 border-t border-line">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted mb-2">
            {t('related')}
          </h3>
          <div className="space-y-1">
            {related.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => onOpen(a)}
                className="w-full text-start text-sm text-brand hover:underline min-h-11 sm:min-h-0 sm:py-1
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus rounded"
              >
                {a.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
