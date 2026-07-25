'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Phone, MessageCircle, Mail, MessageSquare, StickyNote, AlertTriangle } from 'lucide-react';
import { Button, Field, Select, Textarea, EmptyState } from '@/components/ui';
import {
  salesApi, SalesApiError, ACTIVITY_TYPES, ACTIVITY_OUTCOMES,
  labelize, fmtDateTime, teamMemberName,
} from './lib';

const TYPE_ICONS: Record<string, typeof Phone> = {
  call: Phone,
  whatsapp: MessageCircle,
  sms: MessageSquare,
  email: Mail,
  note: StickyNote,
};

interface Props {
  lead: any;                 // SalesLeadDetail
  team: any[];               // SalesTeamMember[]
  readOnly: boolean;
  onLogged: () => void;      // reload lead + notify parent
  onPromptLost: () => void;  // server says: offer "Mark as lost?"
}

/** Activities tab — log a touch (call / WhatsApp / …) + timeline. */
export default function DetailActivities({ lead, team, readOnly, onLogged, onPromptLost }: Props) {
  const [type, setType] = useState('call');
  const [outcome, setOutcome] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [promptLost, setPromptLost] = useState(false);

  const activities: any[] = [...(lead.activities ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const submit = async () => {
    setSaving(true);
    try {
      const res = await salesApi<any>(`leads/${lead.id}/activities`, {
        method: 'POST',
        body: {
          type,
          outcome: outcome || undefined,
          notes: notes.trim() || undefined,
        },
      });
      setNotes('');
      setOutcome('');
      if (res?.follow_up_tasks_created > 0) {
        toast.success(`Activity logged — ${res.follow_up_tasks_created} follow-up task${res.follow_up_tasks_created > 1 ? 's' : ''} created`);
      } else {
        toast.success('Activity logged');
      }
      if (res?.prompt_lost) setPromptLost(true);
      onLogged();
    } catch (e) {
      toast.error(e instanceof SalesApiError ? e.message : 'Network error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {promptLost && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl bg-danger-soft border border-line">
          <AlertTriangle className="w-5 h-5 text-danger shrink-0" />
          <p className="text-sm text-fg flex-1">
            Max contact attempts reached without an answer. Mark this lead as lost?
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPromptLost(false)}>Keep trying</Button>
            <Button variant="danger" size="sm" onClick={() => { setPromptLost(false); onPromptLost(); }}>
              Mark as lost
            </Button>
          </div>
        </div>
      )}

      {!readOnly && (
        <div className="p-4 bg-surface-2 border border-line rounded-xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value)}>
                {ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t}>{labelize(t)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Outcome">
              <Select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
                <option value="">—</option>
                {ACTIVITY_OUTCOMES.map((o) => (
                  <option key={o} value={o}>{labelize(o)}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Notes">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="What was said / agreed…" />
          </Field>
          <Button variant="primary" onClick={submit} isLoading={saving} className="w-full sm:w-auto">
            Log activity
          </Button>
        </div>
      )}

      {activities.length === 0 ? (
        <EmptyState size="sm" icon={Phone} title="No activity yet"
          description="Log the first call or message to start the follow-up cadence." />
      ) : (
        <ol className="space-y-3">
          {activities.map((a) => {
            const Icon = TYPE_ICONS[a.type] ?? StickyNote;
            return (
              <li key={a.id} className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-surface-3 border border-line flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-fg-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium text-fg">{labelize(a.type)}</span>
                    {a.outcome && <span className="text-xs text-fg-muted">{labelize(a.outcome)}</span>}
                    <span className="text-xs text-fg-faint ms-auto">{fmtDateTime(a.created_at)}</span>
                  </div>
                  {a.notes && <p className="text-sm text-fg-muted mt-0.5 whitespace-pre-wrap">{a.notes}</p>}
                  {teamMemberName(team, a.user_id) && (
                    <p className="text-[11px] text-fg-faint mt-0.5">by {teamMemberName(team, a.user_id)}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
