'use client';

import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Package, Power, AlertTriangle, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import ProductModal from './product-modal';
import { can, type Permission } from '@/lib/get-permissions';
import { apiErrorMessage, networkErrorMessage } from '@/lib/api-error';
import type { GymProduct } from '@/lib/types/store-events';
import {
  Badge, Button, DataTable, EmptyState, Modal, SearchInput, Select, StatCard,
  type DataTableColumn,
} from '@/components/ui';

type StatusFilter = 'all' | 'active' | 'inactive';

/** Stock at or below this (but above 0) is flagged "Low stock". */
export const LOW_STOCK_THRESHOLD = 5;

export function fmtPrice(n: number | null | undefined) {
  return Number(n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/** Single price, or min–max range across active variants. */
function priceLabel(p: GymProduct): string {
  const active = p.variants.filter(v => v.is_active);
  if (active.length > 0) {
    const prices = active.map(v => Number(v.price));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return min === max
      ? `${fmtPrice(min)} ${p.currency}`
      : `${fmtPrice(min)}–${fmtPrice(max)} ${p.currency}`;
  }
  return `${fmtPrice(p.price)} ${p.currency}`;
}

export type StockInfo =
  | { kind: 'untracked' }
  | { kind: 'out' }
  | { kind: 'low'; count: number }
  | { kind: 'count'; count: number };

/**
 * Stock summary. Variant products sum their active variants' stock; any
 * untracked active variant makes the product "Untracked" overall.
 */
export function stockInfo(p: GymProduct): StockInfo {
  const active = p.variants.filter(v => v.is_active);
  let count: number | null;
  if (active.length > 0) {
    count = active.some(v => v.stock === null)
      ? null
      : active.reduce((sum, v) => sum + (v.stock ?? 0), 0);
  } else {
    count = p.stock;
  }
  if (count === null) return { kind: 'untracked' };
  if (count <= 0) return { kind: 'out' };
  if (count <= LOW_STOCK_THRESHOLD) return { kind: 'low', count };
  return { kind: 'count', count };
}

export default function StorePage({
  initialProducts, permissions, embedded = false,
}: {
  initialProducts: GymProduct[];
  permissions: Permission[] | null;
  /** Rendered as a sub-tab (Services → Store): the parent owns the page heading. */
  embedded?: boolean;
}) {
  const t    = useTranslations('store');
  const tc   = useTranslations('common');
  const tErr = useTranslations('common.errors');

  const [products, setProducts]   = useState<GymProduct[]>(initialProducts);
  const [editing, setEditing]     = useState<GymProduct | 'new' | null>(null);
  const [deleting, setDeleting]   = useState<GymProduct | null>(null);
  const [busyId, setBusyId]       = useState<string | null>(null);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const canCreate = can(permissions, 'store', 'create');
  const canEdit   = can(permissions, 'store', 'edit');
  const canDelete = can(permissions, 'store', 'delete');

  const filtered = useMemo(() => {
    let list = [...products];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.variants.some(v => v.name.toLowerCase().includes(q)),
      );
    }
    if (statusFilter !== 'all') list = list.filter(p => (statusFilter === 'active') === p.is_active);
    list.sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
    return list;
  }, [products, search, statusFilter]);

  const counts = useMemo(() => {
    let low = 0, out = 0;
    for (const p of products) {
      if (!p.is_active) continue;
      const s = stockInfo(p);
      if (s.kind === 'low') low++;
      if (s.kind === 'out') out++;
    }
    return {
      total: products.length,
      active: products.filter(p => p.is_active).length,
      low, out,
    };
  }, [products]);

  const upsert = (saved: GymProduct) => {
    setProducts(prev => prev.some(p => p.id === saved.id)
      ? prev.map(p => (p.id === saved.id ? saved : p))
      : [saved, ...prev]);
  };

  /** Re-fetch the list (after a sale the stock numbers change server-side). */
  const reload = async () => {
    try {
      const res = await fetch('/api/products');
      const json = await res.json().catch(() => null);
      if (res.ok) setProducts((json?.data ?? json ?? []) as GymProduct[]);
    } catch { /* keep current list */ }
  };

  const toggleActive = async (p: GymProduct) => {
    setBusyId(p.id);
    try {
      const res = await fetch(`/api/products/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !p.is_active }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { toast.error(apiErrorMessage(json, res.status, tErr)); return; }
      upsert((json?.data ?? json) as GymProduct);
      toast.success(p.is_active ? t('toast.deactivated') : t('toast.activated'));
    } catch {
      toast.error(networkErrorMessage(tErr));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const p = deleting;
    setBusyId(p.id);
    try {
      const res = await fetch(`/api/products/${p.id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => null);
      if (!res.ok) { toast.error(apiErrorMessage(json, res.status, tErr)); return; }
      setProducts(prev => prev.filter(x => x.id !== p.id));
      toast.success(t('toast.deleted'));
      setDeleting(null);
    } catch {
      toast.error(networkErrorMessage(tErr));
    } finally {
      setBusyId(null);
    }
  };

  const columns: DataTableColumn<GymProduct>[] = [
    {
      key: 'product',
      header: t('col.product'),
      cell: (p) => (
        <div className="flex items-center gap-3 max-w-xs">
          {p.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded image on external host
            <img src={p.image_url} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0 bg-surface-3" />
          ) : (
            <div className="w-11 h-11 rounded-lg bg-surface-3 flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-fg-faint" aria-hidden />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium text-fg truncate">{p.name}</p>
            {p.variants.length > 0 ? (
              <p className="text-xs text-fg-faint mt-0.5 truncate">
                {t('variantCount', { count: p.variants.length })}: {p.variants.map(v => v.name).join(', ')}
              </p>
            ) : p.description ? (
              <p className="text-xs text-fg-faint mt-0.5 truncate">{p.description}</p>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      header: t('col.price'),
      cell: (p) => (
        <span className="whitespace-nowrap">
          <span className="text-fg">{priceLabel(p)}</span>
          {p.variants.length === 0 && p.before_price != null && Number(p.before_price) > Number(p.price) && (
            <span className="ms-2 text-xs text-fg-faint line-through">{fmtPrice(p.before_price)}</span>
          )}
        </span>
      ),
    },
    {
      key: 'stock',
      header: t('col.stock'),
      cell: (p) => {
        const s = stockInfo(p);
        if (s.kind === 'untracked') return <span className="text-fg-muted">{t('stock.untracked')}</span>;
        if (s.kind === 'out') return <Badge variant="danger">{t('stock.out')}</Badge>;
        if (s.kind === 'low') {
          return (
            <span className="inline-flex items-center gap-2">
              <span className="text-fg tabular-nums">{s.count}</span>
              <Badge variant="warning" size="sm">{t('stock.low')}</Badge>
            </span>
          );
        }
        return <span className="text-fg tabular-nums">{s.count}</span>;
      },
    },
    {
      key: 'status',
      header: tc('status'),
      cell: (p) => (
        <Badge variant={p.is_active ? 'success' : 'neutral'}>
          {p.is_active ? tc('active') : tc('inactive')}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: tc('actions'),
      align: 'right',
      cell: (p) => (
        <div className="flex items-center justify-end gap-1">
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(p)}
              title={tc('edit')}
              aria-label={tc('edit')}
              className="p-1.5 rounded-lg text-fg-faint hover:text-brand hover:bg-brand/10 transition-colors"
            >
              <Pencil className="w-4 h-4" aria-hidden />
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => toggleActive(p)}
              disabled={busyId === p.id}
              title={p.is_active ? t('deactivate') : t('activate')}
              aria-label={p.is_active ? t('deactivate') : t('activate')}
              className="p-1.5 rounded-lg text-fg-faint hover:text-warning hover:bg-warning-soft transition-colors disabled:opacity-40"
            >
              <Power className="w-4 h-4" aria-hidden />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => setDeleting(p)}
              disabled={busyId === p.id}
              title={tc('delete')}
              aria-label={tc('delete')}
              className="p-1.5 rounded-lg text-fg-faint hover:text-danger hover:bg-danger-soft transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4" aria-hidden />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {embedded
            ? <h2 className="text-lg font-semibold text-fg">{t('title')}</h2>
            : <h1 className="text-2xl font-bold text-fg">{t('title')}</h1>}
          <p className="text-sm text-fg-muted mt-0.5">{t('subtitle')}</p>
          {/* Sales are recorded from Payments → Record Payment, not here. */}
          <p className="text-xs text-fg-faint mt-1 inline-flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
            {t('sellViaPayments')}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setEditing('new')} leftIcon={<Plus className="w-4 h-4" />}>
            {t('addProduct')}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={t('stats.total')} value={counts.total} icon={Package} />
        <StatCard label={t('stats.active')} value={counts.active} />
        <StatCard label={t('stats.low')} value={counts.low} icon={AlertTriangle} tone={counts.low > 0 ? 'warning' : 'default'} />
        <StatCard label={t('stats.out')} value={counts.out} tone={counts.out > 0 ? 'danger' : 'default'} />
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[220px]">
          <SearchInput value={search} onValueChange={setSearch} placeholder={t('searchPlaceholder')} />
        </div>
        <Select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          className="w-auto"
          aria-label={tc('status')}
        >
          <option value="all">{t('filter.all')}</option>
          <option value="active">{t('filter.active')}</option>
          <option value="inactive">{t('filter.inactive')}</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={p => p.id}
        empty={
          <EmptyState
            icon={Package}
            title={products.length === 0 ? t('empty.title') : t('empty.noMatch')}
            description={products.length === 0 ? t('empty.description') : undefined}
            action={products.length === 0 && canCreate ? (
              <Button onClick={() => setEditing('new')} leftIcon={<Plus className="w-4 h-4" />}>{t('addProduct')}</Button>
            ) : undefined}
          />
        }
      />

      {editing && (
        <ProductModal
          product={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={upsert}
        />
      )}


      {deleting && (
        <Modal open onClose={() => setDeleting(null)} size="sm" closeOnBackdrop={false}>
          <Modal.Header>{t('delete.title')}</Modal.Header>
          <Modal.Body>
            <p className="text-sm text-fg-muted">{t('delete.body', { name: deleting.name })}</p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" fullWidth onClick={() => setDeleting(null)}>{tc('cancel')}</Button>
            <Button variant="danger" fullWidth isLoading={busyId === deleting.id} onClick={confirmDelete}>
              {tc('delete')}
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
}
