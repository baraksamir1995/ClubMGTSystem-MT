'use client';

import { useState, useRef, useEffect } from 'react';
import { Building2, Clock, Upload, Loader2, Check, Dumbbell, Smartphone, GitBranch, Users, ChevronDown, CreditCard, ShieldCheck, Eye, EyeOff, Palette } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import type { GymSettings, OperatingHours, DayHours } from '@/lib/settings-types';
import { DEFAULT_HOURS } from '@/lib/settings-types';
import { can, type Permission } from '@/lib/get-permissions';
import BranchesPage from '@/components/branches/branches-page';
import type { GymBranch } from '@/app/dashboard/branches/page';
import type { GymStudio } from '@/app/dashboard/classes/page';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

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
  const t = useTranslations('settings');
  const tc = useTranslations('common');

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
  const [sessionTransferEnabled, setSessionTransferEnabled] = useState(gym.session_transfer_enabled ?? true);
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

  const inp = 'w-full bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-focus focus:ring-2 focus:ring-focus';

  const saveProfile = async () => {
    if (!profile.name.trim()) { toast.error(t('profile.gymNameRequired')); return; }
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
      if (!res.ok) { toast.error(data.error ?? t('failedSave')); return; }
      toast.success(t('profile.savedProfile'));
    } catch { toast.error(t('networkError')); }
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
      if (!res.ok) { toast.error(data.error ?? t('failedSave')); return; }
      toast.success(t('hours.savedHours'));
    } catch { toast.error(t('networkError')); }
    finally { setSavingHours(false); }
  };

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/settings/logo', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? t('failedUpload')); return; }
      setLogoUrl(data.logo_url);
      toast.success(t('profile.logoUpdated'));
    } catch { toast.error(t('networkError')); }
    finally { setUploadingLogo(false); }
  };

  const saveAppSettings = async () => {
    setSavingAppSettings(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobilePaymentsEnabled, sessionTransferEnabled }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? t('failedSave')); return; }
      toast.success(t('app.savedAppSettings'));
    } catch { toast.error(t('networkError')); }
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
      if (!res.ok) { toast.error(data.error ?? t('failedSave')); return; }
      toast.success(t('branding.savedColors'));
    } catch { toast.error(t('networkError')); }
    finally { setSavingBranding(false); }
  };

  const saveCapacity = async () => {
    const cap = parseInt(maxCapacity, 10);
    if (capacityEnabled && (isNaN(cap) || cap <= 0)) {
      toast.error(t('capacity.maxCapacityRequired'));
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
      if (!res.ok) { toast.error(data.error ?? t('failedSave')); return; }
      toast.success(t('capacity.savedCapacity'));
    } catch { toast.error(t('networkError')); }
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
      toast.error(t('app.paymentConfigRequired'));
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
        toast.error(data.error ?? t('failedSave'));
        return;
      }
      toast.success(t('app.paymentConfigSaved'));
      setPaymentForm({ secretKey: '', publicKey: '', integrationId: '', valuIntegrationId: '', applepayIntegrationId: '' });
      setShowSecretKey(false);
      loadPaymentStatus();
    } catch { toast.error(t('networkError')); }
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
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
      </div>
      <ChevronDown
        className={`w-4 h-4 text-fg-muted group-hover:text-fg transition-transform duration-200 ${open[sectionKey] ? 'rotate-0' : '-rotate-90'}`}
      />
    </button>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-fg">{t('title')}</h1>
        <p className="text-sm text-fg-muted mt-0.5">{t('subtitle')}</p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1: GYM PROFILE (Logo + Profile fields)
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-surface-2 border border-line rounded-xl p-6">
        <SectionHeader sectionKey="profile" icon={<Building2 className="w-4 h-4 text-brand" />} title={t('sections.gymProfile')} />
        {open.profile && (
          <div className="space-y-6 mt-5">
            {/* Logo */}
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-xl bg-surface-3 border border-line flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoUrl
                  // eslint-disable-next-line @next/next/no-img-element -- user-uploaded gym logo on external host
                  ? <img src={logoUrl} alt={t('profile.logoAlt')} className="w-full h-full object-cover" />
                  : <Dumbbell className="w-8 h-8 text-fg-faint" />}
              </div>
              <div>
                <p className="text-sm text-fg-muted mb-2">{t('profile.logoUsage')}</p>
                {can(permissions, 'settings', 'edit') && (
                  <>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ''; }} />
                    <button onClick={() => fileRef.current?.click()} disabled={uploadingLogo}
                      className="flex items-center gap-2 px-4 py-2 bg-surface-3 hover:bg-surface-4 border border-line text-fg text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                      {uploadingLogo
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('profile.uploading')}</>
                        : <><Upload className="w-4 h-4" /> {t('profile.uploadLogo')}</>}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="border-t border-line" />

            {/* Profile fields */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-fg-muted mb-1.5">{t('profile.gymName')} <span className="text-danger">*</span></label>
                <input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                  placeholder={t('profile.gymNamePlaceholder')} className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-fg-muted mb-1.5">{tc('email')}</label>
                  <input type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                    placeholder={t('profile.emailPlaceholder')} className={inp} />
                </div>
                <div>
                  <label className="block text-xs text-fg-muted mb-1.5">{tc('phone')}</label>
                  <input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                    placeholder={t('profile.phonePlaceholder')} className={inp} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-fg-muted mb-1.5">{t('profile.address')}</label>
                <input value={profile.address} onChange={e => setProfile(p => ({ ...p, address: e.target.value }))}
                  placeholder={t('profile.addressPlaceholder')} className={inp} />
              </div>
              <div>
                <label className="block text-xs text-fg-muted mb-1.5">
                  {t('profile.description')} <span className="text-fg-faint">{t('profile.descriptionHint')}</span>
                </label>
                <textarea value={profile.description} onChange={e => setProfile(p => ({ ...p, description: e.target.value }))}
                  placeholder={t('profile.descriptionPlaceholder')} rows={3}
                  className={inp + ' resize-none'} />
              </div>
              {can(permissions, 'settings', 'edit') && (
                <button onClick={saveProfile} disabled={savingProfile}
                  className="flex items-center gap-2 px-5 py-2 bg-brand-fill hover:bg-brand-dim text-brand-ink border border-brand-edge text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                  {savingProfile ? <><Loader2 className="w-4 h-4 animate-spin" /> {tc('saving')}</> : <><Check className="w-4 h-4" /> {t('profile.saveProfile')}</>}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION: APP BRANDING (Colors)
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-surface-2 border border-line rounded-xl p-6">
        <SectionHeader sectionKey="branding" icon={<Palette className="w-4 h-4 text-brand" />} title={t('sections.appBranding')} />
        {open.branding && (
          <div className="space-y-6 mt-5">
            <p className="text-xs text-fg-muted">
              {t('branding.subtitle')}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Primary color */}
              <div>
                <label className="block text-sm font-medium text-fg mb-2">{t('branding.primaryColor')}</label>
                <p className="text-xs text-fg-muted mb-3">{t('branding.primaryColorDesc')}</p>
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
                      className="w-12 h-12 rounded-xl border-2 border-line shadow-lg transition-transform hover:scale-105"
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
                <label className="block text-sm font-medium text-fg mb-2">{t('branding.secondaryColor')}</label>
                <p className="text-xs text-fg-muted mb-3">{t('branding.secondaryColorDesc')}</p>
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
                      className="w-12 h-12 rounded-xl border-2 border-line shadow-lg transition-transform hover:scale-105"
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
              <p className="text-xs text-fg-muted mb-3">{t('branding.preview')}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <button className="px-5 py-2 rounded-lg text-fg text-sm font-medium" style={{ backgroundColor: primaryColor }}>
                  {t('branding.primaryButton')}
                </button>
                <button className="px-5 py-2 rounded-lg text-fg text-sm font-medium" style={{ backgroundColor: secondaryColor }}>
                  {t('branding.secondaryButton')}
                </button>
                <span className="px-3 py-1 rounded-full text-xs font-medium text-fg" style={{ backgroundColor: primaryColor }}>
                  {t('branding.badge')}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-medium text-fg" style={{ backgroundColor: secondaryColor }}>
                  {t('branding.tag')}
                </span>
              </div>
            </div>

            {can(permissions, 'settings', 'edit') && (
              <button onClick={saveBranding} disabled={savingBranding}
                className="flex items-center gap-2 px-5 py-2 bg-brand-fill hover:bg-brand-dim text-brand-ink border border-brand-edge text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                {savingBranding ? <><Loader2 className="w-4 h-4 animate-spin" /> {tc('saving')}</> : <><Check className="w-4 h-4" /> {t('branding.saveColors')}</>}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION: MOBILE APP & PAYMENTS (Toggle + Payment Gateway)
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-surface-2 border border-line rounded-xl p-6">
        <SectionHeader sectionKey="app" icon={<Smartphone className="w-4 h-4 text-brand" />} title={t('sections.mobileApp')} />
        {open.app && (
          <div className="space-y-6 mt-5">
            {/* Mobile payments toggle */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-fg">{t('app.mobilePayments')}</p>
                <p className="text-xs text-fg-muted mt-0.5">
                  {t('app.mobilePaymentsDesc')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => can(permissions, 'settings', 'edit') && setMobilePaymentsEnabled(v => !v)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                  mobilePaymentsEnabled ? 'bg-brand' : 'bg-surface-4'
                } ${!can(permissions, 'settings', 'edit') ? 'opacity-40 cursor-not-allowed' : ''}`}
                aria-pressed={mobilePaymentsEnabled}
                aria-label={t('app.mobilePayments')}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface border border-line-strong shadow ring-0 transition duration-200 ${
                  mobilePaymentsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Session transfers toggle */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-fg">{t('app.sessionTransfers')}</p>
                <p className="text-xs text-fg-muted mt-0.5">
                  {t('app.sessionTransfersDesc')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => can(permissions, 'settings', 'edit') && setSessionTransferEnabled(v => !v)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                  sessionTransferEnabled ? 'bg-brand' : 'bg-surface-4'
                } ${!can(permissions, 'settings', 'edit') ? 'opacity-40 cursor-not-allowed' : ''}`}
                aria-pressed={sessionTransferEnabled}
                aria-label={t('app.sessionTransfers')}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface border border-line-strong shadow ring-0 transition duration-200 ${
                  sessionTransferEnabled ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
            {can(permissions, 'settings', 'edit') && (
              <button onClick={saveAppSettings} disabled={savingAppSettings}
                className="flex items-center gap-2 px-5 py-2 bg-brand-fill hover:bg-brand-dim text-brand-ink border border-brand-edge text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                {savingAppSettings ? <><Loader2 className="w-4 h-4 animate-spin" /> {tc('saving')}</> : <><Check className="w-4 h-4" /> {t('app.saveAppSettings')}</>}
              </button>
            )}

            {/* Payment gateway config */}
            {can(permissions, 'settings', 'edit') && (
              <>
                <div className="border-t border-line" />
                <div className="flex items-center gap-2 mb-1">
                  <CreditCard className="w-4 h-4 text-brand" />
                  <h3 className="text-sm font-semibold text-fg">{t('app.paymentGateway')}</h3>
                </div>

                {/* Current status */}
                {paymentLoaded && paymentStatus && (
                  <div className={`rounded-xl p-4 border ${paymentStatus.configured && paymentStatus.is_active
                    ? 'bg-success-soft border-success/40' : 'bg-warning-soft border-warning/40'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldCheck className={`w-4 h-4 ${paymentStatus.configured ? 'text-success' : 'text-warning'}`} />
                      <p className={`text-sm font-medium ${paymentStatus.configured ? 'text-success' : 'text-warning'}`}>
                        {paymentStatus.configured ? t('app.gatewayConfigured') : t('app.gatewayNotConfigured')}
                      </p>
                    </div>
                    {paymentStatus.configured && (
                      <div className="text-xs text-fg-muted space-y-1">
                        <p>{t('app.provider')}: <span className="text-fg font-medium capitalize">{paymentStatus.provider}</span></p>
                        {paymentStatus.secret_key_hint && <p>{t('app.secretKeyHint')}: <span className="text-fg font-mono">{paymentStatus.secret_key_hint}</span></p>}
                        {paymentStatus.public_key_hint && <p>{t('app.publicKeyHint')}: <span className="text-fg font-mono">{paymentStatus.public_key_hint}</span></p>}
                        <div className="flex gap-3 mt-1">
                          <span className={paymentStatus.has_card ? 'text-success' : 'text-fg-faint'}>{t('app.cardMethod')} {paymentStatus.has_card ? '✓' : '✗'}</span>
                          <span className={paymentStatus.has_valu ? 'text-success' : 'text-fg-faint'}>{t('app.valuMethod')} {paymentStatus.has_valu ? '✓' : '✗'}</span>
                          <span className={paymentStatus.has_applepay ? 'text-success' : 'text-fg-faint'}>{t('app.applePayMethod')} {paymentStatus.has_applepay ? '✓' : '✗'}</span>
                        </div>
                        {paymentStatus.updated_at && (
                          <p className="text-fg-faint mt-1">{t('app.lastUpdated')}: {new Date(paymentStatus.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-fg-muted">
                  {t('app.paymobHint')}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-fg-muted mb-1.5">{t('app.secretKey')} <span className="text-danger">*</span></label>
                    <div className="relative">
                      <input
                        type={showSecretKey ? 'text' : 'password'}
                        value={paymentForm.secretKey}
                        onChange={e => setPaymentForm(p => ({ ...p, secretKey: e.target.value }))}
                        placeholder={t('app.secretKeyPlaceholder')}
                        className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg w-full pe-10 focus:outline-none focus:border-focus focus:ring-2 focus:ring-focus"
                      />
                      <button type="button" onClick={() => setShowSecretKey(v => !v)}
                        aria-pressed={showSecretKey}
                        aria-label={showSecretKey ? 'Hide secret key' : 'Show secret key'}
                        className="absolute end-0 top-1/2 -translate-y-1/2 min-w-11 min-h-11 inline-flex items-center justify-center text-fg-muted hover:text-fg">
                        {showSecretKey ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-fg-muted mb-1.5">{t('app.publicKey')} <span className="text-danger">*</span></label>
                    <input type="text" value={paymentForm.publicKey}
                      onChange={e => setPaymentForm(p => ({ ...p, publicKey: e.target.value }))}
                      placeholder={t('app.publicKeyPlaceholder')}
                      className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg w-full focus:outline-none focus:border-focus focus:ring-2 focus:ring-focus" />
                  </div>
                  <div>
                    <label className="block text-xs text-fg-muted mb-1.5">{t('app.cardIntegrationId')} <span className="text-danger">*</span></label>
                    <input type="text" value={paymentForm.integrationId}
                      onChange={e => setPaymentForm(p => ({ ...p, integrationId: e.target.value }))}
                      placeholder={t('app.cardIntegrationIdPlaceholder')}
                      className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg w-full focus:outline-none focus:border-focus focus:ring-2 focus:ring-focus" />
                  </div>
                  <div>
                    <label className="block text-xs text-fg-muted mb-1.5">{t('app.valuIntegrationId')} <span className="text-fg-faint">({tc('optional')})</span></label>
                    <input type="text" value={paymentForm.valuIntegrationId}
                      onChange={e => setPaymentForm(p => ({ ...p, valuIntegrationId: e.target.value }))}
                      placeholder={t('app.valuIntegrationIdPlaceholder')}
                      className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg w-full focus:outline-none focus:border-focus focus:ring-2 focus:ring-focus" />
                  </div>
                  <div>
                    <label className="block text-xs text-fg-muted mb-1.5">{t('app.applepayIntegrationId')} <span className="text-fg-faint">({tc('optional')})</span></label>
                    <input type="text" value={paymentForm.applepayIntegrationId}
                      onChange={e => setPaymentForm(p => ({ ...p, applepayIntegrationId: e.target.value }))}
                      placeholder={t('app.applepayIntegrationIdPlaceholder')}
                      className="bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg w-full focus:outline-none focus:border-focus focus:ring-2 focus:ring-focus" />
                  </div>
                </div>

                <button onClick={savePaymentConfig} disabled={savingPayment}
                  className="flex items-center gap-2 px-5 py-2 bg-brand-fill hover:bg-brand-dim text-brand-ink border border-brand-edge text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                  {savingPayment ? <><Loader2 className="w-4 h-4 animate-spin" /> {tc('saving')}</> : <><CreditCard className="w-4 h-4" /> {t('app.savePaymentConfig')}</>}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 3: BRANCHES & OPERATIONS (Hours + Capacity + Branches)
         ══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-surface-2 border border-line rounded-xl p-6">
        <SectionHeader sectionKey="operations" icon={<GitBranch className="w-4 h-4 text-brand" />} title={t('sections.branchesOps')} />
        {open.operations && (
          <div className="space-y-6 mt-5">
            {/* Operating Hours */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-4 h-4 text-fg-muted" />
                <h3 className="text-sm font-semibold text-fg">{t('hours.title')}</h3>
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
                            className="w-4 h-4 rounded border-line bg-surface-3 text-brand focus:ring-brand" />
                          <span className={`text-sm font-medium capitalize ${dh.closed ? 'text-fg-faint' : 'text-fg'}`}>
                            {t(`hours.days.${day}`)}
                          </span>
                        </label>
                      </div>
                      {dh.closed ? (
                        <span className="text-xs text-fg-faint italic">{t('hours.closed')}</span>
                      ) : (
                        <div className="flex items-center gap-2 flex-1">
                          <input type="time" value={dh.open} onChange={e => updateDay(day, 'open', e.target.value)}
                            className="bg-surface border border-line rounded-lg px-3 py-1.5 text-sm text-fg focus:outline-none focus:border-focus focus:ring-2 focus:ring-focus" />
                          <span className="text-fg-faint text-xs">{t('hours.to')}</span>
                          <input type="time" value={dh.close} onChange={e => updateDay(day, 'close', e.target.value)}
                            className="bg-surface border border-line rounded-lg px-3 py-1.5 text-sm text-fg focus:outline-none focus:border-focus focus:ring-2 focus:ring-focus" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {can(permissions, 'settings', 'edit') && (
                <button onClick={saveHours} disabled={savingHours}
                  className="mt-5 flex items-center gap-2 px-5 py-2 bg-brand-fill hover:bg-brand-dim text-brand-ink border border-brand-edge text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                  {savingHours ? <><Loader2 className="w-4 h-4 animate-spin" /> {tc('saving')}</> : <><Check className="w-4 h-4" /> {t('hours.saveHours')}</>}
                </button>
              )}
            </div>

            <div className="border-t border-line" />

            {/* Gym Capacity */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-fg-muted" />
                <h3 className="text-sm font-semibold text-fg">{t('capacity.title')}</h3>
              </div>
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-fg">{t('capacity.enableTracking')}</p>
                    <p className="text-xs text-fg-muted mt-0.5">
                      {t('capacity.enableTrackingDesc')}
                    </p>
                  </div>
                  <button type="button"
                    onClick={() => can(permissions, 'settings', 'edit') && setCapacityEnabled(v => !v)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                      capacityEnabled ? 'bg-brand' : 'bg-surface-4'
                    } ${!can(permissions, 'settings', 'edit') ? 'opacity-40 cursor-not-allowed' : ''}`}
                    aria-pressed={capacityEnabled}
                    aria-label={t('capacity.enableTracking')}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface border border-line-strong shadow ring-0 transition duration-200 ${
                      capacityEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

                {capacityEnabled && (
                  <div>
                    <label className="block text-xs text-fg-muted mb-1.5">{t('capacity.maxCapacity')} <span className="text-danger">*</span></label>
                    <input type="number" min={1} value={maxCapacity}
                      onChange={e => setMaxCapacity(e.target.value)} placeholder={t('capacity.maxCapacityPlaceholder')}
                      className="w-48 bg-surface border border-line rounded-lg px-3 py-2 text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-focus focus:ring-2 focus:ring-focus"
                      readOnly={!can(permissions, 'settings', 'edit')} />
                    <p className="text-xs text-fg-faint mt-1">{t('capacity.maxCapacityHint')}</p>
                  </div>
                )}

                {capacityEnabled && liveCapacity && (
                  <div className="bg-surface border border-line rounded-lg p-4">
                    <p className="text-xs text-fg-muted font-semibold uppercase tracking-wider mb-3">{t('capacity.livePreview')}</p>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        liveCapacity.status === 'not_busy' ? 'bg-success' :
                        liveCapacity.status === 'moderate' ? 'bg-warning' : 'bg-danger'
                      }`} />
                      <span className="text-sm font-semibold text-fg">
                        {liveCapacity.status === 'not_busy' ? t('capacity.notCrowded') :
                         liveCapacity.status === 'moderate' ? t('capacity.moderatelyBusy') : t('capacity.veryBusy')}
                      </span>
                      <span className={`ms-auto text-sm font-bold ${
                        liveCapacity.status === 'not_busy' ? 'text-success' :
                        liveCapacity.status === 'moderate' ? 'text-warning' : 'text-danger'
                      }`}>{liveCapacity.capacity_percentage}%</span>
                    </div>
                    <div className="w-full h-2 bg-surface-3 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${
                        liveCapacity.status === 'not_busy' ? 'bg-success' :
                        liveCapacity.status === 'moderate' ? 'bg-warning' : 'bg-danger'
                      }`} style={{ width: `${liveCapacity.capacity_percentage}%` }} />
                    </div>
                    <p className="text-xs text-fg-faint mt-2">
                      {t('capacity.activeOf', { active: liveCapacity.active_users, max: liveCapacity.max_capacity })}
                    </p>
                  </div>
                )}

                {can(permissions, 'settings', 'edit') && (
                  <button onClick={saveCapacity} disabled={savingCapacity}
                    className="flex items-center gap-2 px-5 py-2 bg-brand-fill hover:bg-brand-dim text-brand-ink border border-brand-edge text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                    {savingCapacity ? <><Loader2 className="w-4 h-4 animate-spin" /> {tc('saving')}</> : <><Check className="w-4 h-4" /> {t('capacity.saveCapacity')}</>}
                  </button>
                )}
              </div>
            </div>

            <div className="border-t border-line" />

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
