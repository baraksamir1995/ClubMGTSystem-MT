'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { CalendarDays, Check, X, Ban } from 'lucide-react';
import { Button, Field, Select, Input, EmptyState, Badge } from '@/components/ui';
import { salesApi, errMsg, APPOINTMENT_TYPES, labelize, fmtDateTime } from './lib';

interface Props {
  lead: any;        // SalesLeadDetail
  context: any;     // SalesContext — branches for the booking form
  readOnly: boolean;
  onChanged: () => void;
}

function statusVariant(status: string): 'neutral' | 'success' | 'danger' | 'warning' {
  if (status === 'showed') return 'success';
  if (status === 'no_show') return 'danger';
  if (status === 'cancelled') return 'warning';
  return 'neutral';
}

/** Appointments tab — book a visit + mark showed / no-show / cancelled. */
export default function DetailAppointments({ lead, context, readOnly, onChanged }: Props) {
  const [type, setType] = useState('tour');
  const [scheduledAt, setScheduledAt] = useState('');
  const [branchId, setBranchId] = useState<string>(lead.branch_id ?? '');
  const [saving, setSaving] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const branches: Array<{ id: string; name: string }> = context?.branches ?? [];
  const appointments: any[] = [...(lead.appointments ?? [])].sort(
    (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime(),
  );

  const book = async () => {
    if (!scheduledAt) { toast.error('Pick a date and time.'); return; }
    setSaving(true);
    try {
      await salesApi(`leads/${lead.id}/appointments`, {
        method: 'POST',
        body: {
          type,
          scheduled_at: new Date(scheduledAt).toISOString(),
          branch_id: branchId || undefined,
        },
      });
      setScheduledAt('');
      toast.success('Appointment booked');
      onChanged();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const mark = async (id: string, status: 'showed' | 'no_show' | 'cancelled') => {
    setMarkingId(id);
    try {
      await salesApi(`appointments/${id}/status`, { method: 'PATCH', body: { status } });
      toast.success(status === 'showed' ? 'Marked as showed' : status === 'no_show' ? 'Marked as no-show' : 'Cancelled');
      onChanged();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {!readOnly && (
        <div className="p-4 bg-surface-2 border border-line rounded-xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {APPOINTMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{labelize(t)}</option>
                ))}
              </Select>
            </Field>
            <Field label="When" required>
              <Input type="datetime-local" value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)} />
            </Field>
          </div>
          {branches.length > 0 && (
            <Field label="Branch">
              <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Default branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
            </Field>
          )}
          <Button variant="primary" onClick={book} isLoading={saving} className="w-full sm:w-auto"
            leftIcon={<CalendarDays className="w-4 h-4" />}>
            Book appointment
          </Button>
        </div>
      )}

      {appointments.length === 0 ? (
        <EmptyState size="sm" icon={CalendarDays} title="No appointments"
          description="Book a tour or trial to move this lead forward." />
      ) : (
        <ul className="space-y-2">
          {appointments.map((a) => {
            const isPast = new Date(a.scheduled_at).getTime() <= Date.now();
            const pending = a.status === 'scheduled';
            return (
              <li key={a.id} className="p-3 bg-surface-2 border border-line rounded-xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-fg">{labelize(a.type)}</span>
                  <Badge size="sm" variant={statusVariant(a.status)}>{labelize(a.status)}</Badge>
                  <span className="text-xs text-fg-muted ms-auto">{fmtDateTime(a.scheduled_at)}</span>
                </div>
                {pending && !readOnly && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {isPast && (
                      <>
                        <Button size="sm" variant="secondary" disabled={markingId === a.id}
                          leftIcon={<Check className="w-3.5 h-3.5 text-success" />}
                          onClick={() => mark(a.id, 'showed')}>
                          Showed
                        </Button>
                        <Button size="sm" variant="secondary" disabled={markingId === a.id}
                          leftIcon={<X className="w-3.5 h-3.5 text-danger" />}
                          onClick={() => mark(a.id, 'no_show')}>
                          No-show
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" disabled={markingId === a.id}
                      leftIcon={<Ban className="w-3.5 h-3.5" />}
                      onClick={() => mark(a.id, 'cancelled')}>
                      Cancel
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
