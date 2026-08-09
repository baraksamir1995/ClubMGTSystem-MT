// Shared helpers for the Sales rep surface (components/sales/rep/**).
//
// Types are owned by @/lib/sales-types (built in parallel with the shell).
// Everything here funnels through this one re-export so a rename lands in
// a single file.
import { apiErrorMessage, networkErrorMessage } from '@/lib/api-error';

export type {
  SalesContext,
  TeamMember,
  SalesTeamMember,
  Lead,
  SalesLead,
  LeadFlags,
  SalesTask,
  Appointment,
  SalesAppointment,
  Offer,
  Activity,
  Objection,
  LeadSource,
  StageHistoryEntry,
  DuplicateLeadError,
  LeadStage,
  LeadScore,
} from '@/lib/sales-types';

/** List meta on GET sales/leads. */
export interface SalesListMeta {
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
}

/* ── API helper ─────────────────────────────────────────────────── */

export class SalesApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = 'SalesApiError';
    this.status = status;
    this.payload = payload;
  }
}

/**
 * Fetch against the gym-admin sales proxy: `salesApi('leads?stage=new')`
 * → GET /api/sales/leads?stage=new. Throws `SalesApiError` on non-2xx
 * with the server's message + raw payload (409 duplicate flow needs it).
 */
export async function salesApi<T = unknown>(
  path: string,
  init?: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown },
): Promise<T> {
  const res = await fetch(`/api/sales/${path}`, {
    method: init?.method ?? 'GET',
    headers: init?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    throw new SalesApiError(res.status, extractErrorMessage(json, res.status), json);
  }
  return json as T;
}

function extractErrorMessage(json: any, status: number): string {
  if (json?.error === 'duplicate') return 'A lead with this phone or email already exists.';
  return apiErrorMessage(json, status);
}

/** User-facing message for a caught error: safe API message or a friendly network fallback. */
export function errMsg(e: unknown): string {
  if (e instanceof SalesApiError) return e.message;
  return networkErrorMessage();
}

/* ── Pipeline vocabulary ────────────────────────────────────────── */

export const ACTIVE_STAGES = ['new', 'qualified', 'contacted', 'tour_booked', 'offer_presented'] as const;
export const ALL_STAGES = [...ACTIVE_STAGES, 'converted', 'lost'] as const;

export const STAGE_LABELS: Record<string, string> = {
  new:             'New',
  qualified:       'Qualified',
  contacted:       'Contacted',
  tour_booked:     'Tour booked',
  offer_presented: 'Offer presented',
  converted:       'Converted',
  lost:            'Lost',
};

/** Server enforces one-step-forward; this mirrors it for optimistic UI. */
export function nextStage(stage: string): string | null {
  const idx = (ACTIVE_STAGES as readonly string[]).indexOf(stage);
  if (idx === -1) return null;
  return idx === ACTIVE_STAGES.length - 1 ? 'converted' : ACTIVE_STAGES[idx + 1];
}

export const SCORE_STYLES: Record<string, string> = {
  hot:  'bg-danger-soft text-danger',
  warm: 'bg-warning-soft text-warning',
  cold: 'bg-sky-500/15 text-sky-500',
};

export const LOST_REASONS = [
  'price', 'commitment_length', 'needs_to_think', 'comparing_competitors',
  'timing', 'unreachable', 'other',
] as const;

/** Objection reasons exclude `unreachable` (that's a lost-only reason). */
export const OBJECTION_REASONS = [
  'price', 'commitment_length', 'needs_to_think', 'comparing_competitors',
  'timing', 'other',
] as const;

export const ACTIVITY_TYPES = ['call', 'whatsapp', 'sms', 'email', 'note'] as const;
export const ACTIVITY_OUTCOMES = ['answered', 'no_answer', 'callback_requested', 'not_interested'] as const;
export const APPOINTMENT_TYPES = ['tour', 'trial', 'guest_pass', 'class_taster'] as const;
export const PAYMENT_METHODS = ['cash', 'card', 'instapay', 'bank_transfer', 'other'] as const;
export const DISCOUNT_TYPES = ['percent', 'fixed', 'waived_joining_fee', 'custom'] as const;

export const FITNESS_GOALS = ['weight_loss', 'muscle_gain', 'general_fitness', 'classes', 'pt', 'rehab'] as const;
export const INTEREST_LEVELS = ['high', 'medium', 'low'] as const;
export const LOCATION_FITS = ['good', 'acceptable', 'poor'] as const;
export const JOIN_TIMEFRAMES = ['immediately', 'this_month', '1_3_months', 'later'] as const;

/** `commitment_length` → `Commitment length`, `1_3_months` → `1 3 months`… */
export function labelize(value: string | null | undefined): string {
  if (!value) return '—';
  const spaced = value.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const JOIN_TIMEFRAME_LABELS: Record<string, string> = {
  immediately: 'Immediately',
  this_month:  'This month',
  '1_3_months': '1–3 months',
  later:       'Later',
};

/* ── Phone links (reps live on tel: / wa.me) ────────────────────── */

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** wa.me wants E.164 digits with no plus. */
export function waHref(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, '')}`;
}

/* ── Dates ──────────────────────────────────────────────────────── */

export function fmtDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function fmtTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** Whole days between a timestamp and now (>= 0). */
export function daysSince(value: string | null | undefined): number {
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
}

export function fmtMinutes(mins: number): string {
  if (!Number.isFinite(mins)) return '—';
  const rounded = Math.round(mins);
  if (rounded < 60) return `${rounded}m`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Local YYYY-MM-DD (avoids the UTC shift of toISOString). */
export function localDateStr(d: Date): string {
  return d.toLocaleDateString('en-CA');
}

/** Resolve a team member's display name from their profile user_id. */
export function teamMemberName(team: Array<{ user_id: string; full_name: string }> | undefined, userId: string | null | undefined): string | null {
  if (!userId || !team) return null;
  return team.find((m) => m.user_id === userId)?.full_name ?? null;
}
