'use client';

import { useState, useEffect } from 'react';
import { X, Dumbbell, Salad, HeartPulse, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const SERVICE_TYPES = [
  { value: 'personal_trainer',  label: 'Personal Training', icon: Dumbbell,   color: 'text-purple-400',  bg: 'bg-purple-400/10',  border: 'border-purple-400/30' },
  { value: 'nutritionist',      label: 'Nutrition',         icon: Salad,       color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
  { value: 'physiotherapist',   label: 'Physiotherapy',     icon: HeartPulse,  color: 'text-blue-400',    bg: 'bg-blue-400/10',    border: 'border-blue-400/30' },
] as const;

const PAYMENT_METHODS = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'card',          label: 'Card' },
  { value: 'other',         label: 'Other' },
];

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
  const [serviceType, setServiceType] = useState<string>('personal_trainer');
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
      setTrainers(all.filter(t => t.trainer_type === serviceType && t.is_active));
    }).finally(() => setFetching(false));
  }, [serviceType]);

  async function handleSubmit() {
    if (!selectedPkg) { setError('Please select a package'); return; }
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
        throw new Error(body.error ?? 'Failed to assign package');
      }
      toast.success('Service package assigned');
      onClose();
      window.location.reload();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-lg border border-gray-700/50 shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <div>
            <h2 className="text-white font-semibold text-base">Assign Service Package</h2>
            <p className="text-gray-400 text-xs mt-0.5">{memberName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Service type selector */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Service Type</label>
            <div className="grid grid-cols-3 gap-2">
              {SERVICE_TYPES.map(({ value, label, icon: Icon, color, bg, border }) => (
                <button
                  key={value}
                  onClick={() => setServiceType(value)}
                  className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-medium transition-all ${
                    serviceType === value
                      ? `${bg} ${color} ${border}`
                      : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Package list */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Package</label>
            {fetching ? (
              <div className="text-sm text-gray-500 py-4 text-center">Loading packages…</div>
            ) : packages.length === 0 ? (
              <div className="text-sm text-gray-500 py-4 text-center">No packages available for this service type.</div>
            ) : (
              <div className="space-y-2">
                {packages.map(pkg => (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPkg(pkg)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      selectedPkg?.id === pkg.id
                        ? 'bg-purple-600/10 border-purple-500/40 text-white'
                        : 'bg-gray-800 border-gray-700 hover:border-gray-600 text-gray-300'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{pkg.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{pkg.session_count} sessions</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-purple-400">{fmt(pkg.price, pkg.currency)}</p>
                      {selectedPkg?.id === pkg.id && <Check className="w-4 h-4 text-purple-400 ml-auto mt-1" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Trainer (optional) */}
          {trainers.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Specialist <span className="text-gray-600 normal-case font-normal">(optional)</span>
              </label>
              <select
                value={trainerId}
                onChange={e => setTrainerId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="">— Not assigned —</option>
                {trainers.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Payment method */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              Notes <span className="text-gray-600 normal-case font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Start next Monday"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
            />
          </div>

          {/* Summary */}
          {selectedPkg && (
            <div className="bg-gray-800/60 rounded-xl p-4 text-sm space-y-1.5">
              <div className="flex justify-between text-gray-400">
                <span>Package</span>
                <span className="text-white font-medium">{selectedPkg.name}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Sessions</span>
                <span className="text-white">{selectedPkg.session_count}</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Amount due</span>
                <span className="text-purple-400 font-semibold">{fmt(selectedPkg.price, selectedPkg.currency)}</span>
              </div>
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-600 text-gray-300 text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !selectedPkg}
              className="flex-1 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Assigning…' : 'Assign Package'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
