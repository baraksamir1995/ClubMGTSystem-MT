'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Dumbbell, Salad, HeartPulse, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Button, Modal, Select, Textarea } from '@/components/ui';
import { isDisplayableMessage, networkErrorMessage } from '@/lib/api-error';

const SERVICE_TYPE_KEYS = ['personal_trainer', 'nutritionist', 'physiotherapist'] as const;
type ServiceTypeKey = typeof SERVICE_TYPE_KEYS[number];

const SERVICE_ICONS: Record<ServiceTypeKey, React.ElementType> = {
  personal_trainer: Dumbbell,
  nutritionist: Salad,
  physiotherapist: HeartPulse,
};

const SERVICE_STYLES: Record<ServiceTypeKey, { color: string; bg: string; border: string }> = {
  personal_trainer: { color: 'text-brand',       bg: 'bg-brand/10',       border: 'border-brand/30' },
  nutritionist:     { color: 'text-success', bg: 'bg-success-soft', border: 'border-success/40' },
  physiotherapist:  { color: 'text-info',    bg: 'bg-info-soft',    border: 'border-info/40' },
};

const PAYMENT_METHOD_KEYS = ['cash', 'bank_transfer', 'card', 'other'] as const;

interface Pkg {
  id: string;
  name: string;
  session_count: number;
  price: number;
  currency: string;
  description: string | null;
}

interface Trainer {
  id: string;
  name: string;
  photo_url: string | null;
}

interface Props {
  memberId: string;
  memberName: string;
  onClose: () => void;
}

const fmt = (amount: number, currency = 'EGP') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);

export default function AssignServiceModal({ memberId, memberName, onClose }: Props) {
  const t = useTranslations('members.assignService');
  const tp = useTranslations('members.payments');
  const tc = useTranslations('common');
  const ts = useTranslations('members.servicePackages');
  const tErr = useTranslations('common.errors');
  const router = useRouter();
  const [serviceType, setServiceType] = useState<ServiceTypeKey>('personal_trainer');
  const [packages, setPackages]       = useState<Pkg[]>([]);
  const [trainers, setTrainers]       = useState<Trainer[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<Pkg | null>(null);
  const [trainerId, setTrainerId]     = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [notes, setNotes]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [fetching, setFetching]       = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // Reload packages + trainers whenever service type changes
  useEffect(() => {
    setSelectedPkg(null);
    setTrainerId('');
    setFetching(true);

    Promise.all([
      fetch(`/api/service-packages?trainer_type=${serviceType}`).then(r => r.json()),
      fetch(`/api/trainers`).then(r => r.json()),
    ]).then(([pkgRes, trainerRes]) => {
      setPackages(pkgRes.packages ?? []);
      const all: any[] = trainerRes.trainers ?? [];
      setTrainers(all.filter(tr => tr.trainer_type === serviceType && tr.is_active));
    }).finally(() => setFetching(false));
  }, [serviceType]);

  async function handleSubmit() {
    if (!selectedPkg) { setError(t('toast.selectPackage')); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/members/${memberId}/services`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_package_id: selectedPkg.id,
          trainer_id:         trainerId || null,
          payment_method:     paymentMethod,
          notes:              notes || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? t('toast.failed'));
      }
      toast.success(t('toast.assigned'));
      onClose();
      router.refresh();
    } catch (e: any) {
      setError(isDisplayableMessage(e?.message) ? e.message : networkErrorMessage(tErr));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open onClose={onClose} size="lg">
      <Modal.Header>
        <span>
          {t('title')}
          <span className="block text-fg-muted text-xs font-normal mt-0.5">{memberName}</span>
        </span>
      </Modal.Header>

      <Modal.Body className="space-y-5">
          {/* Service type selector */}
          <div>
            <label className="block text-xs font-medium text-fg-muted uppercase tracking-wide mb-2">{t('serviceTypeLabel')}</label>
            <div className="grid grid-cols-3 gap-2">
              {SERVICE_TYPE_KEYS.map((key) => {
                const Icon = SERVICE_ICONS[key];
                const { color, bg, border } = SERVICE_STYLES[key];
                const label = ts(`serviceType.${key}`);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setServiceType(key)}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-medium transition-all ${
                      serviceType === key
                        ? `${bg} ${color} ${border}`
                        : 'bg-surface-2 text-fg-muted border-line hover:border-line-strong'
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Package list */}
          <div>
            <label className="block text-xs font-medium text-fg-muted uppercase tracking-wide mb-2">{t('packageLabel')}</label>
            {fetching ? (
              <div className="text-sm text-fg-faint py-4 text-center">{t('loadingPackages')}</div>
            ) : packages.length === 0 ? (
              <div className="text-sm text-fg-faint py-4 text-center">{t('noPackages')}</div>
            ) : (
              <div className="space-y-2">
                {packages.map(pkg => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => setSelectedPkg(pkg)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-start transition-all ${
                      selectedPkg?.id === pkg.id
                        ? 'bg-brand/10 border-brand/40 text-fg'
                        : 'bg-surface-2 border-line hover:border-line-strong text-fg-muted'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{pkg.name}</p>
                      <p className="text-xs text-fg-faint mt-0.5">{t('sessionsCount', { count: pkg.session_count })}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-sm font-semibold text-brand">{fmt(pkg.price, pkg.currency)}</p>
                      {selectedPkg?.id === pkg.id && <Check className="w-4 h-4 text-brand ms-auto mt-1" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Trainer (optional) */}
          {trainers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-fg-muted uppercase tracking-wide mb-2">
                {t('specialistLabel')} <span className="text-fg-faint normal-case font-normal">({tc('optional')})</span>
              </label>
              <Select value={trainerId} onChange={e => setTrainerId(e.target.value)}>
                <option value="">{t('notAssigned')}</option>
                {trainers.map(tr => (
                  <option key={tr.id} value={tr.id}>{tr.name}</option>
                ))}
              </Select>
            </div>
          )}

          {/* Payment method */}
          <div>
            <label className="block text-xs font-medium text-fg-muted uppercase tracking-wide mb-2">{t('paymentMethodLabel')}</label>
            <Select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHOD_KEYS.map(key => (
                <option key={key} value={key}>{tp(`method.${key}`)}</option>
              ))}
            </Select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-fg-muted uppercase tracking-wide mb-2">
              {t('notesLabel')} <span className="text-fg-faint normal-case font-normal">({tc('optional')})</span>
            </label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder={t('notesPlaceholder')}
              className="resize-none"
            />
          </div>

          {/* Summary */}
          {selectedPkg && (
            <div className="bg-surface-3/60 rounded-xl p-4 text-sm space-y-1.5">
              <div className="flex justify-between text-fg-muted">
                <span>{t('summaryPackage')}</span>
                <span className="text-fg font-medium">{selectedPkg.name}</span>
              </div>
              <div className="flex justify-between text-fg-muted">
                <span>{t('summarySessions')}</span>
                <span className="text-fg">{selectedPkg.session_count}</span>
              </div>
              <div className="flex justify-between text-fg-muted">
                <span>{t('summaryAmountDue')}</span>
                <span className="text-brand font-semibold">{fmt(selectedPkg.price, selectedPkg.currency)}</span>
              </div>
            </div>
          )}

          {error && <p className="text-danger text-sm">{error}</p>}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>{tc('cancel')}</Button>
        <Button variant="primary" fullWidth onClick={handleSubmit} disabled={!selectedPkg} isLoading={loading}>
          {t('assignPackage')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
