'use client';

import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Gift, Search, ChevronUp, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRefresh } from '@/lib/use-refresh';
import OfferModal from './offer-modal';
import type { GymOffer } from '@/app/dashboard/content/page';
import { can, type Permission } from '@/lib/get-permissions';

type SortKey = 'status' | 'expires_at' | 'created_at';
type SortDir = 'asc' | 'desc';
type StatusFilter = 'all' | 'draft' | 'active' | 'expired';

const STATUS_STYLES: Record<string, string> = {
  active:  'bg-emerald-400/10 text-emerald-400',
  draft:   'bg-gray-400/10 text-gray-400',
  expired: 'bg-red-400/10 text-red-400',
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
      className="inline-flex items-center gap-0.5 hover:text-white transition-colors"
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
    if (!confirm('Delete this offer? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/offers/${id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error('Failed to delete offer'); return; }
      setOffers(prev => prev.filter(o => o.id !== id));
      toast.success('Offer deleted');
      refresh();
    } catch {
      toast.error('Network error');
    } finally {
      setDeletingId(null);
    }
  };

  const selectCls = 'bg-gray-700 border border-gray-600 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:border-purple-500 transition-colors';

  return (
    <>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Offers</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage promotional offers shown on the mobile app Explore feed</p>
          </div>
          {can(permissions, 'offers', 'create') && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> New Offer
            </button>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4">
          {([
            { label: 'Total Offers',   value: counts.total,   color: 'text-white',         filter: 'all' as StatusFilter },
            { label: 'Active',         value: counts.active,  color: 'text-emerald-400',   filter: 'active' as StatusFilter },
            { label: 'Draft',          value: counts.draft,   color: 'text-gray-300',      filter: 'draft' as StatusFilter },
            { label: 'Expired',        value: counts.expired, color: 'text-red-400',       filter: 'expired' as StatusFilter },
          ] as const).map(s => (
            <button
              key={s.filter}
              onClick={() => setStatusFilter(statusFilter === s.filter ? 'all' : s.filter)}
              className={`bg-gray-800 border rounded-xl p-4 text-left transition-colors ${
                statusFilter === s.filter ? 'border-purple-500' : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </button>
          ))}
        </div>

        {/* Active limit notice */}
        {counts.active >= 10 && (
          <div className="flex items-center gap-3 bg-amber-400/10 border border-amber-400/30 rounded-xl px-4 py-3">
            <span className="text-amber-400 text-sm font-medium">
              ⚠ You have reached the maximum of 10 active offers. Deactivate one before adding another.
            </span>
          </div>
        )}

        {/* Search + sort */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title, description or tag…"
              className="w-full pl-9 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as StatusFilter)}
              className={selectCls}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="expired">Expired</option>
            </select>
            <span className="ml-auto text-xs text-gray-500">{filtered.length} of {offers.length} offers</span>
          </div>
        </div>

        {/* Table */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Gift className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">
                {offers.length === 0
                  ? 'No offers yet. Create your first offer.'
                  : 'No offers match your filters.'}
              </p>
              {offers.length === 0 && can(permissions, 'offers', 'create') && (
                <button
                  onClick={openCreate}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" /> Create your first offer
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-5 py-3">Offer</th>
                    <th className="text-left px-5 py-3">Tag</th>
                    <th className="text-left px-5 py-3">
                      <span className="inline-flex items-center gap-1">
                        Expires
                        <SortButton col="expires_at" sort={sortKey} dir={sortDir} onToggle={toggleSort} />
                      </span>
                    </th>
                    <th className="text-left px-5 py-3">
                      <span className="inline-flex items-center gap-1">
                        Status
                        <SortButton col="status" sort={sortKey} dir={sortDir} onToggle={toggleSort} />
                      </span>
                    </th>
                    <th className="text-left px-5 py-3">
                      <span className="inline-flex items-center gap-1">
                        Created
                        <SortButton col="created_at" sort={sortKey} dir={sortDir} onToggle={toggleSort} />
                      </span>
                    </th>
                    <th className="text-right px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {filtered.map(offer => (
                    <tr key={offer.id} className="hover:bg-gray-700/30 transition-colors">
                      {/* Offer */}
                      <td className="px-5 py-3.5 max-w-xs">
                        <div className="flex items-start gap-3">
                          {offer.hero_image_url ? (
                            <img
                              src={offer.hero_image_url}
                              alt=""
                              className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-gray-700"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0">
                              <Gift className="w-5 h-5 text-gray-500" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate">{offer.title}</p>
                            {offer.short_description && (
                              <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[220px]">
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
                            className="inline-block px-2.5 py-1 rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: offer.tag_color ?? '#F59E0B' }}
                          >
                            {offer.tag_label}
                          </span>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>

                      {/* Expires */}
                      <td className="px-5 py-3.5 text-gray-300 whitespace-nowrap">
                        {fmt(offer.expires_at)}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[offer.status] ?? 'bg-gray-400/10 text-gray-400'}`}>
                          {offer.status}
                        </span>
                      </td>

                      {/* Created */}
                      <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap text-xs">
                        {fmt(offer.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          {can(permissions, 'offers', 'edit') && (
                            <button
                              onClick={() => openEdit(offer)}
                              title="Edit offer"
                              className="p-1.5 rounded-lg text-gray-500 hover:text-purple-400 hover:bg-purple-400/10 transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {can(permissions, 'offers', 'delete') && (
                            <button
                              onClick={() => handleDelete(offer.id)}
                              disabled={deletingId === offer.id}
                              title="Delete offer"
                              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
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
