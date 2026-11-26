'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { UserCheck, X } from 'lucide-react';
import { Button, Card, Field, SearchInput, Select } from '@/components/ui';
import { SafeAvatar } from './safe-avatar';
import { getMemberMemberships, searchMembers, type OfflineDB } from '@/lib/offline/db';
import type { SubmitInput } from '@/lib/offline/front-desk';
import type { CachedBranch, CachedClassSession, CachedMember, CachedMembership } from '@/lib/offline/types';
import { MemberSummary } from './member-summary';

interface Props {
  db: OfflineDB | null;
  sessions: CachedClassSession[];
  branches: CachedBranch[];
  asOf: string | null;
  /** null = allowed; otherwise the explanation shown instead of the button */
  blockedReason: string | null;
  submit: (input: SubmitInput) => Promise<boolean>;
}

/** Cached sessions starting today (device-local day). */
export function todaysSessions(sessions: CachedClassSession[], now = new Date()): CachedClassSession[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return sessions.filter((s) => {
    const t = Date.parse(s.starts_at);
    return !Number.isNaN(t) && t >= start.getTime() && t < end.getTime();
  });
}

export function ManualCheckin({ db, sessions, branches, asOf, blockedReason, submit }: Props) {
  const t = useTranslations('attendance.frontDesk.manual');
  const format = useFormatter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CachedMember[]>([]);
  const [selected, setSelected] = useState<CachedMember | null>(null);
  const [memberships, setMemberships] = useState<CachedMembership[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [saving, setSaving] = useState(false);

  const today = useMemo(() => todaysSessions(sessions), [sessions]);
  const activeBranches = useMemo(() => branches.filter((b) => b.is_active), [branches]);

  useEffect(() => {
    if (activeBranches.length === 1 && !branchId) setBranchId(activeBranches[0].id);
  }, [activeBranches, branchId]);

  useEffect(() => {
    let cancelled = false;
    if (!db || !query.trim()) {
      setResults([]);
      return;
    }
    searchMembers(db, query, 12).then((r) => {
      if (!cancelled) setResults(r);
    });
    return () => {
      cancelled = true;
    };
  }, [db, query]);

  useEffect(() => {
    let cancelled = false;
    if (!db || !selected) {
      setMemberships([]);
      return;
    }
    getMemberMemberships(db, selected.gym_member_id).then((m) => {
      if (!cancelled) setMemberships(m);
    });
    return () => {
      cancelled = true;
    };
  }, [db, selected]);

  const chosenSession = today.find((s) => s.id === sessionId) ?? null;
  const effectiveBranchId = chosenSession?.branch_id ?? (branchId || null);

  const onRecord = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const ok = await submit({
        member_id: selected.gym_member_id,
        attendance_method: 'manual',
        class_session_id: chosenSession?.id ?? null,
        studio_id: chosenSession?.studio_id ?? null,
        branch_id: effectiveBranchId,
        sessionName: chosenSession?.name ?? null,
        branchName: branches.find((b) => b.id === effectiveBranchId)?.name ?? null,
      });
      if (ok) {
        setSelected(null);
        setQuery('');
        setSessionId('');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card padding="lg" className="space-y-4">
      <h2 className="text-base font-semibold text-fg">{t('title')}</h2>

      {!selected ? (
        <div className="space-y-2">
          <SearchInput value={query} onValueChange={setQuery} placeholder={t('search')} debounceMs={150} aria-label={t('search')} />
          {query.trim() && results.length === 0 && <p className="text-sm text-fg-muted">{t('noResults')}</p>}
          {results.length > 0 && (
            <ul className="divide-y divide-line rounded-lg border border-line" role="listbox" aria-label={t('search')}>
              {results.map((m) => (
                <li key={m.gym_member_id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => setSelected(m)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-start hover:bg-surface-3 focus:outline-none focus-visible:bg-surface-3"
                  >
                    <SafeAvatar name={m.full_name ?? '—'} src={m.photo_url} size={32} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-fg truncate">{m.full_name ?? '—'}</span>
                      {m.member_number != null && (
                        <span className="block text-xs text-fg-muted">{t('number', { number: String(m.member_number) })}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <MemberSummary member={selected} memberships={memberships} asOf={asOf} />
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)} leftIcon={<X className="w-4 h-4" />}>
              {t('clear')}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('session')}>
              <Select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
                <option value="">{t('noSession')}</option>
                {today.map((s) => (
                  <option key={s.id} value={s.id}>
                    {format.dateTime(new Date(s.starts_at), { timeStyle: 'short' })} · {s.name ?? '—'}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('branch')}>
              <Select
                value={chosenSession?.branch_id ?? branchId}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={!!chosenSession?.branch_id}
              >
                <option value="">{t('anyBranch')}</option>
                {activeBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {blockedReason ? (
            <p className="text-sm text-warning" role="note">{blockedReason}</p>
          ) : (
            <Button onClick={onRecord} isLoading={saving} leftIcon={<UserCheck className="w-4 h-4" />} fullWidth>
              {saving ? t('recording') : t('record')}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
