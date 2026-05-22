'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Plus, Tag, Pencil, ToggleLeft, ToggleRight, Search, X, Copy, Percent, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRefresh } from '@/lib/use-refresh';
import PromoModal from './promo-modal';
import PlanPricingTab from './plan-pricing-tab';
import PromoRedemptionsModal from './promo-redemptions-modal';
import type { PromoCode } from '@/app/dashboard/promotions/page';
import type { Plan } from '@/app/dashboard/plans/page';
import { can, type Permission } from '@/lib/get-permissions';
import { Badge, Button, Tabs } from '@/components/ui';

interface Props {
  initialPromos: PromoCode[];
  plans: Plan[];
  permissions: Permission[] | null;
}

export default function PromosPage({ initialPromos, plans, permissions }: Props) {
  const refresh = useRefresh();
  const [activeTab, setActiveTab] = useState<'codes' | 'pricing'>('codes');
  const [promos,      setPromos]      = useState<PromoCode[]>(initialPromos);
  const [search,      setSearch]      = useState('');
  const [filter,      setFilter]      = useState<'all' | 'active' | 'inactive'>('all');
  const [modal,            setModal]            = useState<{ open: boolean; existing?: PromoCode }>({ open: false });
  const [redemptionsPromo, setRedemptionsPromo] = useState<PromoCode | null>(null);
  const [togglingId,       setTogglingId]       = useState<string | null>(null);

  const fetchPromos = useCallback(async () => {
    try {
      const res = await fetch('/api/promos');
      if (res.ok) {
        const data = await res.json();
        setPromos(data.promos ?? []);
      }
    } catch {}
  }, []);

  // Refresh promos when tab regains focus (usage counts may have changed)
  useEffect(() => {
    const onFocus = () => fetchPromos();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchPromos]);

  const today = new Date().toLocaleDateString('en-CA');

  const filtered = useMemo(() => {
    let list = [...promos];
    if (filter === 'active')   list = list.filter(p => p.is_active);
    if (filter === 'inactive') list = list.filter(p => !p.is_active);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
    }
    return list;
  }, [promos, filter, search]);

  const toggleActive = async (promo: PromoCode) => {
    setTogglingId(promo.id);
    try {
      const res = await fetch(`/api/promos/${promo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code:          promo.code,
          name:          promo.name,
          discountType:  promo.discount_type,
          discountValue: promo.discount_value,
          validFrom:     promo.valid_from,
          validUntil:    promo.valid_until,
          maxUses:       promo.max_uses,
          isActive:      !promo.is_active,
        }),
      });
      if (!res.ok) { toast.error('Failed to update'); return; }
      setPromos(prev => prev.map(p => p.id === promo.id ? { ...p, is_active: !p.is_active } : p));
      toast.success(promo.is_active ? 'Promo deactivated' : 'Promo activated');
    } catch { toast.error('Network error'); }
    finally { setTogglingId(null); }
  };

const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied!');
  };

  const isExpired = (promo: PromoCode) =>
    promo.valid_until ? promo.valid_until.slice(0, 10) < today : false;

  const counts = {
    all:      promos.length,
    active:   promos.filter(p => p.is_active).length,
    inactive: promos.filter(p => !p.is_active).length,
  };

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-fg">Promotions & Discounts</h1>
            <p className="text-sm text-fg-muted mt-0.5">Manage promo codes and plan promotional pricing</p>
          </div>
          {activeTab === 'codes' && can(permissions, 'promotions', 'create') && (
            <Button variant="primary" onClick={() => setModal({ open: true })} leftIcon={<Plus className="w-4 h-4" />}>New Code</Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'codes' | 'pricing')}>
          <Tabs.List>
            <Tabs.Trigger value="codes" icon={Tag}>Promo Codes</Tabs.Trigger>
            <Tabs.Trigger value="pricing" icon={Percent}>Plan Pricing</Tabs.Trigger>
          </Tabs.List>
        </Tabs>

        <div className={activeTab !== 'pricing' ? 'hidden' : ''}>
          <PlanPricingTab plans={plans} />
        </div>

        {activeTab === 'codes' && <>
        {/* Filter + Search */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 bg-surface-2 border border-line rounded-xl p-1">
            {(['all', 'active', 'inactive'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${filter === f ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg"}`}>
                {f}
                <span className="text-xs bg-surface-4 text-fg-muted px-1.5 py-0.5 rounded-full">{counts[f]}</span>
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-faint" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search codes…"
              className="w-full pl-9 pr-8 py-2 bg-surface-2 border border-line rounded-lg text-sm text-fg placeholder-gray-500 focus:outline-none focus:border-brand" />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-faint hover:text-fg"><X className="w-3.5 h-3.5" /></button>}
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
            <Tag className="w-10 h-10 text-fg-faint mx-auto mb-3" />
            <p className="text-fg-muted text-sm">{promos.length === 0 ? 'No promo codes yet' : 'No codes match your search'}</p>
            {promos.length === 0 && can(permissions, 'promotions', 'create') && (
              <Button variant="primary" className="mt-4" onClick={() => setModal({ open: true })} leftIcon={<Plus className="w-4 h-4" />}>Create first code</Button>
            )}
          </div>
        ) : (
          <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left text-xs text-fg-muted font-medium px-5 py-3">CODE</th>
                  <th className="text-left text-xs text-fg-muted font-medium px-5 py-3">NAME</th>
                  <th className="text-left text-xs text-fg-muted font-medium px-5 py-3">DISCOUNT</th>
                  <th className="text-left text-xs text-fg-muted font-medium px-5 py-3">VALIDITY</th>
                  <th className="text-left text-xs text-fg-muted font-medium px-5 py-3">USES</th>
                  <th className="text-left text-xs text-fg-muted font-medium px-5 py-3">STATUS</th>
                  <th className="text-right text-xs text-fg-muted font-medium px-5 py-3">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map(promo => {
                  const expired = isExpired(promo);
                  return (
                    <tr key={promo.id} className={`hover:bg-surface-3/20 transition-colors ${!promo.is_active ? 'opacity-60' : ''}`}>
                      {/* Code */}
                      <td className="px-5 py-3.5">
                        <button onClick={() => copyCode(promo.code)}
                          className="flex items-center gap-2 group">
                          <span className="font-mono font-semibold text-fg tracking-wider">{promo.code}</span>
                          <Copy className="w-3 h-3 text-fg-faint group-hover:text-brand transition-colors" />
                        </button>
                      </td>

                      {/* Name */}
                      <td className="px-5 py-3.5 text-fg-muted">{promo.name}</td>

                      {/* Discount */}
                      <td className="px-5 py-3.5">
                        <span className="font-semibold text-emerald-400">
                          {promo.discount_type === 'percent'
                            ? `${promo.discount_value}% off`
                            : `EGP ${promo.discount_value} off`}
                        </span>
                      </td>

                      {/* Validity */}
                      <td className="px-5 py-3.5 text-fg-muted text-xs">
                        {!promo.valid_from && !promo.valid_until ? (
                          <span className="text-fg-faint">No limit</span>
                        ) : (
                          <span className={expired ? 'text-red-400' : ''}>
                            {promo.valid_from ? new Date(promo.valid_from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '∞'}
                            {' – '}
                            {promo.valid_until ? new Date(promo.valid_until).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '∞'}
                            {expired && ' (expired)'}
                          </span>
                        )}
                      </td>

                      {/* Uses */}
                      <td className="px-5 py-3.5 text-fg-muted">
                        {promo.usage_count}
                        {promo.max_uses ? <span className="text-fg-faint"> / {promo.max_uses}</span> : <span className="text-fg-faint"> / ∞</span>}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <Badge variant={expired ? 'danger' : promo.is_active ? 'success' : 'neutral'}>
                          {expired ? 'Expired' : promo.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setRedemptionsPromo(promo)}
                            className="p-1.5 rounded-lg text-fg-muted hover:text-brand hover:bg-brand/10 transition-colors" title="View Redemptions">
                            <Users className="w-3.5 h-3.5" />
                          </button>
                          {can(permissions, 'promotions', 'edit') && (
                            <button onClick={() => setModal({ open: true, existing: promo })}
                              className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors" title="Edit">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {can(permissions, 'promotions', 'edit') && (
                            <button onClick={() => toggleActive(promo)} disabled={togglingId === promo.id}
                              className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors"
                              title={promo.is_active ? 'Deactivate' : 'Activate'}>
                              {promo.is_active
                                ? <ToggleRight className="w-3.5 h-3.5 text-emerald-400" />
                                : <ToggleLeft  className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </>}
      </div>

      {modal.open && (
        <PromoModal
          existing={modal.existing}
          onClose={() => setModal({ open: false })}
          onSaved={p => {
            setPromos(prev => modal.existing
              ? prev.map(x => x.id === p.id ? p : x)
              : [p, ...prev]
            );
            refresh();
          }}
        />
      )}

      {redemptionsPromo && (
        <PromoRedemptionsModal
          promo={redemptionsPromo}
          onClose={() => { setRedemptionsPromo(null); fetchPromos(); }}
        />
      )}
    </>
  );
}
