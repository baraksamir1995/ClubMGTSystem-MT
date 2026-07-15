'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { X, DollarSign, Search, Link2, Copy, Check, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { MemberOption, ServiceOption, TrainerOption, PromoCode } from '@/app/dashboard/payments/page';
import type { GymBranch } from '@/app/dashboard/branches/page';
import { Button, Modal } from '@/components/ui';

interface Props {
  memberOptions: MemberOption[];
  serviceOptions: ServiceOption[];
  trainerOptions: TrainerOption[];
  branches: GymBranch[];
  promoCodes: PromoCode[];
  onClose: () => void;
}

const METHODS  = ['cash', 'bank_transfer', 'card', 'other', 'payment_link'];
const CURRENCIES = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED'];

const fmt = (amount: number, currency = 'EGP') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);

export default function RecordPaymentModal({ memberOptions, serviceOptions, trainerOptions, branches, promoCodes, onClose }: Props) {
  const router = useRouter();
  const t  = useTranslations('payments');

  const TRAINER_TYPE_LABELS: Record<string, string> = {
    personal_trainer: t('trainerTypes.personal_trainer'),
    nutritionist:     t('trainerTypes.nutritionist'),
    physiotherapist:  t('trainerTypes.physiotherapist'),
    coach:            t('trainerTypes.coach'),
  };

  const METHOD_LABELS: Record<string, string> = {
    cash:          t('method.cash'),
    bank_transfer: t('method.bankTransfer'),
    card:          t('method.card'),
    other:         t('method.other'),
    payment_link:  t('method.paymentLink'),
  };

  const STATUSES = [
    { value: 'paid',    label: t('status.paid'),    color: 'text-success' },
    { value: 'pending', label: t('status.pending'), color: 'text-warning' },
    { value: 'overdue', label: t('status.overdue'), color: 'text-danger' },
  ];

  const TYPE_LABELS: Record<string, string> = {
    membership:      t('serviceTypes.membership'),
    session_package: t('serviceTypes.session_package'),
    program:         t('serviceTypes.program'),
    offer:           t('serviceTypes.offer'),
    other:           t('serviceTypes.other'),
  };

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
    const msg = encodeURIComponent(t('recordModal.whatsAppMessage', { link: generatedLink }));
    const num = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) { toast.error(t('recordModal.selectMemberError')); return; }
    if (!amount || parseFloat(amount) <= 0) { toast.error(t('recordModal.invalidAmountError')); return; }
    if (isOther && !otherName.trim()) { toast.error(t('recordModal.otherDescriptionError')); return; }
    if (isPaymentLink && !phone.trim()) { toast.error(t('recordModal.mobileRequiredError')); return; }

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
        if (!res.ok) { toast.error(data.error ?? t('recordModal.failedToGenerateLink')); return; }
        setGeneratedLink(data.payment_link_url);
        toast.success(t('recordModal.linkGeneratedSuccess'));
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
        if (!res.ok) { toast.error(data.error ?? t('recordModal.failedToRecord')); return; }
        toast.success(t('recordModal.paymentRecorded'));
        onClose();
        router.refresh();
      }
    } catch {
      toast.error(t('toast.networkError'));
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder-fg-faint focus:outline-none focus:border-brand transition-colors';
  const labelCls = 'block text-xs text-fg-muted mb-1.5';

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header>
        <span className="inline-flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-success-soft flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-success" aria-hidden />
          </span>
          {t('recordModal.title')}
        </span>
      </Modal.Header>

      <Modal.Body>
        <form id="record-payment-form" onSubmit={handleSubmit} className="space-y-4">

            {/* Member selector */}
            <div>
              <label className={labelCls}>{t('recordModal.member')} *</label>
              {selectedMember ? (
                <div className="flex items-center gap-3 p-3 bg-surface-3/50 rounded-xl border border-brand/40">
                  <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center text-xs font-bold text-brand flex-shrink-0">
                    {String(selectedMember.full_name ?? selectedMember.member_number ?? '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg">{selectedMember.full_name ?? '—'}</p>
                    <p className="text-xs text-fg-muted">{selectedMember.email ?? selectedMember.member_number}</p>
                    {selectedMember.plan_name && (
                      <p className="text-xs text-brand mt-0.5">{selectedMember.plan_name} · {fmt(selectedMember.plan_price ?? 0, selectedMember.currency ?? 'EGP')}</p>
                    )}
                  </div>
                  <button type="button" onClick={() => setSelectedMember(null)} aria-label="Clear selected member" className="text-fg-faint hover:text-fg transition-colors">
                    <X className="w-4 h-4" aria-hidden />
                  </button>
                </div>
              ) : (
                <div>
                  <div className="relative mb-2">
                    <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-faint" aria-hidden />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                      placeholder={t('recordModal.memberSearchPlaceholder')}
                      className="w-full ps-9 pe-3 py-2 bg-surface border border-line rounded-lg text-sm text-fg placeholder-fg-faint focus:outline-none focus:border-brand transition-colors"
                    />
                  </div>
                  {search && (
                    <div className="max-h-40 overflow-y-auto bg-surface border border-line rounded-xl">
                      {filtered.length === 0 ? (
                        <p className="text-sm text-fg-faint px-3 py-3 text-center">{t('recordModal.noMembersFound')}</p>
                      ) : filtered.slice(0, 8).map(m => (
                        <button key={m.id} type="button" onClick={() => handleSelectMember(m)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-surface-3 transition-colors text-start">
                          <div className="w-7 h-7 rounded-full bg-brand/20 flex items-center justify-center text-xs font-bold text-brand flex-shrink-0">
                            {String(m.full_name ?? m.member_number ?? '?').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-fg truncate">{m.full_name ?? '—'}</p>
                            <p className="text-xs text-fg-faint truncate">{m.email ?? m.member_number}</p>
                          </div>
                          {m.plan_name && <span className="text-xs text-brand flex-shrink-0">{m.plan_name}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Service selector */}
            <div>
              <label className={labelCls}>{t('recordModal.serviceItem')} <span className="text-fg-faint">({t('recordModal.serviceOptional')})</span></label>
              <select
                value={isOther ? '__other__' : (selectedService?.id ?? '')}
                onChange={e => handleSelectService(e.target.value)}
                className={inputCls}
              >
                <option value="">{t('recordModal.selectService')}</option>
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
                  <option value="__other__">{t('recordModal.otherCustom')}</option>
                </optgroup>
              </select>

              {/* Selected service chip */}
              {selectedService && !isOther && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-info-soft border border-info/40 rounded-lg">
                  <span className="text-xs font-medium text-info">{TYPE_LABELS[selectedService.type] ?? selectedService.type}</span>
                  <span className="text-xs text-fg-muted flex-1 truncate">{selectedService.name}</span>
                  {selectedService.price != null && (
                    <span className="text-xs font-semibold text-fg flex-shrink-0">{selectedService.price} {selectedService.currency}</span>
                  )}
                  <button type="button" onClick={() => handleSelectService('')} aria-label="Clear selected service" className="text-fg-faint hover:text-fg transition-colors flex-shrink-0">
                    <X className="w-3 h-3" aria-hidden />
                  </button>
                </div>
              )}

              {/* Trainer picker — shown for service packages that create an assignment */}
              {selectedService?.creates_assignment && (
                <div className="mt-2">
                  <label className="block text-xs text-fg-faint mb-1">{t('recordModal.specialist')} <span className="text-fg-faint">({t('recordModal.specialistOptional')})</span></label>
                  <select
                    value={selectedTrainer?.id ?? ''}
                    onChange={e => setSelectedTrainer(trainerOptions.find(t => t.id === e.target.value) ?? null)}
                    className={inputCls}
                  >
                    <option value="">{t('recordModal.noSpecialistAssigned')}</option>
                    {trainerOptions
                      .filter(tr => !selectedService.trainer_type || tr.trainer_type === selectedService.trainer_type)
                      .map(tr => (
                        <option key={tr.id} value={tr.id}>{tr.name}</option>
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
                    placeholder={t('recordModal.otherDescribePlaceholder')}
                    className={`${inputCls} flex-1`}
                  />
                  <button type="button" onClick={() => handleSelectService('')} aria-label="Clear custom service" className="p-2 text-fg-faint hover:text-fg transition-colors flex-shrink-0">
                    <X className="w-4 h-4" aria-hidden />
                  </button>
                </div>
              )}
            </div>

            {/* Discount / Promo */}
            {selectedService && (selectedService.original_price != null || promoCodes.length > 0) && (
              <div className="space-y-3">
                {/* Plan has active promotion — toggle original vs discounted */}
                {selectedService.original_price != null && (
                  <div className="p-3 bg-success-soft border border-success/40 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-success">{t('recordModal.activePromotion')}</p>
                        <p className="text-xs text-fg-muted mt-0.5">
                          {t('recordModal.discounted')} {selectedService.price} {selectedService.currency}
                          <span className="line-through ms-2 text-fg-faint">{selectedService.original_price}</span>
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
                            ? 'bg-surface-3 text-fg-muted'
                            : 'bg-success-soft text-success'
                        }`}
                      >
                        {useOriginalPrice ? t('recordModal.usingOriginalPrice') : t('recordModal.usingPromoPrice')}
                      </button>
                    </div>
                  </div>
                )}

                {/* Promo code selector */}
                {promoCodes.length > 0 && !selectedService.plan_promotion_id && (
                  <div>
                    <label className={labelCls}>{t('recordModal.promoCode')}</label>
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
                      <option value="">{t('recordModal.noPromoCode')}</option>
                      {promoCodes.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.code} ({c.discount_type === 'percentage' ? `${c.discount_value}%` : t('recordModal.promoOff', { value: c.discount_value })})
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
                  <label className={labelCls}>{t('recordModal.branch')}</label>
                  <select value={branchId} onChange={e => setBranchId(e.target.value)} className={inputCls}>
                    <option value="">{t('recordModal.selectBranch')}</option>
                    {filteredBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  {allowedIds && (
                    <p className="mt-1 text-xs text-fg-faint">
                      {t('recordModal.planLimitedTo', { branches: filteredBranches.map(b => b.name).join(', ') })}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Amount + Currency */}
            <div>
              <label className={labelCls}>{t('recordModal.amount')} *</label>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 relative">
                  <span className="absolute start-3 top-1/2 -translate-y-1/2 text-xs text-fg-faint">{currency}</span>
                  <input type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder="0.00" className={`${inputCls} ps-12`} required />
                </div>
                <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className={labelCls}>{t('recordModal.paymentMethod')}</label>
              <div className="grid grid-cols-5 gap-2">
                {METHODS.map(m => (
                  <button key={m} type="button"
                    onClick={() => { setMethod(m); if (m === 'payment_link') setStatus('pending'); }}
                    className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                      method === m
                        ? m === 'payment_link'
                          ? 'border-info/40 bg-info-soft text-info'
                          : 'border-brand bg-brand/10 text-brand'
                        : 'border-line text-fg-muted hover:border-line-strong'
                    }`}>
                    {METHOD_LABELS[m]}
                  </button>
                ))}
              </div>
              {isPaymentLink && (
                <p className="mt-2 text-xs text-info flex items-center gap-1.5">
                  <Link2 className="w-3 h-3 flex-shrink-0" aria-hidden />
                  {t('recordModal.paymentLinkNote')}
                </p>
              )}
            </div>

            {/* Mobile number — shown only for payment link */}
            {isPaymentLink && (
              <div>
                <label className={labelCls}>{t('recordModal.customerMobile')} *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+201XXXXXXXXX"
                  className={inputCls}
                  required={isPaymentLink}
                />
                <p className="mt-1 text-xs text-fg-faint">{t('recordModal.mobileHint')}</p>
              </div>
            )}

            {/* Status — disabled for payment links */}
            <div>
              <label className={labelCls}>
                {t('recordModal.statusLabel')}
                {isPaymentLink && (
                  <span className="ms-2 text-info font-normal">{t('recordModal.statusAutomatic')}</span>
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
                          ? 'border-warning/40 bg-warning-soft text-warning/50 cursor-not-allowed'
                          : 'border-line text-fg-faint cursor-not-allowed opacity-40'
                        : status === s.value
                          ? `border-current bg-current/10 ${s.color}`
                          : 'border-line text-fg-muted hover:border-line-strong'
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>{t('recordModal.notes')} <span className="text-fg-faint">({t('recordModal.notesOptional')})</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder={t('recordModal.notesPlaceholder')} rows={2}
              className={`${inputCls} resize-none`} />
          </div>
        </form>
      </Modal.Body>

      {/* Footer */}
      {generatedLink ? (
        <Modal.Footer className="flex-col items-stretch gap-3">
          <p className="text-xs text-fg-muted">{t('recordModal.linkGenerated')}</p>
          <div className="flex items-center gap-2 p-3 bg-surface border border-info/40 rounded-xl">
            <Link2 className="w-4 h-4 text-info flex-shrink-0" aria-hidden />
            <p className="text-xs text-info truncate flex-1">{generatedLink}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={handleCopy}
              leftIcon={copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}>
              {copied ? t('recordModal.copied') : t('recordModal.copyLink')}
            </Button>
            <button type="button" onClick={handleWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-success hover:bg-success/90 text-sm font-medium text-on-status transition-colors">
              <MessageCircle className="w-4 h-4" aria-hidden />
              {t('recordModal.sendWhatsApp')}
            </button>
          </div>
          <Button variant="ghost" fullWidth onClick={() => { onClose(); router.refresh(); }}>{t('recordModal.done')}</Button>
        </Modal.Footer>
      ) : (
        <Modal.Footer>
          <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>{t('recordModal.cancel')}</Button>
          <Button type="submit" form="record-payment-form" variant="primary" fullWidth disabled={!selectedMember} isLoading={loading}>
            {isPaymentLink ? t('recordModal.generateLink') : t('createPayment')}
          </Button>
        </Modal.Footer>
      )}
    </Modal>
  );
}
