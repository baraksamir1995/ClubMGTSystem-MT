'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { X, CreditCard, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Plan } from '@/app/dashboard/plans/page';

interface Props {
  plan?: Plan;
  branches: { id: string; name: string }[];
  onClose: () => void;
}

const PLAN_TYPES = [
  { value: 'duration',         label: 'Duration',            hint: 'Time-based, gym access only' },
  { value: 'sessions',         label: 'Sessions Only',       hint: 'Session pack, studio access only' },
  { value: 'duration_session', label: 'Duration + Sessions', hint: 'Fixed period & session count, gym + studio access' },
];


const DURATION_PRESETS = [
  { label: '1 Month',  days: 30 },
  { label: '3 Months', days: 90 },
  { label: '6 Months', days: 180 },
  { label: '1 Year',   days: 365 },
  { label: 'Custom',   days: null },
];

const CURRENCIES = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED'];

const FACILITY_PRESETS = [
  'Gym Floor', 'Swimming Pool', 'Sauna', 'Steam Room',
  'Group Classes', 'Personal Training', 'Locker Room', 'Parking',
  'Cardio Zone', 'Weights Area', 'Boxing Ring', 'Yoga Studio',
];


function getPresetFromDays(days: number | null): number | null {
  if (!days) return null;
  const match = DURATION_PRESETS.find(p => p.days === days);
  return match ? match.days : null;
}

