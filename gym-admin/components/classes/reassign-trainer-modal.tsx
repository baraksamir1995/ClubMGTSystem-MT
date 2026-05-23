'use client';

import { useState, useEffect } from 'react';
import { User, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import type { GymClass } from '@/app/dashboard/classes/page';
import type { StaffMember } from './class-modal';
import { Button, Input, Modal, Select } from '@/components/ui';

interface Props {
  cls: GymClass;
  onClose: () => void;
  onReassigned: (classId: string, instructor: string | null) => void;
}

export default function ReassignTrainerModal({ cls, onClose, onReassigned }: Props) {
  const t = useTranslations('classes');
  const tc = useTranslations('common');
  const [staff, setStaff]         = useState<StaffMember[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(cls.instructor ?? '');
  const [saving, setSaving]       = useState(false);
  const [useCustom, setUseCustom] = useState(false);
  const [custom, setCustom]       = useState('');

  useEffect(() => {
    fetch('/api/staff')
      .then(r => r.json())
      .then(d => {
        const list: StaffMember[] = d.staff ?? [];
        setStaff(list);
        if (cls.instructor) {
          const match = list.find(s => s.full_name === cls.instructor);
          if (!match) { setUseCustom(true); setCustom(cls.instructor); }
        }
      })
      .catch(() => setStaff([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    const instructor = useCustom ? custom.trim() || null : selected || null;
    setSaving(true);
    try {
      const res = await fetch(`/api/classes/${cls.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cls.name, classType: cls.class_type,
          description: cls.description, instructor,
          location: cls.location, color: cls.color,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? t('reassignTrainer.failedToUpdate')); return; }
      toast.success(t('reassignTrainer.reassignSuccess'));
      onReassigned(cls.id, instructor);
      onClose();
    } catch { toast.error(tc('networkError')); }
    finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="sm">
      <Modal.Header>
        <span className="inline-flex items-center gap-2"><User className="w-4 h-4 text-brand" /> {t('reassignTrainer.title')}</span>
      </Modal.Header>

      <Modal.Body className="space-y-4">
        {/* Class info */}
        <div className="flex items-center gap-2.5 bg-surface-3/40 rounded-xl px-4 py-3">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cls.color }} />
          <div>
            <p className="text-sm text-fg font-medium">{cls.name}</p>
            <p className="text-xs text-fg-muted capitalize">{cls.class_type}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-fg-muted" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-fg-muted">{t('reassignTrainer.selectTrainer')}</label>
              {staff.length > 0 && (
                <button onClick={() => { setUseCustom(c => !c); setSelected(''); setCustom(''); }}
                  className="text-xs text-brand hover:text-brand-dim transition-colors">
                  {useCustom ? t('reassignTrainer.fromStaffList') : t('reassignTrainer.customName')}
                </button>
              )}
            </div>

            {staff.length === 0 || useCustom ? (
              <Input value={custom} onChange={e => setCustom(e.target.value)} placeholder={t('reassignTrainer.trainerName')} />
            ) : (
              <Select value={selected} onChange={e => setSelected(e.target.value)}>
                <option value="">{t('reassignTrainer.removeTrainer')}</option>
                {staff.map(s => (
                  <option key={s.id} value={s.full_name}>
                    {s.full_name}{s.role && s.role !== 'staff' ? ` · ${s.role}` : ''}
                  </option>
                ))}
              </Select>
            )}

            {/* Preview */}
            {((!useCustom && selected) || (useCustom && custom.trim())) && (
              <div className="flex items-center gap-2 bg-brand/10 border border-brand/20 rounded-lg px-3 py-2">
                <User className="w-3.5 h-3.5 text-brand flex-shrink-0" />
                <div>
                  <p className="text-xs text-fg font-medium">{useCustom ? custom : selected}</p>
                  {!useCustom && <p className="text-xs text-fg-faint">{staff.find(s => s.full_name === selected)?.email ?? ''}</p>}
                </div>
                <span className="ms-auto text-xs text-brand font-medium">{t('reassignTrainer.assigned')}</span>
              </div>
            )}

            {/* Current */}
            {cls.instructor && (
              <p className="text-xs text-fg-faint">
                {t('reassignTrainer.current')} <span className="text-fg-muted">{cls.instructor}</span>
              </p>
            )}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" fullWidth onClick={onClose}>{tc('cancel')}</Button>
        <Button variant="primary" fullWidth onClick={handleSave} disabled={loading} isLoading={saving}>
          {t('reassignTrainer.assignTrainer')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
