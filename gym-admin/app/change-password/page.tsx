'use client';

import { useState } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChangePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== confirm) { toast.error('Passwords do not match'); return; }

    setLoading(true);
    try {
      // Update password via Laravel API
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, password_confirmation: password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message ?? data.error ?? 'Failed to update password');
        return;
      }

      toast.success('Password updated! Redirecting…');
      setTimeout(() => { window.location.href = '/dashboard'; }, 800);
    } catch { toast.error('Network error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-brand/20 border border-brand/30 rounded-2xl flex items-center justify-center mb-4">
            <ShieldCheck className="w-8 h-8 text-brand" />
          </div>
          <h1 className="text-2xl font-bold text-fg">Set new password</h1>
          <p className="text-sm text-fg-muted mt-2 text-center">
            Your account requires a new password before you can continue.
          </p>
        </div>

        <div className="bg-surface-2 border border-line rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">New password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full px-3 py-2.5 bg-surface-3 border border-line rounded-lg text-sm text-fg placeholder-gray-500 focus:outline-none focus:border-brand transition-colors pr-10"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg-muted">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Confirm password</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat new password"
                className="w-full px-3 py-2.5 bg-surface-3 border border-line rounded-lg text-sm text-fg placeholder-gray-500 focus:outline-none focus:border-brand transition-colors"
              />
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-2.5 px-4 bg-brand hover:bg-brand disabled:opacity-50 text-brand-ink text-sm font-semibold rounded-lg transition-colors mt-2">
              {loading ? 'Saving…' : 'Set password & continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