function TagInput({
  tags, onAdd, onRemove, placeholder, presets,
}: {
  tags: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder?: string;
  presets?: string[];
}) {
  const [input, setInput] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  const add = (v: string) => {
    const val = v.trim();
    if (val && !tags.includes(val)) onAdd(val);
    setInput('');
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); add(input); }
    if (e.key === 'Backspace' && !input && tags.length) onRemove(tags[tags.length - 1]);
  };

  return (
    <div className="space-y-2">
      {/* Preset chips */}
      {presets && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map(p => {
            const active = tags.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => active ? onRemove(p) : onAdd(p)}
                className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                  active
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                }`}
              >
                {active ? '✓ ' : ''}{p}
              </button>
            );
          })}
        </div>
      )}
      {/* Tag input */}
      <div
        className="flex flex-wrap gap-1.5 min-h-[38px] bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-1.5 cursor-text focus-within:border-purple-500 transition-colors"
        onClick={() => ref.current?.focus()}
      >
        {tags.map(tag => (
          <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-purple-600/20 border border-purple-600/40 text-purple-300 text-xs rounded-md">
            {tag}
            <button type="button" onClick={() => onRemove(tag)} className="hover:text-white">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={ref}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => { if (input.trim()) add(input); }}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder-gray-500 outline-none"
        />
      </div>
      <p className="text-xs text-gray-600">Press Enter or click a preset to add. Click a tag to remove.</p>
    </div>
  );
}

export default function PlanModal({ plan, branches, onClose }: Props) {
  const router = useRouter();
  const isEdit = !!plan;

  const existingPreset = plan?.plan_type !== 'sessions' ? getPresetFromDays(plan?.duration_days ?? null) : null;
  const isCustom = plan?.duration_days != null && existingPreset === null;

  const [name, setName]             = useState(plan?.name ?? '');
  const [planType, setPlanType]     = useState(plan?.plan_type ?? 'duration');
  const [price, setPrice]           = useState(String(plan?.price ?? ''));
  const [currency, setCurrency]     = useState(plan?.currency ?? 'EGP');
  const [durationPreset, setDurationPreset] = useState<number | 'custom'>(
    isCustom ? 'custom' : (existingPreset ?? 30)
  );
  const [customDays, setCustomDays] = useState(isCustom ? String(plan!.duration_days) : '');
  const [sessionCount, setSessionCount] = useState(String(plan?.session_count ?? ''));
  const [sessionExpiryDays, setSessionExpiryDays] = useState(String(plan?.session_expiry_days ?? ''));
  const [description, setDescription] = useState(plan?.description ?? '');

  // Benefits
  const [facilities, setFacilities] = useState<string[]>(plan?.facilities ?? []);

  // Freeze config
  const [freezeEnabled, setFreezeEnabled]   = useState(plan?.freeze_enabled ?? false);
  const [freezeMaxDays, setFreezeMaxDays]   = useState(String(plan?.freeze_max_days ?? ''));
  const [freezeMaxCount, setFreezeMaxCount] = useState(String(plan?.freeze_max_count ?? ''));

  // Invitation config
  const [invitationsEnabled, setInvitationsEnabled]         = useState(plan?.invitations_enabled ?? false);
  const [invitationsPerCycle, setInvitationsPerCycle]       = useState(String(plan?.invitations_per_cycle ?? ''));
  const [inviteDurationType, setInviteDurationType]         = useState<'per_visit' | 'time_based'>(plan?.invitation_duration_type ?? 'per_visit');
  const [inviteDurationDays, setInviteDurationDays]         = useState(String(plan?.invitation_duration_days ?? ''));
  const [inviteValidityDays, setInviteValidityDays]         = useState(String(plan?.invitation_validity_days ?? '7'));

  const [accessScope, setAccessScope] = useState<'all_branches' | 'specific_branches'>(plan?.access_scope ?? 'all_branches');
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>(plan?.allowed_branch_ids ?? []);

  const [loading, setLoading]       = useState(false);

  const resolvedDays = durationPreset === 'custom' ? (parseInt(customDays) || null) : durationPreset;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Plan name is required'); return; }
    if (accessScope === 'specific_branches' && selectedBranchIds.length === 0) { toast.error('Select at least one branch'); return; }
    const isUnlimitedSessions = planType === 'sessions' && !sessionCount;
    if (planType !== 'sessions' && !resolvedDays) { toast.error('Please set a duration'); return; }
    if (isUnlimitedSessions && !resolvedDays) { toast.error('Set a duration for unlimited sessions'); return; }
    // duration_session also supports unlimited (empty session_count = unlimited
    // studio access during the duration window). No required check.
    const isDuration = planType !== 'sessions';
    if (isDuration && freezeEnabled) {
      if (!freezeMaxDays || parseInt(freezeMaxDays) < 1) { toast.error('Freeze max days must be a positive number'); return; }
      if (!freezeMaxCount || parseInt(freezeMaxCount) < 1) { toast.error('Freeze max count must be a positive number'); return; }
      if (resolvedDays && parseInt(freezeMaxDays) >= resolvedDays) { toast.error('Freeze days must be less than plan duration'); return; }
    }

    const body: Record<string, unknown> = {
      name: name.trim(),
      plan_type: planType,

      price: parseFloat(price) || 0,
      currency,
      description: description.trim() || null,
      duration_days: (planType !== 'sessions' || isUnlimitedSessions) ? resolvedDays : null,
      session_count: (planType === 'sessions' || planType === 'duration_session') ? (parseInt(sessionCount) || null) : null,
      session_expiry_days: (planType === 'sessions' && !isUnlimitedSessions) ? (parseInt(sessionExpiryDays) || null) : null,
      facilities: facilities.length > 0 ? facilities : null,
      freeze_enabled:   isDuration ? freezeEnabled : false,
      freeze_max_days:  isDuration && freezeEnabled ? parseInt(freezeMaxDays) : null,
      freeze_max_count: isDuration && freezeEnabled ? parseInt(freezeMaxCount) : null,
      access_scope:        accessScope,
      allowed_branch_ids:  accessScope === 'specific_branches' ? selectedBranchIds : null,
      invitations_enabled:      invitationsEnabled,
      invitations_per_cycle:    invitationsEnabled ? (parseInt(invitationsPerCycle) || null) : null,
      invitation_duration_type: invitationsEnabled ? inviteDurationType : null,
      invitation_duration_days: invitationsEnabled && inviteDurationType === 'time_based' ? (parseInt(inviteDurationDays) || null) : null,
      invitation_validity_days: invitationsEnabled ? (parseInt(inviteValidityDays) || 7) : 7,
    };

    setLoading(true);
    try {
      const url    = isEdit ? `/api/plans/${plan!.id}` : '/api/plans';
      const method = isEdit ? 'PATCH' : 'POST';
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data   = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return; }
      toast.success(isEdit ? 'Plan updated' : 'Plan created');
      onClose();
      router.refresh();
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors';
  const labelCls = 'block text-xs text-gray-400 mb-1.5';
  const sectionCls = 'border-t border-gray-700 pt-5';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-purple-400" />
            <h2 className="text-base font-semibold text-white">{isEdit ? 'Edit Plan' : 'Create Plan'}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">

            {/* ── Plan Name ── */}
            <div>
              <label className={labelCls}>Plan Name *</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. Gold Monthly, 10-Session Pack" className={inputCls} required />
            </div>

            {/* ── Plan Type ── */}
            <div>
              <label className={labelCls}>Plan Type *</label>
              <div className="grid grid-cols-2 gap-2">
                {PLAN_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => setPlanType(t.value)}
                    className={`p-3 rounded-xl border text-left transition-colors ${planType === t.value ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 hover:border-gray-600'}`}>
                    <p className={`text-xs font-semibold ${planType === t.value ? 'text-purple-400' : 'text-gray-300'}`}>{t.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-tight">{t.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Pricing ── */}
            <div>
              <label className={labelCls}>Pricing</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">{currency}</span>
                  <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
                    placeholder="0.00" className={`${inputCls} pl-12 no-spinner`} />
                </div>
                <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>


            {/* ── Duration / Sessions ── */}
            {(planType !== 'sessions' || !sessionCount) && (
              <div>
                <label className={labelCls}>
                  {planType === 'sessions' ? 'Valid For (duration)' : 'Membership Duration'}
                </label>
                <div className="grid grid-cols-5 gap-2 mb-2">
                  {DURATION_PRESETS.map(p => (
                    <button key={p.label} type="button"
                      onClick={() => { setDurationPreset(p.days ?? 'custom'); if (p.days !== null) setCustomDays(''); }}
                      className={`py-2 rounded-lg border text-xs font-medium transition-colors ${
                        (p.days === null ? durationPreset === 'custom' : durationPreset === p.days)
                          ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                          : 'border-gray-700 hover:border-gray-600 text-gray-400'
                      }`}>{p.label}</button>
                  ))}
                </div>
                {durationPreset === 'custom' ? (
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" value={customDays} onChange={e => setCustomDays(e.target.value)}
                      placeholder="Number of days" className={inputCls} />
                    <span className="text-xs text-gray-500 whitespace-nowrap">days</span>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Membership active for <span className="text-gray-300">{durationPreset} days</span></p>
                )}
              </div>
            )}
            {(planType === 'sessions' || planType === 'duration_session') && (
              <div>
                <label className={labelCls}>
                  {planType === 'duration_session' ? 'Included Sessions' : 'Number of Sessions'}
                </label>
                <div className="flex items-center gap-2">
                  <input type="number" min="1" value={sessionCount} onChange={e => setSessionCount(e.target.value)}
                    placeholder="e.g. 10" className={inputCls} />
                  <span className="text-xs text-gray-500 whitespace-nowrap">sessions</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">Leave empty for unlimited sessions.</p>
              </div>
            )}
            {planType === 'sessions' && !!sessionCount && (
              <div>
                <label className={labelCls}>Expiry <span className="text-gray-600">(optional)</span></label>
                <div className="flex items-center gap-2">
                  <input type="number" min="1" value={sessionExpiryDays} onChange={e => setSessionExpiryDays(e.target.value)}
                    placeholder="e.g. 60" className={inputCls} />
                  <span className="text-xs text-gray-500 whitespace-nowrap">days from start</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">Sessions expire after this many days even if not all used. Leave blank for no expiry.</p>
              </div>
            )}

            {/* ══ BENEFITS & ACCESS ══ */}
            <div className={sectionCls}>
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-4">Benefits & Access</p>

              {/* Facilities */}
              <div className="mb-4">
                <label className={labelCls}>Facilities & Classes Access</label>
                <TagInput
                  tags={facilities}
                  onAdd={v => setFacilities(p => [...p, v])}
                  onRemove={v => setFacilities(p => p.filter(x => x !== v))}
                  placeholder="Type a facility and press Enter…"
                  presets={FACILITY_PRESETS}
                />
              </div>


            </div>

            {/* ══ BRANCH ACCESS ══ */}
            {branches.length > 1 && (
              <div className={sectionCls}>
                <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest mb-4">Branch Access</p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {[
                    { value: 'all_branches',      label: 'All Branches',      hint: 'Access any branch' },
                    { value: 'specific_branches', label: 'Specific Branches', hint: 'Restrict to selected' },
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setAccessScope(opt.value as 'all_branches' | 'specific_branches')}
                      className={`p-3 rounded-xl border text-left transition-colors ${accessScope === opt.value ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 hover:border-gray-600'}`}>
                      <p className={`text-xs font-semibold ${accessScope === opt.value ? 'text-purple-400' : 'text-gray-300'}`}>{opt.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{opt.hint}</p>
                    </button>
                  ))}
                </div>
                {accessScope === 'specific_branches' && (
                  <div className="space-y-1.5">
                    {branches.map(b => {
                      const selected = selectedBranchIds.includes(b.id);
                      return (
                        <button key={b.id} type="button"
                          onClick={() => setSelectedBranchIds(prev => selected ? prev.filter(id => id !== b.id) : [...prev, b.id])}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${selected ? 'border-purple-500 bg-purple-500/10' : 'border-gray-700 hover:border-gray-600'}`}>
                          <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${selected ? 'border-purple-500 bg-purple-500' : 'border-gray-600'}`}>
                            {selected && <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                          </div>
                          <span className={`text-sm ${selected ? 'text-white' : 'text-gray-400'}`}>{b.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Description ── */}
            <div className={sectionCls}>
              <label className={labelCls}>Description <span className="text-gray-600">(optional)</span></label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="What's included in this plan…" rows={2} className={`${inputCls} resize-none`} />
            </div>

            {/* ══ FREEZE CONFIGURATION ══ — only for duration-based plans */}
            {planType !== 'sessions' && (
              <div className={sectionCls}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest">Freeze Plan</p>
                    <p className="text-xs text-gray-500 mt-0.5">Allow members to pause their plan for a set number of days</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFreezeEnabled(v => !v)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${freezeEnabled ? 'bg-blue-500' : 'bg-gray-600'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${freezeEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </div>
                {freezeEnabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Max freeze days <span className="text-gray-600">(total)</span></label>
                      <div className="flex items-center gap-2">
                        <input type="number" min="1" value={freezeMaxDays} onChange={e => setFreezeMaxDays(e.target.value)}
                          placeholder="e.g. 14" className={inputCls} />
                        <span className="text-xs text-gray-500 whitespace-nowrap">days</span>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Max freeze count</label>
                      <div className="flex items-center gap-2">
                        <input type="number" min="1" value={freezeMaxCount} onChange={e => setFreezeMaxCount(e.target.value)}
                          placeholder="e.g. 2" className={inputCls} />
                        <span className="text-xs text-gray-500 whitespace-nowrap">times</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══ GUEST INVITATIONS ══ */}
            <div className={sectionCls}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold text-gray-300 uppercase tracking-widest">Guest Invitations</p>
                  <p className="text-xs text-gray-500 mt-0.5">Allow members to invite guests with limited passes</p>
                </div>
                <button
                  type="button"
                  onClick={() => setInvitationsEnabled(v => !v)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${invitationsEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${invitationsEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {invitationsEnabled && (
                <div className="space-y-3">
                  {/* Invites per cycle */}
                  <div>
                    <label className={labelCls}>Invitations per cycle</label>
                    <div className="flex items-center gap-2">
                      <input type="number" min="1" value={invitationsPerCycle} onChange={e => setInvitationsPerCycle(e.target.value)}
                        placeholder="e.g. 3" className={inputCls} />
                      <span className="text-xs text-gray-500 whitespace-nowrap">invites</span>
                    </div>
                  </div>

                  {/* Pass type */}
                  <div>
                    <label className={labelCls}>Pass type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'per_visit', label: 'Per Visit', hint: 'Single entry' },
                        { value: 'time_based', label: 'Time-Based', hint: 'Valid for X days' },
                      ].map(opt => (
                        <button key={opt.value} type="button"
                          onClick={() => setInviteDurationType(opt.value as 'per_visit' | 'time_based')}
                          className={`p-3 rounded-xl border text-left transition-colors ${inviteDurationType === opt.value ? 'border-green-500 bg-green-500/10' : 'border-gray-700 hover:border-gray-600'}`}>
                          <p className={`text-xs font-semibold ${inviteDurationType === opt.value ? 'text-green-400' : 'text-gray-300'}`}>{opt.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{opt.hint}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Duration days — only for time-based */}
                  {inviteDurationType === 'time_based' && (
                    <div>
                      <label className={labelCls}>Pass duration</label>
                      <div className="flex items-center gap-2">
                        <input type="number" min="1" value={inviteDurationDays} onChange={e => setInviteDurationDays(e.target.value)}
                          placeholder="e.g. 3" className={inputCls} />
                        <span className="text-xs text-gray-500 whitespace-nowrap">days</span>
                      </div>
                    </div>
                  )}

                  {/* Validity window */}
                  <div>
                    <label className={labelCls}>Acceptance window</label>
                    <div className="flex items-center gap-2">
                      <input type="number" min="1" max="30" value={inviteValidityDays} onChange={e => setInviteValidityDays(e.target.value)}
                        placeholder="e.g. 7" className={inputCls} />
                      <span className="text-xs text-gray-500 whitespace-nowrap">days to accept</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Invitation expires if not accepted within this window. Unused invite is returned to the member.</p>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-700 flex gap-3 flex-shrink-0">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-medium text-white transition-colors disabled:opacity-50">
              {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
