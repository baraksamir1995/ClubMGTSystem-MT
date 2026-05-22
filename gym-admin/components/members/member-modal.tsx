'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';

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

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header>{isEditing ? 'Edit Member' : 'Add Member'}</Modal.Header>
      <Modal.Body>
        <form id="member-form" onSubmit={handleSubmit} className="space-y-5">
          {/* ── Personal Info ── */}
          <div>
            <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">
              Personal Info
            </p>
            <div className="space-y-3">
              <Field label="Full Name" required>
                <Input
                  value={form.full_name}
                  onChange={(e) => set('full_name', e.target.value)}
                  placeholder="Jane Doe"
                  required
                />
              </Field>

              <Field label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="jane@example.com"
                />
              </Field>

              <Field label="Phone">
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="01012345678"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Gender">
                  <Select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                    <option value="">— Select —</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </Select>
                </Field>
                <Field label="Date of Birth">
                  <Input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => set('date_of_birth', e.target.value)}
                    className="[color-scheme:dark]"
                  />
                </Field>
              </div>

              <Field label="Address">
                <Input
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  placeholder="123 Main St, Cairo"
                />
              </Field>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-line" />

          {/* ── Membership Details ── */}
          <div>
            <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">
              Membership Details
            </p>
            <div className="space-y-3">
              <Field label="Status">
                <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </Select>
              </Field>

              <Field label="Notes">
                <Textarea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder="Optional notes..."
                  rows={3}
                  className="resize-none"
                />
              </Field>
            </div>
          </div>
        </form>
      </Modal.Body>

      <Modal.Footer>
        <Button type="button" variant="secondary" fullWidth onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" form="member-form" variant="primary" fullWidth isLoading={loading}>
          {isEditing ? 'Save Changes' : 'Add Member'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
