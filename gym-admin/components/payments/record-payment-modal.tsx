'use client';

import { useState, useMemo } from 'react';
import { X, DollarSign, Search, Link2, Copy, Check, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { MemberOption, ServiceOption, TrainerOption, PromoCode } from '@/app/dashboard/payments/page';
import type { GymBranch } from '@/app/dashboard/branches/page';

const TRAINER_TYPE_LABELS: Record<string, string> = {
  personal_trainer: 'Personal Trainer',
  nutritionist:     'Nutritionist',
  physiotherapist:  'Physiotherapist',
  coach:            'Coach',
};

interface Props {
  memberOptions: MemberOption[];
  serviceOptions: ServiceOption[];
  trainerOptions: TrainerOption[];
  branches: GymBranch[];
  promoCodes: PromoCode[];
  onClose: () => void;
}

const METHODS  = ['cash', 'bank_transfer', 'card', 'other', 'payment_link'];
const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', bank_transfer: 'Bank', card: 'Card', other: 'Other', payment_link: 'Payment Link',
};
const STATUSES = [
  { value: 'paid',    label: 'Paid',    color: 'text-emerald-400' },
  { value: 'pending', label: 'Pending', color: 'text-amber-400' },
  { value: 'overdue', label: 'Overdue', color: 'text-red-400' },
];
const CURRENCIES = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED'];

const fmt = (amount: number, currency = 'EGP') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);

const TYPE_LABELS: Record<string, string> = {
  membership:      'Membership',
  session_package: 'Session Package',
  program:         'Programme',
  offer:           'Offer',
  other:           'Other',
};

