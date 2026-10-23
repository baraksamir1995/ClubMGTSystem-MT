'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Building2, Check, X, RefreshCw, Mail, MapPin, Phone, User, Settings2,
  AlertTriangle, RotateCcw, Send, History, ShieldCheck, Pencil,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { apiErrorMessage, networkErrorMessage, responseErrorMessage } from '@/lib/api-error';
import { GYM_REQUESTS_CHANGED_EVENT } from '@/lib/gym-request-events';
import { RequestStatusBadge, type GymRequestStatus } from '../status-badge';
import EditRequestModal from './edit-request-modal';

interface GymRequest {
  id: string;
  reference: string;
  status: GymRequestStatus;
  gym_name: string;
  description: string | null;
  logo_url: string | null;
  address: string | null;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  phone: string;
  business_email: string;
  category: string | null;
  services: string[] | null;
  branches_count: number;
  timezone: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  created_at: string;
  reviewed_at: string | null;
  reviewer_name: string | null;
  decline_reason: string | null;
  share_decline_reason: boolean;
  provisioned_gym_id: string | null;
  provisioned_gym_exists: boolean;
  owner_setup_complete: boolean;
  provisioning_attempts: number;
  last_provisioning_error: string | null;
  last_provisioning_failed_at: string | null;
  submitted_email_sent_at: string | null;
  decision_email_sent_at: string | null;
  last_email_error: string | null;
  last_email_failed_at: string | null;
}

interface RequestEvent {
  id: string;
  event: string;
  details: Record<string, any> | null;
  created_at: string;
  actor_name: string | null;
}

const EVENT_LABELS: Record<string, string> = {
  submitted: 'Request submitted',
  approved: 'Approved — gym provisioned',
  declined: 'Declined',
  reopened: 'Reopened for review',
  provisioning_failed: 'Provisioning failed',
  email_sent: 'Email sent',
  email_failed: 'Email delivery failed',
  email_resend_requested: 'Email resend requested',
  email_skipped: 'Email skipped — owner already set a password',
  edited: 'Details edited',
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
};

