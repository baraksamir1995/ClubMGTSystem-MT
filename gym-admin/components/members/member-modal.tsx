'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

interface MemberWithProfile {
  id: string;
  member_number: string;
  status: string;
  joined_at: string;
  notes: string | null;
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    gender?: string | null;
    date_of_birth?: string | null;
    address?: string | null;
  } | null;
}

interface Props {
  member?: MemberWithProfile;
  onClose: () => void;
}

export default function MemberModal({ member, onClose }: Props) {
  const router = useRouter();
  const isEditing = !!member;

  const [form, setForm] = useState({
    full_name: member?.profile?.full_name ?? '',
    email: member?.profile?.email ?? '',
    phone: member?.profile?.phone ?? '',
    gender: member?.profile?.gender ?? '',
    date_of_birth: member?.profile?.date_of_birth ?? '',
    address: member?.profile?.address ?? '',
    status: member?.status ?? 'active',
    notes: member?.notes ?? '',
  });

  const [loading, setLoading] = useState(false);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) {
      toast.error('Full name is required');
      return;
    }

    setLoading(true);

    try {
      const url = isEditing ? `/api/members/${member.id}` : '/api/members';
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          gender: form.gender || null,
          date_of_birth: form.date_of_birth || null,
          address: form.address.trim() || null,
          status: form.status,
          notes: form.notes.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? 'Something went wrong');
        return;
      }

      toast.success(isEditing ? 'Member updated' : 'Member added');
      onClose();
      router.refresh();
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700">
          <h2 className="text-base font-semibold text-white">
            {isEditing ? 'Edit Member' : 'Add Member'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* ── Personal Info ── */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Personal Info
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => set('full_name', e.target.value)}
                  placeholder="Jane Doe"
                  className={inputCls}
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="jane@example.com"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="01012345678"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => set('gender', e.target.value)}
                    className={inputCls}
                  >
                    <option value="">— Select —</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => set('date_of_birth', e.target.value)}
                    className={`${inputCls} [color-scheme:dark]`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Address</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  placeholder="123 Main St, Cairo"
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-700" />

          {/* ── Membership Details ── */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Membership Details
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => set('status', e.target.value)}
                  className={inputCls}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder="Optional notes..."
                  rows={3}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-700 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
