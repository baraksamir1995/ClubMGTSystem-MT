'use client';

import { useEffect, useState } from 'react';
import { X, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Avatar, SearchInput } from '@/components/ui';

export interface PickedMember {
  id: string;
  full_name: string | null;
  member_number: string;
  email: string | null;
  phone: string | null;
}

interface MemberRow {
  id: string;
  member_number: string;
  profile?: { full_name: string | null; email: string | null; phone: string | null } | null;
}

/**
 * Optional member selector for front-desk sales. Searches server-side via
 * /api/members?search= (debounced). Leaving it empty = walk-in customer.
 */
export default function MemberPicker({ value, onChange }: {
  value: PickedMember | null;
  onChange: (m: PickedMember | null) => void;
}) {
  const t = useTranslations('store.sell');
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<PickedMember[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/members?search=${encodeURIComponent(q)}&limit=8`, { signal: ctrl.signal });
        const json = await res.json().catch(() => null);
        const rows: MemberRow[] = res.ok ? (json?.members ?? []) : [];
        setResults(rows.map(m => ({
          id: m.id,
          member_number: m.member_number,
          full_name: m.profile?.full_name ?? null,
          email: m.profile?.email ?? null,
          phone: m.profile?.phone ?? null,
        })));
      } catch {
        /* aborted or offline — keep previous results */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [query]);

  return (
    <div>
      <p className="text-xs font-medium text-fg-muted mb-1.5">{t('member')}</p>
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
          <Avatar name={value.full_name ?? value.member_number} size={32} />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-fg truncate">{value.full_name ?? '—'}</p>
            <p className="text-xs text-fg-faint truncate">#{value.member_number}{value.phone ? ` · ${value.phone}` : ''}</p>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={t('clearMember')}
            className="p-1.5 rounded-lg text-fg-faint hover:text-fg hover:bg-surface-3"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>
      ) : (
        <>
          <SearchInput value={query} onValueChange={setQuery} placeholder={t('memberSearchPlaceholder')} />
          {query.trim().length >= 2 && (
            <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-line bg-surface">
              {loading && results.length === 0 ? (
                <p className="px-3 py-3 text-center text-sm text-fg-faint">{t('searching')}</p>
              ) : results.length === 0 ? (
                <p className="px-3 py-3 text-center text-sm text-fg-faint">{t('noMembers')}</p>
              ) : results.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { onChange(m); setQuery(''); }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-start hover:bg-surface-3 transition-colors"
                >
                  <Avatar name={m.full_name ?? m.member_number} size={28} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fg truncate">{m.full_name ?? '—'}</p>
                    <p className="text-xs text-fg-faint truncate">#{m.member_number}{m.email ? ` · ${m.email}` : ''}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-fg-faint">
            <UserRound className="w-3.5 h-3.5" aria-hidden /> {t('walkInHint')}
          </p>
        </>
      )}
    </div>
  );
}
