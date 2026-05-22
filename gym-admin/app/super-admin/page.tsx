'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Building2, Users, GitBranch, ToggleLeft, ToggleRight, Trash2, RefreshCw, X, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

interface GymRow {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  logo_url: string | null;
  is_active: boolean;
  members_count: number;
  branches_count: number;
  max_branches: number;
  created_at: string;
}

export default function SuperAdminPage() {
  const [gyms, setGyms] = useState<GymRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Create form
  const [name, setName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState('Africa/Cairo');
  const [currency, setCurrency] = useState('EGP');
  const [maxBranches, setMaxBranches] = useState('10');

  const fetchGyms = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super-admin/gyms');
      const json = await res.json();
      if (res.ok) setGyms(json.data ?? []);
    } catch { toast.error('Failed to load gyms'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchGyms(); }, [fetchGyms]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !adminEmail.trim() || !adminPassword.trim() || !adminName.trim()) {
      toast.error('Fill in all required fields');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/super-admin/gyms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          admin_name: adminName.trim(),
          admin_email: adminEmail.trim(),
          admin_password: adminPassword,
          city: city.trim() || null,
          country: country.trim() || null,
          phone: phone.trim() || null,
          timezone,
          currency,
          max_branches: parseInt(maxBranches) || 10,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json.errors
          ? Object.values(json.errors).flat().join(', ')
          : (json.error ?? 'Failed to create gym');
        toast.error(msg);
        return;
      }
      toast.success(`Gym "${name}" created`);
      setShowCreate(false);
      resetForm();
      fetchGyms();
    } catch { toast.error('Network error'); }
    finally { setCreating(false); }
  };

  const resetForm = () => {
    setName(''); setAdminName(''); setAdminEmail(''); setAdminPassword('');
    setCity(''); setCountry(''); setPhone('');
    setTimezone('Africa/Cairo'); setCurrency('EGP'); setMaxBranches('10');
  };

  const toggleActive = async (gym: GymRow) => {
    setTogglingId(gym.id);
    try {
      const res = await fetch(`/api/super-admin/gyms/${gym.id}`, { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setGyms(prev => prev.map(g => g.id === gym.id ? { ...g, is_active: json.data?.is_active ?? !g.is_active } : g));
        toast.success(`${gym.name} ${json.data?.is_active ? 'activated' : 'deactivated'}`);
      }
    } catch { toast.error('Failed'); }
    finally { setTogglingId(null); }
  };

  const deleteGym = async (gym: GymRow) => {
    if (!confirm(`Delete "${gym.name}" and ALL its data? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/super-admin/gyms/${gym.id}`, { method: 'DELETE' });
      if (res.ok) {
        setGyms(prev => prev.filter(g => g.id !== gym.id));
        toast.success(`"${gym.name}" deleted`);
      }
    } catch { toast.error('Failed'); }
  };

  const updateMaxBranches = async (gym: GymRow, value: number) => {
    try {
      const res = await fetch(`/api/super-admin/gyms/${gym.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_branches: value }),
      });
      if (res.ok) {
        setGyms(prev => prev.map(g => g.id === gym.id ? { ...g, max_branches: value } : g));
      }
    } catch { toast.error('Failed'); }
  };

  const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return '—'; }
  };

  const inp = 'w-full px-3 py-2 bg-surface-3 border border-line rounded-lg text-sm text-fg placeholder-gray-500 focus:outline-none focus:border-brand transition-colors';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Gym Management</h1>
          <p className="text-sm text-fg-muted mt-0.5">{gyms.length} gym{gyms.length !== 1 ? 's' : ''} on the platform</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Create Gym
        </button>
      </div>

      {/* Create Form Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface-2 border border-line rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <h2 className="text-lg font-semibold text-fg">Create New Gym</h2>
              <button onClick={() => { setShowCreate(false); resetForm(); }} className="text-fg-muted hover:text-fg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {/* Gym info */}
              <div>
                <label className="block text-xs font-medium text-fg-muted mb-1">Gym Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. FitZone Cairo" className={inp} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1">City</label>
                  <input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Cairo" className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1">Country</label>
                  <input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. Egypt" className={inp} />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1">Phone</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+20..." className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1">Timezone</label>
                  <input value={timezone} onChange={e => setTimezone(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1">Currency</label>
                  <input value={currency} onChange={e => setCurrency(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-fg-muted mb-1">Max Branches</label>
                  <input type="number" min="1" max="100" value={maxBranches} onChange={e => setMaxBranches(e.target.value)} className={inp} />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-line pt-4">
                <p className="text-xs font-medium text-fg-muted mb-3">Gym Admin Account</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-fg-muted mb-1">Admin Name *</label>
                    <input value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="e.g. Ahmed Hassan" className={inp} required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-fg-muted mb-1">Admin Email *</label>
                    <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@fitzone.com" className={inp} required />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-fg-muted mb-1">Admin Password *</label>
                    <div className="relative">
                      <input type={showPassword ? 'text' : 'password'} value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="Min 6 characters" className={inp + ' pr-10'} required minLength={6} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg-muted">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); resetForm(); }}
                  className="px-4 py-2 text-sm text-fg-muted hover:text-fg transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={creating}
                  className="flex items-center gap-2 px-5 py-2 bg-brand hover:bg-brand-dim text-brand-ink text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                  {creating ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Creating...</> : 'Create Gym'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-brand animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && gyms.length === 0 && (
        <div className="bg-surface-2 border border-line rounded-xl p-12 text-center">
          <Building2 className="w-10 h-10 text-fg-faint mx-auto mb-3" />
          <p className="text-sm text-fg-muted">No gyms yet. Create your first gym to get started.</p>
        </div>
      )}

      {/* Gym cards */}
      {!loading && gyms.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {gyms.map(gym => (
            <div key={gym.id} className="bg-surface-2 border border-line rounded-xl p-5 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand/20 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {gym.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- gym logo on external host
                      <img src={gym.logo_url} alt={gym.name} className="w-full h-full object-cover" />
                    ) : (
                      <Building2 className="w-5 h-5 text-brand" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-fg">{gym.name}</p>
                    {(gym.city || gym.country) && (
                      <p className="text-xs text-fg-faint">{[gym.city, gym.country].filter(Boolean).join(', ')}</p>
                    )}
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${gym.is_active ? 'bg-emerald-400/20 text-emerald-400' : 'bg-gray-400/20 text-fg-muted'}`}>
                  {gym.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-fg-faint" />
                  <span className="text-sm text-fg-muted">{gym.members_count} members</span>
                </div>
                <div className="flex items-center gap-2">
                  <GitBranch className="w-3.5 h-3.5 text-fg-faint" />
                  <span className="text-sm text-fg-muted">{gym.branches_count} / {gym.max_branches} branches</span>
                </div>
              </div>

              {/* Branch limit */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-fg-faint">Branch limit</span>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => updateMaxBranches(gym, Math.max(1, gym.max_branches - 1))}
                    className="w-6 h-6 flex items-center justify-center rounded bg-surface-3 text-fg-muted hover:text-fg text-xs font-bold transition-colors">-</button>
                  <span className="text-sm text-fg font-medium w-6 text-center">{gym.max_branches}</span>
                  <button onClick={() => updateMaxBranches(gym, gym.max_branches + 1)}
                    className="w-6 h-6 flex items-center justify-center rounded bg-surface-3 text-fg-muted hover:text-fg text-xs font-bold transition-colors">+</button>
                </div>
              </div>

              <p className="text-xs text-fg-faint">Created {fmtDate(gym.created_at)}</p>

              {/* Actions */}
              <div className="flex items-center gap-1 pt-1 border-t border-line">
                <button onClick={() => toggleActive(gym)} disabled={togglingId === gym.id}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-fg-muted hover:text-brand hover:bg-brand/10 rounded-lg transition-colors disabled:opacity-40">
                  {gym.is_active
                    ? <><ToggleRight className="w-3.5 h-3.5" /> Deactivate</>
                    : <><ToggleLeft className="w-3.5 h-3.5" /> Activate</>}
                </button>
                <button onClick={() => deleteGym(gym)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs text-fg-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
