'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Copy, KeyRound, Loader2, Megaphone, Plus, RefreshCw, SlidersHorizontal,
  ToggleLeft, ToggleRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button, EmptyState, Field, Input, Modal, Select,
} from '@/components/ui';
import type { LeadScore, LeadSource, SalesContext, SalesSettings } from '@/lib/sales-types';
import { Card, salesGet, salesPatch, salesPost } from './lib';

interface Props {
  context: SalesContext;
}

/** "1, 3, 7" ⇄ [1, 3, 7] */
const listToText = (nums: number[] | null | undefined) => (nums ?? []).join(', ');
const textToList = (text: string): number[] =>
  text
    .split(/[,\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);

const SCORE_OPTIONS: { value: LeadScore; label: string }[] = [
  { value: 'hot', label: 'Hot' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
];

export default function SettingsPanel({ context }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ------------------------- SLA & cadence -------------------------- */
  const [settings, setSettings] = useState<SalesSettings | null>(null);
  const [form, setForm] = useState({
    unassigned_sla_minutes: '',
    qualify_sla_hours: '',
    first_contact_minutes: '',
    max_contact_attempts: '',
    cadence_days: '',
    reminder_hours: '',
  });
  const [savingSla, setSavingSla] = useState(false);

  /* ----------------------------- Sources ---------------------------- */
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceScore, setNewSourceScore] = useState<LeadScore>('warm');
  const [addingSource, setAddingSource] = useState(false);
  const [busySourceId, setBusySourceId] = useState<string | null>(null);

  /* ------------------------------ Intake ---------------------------- */
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotating, setRotating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, sourcesRes] = await Promise.all([
        salesGet<SalesSettings>('settings'),
        salesGet<LeadSource[]>('sources'),
      ]);
      const s = settingsRes.data;
      setSettings(s);
      setForm({
        unassigned_sla_minutes: String(s?.unassigned_sla_minutes ?? ''),
        qualify_sla_hours: String(s?.qualify_sla_hours ?? ''),
        first_contact_minutes: String(s?.first_contact_minutes ?? ''),
        max_contact_attempts: String(s?.max_contact_attempts ?? ''),
        cadence_days: listToText(s?.cadence_days),
        reminder_hours: listToText(s?.reminder_hours),
      });
      setSources(sourcesRes.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveSla = async () => {
    const cadence = textToList(form.cadence_days);
    const reminders = textToList(form.reminder_hours);
    if (cadence.length === 0) { toast.error('Cadence days can\'t be empty — e.g. "1, 3, 7"'); return; }
    if (reminders.length === 0) { toast.error('Reminder hours can\'t be empty — e.g. "24, 2"'); return; }
    setSavingSla(true);
    try {
      const body = {
        unassigned_sla_minutes: Number(form.unassigned_sla_minutes),
        qualify_sla_hours: Number(form.qualify_sla_hours),
        first_contact_minutes: Number(form.first_contact_minutes),
        max_contact_attempts: Number(form.max_contact_attempts),
        cadence_days: cadence,
        reminder_hours: reminders,
      };
      const res = await salesPatch<SalesSettings>('settings', body);
      setSettings((prev) => ({ ...(prev ?? {}), ...(res.data ?? body) }) as SalesSettings);
      toast.success('Sales settings saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSavingSla(false);
    }
  };

  const toggleSource = async (src: LeadSource) => {
    setBusySourceId(String(src.id));
    const next = !src.is_active;
    setSources((prev) => prev.map((s) => (s.id === src.id ? { ...s, is_active: next } : s)));
    try {
      await salesPatch(`sources/${src.id}`, { is_active: next });
      toast.success(next ? `${src.name} activated` : `${src.name} deactivated`);
    } catch (e) {
      setSources((prev) => prev.map((s) => (s.id === src.id ? { ...s, is_active: !next } : s)));
      toast.error(e instanceof Error ? e.message : 'Failed to update source');
    } finally {
      setBusySourceId(null);
    }
  };

  const changeSourceScore = async (src: LeadSource, score: LeadScore) => {
    setBusySourceId(String(src.id));
    const prevScore = src.default_score;
    setSources((prev) => prev.map((s) => (s.id === src.id ? { ...s, default_score: score } : s)));
    try {
      await salesPatch(`sources/${src.id}`, { default_score: score });
      toast.success(`${src.name} default score updated`);
    } catch (e) {
      setSources((prev) => prev.map((s) => (s.id === src.id ? { ...s, default_score: prevScore } : s)));
      toast.error(e instanceof Error ? e.message : 'Failed to update source');
    } finally {
      setBusySourceId(null);
    }
  };

  const addSource = async () => {
    if (!newSourceName.trim()) return;
    setAddingSource(true);
    try {
      const res = await salesPost<LeadSource>('sources', {
        name: newSourceName.trim(),
        default_score: newSourceScore,
      });
      if (res.data) setSources((prev) => [...prev, res.data]);
      else load();
      setNewSourceName('');
      setNewSourceScore('warm');
      toast.success('Source added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add source');
    } finally {
      setAddingSource(false);
    }
  };

  const copyToken = () => {
    if (!settings?.intake_token) return;
    navigator.clipboard.writeText(settings.intake_token);
    toast.success('Intake token copied');
  };

  const rotateToken = async () => {
    setRotating(true);
    try {
      const res = await salesPost<{ intake_token?: string } | SalesSettings>('settings/rotate-intake-token');
      const newToken =
        (res.data as { intake_token?: string })?.intake_token ?? null;
      if (newToken) {
        setSettings((prev) => (prev ? { ...prev, intake_token: newToken } : prev));
      } else {
        await load();
      }
      toast.success('Intake token rotated — update your integrations');
      setRotateOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to rotate token');
    } finally {
      setRotating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-fg-muted animate-spin" aria-label="Loading settings" />
      </div>
    );
  }

  if (error) {
    return (
      <Card padding="none">
        <EmptyState
          icon={SlidersHorizontal}
          title="Couldn't load sales settings"
          description={error}
          action={<Button variant="secondary" onClick={load}>Retry</Button>}
        />
      </Card>
    );
  }

  const intakeSnippet = `POST https://api.clbyapp.com/api/sales/intake
X-Intake-Token: ${settings?.intake_token ?? '<your-token>'}
Content-Type: application/json

{
  "name": "Jane Doe",
  "phone": "+201001234567",
  "email": "jane@example.com",     // optional
  "source": "facebook_ads",        // optional, source name
  "utm_source": "fb",              // optional utm_* fields
  "utm_campaign": "summer-2026"
}`;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* (a) SLA & cadence */}
      <Card padding="none">
        <Card.Header>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-fg-muted" />
            <span>SLA &amp; cadence</span>
          </div>
        </Card.Header>
        <Card.Body>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Unassigned SLA (minutes)" hint="Alert when a lead sits unassigned longer than this.">
              <Input
                type="number" min={1} inputMode="numeric"
                value={form.unassigned_sla_minutes}
                onChange={(e) => setForm((f) => ({ ...f, unassigned_sla_minutes: e.target.value }))}
              />
            </Field>
            <Field label="Qualify SLA (hours)" hint="Time allowed to qualify a new lead.">
              <Input
                type="number" min={1} inputMode="numeric"
                value={form.qualify_sla_hours}
                onChange={(e) => setForm((f) => ({ ...f, qualify_sla_hours: e.target.value }))}
              />
            </Field>
            <Field label="First contact (minutes)" hint="Target speed-to-lead after assignment.">
              <Input
                type="number" min={1} inputMode="numeric"
                value={form.first_contact_minutes}
                onChange={(e) => setForm((f) => ({ ...f, first_contact_minutes: e.target.value }))}
              />
            </Field>
            <Field label="Max contact attempts" hint="Attempts before a lead is considered unreachable.">
              <Input
                type="number" min={1} inputMode="numeric"
                value={form.max_contact_attempts}
                onChange={(e) => setForm((f) => ({ ...f, max_contact_attempts: e.target.value }))}
              />
            </Field>
            <Field label="Cadence days" hint='Follow-up schedule in days, comma-separated — e.g. "1, 3, 7".'>
              <Input
                value={form.cadence_days}
                onChange={(e) => setForm((f) => ({ ...f, cadence_days: e.target.value }))}
                placeholder="1, 3, 7"
              />
            </Field>
            <Field label="Reminder hours" hint='Appointment reminders, hours before — e.g. "24, 2".'>
              <Input
                value={form.reminder_hours}
                onChange={(e) => setForm((f) => ({ ...f, reminder_hours: e.target.value }))}
                placeholder="24, 2"
              />
            </Field>
          </div>
        </Card.Body>
        <Card.Footer>
          <div className="flex justify-end">
            <Button variant="primary" isLoading={savingSla} onClick={saveSla}>Save settings</Button>
          </div>
        </Card.Footer>
      </Card>

      {/* (b) Lead sources */}
      <Card padding="none">
        <Card.Header>
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-fg-muted" />
            <span>Lead sources</span>
          </div>
        </Card.Header>
        <Card.Body>
          {sources.length === 0 ? (
            <EmptyState
              size="sm"
              icon={Megaphone}
              title="No lead sources yet"
              description={context.is_admin
                ? 'Add your first source below — e.g. Walk-in, Instagram, Referral.'
                : 'An admin needs to add lead sources.'}
            />
          ) : (
            <ul className="divide-y divide-line -my-2">
              {sources.map((src) => (
                <li key={String(src.id)} className={`flex items-center gap-3 py-2.5 ${!src.is_active ? 'opacity-60' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-fg font-medium truncate">{src.name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="text-xs text-fg-muted">Default score</label>
                    {/* Editing lead sources is admin-only server-side
                        (SalesSourceController::update requires gym_admin);
                        managers see the config read-only rather than
                        controls that always 403. */}
                    {context.is_admin ? (
                      <>
                        <Select
                          value={String(src.default_score ?? '')}
                          disabled={busySourceId === String(src.id)}
                          onChange={(e) => changeSourceScore(src, e.target.value as LeadScore)}
                          aria-label={`Default score for ${src.name}`}
                          className="w-20"
                        >
                          {SCORE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </Select>
                        <button
                          onClick={() => toggleSource(src)}
                          disabled={busySourceId === String(src.id)}
                          className="p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-surface-3 transition-colors disabled:opacity-50"
                          title={src.is_active ? `Deactivate ${src.name}` : `Activate ${src.name}`}
                        >
                          {src.is_active
                            ? <ToggleRight className="w-5 h-5 text-success" />
                            : <ToggleLeft className="w-5 h-5" />}
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-fg capitalize w-20">{String(src.default_score ?? '—')}</span>
                        <span className="text-xs text-fg-muted">{src.is_active ? 'Active' : 'Inactive'}</span>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card.Body>
        {context.is_admin && (
          <Card.Footer>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[180px]">
                <Field label="New source">
                  <Input
                    value={newSourceName}
                    onChange={(e) => setNewSourceName(e.target.value)}
                    placeholder="e.g. Instagram DM"
                    onKeyDown={(e) => { if (e.key === 'Enter') addSource(); }}
                  />
                </Field>
              </div>
              <div className="w-28">
                <Field label="Score">
                  <Select value={newSourceScore} onChange={(e) => setNewSourceScore(e.target.value as LeadScore)}>
                    {SCORE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                </Field>
              </div>
              <Button
                variant="secondary"
                onClick={addSource}
                isLoading={addingSource}
                disabled={!newSourceName.trim()}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Add source
              </Button>
            </div>
          </Card.Footer>
        )}
      </Card>

      {/* (c) Intake integration — admins only */}
      {context.is_admin && (
        <Card padding="none">
          <Card.Header>
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-fg-muted" />
              <span>Intake integration</span>
            </div>
          </Card.Header>
          <Card.Body>
            <div className="space-y-4">
              <p className="text-sm text-fg-muted">
                External forms and ad platforms can push leads straight into the pipeline.
                Authenticate each request with the intake token below.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <code className="flex-1 min-w-[220px] font-mono text-sm text-fg bg-surface-3 border border-line rounded-lg px-3 py-2 break-all">
                  {settings?.intake_token ?? 'No token issued yet — rotate to generate one.'}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={copyToken}
                  disabled={!settings?.intake_token}
                  leftIcon={<Copy className="w-3.5 h-3.5" />}
                >
                  Copy
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setRotateOpen(true)}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Rotate
                </Button>
              </div>
              <div>
                <p className="text-xs text-fg-muted mb-1.5">Example request</p>
                <pre className="text-xs font-mono text-fg-muted bg-surface-3 border border-line rounded-lg p-3 overflow-x-auto whitespace-pre">
{intakeSnippet}
                </pre>
              </div>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Rotate confirmation */}
      <Modal open={rotateOpen} onClose={() => setRotateOpen(false)} size="sm" closeOnBackdrop={false}>
        <Modal.Header>Rotate intake token?</Modal.Header>
        <Modal.Body>
          <p className="text-sm text-fg-muted">
            The current token stops working immediately. Every form or integration
            using it will fail until you update it with the new token.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" fullWidth onClick={() => setRotateOpen(false)}>Cancel</Button>
          <Button variant="danger" fullWidth isLoading={rotating} onClick={rotateToken}>Rotate token</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
