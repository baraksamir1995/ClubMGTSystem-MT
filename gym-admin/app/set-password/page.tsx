'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiErrorMessage, networkErrorMessage } from '@/lib/api-error';
import ThemeToggle from '@/components/theme/theme-toggle';

/**
 * Public page linked from the gym-owner approval email
 * (SendGymRequestEmail → /set-password?token=…). Consumes the single-use,
 * time-limited token through POST /api/auth/reset-password, then sends the
 * owner to the normal login.
 */
function SetPasswordForm() {
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (password !== confirm) { toast.error('Passwords do not match'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, password_confirmation: confirm }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(res.status === 422 && data?.message === 'Invalid or expired token.'
          ? 'This link is invalid or has expired. Ask the CLBY team to send a new one.'
          : apiErrorMessage(data, res.status));
        return;
      }
      setDone(true);
    } catch { toast.error(networkErrorMessage()); }
    finally { setLoading(false); }
  };

  if (!token) {
    return (
      <p className="text-sm text-fg-muted text-center">
        This link is missing its setup token. Open the link from your approval email again, or ask the CLBY team to resend it.
      </p>
    );
  }

  if (done) {
    return (
      <div className="text-center space-y-4">
        <CheckCircle2 className="w-10 h-10 text-success mx-auto" aria-hidden />
        <p className="text-sm text-fg">Your password is set. You can now sign in to your dashboard.</p>
        <Link href="/login"
          className="inline-block w-full py-2.5 px-4 bg-brand-fill hover:bg-brand-dim text-brand-ink border border-brand-edge text-sm font-semibold rounded-lg transition-colors">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="new-password" className="block text-xs font-medium text-fg-muted mb-1.5">New password</label>
        <div className="relative">
          <input
            id="new-password"
            type={showPw ? 'text' : 'password'}
            required
            autoComplete="new-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            className="w-full px-3 py-2.5 bg-surface-3 border border-line rounded-lg text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand transition-colors pr-10"
          />
          <button type="button" onClick={() => setShowPw(!showPw)}
            aria-label={showPw ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg">
            {showPw ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="confirm-password" className="block text-xs font-medium text-fg-muted mb-1.5">Confirm password</label>
        <input
          id="confirm-password"
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          placeholder="Repeat new password"
          className="w-full px-3 py-2.5 bg-surface-3 border border-line rounded-lg text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand transition-colors"
        />
      </div>

      <button type="submit" disabled={loading}
        className="w-full py-2.5 px-4 bg-brand-fill hover:bg-brand-dim disabled:opacity-50 text-brand-ink border border-brand-edge text-sm font-semibold rounded-lg transition-colors mt-2">
        {loading ? 'Saving…' : 'Set password'}
      </button>
    </form>
  );
}

export default function SetPasswordPage() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4 relative">
      <div className="absolute top-4 end-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-brand/20 border border-brand/30 rounded-2xl flex items-center justify-center mb-4">
            <KeyRound className="w-8 h-8 text-brand" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold text-fg">Set your password</h1>
          <p className="text-sm text-fg-muted mt-2 text-center">
            Choose a password for your CLBY admin dashboard.
          </p>
        </div>

        <div className="bg-surface-2 border border-line rounded-2xl p-6 shadow-2xl">
          <Suspense fallback={null}>
            <SetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
