'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('members.modal');
  const tc = useTranslations('common');
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
      toast.error(t('toast.nameRequired'));
      return;
    }
    if (!form.email.trim()) {
      toast.error(t('toast.emailRequired'));
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
          email: form.email.trim(),
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
        toast.error(data.error ?? tc('somethingWrong'));
        return;
      }

      toast.success(isEditing ? t('toast.updated') : t('toast.added'));
      onClose();
      router.refresh();
    } catch {
      toast.error(tc('networkError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="md">
      <Modal.Header>{isEditing ? t('editTitle') : t('addTitle')}</Modal.Header>
      <Modal.Body>
        <form id="member-form" onSubmit={handleSubmit} className="space-y-5">
          {/* ── Personal Info ── */}
          <div>
            <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">
              {t('sectionPersonal')}
            </p>
            <div className="space-y-3">
              <Field label={t('fullName')} required>
                <Input
                  value={form.full_name}
                  onChange={(e) => set('full_name', e.target.value)}
                  placeholder={t('fullNamePlaceholder')}
                  required
                />
              </Field>

              <Field label={tc('email')}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder={t('emailPlaceholder')}
                  required
                />
              </Field>

              <Field label={tc('phone')}>
                <Input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder={t('phonePlaceholder')}
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={t('gender')}>
                  <Select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                    <option value="">{t('genderSelect')}</option>
                    <option value="male">{t('genderMale')}</option>
                    <option value="female">{t('genderFemale')}</option>
                  </Select>
                </Field>
                <Field label={t('dateOfBirth')}>
                  <Input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => set('date_of_birth', e.target.value)}
                    className="[color-scheme:dark]"
                  />
                </Field>
              </div>

              <Field label={t('address')}>
                <Input
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  placeholder={t('addressPlaceholder')}
                />
              </Field>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-line" />

          {/* ── Membership Details ── */}
          <div>
            <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">
              {t('sectionMembership')}
            </p>
            <div className="space-y-3">
              <Field label={t('status')}>
                <Select value={form.status} onChange={(e) => set('status', e.target.value)}>
                  <option value="active">{t('statusActive')}</option>
                  <option value="inactive">{t('statusInactive')}</option>
                  <option value="suspended">{t('statusSuspended')}</option>
                </Select>
              </Field>

              <Field label={tc('notes')}>
                <Textarea
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder={t('notesPlaceholder')}
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
          {tc('cancel')}
        </Button>
        <Button type="submit" form="member-form" variant="primary" fullWidth isLoading={loading}>
          {isEditing ? t('saveChanges') : t('addMemberSubmit')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