export default function RecordPaymentModal({ memberOptions, serviceOptions, trainerOptions, branches, promoCodes, onClose }: Props) {
  const [search, setSearch]           = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberOption | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceOption | null>(null);
  const [selectedTrainer, setSelectedTrainer] = useState<TrainerOption | null>(null);
  const [isOther, setIsOther]         = useState(false);
  const [otherName, setOtherName]     = useState('');
  const [amount, setAmount]           = useState('');
  const [currency, setCurrency]       = useState('EGP');
  const [method, setMethod]           = useState<string>('cash');
  const [status, setStatus]           = useState<string>('paid');
  const [notes, setNotes]             = useState('');
  const [phone, setPhone]             = useState('');
  const [branchId, setBranchId]       = useState(branches.length === 1 ? branches[0].id : '');
  const [loading, setLoading]         = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied]           = useState(false);
  const [selectedPromoId, setSelectedPromoId] = useState<string>('');
  const [useOriginalPrice, setUseOriginalPrice] = useState(false);

  const isPaymentLink = method === 'payment_link';

  // Group services by type for the select dropdown
  const grouped = useMemo(() => {
    const groups: Record<string, ServiceOption[]> = {};
    for (const s of serviceOptions) {
      if (!groups[s.type]) groups[s.type] = [];
      groups[s.type].push(s);
    }
    return groups;
  }, [serviceOptions]);

  const groupedTrainers = useMemo(() => {
    const groups: Record<string, TrainerOption[]> = {};
    for (const t of trainerOptions) {
      const key = t.trainer_type ?? 'personal_trainer';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return groups;
  }, [trainerOptions]);

  const filtered = useMemo(() => {
    if (!search.trim()) return memberOptions;
    const q = search.toLowerCase();
    return memberOptions.filter(m =>
      m.full_name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.member_number?.toString().toLowerCase().includes(q)
    );
  }, [memberOptions, search]);

  // When a member is selected, only auto-fill price if no service is chosen yet
  const handleSelectMember = (m: MemberOption) => {
    setSelectedMember(m);
    setSearch('');
    if (!selectedService && m.plan_price) {
      setAmount(String(m.plan_price));
      setCurrency(m.currency ?? 'EGP');
    }
  };

  const handleSelectService = (id: string) => {
    if (!id) {
      setSelectedService(null);
      setIsOther(false);
      setOtherName('');
      setSelectedTrainer(null);
      return;
    }
    if (id === '__other__') {
      setSelectedService(null);
      setIsOther(true);
      setOtherName('');
      setSelectedTrainer(null);
      return;
    }
    const svc = serviceOptions.find(s => s.id === id) ?? null;
    setSelectedService(svc);
    setIsOther(false);
    setSelectedTrainer(null);
    if (svc) {
      if (svc.price != null) {
        setAmount(String(svc.price));
        setCurrency(svc.currency);
      }
      setNotes(`${TYPE_LABELS[svc.type] ?? svc.type}: ${svc.name}`);
      setSelectedPromoId('');
      setUseOriginalPrice(false);
      // Auto-select branch if plan is restricted to a single branch
      if (svc.allowed_branch_ids?.length === 1) {
        setBranchId(svc.allowed_branch_ids[0]);
      }
    }
  };

  const handleCopy = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    if (!generatedLink) return;
    const msg = encodeURIComponent(`Hi! Here is your payment link to complete your payment:\n\n${generatedLink}`);
    const num = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) { toast.error('Select a member'); return; }
    if (!amount || parseFloat(amount) <= 0) { toast.error('Enter a valid amount'); return; }
    if (isOther && !otherName.trim()) { toast.error('Enter a description for Other'); return; }
    if (isPaymentLink && !phone.trim()) { toast.error('Mobile number is required for payment links'); return; }

    setLoading(true);
    try {
      const commonPayload = {
        gym_member_id:   selectedMember.id,
        amount:          parseFloat(amount),
        currency,
        notes:           notes.trim() || null,
        service_type:    isOther ? 'other' : (selectedService?.type ?? (selectedMember.active_membership_id && selectedMember.plan_name ? 'membership' : null)),
        service_id:      selectedService?.id ?? null,
        service_name:    isOther ? otherName.trim() : (selectedService?.name ?? selectedMember.plan_name ?? null),
        specialist_name: selectedTrainer?.name ?? null,
        branch_id:       branchId || null,
        promo_code_id:   selectedPromoId || null,
        service_package_id: selectedService?.creates_assignment ? selectedService.id : null,
        trainer_id:         selectedService?.creates_assignment ? (selectedTrainer?.id ?? null) : null,
      };

      if (isPaymentLink) {
        // ── Payment link flow ─────────────────────────────────────────────
        const res = await fetch('/api/payments/send-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...commonPayload, phone }),
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error ?? 'Failed to generate link'); return; }
        setGeneratedLink(data.payment_link_url);
        toast.success('Payment link generated!');
      } else {
        // ── Regular payment record flow ───────────────────────────────────
        const res = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...commonPayload,
            membership_id:  selectedMember.active_membership_id,
            payment_method: method,
            status,
          }),
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error ?? 'Failed to record payment'); return; }
        toast.success('Payment recorded');
        onClose();
        window.location.reload();
      }
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors';
  const labelCls = 'block text-xs text-gray-400 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <h2 className="text-base font-semibold text-white">Create Payment</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">

            {/* Member selector */}
            <div>
              <label className={labelCls}>Member *</label>
              {selectedMember ? (
                <div className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-xl border border-purple-500/40">
                  <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center text-xs font-bold text-purple-400 flex-shrink-0">
                    {String(selectedMember.full_name ?? selectedMember.member_number ?? '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{selectedMember.full_name ?? '—'}</p>
                    <p className="text-xs text-gray-400">{selectedMember.email ?? selectedMember.member_number}</p>
                    {selectedMember.plan_name && (
                      <p className="text-xs text-purple-400 mt-0.5">{selectedMember.plan_name} · {fmt(selectedMember.plan_price ?? 0, selectedMember.currency ?? 'EGP')}</p>
                    )}
                  </div>
                  <button type="button" onClick={() => setSelectedMember(null)} className="text-gray-500 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div>
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                      placeholder="Search by name, email, or member #…"
                      className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                  {search && (
                    <div className="max-h-40 overflow-y-auto bg-gray-900 border border-gray-700 rounded-xl">
                      {filtered.length === 0 ? (
                        <p className="text-sm text-gray-500 px-3 py-3 text-center">No members found</p>
                      ) : filtered.slice(0, 8).map(m => (
                        <button key={m.id} type="button" onClick={() => handleSelectMember(m)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800 transition-colors text-left">
                          <div className="w-7 h-7 rounded-full bg-purple-600/20 flex items-center justify-center text-xs font-bold text-purple-400 flex-shrink-0">
                            {String(m.full_name ?? m.member_number ?? '?').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{m.full_name ?? '—'}</p>
                            <p className="text-xs text-gray-500 truncate">{m.email ?? m.member_number}</p>
                          </div>
                          {m.plan_name && <span className="text-xs text-purple-400 flex-shrink-0">{m.plan_name}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Service selector */}
            <div>
              <label className={labelCls}>Service / Item <span className="text-gray-600">(optional)</span></label>
              <select
                value={isOther ? '__other__' : (selectedService?.id ?? '')}
                onChange={e => handleSelectService(e.target.value)}
                className={inputCls}
              >
                <option value="">— Select a service —</option>
                {Object.entries(grouped).map(([type, items]) => (
                  <optgroup key={type} label={TYPE_LABELS[type] ?? type}>
                    {items.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.subtitle ? ` (${s.subtitle})` : ''}{s.price != null ? ` — ${s.price} ${s.currency}` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <optgroup label="──────────────">
                  <option value="__other__">Other (custom description)</option>
                </optgroup>
              </select>

              {/* Selected service chip */}
              {selectedService && !isOther && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg">
                  <span className="text-xs font-medium text-indigo-400">{TYPE_LABELS[selectedService.type] ?? selectedService.type}</span>
                  <span className="text-xs text-gray-300 flex-1 truncate">{selectedService.name}</span>
                  {selectedService.price != null && (
                    <span className="text-xs font-semibold text-white flex-shrink-0">{selectedService.price} {selectedService.currency}</span>
                  )}
                  <button type="button" onClick={() => handleSelectService('')} className="text-gray-500 hover:text-white transition-colors flex-shrink-0">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Trainer picker — shown for service packages that create an assignment */}
              {selectedService?.creates_assignment && (
                <div className="mt-2">
                  <label className="block text-xs text-gray-500 mb-1">Specialist <span className="text-gray-600">(optional)</span></label>
                  <select
                    value={selectedTrainer?.id ?? ''}
                    onChange={e => setSelectedTrainer(trainerOptions.find(t => t.id === e.target.value) ?? null)}
                    className={inputCls}
                  >
                    <option value="">— No specialist assigned —</option>
                    {trainerOptions
                      .filter(t => !selectedService.trainer_type || t.trainer_type === selectedService.trainer_type)
                      .map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                  </select>
                </div>
              )}

              {/* Other — custom name input */}
              {isOther && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={otherName}
                    onChange={e => setOtherName(e.target.value)}
                    placeholder="Describe the service or item…"
                    className={`${inputCls} flex-1`}
                  />
                  <button type="button" onClick={() => handleSelectService('')} className="p-2 text-gray-500 hover:text-white transition-colors flex-shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Discount / Promo */}
            {selectedService && (selectedService.original_price != null || promoCodes.length > 0) && (
              <div className="space-y-3">
                {/* Plan has active promotion — toggle original vs discounted */}
                {selectedService.original_price != null && (
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-emerald-400">Active Promotion</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Discounted: {selectedService.price} {selectedService.currency}
                          <span className="line-through ml-2 text-gray-600">{selectedService.original_price}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const useOriginal = !useOriginalPrice;
                          setUseOriginalPrice(useOriginal);
                          setAmount(String(useOriginal ? selectedService.original_price : selectedService.price));
                        }}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                          useOriginalPrice
                            ? 'bg-gray-700 text-gray-300'
                            : 'bg-emerald-600/20 text-emerald-400'
                        }`}
                      >
                        {useOriginalPrice ? 'Using original price' : 'Using promo price'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Promo code selector */}
                {promoCodes.length > 0 && !selectedService.plan_promotion_id && (
                  <div>
                    <label className={labelCls}>Promo Code</label>
                    <select
                      value={selectedPromoId}
                      onChange={e => {
                        const promoId = e.target.value;
                        setSelectedPromoId(promoId);
                        if (promoId && selectedService.price != null) {
                          const code = promoCodes.find(c => c.id === promoId);
                          if (code) {
                            const originalPrice = selectedService.price;
                            const discount = code.discount_type === 'percentage'
                              ? originalPrice * (code.discount_value / 100)
                              : Math.min(code.discount_value, originalPrice);
                            setAmount(String(Math.max(0, originalPrice - discount)));
                          }
                        } else if (selectedService.price != null) {
                          setAmount(String(selectedService.price));
                        }
                      }}
                      className={inputCls}
                    >
                      <option value="">— No promo code —</option>
                      {promoCodes.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.code} ({c.discount_type === 'percentage' ? `${c.discount_value}%` : `${c.discount_value} off`})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Branch */}
            {branches.length > 0 && (() => {
              const allowedIds = selectedService?.allowed_branch_ids;
              const filteredBranches = allowedIds
                ? branches.filter(b => allowedIds.includes(b.id))
                : branches;
              return (
                <div>
                  <label className={labelCls}>Branch</label>
                  <select value={branchId} onChange={e => setBranchId(e.target.value)} className={inputCls}>
                    <option value="">— Select branch —</option>
                    {filteredBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  {allowedIds && (
                    <p className="mt-1 text-xs text-gray-500">
                      This plan is limited to {filteredBranches.map(b => b.name).join(', ')}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Amount + Currency */}
            <div>
              <label className={labelCls}>Amount *</label>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">{currency}</span>
                  <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="0.00" className={`${inputCls} pl-12`} required />
                </div>
                <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className={labelCls}>Payment Method</label>
              <div className="grid grid-cols-5 gap-2">
                {METHODS.map(m => (
                  <button key={m} type="button"
                    onClick={() => { setMethod(m); if (m === 'payment_link') setStatus('pending'); }}
                    className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                      method === m
                        ? m === 'payment_link'
                          ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                          : 'border-purple-500 bg-purple-500/10 text-purple-400'
                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}>
                    {METHOD_LABELS[m]}
                  </button>
                ))}
              </div>
              {isPaymentLink && (
                <p className="mt-2 text-xs text-blue-400 flex items-center gap-1.5">
                  <Link2 className="w-3 h-3 flex-shrink-0" />
                  A secure Paymob checkout link will be generated and shared with the customer.
                </p>
              )}
            </div>

            {/* Mobile number — shown only for payment link */}
            {isPaymentLink && (
              <div>
                <label className={labelCls}>Customer Mobile Number *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+201XXXXXXXXX"
                  className={inputCls}
                  required={isPaymentLink}
                />
                <p className="mt-1 text-xs text-gray-500">Include country code — e.g. +201001234567</p>
              </div>
            )}

            {/* Status — disabled for payment links */}
            <div>
              <label className={labelCls}>
                Status
                {isPaymentLink && (
                  <span className="ml-2 text-blue-400 font-normal">— set automatically by payment</span>
                )}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {STATUSES.map(s => (
                  <button key={s.value} type="button"
                    onClick={() => !isPaymentLink && setStatus(s.value)}
                    disabled={isPaymentLink}
                    className={`py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                      isPaymentLink
                        ? s.value === 'pending'
                          ? 'border-amber-500/40 bg-amber-500/5 text-amber-400/50 cursor-not-allowed'
                          : 'border-gray-800 text-gray-600 cursor-not-allowed opacity-40'
                        : status === s.value
                          ? `border-current bg-current/10 ${s.color}`
                          : 'border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className={labelCls}>Notes <span className="text-gray-600">(optional)</span></label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Cash received at front desk…" rows={2}
                className={`${inputCls} resize-none`} />
            </div>

          </div>

          {/* Footer */}
          {generatedLink ? (
            <div className="px-6 py-4 border-t border-gray-700 space-y-3 flex-shrink-0">
              <p className="text-xs text-gray-400">Payment link generated — share it with the customer:</p>
              <div className="flex items-center gap-2 p-3 bg-gray-900 border border-blue-500/30 rounded-xl">
                <Link2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <p className="text-xs text-blue-300 truncate flex-1">{generatedLink}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 transition-colors">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
                <button type="button" onClick={handleWhatsApp}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-sm font-medium text-white transition-colors">
                  <MessageCircle className="w-4 h-4" />
                  Send via WhatsApp
                </button>
              </div>
              <button type="button" onClick={() => { onClose(); window.location.reload(); }}
                className="w-full py-2 rounded-lg text-sm text-gray-500 hover:text-gray-300 transition-colors">
                Done
              </button>
            </div>
          ) : (
            <div className="px-6 py-4 border-t border-gray-700 flex gap-3 flex-shrink-0">
              <button type="button" onClick={onClose} disabled={loading}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={loading || !selectedMember}
                className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40 ${
                  isPaymentLink
                    ? 'bg-blue-600 hover:bg-blue-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}>
                {loading
                  ? isPaymentLink ? 'Generating…' : 'Creating…'
                  : isPaymentLink ? 'Generate Payment Link' : 'Create Payment'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
