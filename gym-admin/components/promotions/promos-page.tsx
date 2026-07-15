'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Plus, Tag, Pencil, ToggleLeft, ToggleRight, Search, X, Copy, Percent, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
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
  const t  = useTranslations('promotions');
  const tc = useTranslations('common');
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
      if (!res.ok) { toast.error(t('failedToUpdate')); return; }
      setPromos(prev => prev.map(p => p.id === promo.id ? { ...p, is_active: !p.is_active } : p));
      toast.success(promo.is_active ? t('promoDeactivated') : t('promoActivated'));
    } catch { toast.error(t('networkError')); }
    finally { setTogglingId(null); }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(t('codeCopied'));
  };

  const isExpired = (promo: PromoCode) =>
    promo.valid_until ? promo.valid_until.slice(0, 10) < today : false;

  const counts = {
    all:      promos.length,
    active:   promos.filter(p => p.is_active).length,
    inactive: promos.filter(p => !p.is_active).length,
  };

  const filterLabels: Record<'all' | 'active' | 'inactive', string> = {
    all:      t('filterAll'),
    active:   t('filterActive'),
    inactive: t('filterInactive'),
  };

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-fg">{t('pageTitle')}</h1>
            <p className="text-sm text-fg-muted mt-0.5">{t('pageSubtitle')}</p>
          </div>
          {activeTab === 'codes' && can(permissions, 'promotions', 'create') && (
            <Button variant="primary" onClick={() => setModal({ open: true })} leftIcon={<Plus className="w-4 h-4" />}>{t('newCode')}</Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'codes' | 'pricing')}>
          <Tabs.List>
            <Tabs.Trigger value="codes" icon={Tag}>{t('tabCodes')}</Tabs.Trigger>
            <Tabs.Trigger value="pricing" icon={Percent}>{t('tabPricing')}</Tabs.Trigger>
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === f ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg"}`}>
                {filterLabels[f]}
                <span className="text-xs bg-surface-4 text-fg-muted px-1.5 py-0.5 rounded-full">{counts[f]}</span>
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-faint" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('searchCodesPlaceholder')}
              className="w-full ps-9 pe-8 py-2 bg-surface-2 border border-line-strong rounded-lg text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-focus focus:ring-2 focus:ring-focus" />
            {search && <button onClick={() => setSearch('')} className="absolute end-3 top-1/2 -translate-y-1/2 text-fg-faint hover:text-fg"><X className="w-3.5 h-3.5" /></button>}
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
            <Tag className="w-10 h-10 text-fg-faint mx-auto mb-3" />
            <p className="text-fg-muted text-sm">{promos.length === 0 ? t('noPromoCodesYet') : t('noCodesMatchSearch')}</p>
            {promos.length === 0 && can(permissions, 'promotions', 'create') && (
              <Button variant="primary" className="mt-4" onClick={() => setModal({ open: true })} leftIcon={<Plus className="w-4 h-4" />}>{t('createFirstCode')}</Button>
            )}
          </div>
        ) : (
          <div className="bg-surface-2 border border-line rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-start text-xs text-fg-muted font-medium px-5 py-3">{t('colCode')}</th>
                  <th className="text-start text-xs text-fg-muted font-medium px-5 py-3">{t('colName')}</th>
                  <th className="text-start text-xs text-fg-muted font-medium px-5 py-3">{t('colDiscount')}</th>
                  <th className="text-start text-xs text-fg-muted font-medium px-5 py-3">{t('colValidity')}</th>
                  <th className="text-start text-xs text-fg-muted font-medium px-5 py-3">{t('colUses')}</th>
                  <th className="text-start text-xs text-fg-muted font-medium px-5 py-3">{t('colStatus')}</th>
                  <th className="text-end text-xs text-fg-muted font-medium px-5 py-3">{t('colActions')}</th>
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
                        <span className="font-semibold text-success">
                          {promo.discount_type === 'percent'
                            ? t('discountPercent', { value: promo.discount_value })
                            : t('discountFixed',   { value: promo.discount_value })}
                        </span>
                      </td>

                      {/* Validity */}
                      <td className="px-5 py-3.5 text-fg-muted text-xs">
                        {!promo.valid_from && !promo.valid_until ? (
                          <span className="text-fg-faint">{t('noLimit')}</span>
                        ) : (
                          <span className={expired ? 'text-danger' : ''}>
                            {promo.valid_from ? new Date(promo.valid_from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : t('unlimited')}
                            {' – '}
                            {promo.valid_until ? new Date(promo.valid_until).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : t('unlimited')}
                            {expired && ' ' + t('expired')}
                          </span>
                        )}
                      </td>

                      {/* Uses */}
                      <td className="px-5 py-3.5 text-fg-muted">
                        {promo.usage_count}
                        {promo.max_uses ? <span className="text-fg-faint"> / {promo.max_uses}</span> : <span className="text-fg-faint"> / {t('unlimited')}</span>}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <Badge variant={expired ? 'danger' : promo.is_active ? 'success' : 'neutral'}>
                          {expired ? t('statusExpired') : promo.is_active ? t('statusActive') : t('statusInactive')}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setRedemptionsPromo(promo)}
                            className="p-1.5 rounded-lg text-fg-muted hover:text-brand hover:bg-brand/10 transition-colors" title={t('titleViewRedemptions')}>
                            <Users className="w-3.5 h-3.5" />
                          </button>
                          {can(permissions, 'promotions', 'edit') && (
                            <button onClick={() => setModal({ open: true, existing: promo })}
                              className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors" title={t('titleEdit')}>
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {can(permissions, 'promotions', 'edit') && (
                            <button onClick={() => toggleActive(promo)} disabled={togglingId === promo.id}
                              className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors"
                              title={promo.is_active ? t('titleDeactivate') : t('titleActivate')}>
                              {promo.is_active
                                ? <ToggleRight className="w-3.5 h-3.5 text-success" />
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
