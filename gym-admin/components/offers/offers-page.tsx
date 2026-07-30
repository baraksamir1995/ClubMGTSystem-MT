'use client';

import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Gift, Search, ChevronUp, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { useRefresh } from '@/lib/use-refresh';
import OfferModal from './offer-modal';
import type { GymOffer } from '@/app/dashboard/content/page';
import { can, type Permission } from '@/lib/get-permissions';
import { Badge, type BadgeProps, Button } from '@/components/ui';

type SortKey = 'status' | 'expires_at' | 'created_at';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'all' | 'draft' | 'active' | 'expired';

const STATUS_VARIANT: Record<string, BadgeProps['variant']> = {
  active:  'success',
  draft:   'neutral',
  expired: 'danger',
};

function fmt(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
}

function SortButton({ col, sort, dir, onToggle }: {
  col: SortKey; sort: SortKey; dir: SortDir;
  onToggle: (col: SortKey) => void;
}) {
  const active = col === sort;
  return (
    <button
      onClick={() => onToggle(col)}
      className="inline-flex items-center gap-0.5 hover:text-fg transition-colors"
    >
      {active ? (
        dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      ) : (
        <ChevronDown className="w-3 h-3 opacity-30" />
      )}
    </button>
  );
}

export default function OffersPage({
  initialOffers, permissions, gymId,
}: {
  initialOffers: GymOffer[];
  permissions: Permission[] | null;
  gymId: string;
}) {
  const t  = useTranslations('promotions');
  const tc = useTranslations('common');
  const refresh = useRefresh();
  const [offers, setOffers]             = useState<GymOffer[]>(initialOffers);
  const [modalOpen, setModalOpen]       = useState(false);
  const [editingOffer, setEditingOffer] = useState<GymOffer | undefined>(undefined);
  const [deletingId, setDeletingId]     = useState<string | null>(null);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey]           = useState<SortKey>('created_at');
  const [sortDir, setSortDir]           = useState<SortDir>('desc');

  const openCreate = () => { setEditingOffer(undefined); setModalOpen(true); };
  const openEdit   = (o: GymOffer) => { setEditingOffer(o); setModalOpen(true); };

  const toggleSort = (col: SortKey) => {
    if (sortKey === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(col); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    let list = [...offers];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        o.title.toLowerCase().includes(q) ||
        o.short_description?.toLowerCase().includes(q) ||
        o.tag_label?.toLowerCase().includes(q),
      );
    }
    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter);
    list.sort((a, b) => {
      let av: string, bv: string;
      if (sortKey === 'status') { av = a.status; bv = b.status; }
      else if (sortKey === 'expires_at') { av = a.expires_at; bv = b.expires_at; }
      else { av = a.created_at; bv = b.created_at; }
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return list;
  }, [offers, search, statusFilter, sortKey, sortDir]);

  const counts = useMemo(() => ({
    total:   offers.length,
    active:  offers.filter(o => o.status === 'active').length,
    draft:   offers.filter(o => o.status === 'draft').length,
    expired: offers.filter(o => o.status === 'expired').length,
  }), [offers]);

  const handleSaved = (saved: GymOffer) => {
    setOffers(prev => {
      const idx = prev.findIndex(o => o.id === saved.id);
      return idx >= 0
        ? prev.map(o => o.id === saved.id ? saved : o)
        : [saved, ...prev];
    });
    refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('deleteOfferConfirm'))) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/offers/${id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error(t('failedToDeleteOffer')); return; }
      setOffers(prev => prev.filter(o => o.id !== id));
      toast.success(t('offerDeleted'));
      refresh();
    } catch {
      toast.error(tc('networkError'));
    } finally {
      setDeletingId(null);
    }
  };

  const selectCls = 'bg-surface-3 border border-line text-sm text-fg rounded-lg px-3 py-2 focus:outline-none focus:border-brand transition-colors';

  const statusLabels: Record<StatusFilter, string> = {
    all:     t('selectAllStatuses'),
    active:  t('selectActive'),
    draft:   t('selectDraft'),
    expired: t('selectExpired'),
  };

  return (
    <>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-fg">{t('offersPageTitle')}</h1>
            <p className="text-sm text-fg-muted mt-0.5">{t('offersPageSubtitle')}</p>
          </div>
          {can(permissions, 'offers', 'create') && (
            <Button variant="primary" onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>{t('newOffer')}</Button>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {([
            { labelKey: 'cardTotalOffers', value: counts.total,   color: 'text-fg',           filter: 'all'     as StatusFilter },
            { labelKey: 'cardActive',      value: counts.active,  color: 'text-success',   filter: 'active'  as StatusFilter },
            { labelKey: 'cardDraft',       value: counts.draft,   color: 'text-fg-muted',      filter: 'draft'   as StatusFilter },
            { labelKey: 'cardExpired',     value: counts.expired, color: 'text-danger',       filter: 'expired' as StatusFilter },
          ] as const).map(s => (
            <button
              key={s.filter}
              onClick={() => setStatusFilter(statusFilter === s.filter ? 'all' : s.filter)}
              className={`bg-surface-2 border rounded-xl p-4 text-start transition-colors ${statusFilter === s.filter ? "border-brand" : "border-line hover:border-line-strong"}`}
            >
              <p className="text-xs text-fg-muted mb-1">{t(s.labelKey)}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </button>
          ))}
        </div>

        {/* Active limit notice */}
        {counts.active >= 10 && (
          <div className="flex items-center gap-3 bg-warning-soft border border-warning/40 rounded-xl px-4 py-3">
            <span className="text-warning text-sm font-medium">
              {t('activeOfferLimit')}
            </span>
          </div>
        )}

        {/* Search + sort */}
        <div className="bg-surface-2 border border-line rounded-xl p-4 space-y-3">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-faint" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('searchOffersPlaceholder')}
              className="w-full ps-9 pe-4 py-2 bg-surface border border-line rounded-lg text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand transition-colors"
            />
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className={selectCls}
            >
              {(['all', 'active', 'draft', 'expired'] as StatusFilter[]).map(v => (
                <option key={v} value={v}>{statusLabels[v]}</option>
              ))}
            </select>
            <span className="ms-auto text-xs text-fg-faint">{t('offerCountSummary', { filtered: filtered.length, total: offers.length })}</span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Gift className="w-10 h-10 text-fg-faint mx-auto mb-3" />
              <p className="text-fg-muted text-sm">
                {offers.length === 0
                  ? t('noOffersYet')
                  : t('noOffersMatchFilters')}
              </p>
              {offers.length === 0 && can(permissions, 'offers', 'create') && (
                <Button variant="primary" className="mt-4" onClick={openCreate} leftIcon={<Plus className="w-4 h-4" />}>{t('createYourFirstOffer')}</Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-xs text-fg-muted uppercase tracking-wide">
                    <th className="text-start px-5 py-3">{t('colOffer')}</th>
                    <th className="text-start px-5 py-3">{t('colTag')}</th>
                    <th className="text-start px-5 py-3">
                      <span className="inline-flex items-center gap-1">
                        {t('colExpires')}
                        <SortButton col="expires_at" sort={sortKey} dir={sortDir} onToggle={toggleSort} />
                      </span>
                    </th>
                    <th className="text-start px-5 py-3">
                      <span className="inline-flex items-center gap-1">
                        {tc('status')}
                        <SortButton col="status" sort={sortKey} dir={sortDir} onToggle={toggleSort} />
                      </span>
                    </th>
                    <th className="text-start px-5 py-3">
                      <span className="inline-flex items-center gap-1">
                        {t('colCreated')}
                        <SortButton col="created_at" sort={sortKey} dir={sortDir} onToggle={toggleSort} />
                      </span>
                    </th>
                    <th className="text-end px-5 py-3">{tc('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map(offer => (
                    <tr key={offer.id} className="hover:bg-surface-3/30 transition-colors">
                      {/* Offer */}
                      <td className="px-5 py-3.5 max-w-xs">
                        <div className="flex items-start gap-3">
                          {offer.hero_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded hero, external host
                            <img
                              src={offer.hero_image_url}
                              alt=""
                              className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-surface-3"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-surface-3 flex items-center justify-center flex-shrink-0">
                              <Gift className="w-5 h-5 text-fg-faint" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-fg truncate">{offer.title}</p>
                            {offer.short_description && (
                              <p className="text-xs text-fg-faint mt-0.5 truncate max-w-[220px]">
                                {offer.short_description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Tag */}
                      <td className="px-5 py-3.5">
                        {offer.tag_label ? (
                          <span
                            className="inline-block px-2.5 py-1 rounded-full text-xs font-bold text-fg"
                            style={{ backgroundColor: offer.tag_color ?? '#F59E0B' }}
                          >
                            {offer.tag_label}
                          </span>
                        ) : (
                          <span className="text-fg-faint">—</span>
                        )}
                      </td>

                      {/* Expires */}
                      <td className="px-5 py-3.5 text-fg-muted whitespace-nowrap">
                        {fmt(offer.expires_at)}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <Badge variant={STATUS_VARIANT[offer.status] ?? 'neutral'} className="capitalize">{offer.status}</Badge>
                      </td>

                      {/* Created */}
                      <td className="px-5 py-3.5 text-fg-faint whitespace-nowrap text-xs">
                        {fmt(offer.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {can(permissions, 'offers', 'edit') && (
                            <button
                              onClick={() => openEdit(offer)}
                              title={t('titleEditOffer')}
                              className="p-1.5 rounded-lg text-fg-faint hover:text-brand hover:bg-brand/10 transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {can(permissions, 'offers', 'delete') && (
                            <button
                              onClick={() => handleDelete(offer.id)}
                              disabled={deletingId === offer.id}
                              title={t('titleDeleteOffer')}
                              className="p-1.5 rounded-lg text-fg-faint hover:text-danger hover:bg-danger-soft transition-colors disabled:opacity-40"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <OfferModal
          offer={editingOffer}
          gymId={gymId}
          onClose={() => { setModalOpen(false); setEditingOffer(undefined); }}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
