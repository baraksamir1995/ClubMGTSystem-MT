'use client';

import { useState, useRef, useEffect } from 'react';
import { Building2, Clock, Upload, Loader2, Check, Dumbbell, Smartphone, GitBranch, Users, ChevronDown, CreditCard, ShieldCheck, Eye, EyeOff, Palette } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GymSettings, OperatingHours, DayHours } from '@/lib/settings-types';
import { DEFAULT_HOURS } from '@/lib/settings-types';
import { can, type Permission } from '@/lib/get-permissions';
import BranchesPage from '@/components/branches/branches-page';
import type { GymBranch } from '@/app/dashboard/branches/page';
import type { GymStudio } from '@/app/dashboard/classes/page';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
};

interface Props {
  gym: GymSettings;
  permissions: Permission[] | null;
  initialBranches: GymBranch[];
  initialStudios: GymStudio[];
  maxBranches: number;
  pricePerBranch: number | null;
  gymId: string;
}

const ALL_SECTIONS = ['profile', 'branding', 'app', 'operations'] as const;
type SectionKey = typeof ALL_SECTIONS[number];

export default function SettingsPage({ gym, permissions, initialBranches, initialStudios, maxBranches, pricePerBranch, gymId }: Props) {
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    profile: false, branding: false, app: false, operations: false,
  });

  const toggle = (key: SectionKey) => setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  const [profile, setProfile] = useState({
    name:        gym.name        ?? '',
    email:       gym.email       ?? '',
    phone:       gym.phone       ?? '',
    address:     gym.address     ?? '',
    description: gym.description ?? '',
  });
  const [hours,       setHours]       = useState<OperatingHours>(gym.operating_hours ?? DEFAULT_HOURS);
  const [logoUrl,     setLogoUrl]     = useState(gym.logo_url);
  const [mobilePaymentsEnabled, setMobilePaymentsEnabled] = useState(gym.mobile_payments_enabled);
  const [capacityEnabled, setCapacityEnabled] = useState(gym.capacity_feature_enabled ?? false);
  const [maxCapacity,     setMaxCapacity]     = useState(String(gym.max_capacity ?? 100));
  const [savingCapacity,  setSavingCapacity]  = useState(false);
  const [liveCapacity, setLiveCapacity] = useState<{
    active_users: number; max_capacity: number; capacity_percentage: number; status: string;
  } | null>(null);
  const [primaryColor,   setPrimaryColor]   = useState(gym.branding_config?.primary_color   ?? '#7C3AED');
  const [secondaryColor, setSecondaryColor] = useState(gym.branding_config?.secondary_color ?? '#818cf8');
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingProfile,  setSavingProfile]  = useState(false);
  const [savingHours,    setSavingHours]    = useState(false);
  const [savingAppSettings, setSavingAppSettings] = useState(false);
  const [uploadingLogo,  setUploadingLogo]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Payment config
  const [paymentStatus, setPaymentStatus] = useState<{
    configured: boolean; is_active?: boolean; provider?: string;
    secret_key_hint?: string; public_key_hint?: string;
    has_card?: boolean; has_valu?: boolean; has_applepay?: boolean;
    updated_at?: string;
  } | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    secretKey: '', publicKey: '', integrationId: '',
    valuIntegrationId: '', applepayIntegrationId: '',
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [paymentLoaded, setPaymentLoaded] = useState(false);

  const inp = 'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500';

  const saveProfile = async () => {
    if (!profile.name.trim()) { toast.error('Gym name is required'); return; }
    setSavingProfile(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:        profile.name.trim(),
          email:       profile.email.trim()   || null,
          phone:       profile.phone.trim()   || null,
          address:     profile.address.trim() || null,
          description: profile.description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return; }
      toast.success('Profile saved');
    } catch { toast.error('Network error'); }
    finally { setSavingProfile(false); }
  };

  const saveHours = async () => {
    setSavingHours(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatingHours: hours }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return; }
      toast.success('Operating hours saved');
    } catch { toast.error('Network error'); }
    finally { setSavingHours(false); }
  };

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/settings/logo', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Upload failed'); return; }
      setLogoUrl(data.logo_url);
      toast.success('Logo updated');
    } catch { toast.error('Network error'); }
    finally { setUploadingLogo(false); }
  };

  const saveAppSettings = async () => {
    setSavingAppSettings(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobilePaymentsEnabled }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return; }
      toast.success('App settings saved');
    } catch { toast.error('Network error'); }
    finally { setSavingAppSettings(false); }
  };

  const saveBranding = async () => {
    setSavingBranding(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandingConfig: {
            primary_color: primaryColor,
            secondary_color: secondaryColor,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return; }
      toast.success('App colors saved — members will see the changes next time they open the app');
    } catch { toast.error('Network error'); }
    finally { setSavingBranding(false); }
  };

  const saveCapacity = async () => {
    const cap = parseInt(maxCapacity, 10);
    if (capacityEnabled && (isNaN(cap) || cap <= 0)) {
      toast.error('Max capacity must be a positive number');
      return;
    }
    setSavingCapacity(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capacityEnabled, maxCapacity: cap }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return; }
      toast.success('Capacity settings saved');
    } catch { toast.error('Network error'); }
    finally { setSavingCapacity(false); }
  };

  // ── Payment config ──
  const loadPaymentStatus = async () => {
    try {
      const res = await fetch('/api/settings/payment-config');
      if (res.ok) {
        const data = await res.json();
        setPaymentStatus(data);
      }
    } catch {}
    setPaymentLoaded(true);
  };

  const savePaymentConfig = async () => {
    if (!paymentForm.secretKey || !paymentForm.publicKey || !paymentForm.integrationId) {
      toast.error('Secret key, public key, and card integration ID are required');
      return;
    }
    setSavingPayment(true);
    try {
      const res = await fetch('/api/settings/payment-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentForm),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error ?? 'Failed to save payment config');
        return;
      }
      toast.success('Payment gateway configured successfully');
      setPaymentForm({ secretKey: '', publicKey: '', integrationId: '', valuIntegrationId: '', applepayIntegrationId: '' });
      setShowSecretKey(false);
      loadPaymentStatus();
    } catch { toast.error('Network error'); }
    finally { setSavingPayment(false); }
  };

  useEffect(() => {
    loadPaymentStatus();
  }, []);

  useEffect(() => {
    if (!capacityEnabled) { setLiveCapacity(null); return; }
    let cancelled = false;
    fetch('/api/capacity')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (!cancelled && data) setLiveCapacity(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [capacityEnabled]);

  const updateDay = (day: typeof DAYS[number], field: keyof DayHours, value: string | boolean) => {
    setHours(prev => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
  };

  // Shared section header button
  const SectionHeader = ({ sectionKey, icon, title }: { sectionKey: SectionKey; icon: React.ReactNode; title: string }) => (
    <button
      type="button"
      onClick={() => toggle(sectionKey)}
      className="w-full flex items-center justify-between gap-2 group"
    >
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <ChevronDown
        className={`w-4 h-4 text-gray-400 group-hover:text-white transition-transform duration-200 ${open[sectionKey] ? 'rotate-0' : '-rotate-90'}`}
      />
    </button>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage your gym profile, operations, and integrations</p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1: GYM PROFILE (Logo + Profile fields)
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <SectionHeader sectionKey="profile" icon={<Building2 className="w-4 h-4 text-purple-400" />} title="Gym Profile" />
        {open.profile && (
          <div className="space-y-6 mt-5">
            {/* Logo */}
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-xl bg-gray-700 border border-gray-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoUrl
                  ? <img src={logoUrl} alt="Gym logo" className="w-full h-full object-cover" />
                  : <Dumbbell className="w-8 h-8 text-gray-500" />}
              </div>
              <div>
                <p className="text-sm text-gray-300 mb-2">Used in the member app and splash screen</p>
                {can(permissions, 'settings', 'edit') && (
                  <>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ''; }} />
                    <button onClick={() => fileRef.current?.click()} disabled={uploadingLogo}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-200 text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                      {uploadingLogo
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                        : <><Upload className="w-4 h-4" /> Upload Logo</>}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="border-t border-gray-700" />

            {/* Profile fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Gym Name <span className="text-red-400">*</span></label>
                <input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Iron Fitness Club" className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Email</label>
                  <input type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                    placeholder="contact@gym.com" className={inp} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">Phone</label>
                  <input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                    placeholder="+1 234 567 8900" className={inp} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Address</label>
                <input value={profile.address} onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
                  placeholder="123 Main St, City, Country" className={inp} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Description <span className="text-gray-600">(shown on app splash screen)</span></label>
                <textarea value={profile.description} onChange={e => setProfile(p => ({ ...p, description: e.target.value }))}
                  placeholder="Brief description of your gym…" rows={3}
                  className={inp + ' resize-none'} />
              </div>
              {can(permissions, 'settings', 'edit') && (
                <button onClick={saveProfile} disabled={savingProfile}
                  className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                  {savingProfile ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Check className="w-4 h-4" /> Save Profile</>}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION: APP BRANDING (Colors)
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <SectionHeader sectionKey="branding" icon={<Palette className="w-4 h-4 text-purple-400" />} title="App Branding" />
        {open.branding && (
          <div className="space-y-6 mt-5">
            <p className="text-xs text-gray-400">
              Customize the colors members see in the mobile app. Changes take effect next time a member opens the app.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Primary color */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Primary Color</label>
                <p className="text-xs text-gray-400 mb-3">Used for buttons, links, navigation highlights, and main accents.</p>
                <div className="flex items-center gap-3">
                  <label className="relative cursor-pointer">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={e => setPrimaryColor(e.target.value)}
                      disabled={!can(permissions, 'settings', 'edit')}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div
                      className="w-12 h-12 rounded-xl border-2 border-gray-600 shadow-lg transition-transform hover:scale-105"
                      style={{ backgroundColor: primaryColor }}
                    />
                  </label>
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={e => setPrimaryColor(e.target.value)}
                    disabled={!can(permissions, 'settings', 'edit')}
                    className={`${inp} w-32 uppercase font-mono`}
                    maxLength={7}
                  />
                </div>
              </div>

              {/* Secondary color */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Secondary Color</label>
                <p className="text-xs text-gray-400 mb-3">Used for badges, tags, secondary buttons, and subtle highlights.</p>
                <div className="flex items-center gap-3">
                  <label className="relative cursor-pointer">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={e => setSecondaryColor(e.target.value)}
                      disabled={!can(permissions, 'settings', 'edit')}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <div
                      className="w-12 h-12 rounded-xl border-2 border-gray-600 shadow-lg transition-transform hover:scale-105"
                      style={{ backgroundColor: secondaryColor }}
                    />
                  </label>
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={e => setSecondaryColor(e.target.value)}
                    disabled={!can(permissions, 'settings', 'edit')}
                    className={`${inp} w-32 uppercase font-mono`}
                    maxLength={7}
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div>
              <p className="text-xs text-gray-400 mb-3">Preview</p>
              <div className="flex items-center gap-3 flex-wrap">
                <button className="px-5 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: primaryColor }}>
                  Primary Button
                </button>
                <button className="px-5 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: secondaryColor }}>
                  Secondary Button
                </button>
                <span className="px-3 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: primaryColor }}>
                  Badge
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: secondaryColor }}>
                  Tag
                </span>
              </div>
            </div>

            {can(permissions, 'settings', 'edit') && (
              <button onClick={saveBranding} disabled={savingBranding}
                className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                {savingBranding ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Check className="w-4 h-4" /> Save Colors</>}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION: MOBILE APP & PAYMENTS (Toggle + Payment Gateway)
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <SectionHeader sectionKey="app" icon={<Smartphone className="w-4 h-4 text-purple-400" />} title="Mobile App & Payments" />
        {open.app && (
          <div className="space-y-6 mt-5">
            {/* Mobile payments toggle */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">Mobile Payments</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Allow members to pay for memberships, programmes, and packages directly in the app.
                  When disabled, all payment buttons are hidden from the member app.
                </p>
              </div>
              <button
                type="button"
                onClick={() => can(permissions, 'settings', 'edit') && setMobilePaymentsEnabled(v => !v)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                  mobilePaymentsEnabled ? 'bg-purple-600' : 'bg-gray-600'
                } ${!can(permissions, 'settings', 'edit') ? 'opacity-40 cursor-not-allowed' : ''}`}
                aria-pressed={mobilePaymentsEnabled}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                  mobilePaymentsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
            {can(permissions, 'settings', 'edit') && (
              <button onClick={saveAppSettings} disabled={savingAppSettings}
                className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                {savingAppSettings ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Check className="w-4 h-4" /> Save</>}
              </button>
            )}

            {/* Payment gateway config */}
            {can(permissions, 'settings', 'edit') && (
              <>
                <div className="border-t border-gray-700" />
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-semibold text-white">Payment Gateway</h3>
                </div>

                {/* Current status */}
                {paymentLoaded && paymentStatus && (
                  <div className={`rounded-xl p-4 border ${paymentStatus.configured && paymentStatus.is_active
                    ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldCheck className={`w-4 h-4 ${paymentStatus.configured ? 'text-emerald-400' : 'text-amber-400'}`} />
                      <p className={`text-sm font-medium ${paymentStatus.configured ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {paymentStatus.configured ? 'Payment gateway configured' : 'Payment gateway not configured'}
                      </p>
                    </div>
                    {paymentStatus.configured && (
                      <div className="text-xs text-gray-400 space-y-1">
                        <p>Provider: <span className="text-white font-medium capitalize">{paymentStatus.provider}</span></p>
                        {paymentStatus.secret_key_hint && <p>Secret key: <span className="text-white font-mono">{paymentStatus.secret_key_hint}</span></p>}
                        {paymentStatus.public_key_hint && <p>Public key: <span className="text-white font-mono">{paymentStatus.public_key_hint}</span></p>}
                        <div className="flex gap-3 mt-1">
                          <span className={paymentStatus.has_card ? 'text-emerald-400' : 'text-gray-600'}>Card {paymentStatus.has_card ? '✓' : '✗'}</span>
                          <span className={paymentStatus.has_valu ? 'text-emerald-400' : 'text-gray-600'}>ValU {paymentStatus.has_valu ? '✓' : '✗'}</span>
                          <span className={paymentStatus.has_applepay ? 'text-emerald-400' : 'text-gray-600'}>Apple Pay {paymentStatus.has_applepay ? '✓' : '✗'}</span>
                        </div>
                        {paymentStatus.updated_at && (
                          <p className="text-gray-500 mt-1">Last updated: {new Date(paymentStatus.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-gray-400">
                  Enter your Paymob credentials below. For security, saved credentials are never displayed.
                  Submitting new values will overwrite the existing configuration.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Secret Key <span className="text-red-400">*</span></label>
                    <div className="relative">
                      <input
                        type={showSecretKey ? 'text' : 'password'}
                        value={paymentForm.secretKey}
                        onChange={e => setPaymentForm(p => ({ ...p, secretKey: e.target.value }))}
                        placeholder="sk_live_•••••••••••"
                        className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white w-full pr-10 focus:outline-none focus:border-purple-500"
                      />
                      <button type="button" onClick={() => setShowSecretKey(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                        {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Public Key <span className="text-red-400">*</span></label>
                    <input type="text" value={paymentForm.publicKey}
                      onChange={e => setPaymentForm(p => ({ ...p, publicKey: e.target.value }))}
                      placeholder="pk_live_•••••••••••"
                      className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white w-full focus:outline-none focus:border-purple-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Card Integration ID <span className="text-red-400">*</span></label>
                    <input type="text" value={paymentForm.integrationId}
                      onChange={e => setPaymentForm(p => ({ ...p, integrationId: e.target.value }))}
                      placeholder="e.g. 123456"
                      className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white w-full focus:outline-none focus:border-purple-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">ValU Integration ID <span className="text-gray-500">(optional)</span></label>
                    <input type="text" value={paymentForm.valuIntegrationId}
                      onChange={e => setPaymentForm(p => ({ ...p, valuIntegrationId: e.target.value }))}
                      placeholder="e.g. 789012"
                      className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white w-full focus:outline-none focus:border-purple-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Apple Pay Integration ID <span className="text-gray-500">(optional)</span></label>
                    <input type="text" value={paymentForm.applepayIntegrationId}
                      onChange={e => setPaymentForm(p => ({ ...p, applepayIntegrationId: e.target.value }))}
                      placeholder="e.g. 345678"
                      className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white w-full focus:outline-none focus:border-purple-500" />
                  </div>
                </div>

                <button onClick={savePaymentConfig} disabled={savingPayment}
                  className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                  {savingPayment ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><CreditCard className="w-4 h-4" /> Save Payment Config</>}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 3: BRANCHES & OPERATIONS (Hours + Capacity + Branches)
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <SectionHeader sectionKey="operations" icon={<GitBranch className="w-4 h-4 text-purple-400" />} title="Branches & Operations" />
        {open.operations && (
          <div className="space-y-6 mt-5">
            {/* Operating Hours */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-white">Operating Hours</h3>
              </div>
              <div className="space-y-3">
                {DAYS.map(day => {
                  const dh = hours[day];
                  return (
                    <div key={day} className="flex items-center gap-3">
                      <div className="w-28 flex-shrink-0">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={!dh.closed}
                            onChange={e => updateDay(day, 'closed', !e.target.checked)}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500" />
                          <span className={`text-sm font-medium capitalize ${dh.closed ? 'text-gray-500' : 'text-white'}`}>
                            {DAY_LABELS[day]}
                          </span>
                        </label>
                      </div>
                      {dh.closed ? (
                        <span className="text-xs text-gray-500 italic">Closed</span>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <input type="time" value={dh.open} onChange={e => updateDay(day, 'open', e.target.value)}
                            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500 [color-scheme:dark]" />
                          <span className="text-gray-500 text-xs">to</span>
                          <input type="time" value={dh.close} onChange={e => updateDay(day, 'close', e.target.value)}
                            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500 [color-scheme:dark]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {can(permissions, 'settings', 'edit') && (
                <button onClick={saveHours} disabled={savingHours}
                  className="mt-5 flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                  {savingHours ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Check className="w-4 h-4" /> Save Hours</>}
                </button>
              )}
            </div>

            <div className="border-t border-gray-700" />

            {/* Gym Capacity */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-gray-400" />
                <h3 className="text-sm font-semibold text-white">Gym Capacity</h3>
              </div>
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-white">Enable Capacity Tracking</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Show members how busy the gym is right now. Based on check-ins in the last 2 hours.
                    </p>
                  </div>
                  <button type="button"
                    onClick={() => can(permissions, 'settings', 'edit') && setCapacityEnabled(v => !v)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                      capacityEnabled ? 'bg-purple-600' : 'bg-gray-600'
                    } ${!can(permissions, 'settings', 'edit') ? 'opacity-40 cursor-not-allowed' : ''}`}
                    aria-pressed={capacityEnabled}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                      capacityEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {capacityEnabled && (
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">Maximum Gym Capacity <span className="text-red-400">*</span></label>
                    <input type="number" min={1} value={maxCapacity}
                      onChange={e => setMaxCapacity(e.target.value)} placeholder="e.g. 100"
                      className="w-48 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                      readOnly={!can(permissions, 'settings', 'edit')} />
                    <p className="text-xs text-gray-500 mt-1">Total number of members allowed in the gym at once</p>
                  </div>
                )}

                {capacityEnabled && liveCapacity && (
                  <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3">Live Preview</p>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        liveCapacity.status === 'not_busy' ? 'bg-green-500' :
                        liveCapacity.status === 'moderate' ? 'bg-amber-500' : 'bg-red-500'
                      }`} />
                      <span className="text-sm font-semibold text-white">
                        {liveCapacity.status === 'not_busy' ? 'Not crowded' :
                         liveCapacity.status === 'moderate' ? 'Moderately busy' : 'Very busy'}
                      </span>
                      <span className={`ml-auto text-sm font-bold ${
                        liveCapacity.status === 'not_busy' ? 'text-green-400' :
                        liveCapacity.status === 'moderate' ? 'text-amber-400' : 'text-red-400'
                      }`}>{liveCapacity.capacity_percentage}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${
                        liveCapacity.status === 'not_busy' ? 'bg-green-500' :
                        liveCapacity.status === 'moderate' ? 'bg-amber-500' : 'bg-red-500'
                      }`} style={{ width: `${liveCapacity.capacity_percentage}%` }} />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {liveCapacity.active_users} active members out of {liveCapacity.max_capacity} capacity
                    </p>
                  </div>
                )}

                {can(permissions, 'settings', 'edit') && (
                  <button onClick={saveCapacity} disabled={savingCapacity}
                    className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                    {savingCapacity ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Check className="w-4 h-4" /> Save</>}
                  </button>
                )}
              </div>
            </div>

            <div className="border-t border-gray-700" />

            {/* Branches */}
            <BranchesPage
              initialBranches={initialBranches}
              initialStudios={initialStudios}
              maxBranches={maxBranches}
              pricePerBranch={pricePerBranch}
              gymId={gymId}
              permissions={permissions}
              hideHeader
            />
          </div>
        )}
      </div>
    </div>
  );
}