const humanize = (s: string | null) => (s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—');

export default function GymRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [req, setReq] = useState<GymRequest | null>(null);
  const [events, setEvents] = useState<RequestEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'approve' | 'decline' | 'reopen' | 'resend-email'>(null);
  const [modal, setModal] = useState<null | 'approve' | 'decline' | 'reopen'>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [shareReason, setShareReason] = useState(false);
  const [maxBranches, setMaxBranches] = useState('');
  const [editing, setEditing] = useState(false);

  const fetchRequest = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/super-admin/gym-requests/${id}`);
      if (!res.ok) { setError(`Couldn't load request — ${await responseErrorMessage(res)}`); return; }
      const json = await res.json();
      setReq(json.data);
      setEvents(json.events ?? []);
    } catch { setError(networkErrorMessage()); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchRequest(); }, [fetchRequest]);

  const runAction = async (action: 'approve' | 'decline' | 'reopen' | 'resend-email', body: object = {}) => {
    if (busy) return;
    setBusy(action);
    try {
      const res = await fetch(`/api/super-admin/gym-requests/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        // Provisioning failures carry a specific, safe message — show it.
        toast.error(action === 'approve' && json?.message ? json.message : apiErrorMessage(json, res.status));
        if (action === 'approve') fetchRequest();
        return;
      }
      setModal(null);
      toast.success({
        approve: json?.already_approved ? 'Already approved' : 'Approved — gym is live and the owner has been emailed',
        decline: json?.already_declined ? 'Already declined' : 'Request declined',
        reopen: 'Request reopened for review',
        'resend-email': 'Email queued',
      }[action]);
      window.dispatchEvent(new Event(GYM_REQUESTS_CHANGED_EVENT));
      fetchRequest();
    } catch { toast.error(networkErrorMessage()); }
    finally { setBusy(null); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 text-brand animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (error || !req) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="bg-danger-soft border border-danger/30 rounded-xl p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0" aria-hidden />
          <div>
            <p className="text-sm text-fg">{error ?? 'Request not found'}</p>
            <button onClick={() => { setLoading(true); fetchRequest(); }} className="mt-2 text-sm text-brand hover:underline">Try again</button>
          </div>
        </div>
      </div>
    );
  }

  // Once the owner has set a password, re-sending the approval email would
  // mint a reset link for an account in use — the API refuses it too.
  const canResend = !(req.status === 'approved' && req.owner_setup_complete);
  const inp = 'w-full px-3 py-2 bg-surface-3 border border-line-strong rounded-lg text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:border-brand transition-colors';
  const mapsUrl = req.latitude != null && req.longitude != null
    ? `https://www.google.com/maps?q=${req.latitude},${req.longitude}`
    : null;

  return (
    <div className="space-y-5 max-w-5xl">
      <BackLink />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          {req.logo_url
            ? <img src={req.logo_url} alt={`${req.gym_name} logo`} className="w-16 h-16 rounded-xl object-cover bg-surface-3 border border-line flex-shrink-0" />
            : <div className="w-16 h-16 rounded-xl bg-surface-3 border border-line flex items-center justify-center flex-shrink-0"><Building2 className="w-7 h-7 text-fg-faint" aria-hidden /></div>}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-fg truncate">{req.gym_name}</h1>
              <RequestStatusBadge status={req.status} />
            </div>
            <p className="text-sm text-fg-muted mt-0.5">
              <span className="font-mono">{req.reference}</span> · Submitted {fmtDate(req.created_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {req.status === 'pending' && (
            <>
              <button onClick={() => setEditing(true)} disabled={!!busy}
                className="flex items-center gap-1.5 px-4 py-2 bg-surface-2 border border-line hover:bg-surface-3 text-fg text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                <Pencil className="w-4 h-4" aria-hidden /> Edit
              </button>
              <button onClick={() => { setDeclineReason(''); setShareReason(false); setModal('decline'); }} disabled={!!busy}
                className="flex items-center gap-1.5 px-4 py-2 bg-surface-2 border border-line hover:bg-danger-soft hover:text-danger text-fg-muted text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                <X className="w-4 h-4" aria-hidden /> Decline
              </button>
              <button onClick={() => { setMaxBranches(String(Math.max(10, req.branches_count))); setModal('approve'); }} disabled={!!busy}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-fill hover:bg-brand-dim text-brand-ink border border-brand-edge text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
                <Check className="w-4 h-4" aria-hidden /> Approve
              </button>
            </>
          )}
          {req.status === 'declined' && (
            <button onClick={() => setModal('reopen')} disabled={!!busy}
              className="flex items-center gap-1.5 px-4 py-2 bg-surface-2 border border-line hover:bg-surface-3 text-fg text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
              <RotateCcw className="w-4 h-4" aria-hidden /> Reopen for review
            </button>
          )}
        </div>
      </div>

      {/* Operational alerts */}
      {req.status === 'pending' && req.last_provisioning_error && (
        <Alert tone="danger" title={`Last approval attempt failed (${req.provisioning_attempts} attempt${req.provisioning_attempts === 1 ? '' : 's'}, ${fmtDate(req.last_provisioning_failed_at)})`}>
          {req.last_provisioning_error}
          <p className="mt-1 text-fg-muted">
            Nothing was created.{' '}
            <button onClick={() => setEditing(true)} className="text-brand hover:underline">Edit the request</button>{' '}
            to fix it, then approve again.
          </p>
        </Alert>
      )}
      {req.last_email_error && (
        <Alert tone="warning" title={`Email delivery failed (${fmtDate(req.last_email_failed_at)})`}
          action={canResend ? <ResendButton busy={busy === 'resend-email'} onClick={() => runAction('resend-email')} /> : undefined}>
          {req.last_email_error}
          <p className="mt-1 text-fg-muted">The request itself is unaffected. Delivery is retried automatically; you can also resend now.</p>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Section icon={Building2} title="Gym">
            <Field label="Name" value={req.gym_name} />
            <Field label="Category" value={humanize(req.category)} />
            <Field label="Description" value={req.description} wide />
          </Section>

          <Section icon={MapPin} title="Location">
            <Field label="Address" value={req.address} wide />
            <Field label="City" value={req.city} />
            <Field label="Country" value={req.country} />
            {mapsUrl && (
              <Field label="Coordinates" wide value={
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                  {req.latitude}, {req.longitude}
                </a>
              } />
            )}
          </Section>

          <Section icon={Phone} title="Business contact">
            <Field label="Phone" value={<a href={`tel:${req.phone}`} className="hover:underline">{req.phone}</a>} />
            <Field label="Email" value={<a href={`mailto:${req.business_email}`} className="hover:underline">{req.business_email}</a>} />
          </Section>

          <Section icon={User} title="Owner">
            <Field label="Full name" value={req.owner_name} />
            <Field label="Email (dashboard username)" value={<a href={`mailto:${req.owner_email}`} className="hover:underline">{req.owner_email}</a>} />
            <Field label="Mobile" value={<a href={`tel:${req.owner_phone}`} className="hover:underline">{req.owner_phone}</a>} />
          </Section>

          <Section icon={Settings2} title="Configuration">
            <Field label="Branches" value={String(req.branches_count)} />
            <Field label="Timezone" value={req.timezone} />
            <Field label="Services" wide value={
              req.services?.length
                ? <div className="flex flex-wrap gap-1.5">{req.services.map(s => <span key={s} className="px-2 py-0.5 rounded-md bg-surface-3 text-xs text-fg">{s}</span>)}</div>
                : '—'
            } />
          </Section>
        </div>

        <div className="space-y-5">
          <Section icon={ShieldCheck} title="Review" cols={1}>
            <Field label="Status" value={<RequestStatusBadge status={req.status} />} />
            <Field label="Reviewed by" value={req.reviewer_name} />
            <Field label="Reviewed at" value={req.reviewed_at ? fmtDate(req.reviewed_at) : null} />
            {req.status === 'declined' && (
              <Field label={`Decline reason${req.decline_reason ? (req.share_decline_reason ? ' (shared with applicant)' : ' (internal)') : ''}`}
                value={req.decline_reason} />
            )}
            {req.status === 'approved' && (
              <Field label="Provisioned gym" value={
                req.provisioned_gym_exists
                  ? <Link href="/super-admin" className="text-brand hover:underline font-mono text-xs break-all">{req.provisioned_gym_id}</Link>
                  : <span className="text-warning">Gym no longer exists</span>
              } />
            )}
          </Section>

          <Section icon={Mail} title="Notifications" cols={1}>
            <Field label="Confirmation email" value={req.submitted_email_sent_at ? `Sent ${fmtDate(req.submitted_email_sent_at)}` : 'Not sent yet'} />
            {req.status !== 'pending' && (
              <Field label={req.status === 'approved' ? 'Approval email' : 'Decline email'}
                value={req.decision_email_sent_at ? `Sent ${fmtDate(req.decision_email_sent_at)}` : 'Not sent yet'} />
            )}
            {req.status === 'approved' && req.owner_setup_complete && (
              <Field label="Owner account" value="Password set — owner can sign in" />
            )}
            {!req.last_email_error && canResend && (
              <div className="pt-1">
                <ResendButton busy={busy === 'resend-email'} onClick={() => runAction('resend-email')}
                  label={req.status === 'approved' ? 'Resend approval email (new setup link)' : undefined} />
              </div>
            )}
          </Section>

          <Section icon={History} title="Activity" cols={1}>
            <ol className="space-y-3">
              {events.map(ev => (
                <li key={ev.id} className="text-sm">
                  <p className={`font-medium ${ev.event.endsWith('failed') ? 'text-danger' : 'text-fg'}`}>
                    {EVENT_LABELS[ev.event] ?? humanize(ev.event)}
                    {ev.details?.type ? <span className="text-fg-muted font-normal"> · {ev.details.type}</span> : null}
                  </p>
                  <p className="text-xs text-fg-faint">
                    {fmtDate(ev.created_at)}{ev.actor_name ? ` · ${ev.actor_name}` : ''}
                  </p>
                  {ev.details?.error && <p className="text-xs text-fg-muted mt-0.5 break-words">{ev.details.error}</p>}
                  {ev.event === 'edited' && ev.details?.changes && (
                    <p className="text-xs text-fg-muted mt-0.5">{Object.keys(ev.details.changes).map(k => humanize(k)).join(', ')}</p>
                  )}
                  {ev.event === 'declined' && ev.details?.reason && <p className="text-xs text-fg-muted mt-0.5">“{ev.details.reason}”</p>}
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>

      {editing && (
        <EditRequestModal request={req} onClose={() => setEditing(false)} onSaved={fetchRequest} />
      )}

      {/* Approve */}
      {modal === 'approve' && (
        <Modal title="Approve request" onClose={() => !busy && setModal(null)}>
          <p className="text-sm text-fg-muted">
            This creates <strong className="text-fg">{req.gym_name}</strong> with a Main Branch and studio, creates the owner
            account for <strong className="text-fg">{req.owner_email}</strong>, makes the gym visible in the CLBY app,
            and emails the owner a password-setup link.
          </p>
          <div className="mt-4">
            <label htmlFor="max-branches" className="block text-xs font-medium text-fg-muted mb-1.5">Branch limit</label>
            <input id="max-branches" type="number" min={1} max={100} value={maxBranches}
              onChange={e => setMaxBranches(e.target.value)} className={inp} />
            <p className="text-xs text-fg-faint mt-1">Applicant reported {req.branches_count} branch{req.branches_count === 1 ? '' : 'es'}.</p>
          </div>
          <ModalActions>
            <button onClick={() => setModal(null)} disabled={!!busy} className="px-4 py-2 text-sm text-fg-muted hover:text-fg">Cancel</button>
            <button onClick={() => runAction('approve', { max_branches: parseInt(maxBranches) || undefined })} disabled={!!busy}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-fill hover:bg-brand-dim text-brand-ink border border-brand-edge text-sm font-semibold rounded-lg disabled:opacity-50">
              {busy === 'approve' ? <RefreshCw className="w-4 h-4 animate-spin" aria-hidden /> : <Check className="w-4 h-4" aria-hidden />}
              {busy === 'approve' ? 'Provisioning…' : 'Approve & activate'}
            </button>
          </ModalActions>
        </Modal>
      )}

      {/* Decline */}
      {modal === 'decline' && (
        <Modal title="Decline request" onClose={() => !busy && setModal(null)}>
          <p className="text-sm text-fg-muted">
            <strong className="text-fg">{req.gym_name}</strong> will not be created and the applicant will be notified by email.
          </p>
          <div className="mt-4">
            <label htmlFor="decline-reason" className="block text-xs font-medium text-fg-muted mb-1.5">Reason (optional)</label>
            <textarea id="decline-reason" rows={3} maxLength={1000} value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              placeholder="e.g. We couldn't verify the business details" className={inp} />
          </div>
          <label className={`mt-3 flex items-start gap-2 text-sm ${declineReason.trim() ? 'text-fg' : 'text-fg-faint'}`}>
            <input type="checkbox" checked={shareReason && !!declineReason.trim()} disabled={!declineReason.trim()}
              onChange={e => setShareReason(e.target.checked)} className="mt-0.5" />
            Include this reason in the email to the applicant
          </label>
          <ModalActions>
            <button onClick={() => setModal(null)} disabled={!!busy} className="px-4 py-2 text-sm text-fg-muted hover:text-fg">Cancel</button>
            <button onClick={() => runAction('decline', { reason: declineReason.trim() || null, share_reason: shareReason && !!declineReason.trim() })}
              disabled={!!busy}
              className="flex items-center gap-1.5 px-4 py-2 bg-danger text-on-status text-sm font-semibold rounded-lg disabled:opacity-50 hover:opacity-90">
              {busy === 'decline' ? <RefreshCw className="w-4 h-4 animate-spin" aria-hidden /> : <X className="w-4 h-4" aria-hidden />}
              Decline request
            </button>
          </ModalActions>
        </Modal>
      )}

      {/* Reopen */}
      {modal === 'reopen' && (
        <Modal title="Reopen request" onClose={() => !busy && setModal(null)}>
          <p className="text-sm text-fg-muted">
            Move this declined request back to <strong className="text-fg">pending</strong> so it can be reviewed again.
            The previous decision stays in the activity log. No email is sent until a new decision is made.
          </p>
          <ModalActions>
            <button onClick={() => setModal(null)} disabled={!!busy} className="px-4 py-2 text-sm text-fg-muted hover:text-fg">Cancel</button>
            <button onClick={() => runAction('reopen')} disabled={!!busy}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-fill hover:bg-brand-dim text-brand-ink border border-brand-edge text-sm font-semibold rounded-lg disabled:opacity-50">
              <RotateCcw className="w-4 h-4" aria-hidden /> Reopen
            </button>
          </ModalActions>
        </Modal>
      )}
    </div>
  );
}

/* ── pieces ─────────────────────────────────────────────────────── */

function BackLink() {
  return (
    <Link href="/super-admin/gym-requests" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
      <ArrowLeft className="w-4 h-4" aria-hidden /> Gym Requests
    </Link>
  );
}

function Section({ icon: Icon, title, children, cols = 2 }: { icon: any; title: string; children: React.ReactNode; cols?: 1 | 2 }) {
  return (
    <section className="bg-surface-2 border border-line rounded-xl p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-fg mb-4">
        <Icon className="w-4 h-4 text-fg-muted" aria-hidden /> {title}
      </h2>
      <dl className={`grid gap-4 ${cols === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>{children}</dl>
    </section>
  );
}

function Field({ label, value, wide = false }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="text-xs text-fg-faint mb-0.5">{label}</dt>
      <dd className="text-sm text-fg whitespace-pre-wrap break-words">{value === null || value === undefined || value === '' ? '—' : value}</dd>
    </div>
  );
}

function Alert({ tone, title, children, action }: { tone: 'danger' | 'warning'; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  const cls = tone === 'danger' ? 'bg-danger-soft border-danger/30' : 'bg-warning-soft border-warning/30';
  return (
    <div role="alert" className={`border rounded-xl p-4 flex items-start gap-3 ${cls}`}>
      <AlertTriangle className={`w-5 h-5 flex-shrink-0 ${tone === 'danger' ? 'text-danger' : 'text-warning'}`} aria-hidden />
      <div className="flex-1 text-sm text-fg">
        <p className="font-semibold mb-0.5">{title}</p>
        {children}
      </div>
      {action}
    </div>
  );
}

function ResendButton({ busy, onClick, label = 'Resend email' }: { busy: boolean; onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} disabled={busy}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-2 border border-line hover:bg-surface-3 text-fg text-xs font-medium rounded-lg transition-colors disabled:opacity-50 flex-shrink-0">
      {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Send className="w-3.5 h-3.5" aria-hidden />} {label}
    </button>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-surface-2 border border-line rounded-2xl p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-fg mb-3">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex items-center justify-end gap-2">{children}</div>;
}
