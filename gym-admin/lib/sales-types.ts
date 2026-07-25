/**
 * Shared types for the Sales & Leads module.
 *
 * Mirrors the backend contract:
 *   clby-api/app/Http/Controllers/Sales/*.php
 *   clby-api/app/Enums/Sales/*.php
 *   clby-api/database/migrations/2026_07_15_100000_create_sales_pipeline_tables.php
 *
 * Note: Laravel serializes decimal columns (quoted_price, final_price,
 * discount_value) as strings — typed `number | string` here.
 */

/* ── Pipeline stages ─────────────────────────────────────────────── */

export type LeadStage =
  | 'new'
  | 'qualified'
  | 'contacted'
  | 'tour_booked'
  | 'offer_presented'
  | 'converted'
  | 'lost';

/** Ordered forward pipeline (mirrors LeadStage::ORDER; `lost` is a side exit). */
export const STAGE_ORDER: LeadStage[] = [
  'new',
  'qualified',
  'contacted',
  'tour_booked',
  'offer_presented',
  'converted',
];

export const STAGE_LABELS: Record<LeadStage, string> = {
  new: 'New',
  qualified: 'Qualified',
  contacted: 'Contacted',
  tour_booked: 'Tour Booked',
  offer_presented: 'Offer Presented',
  converted: 'Converted',
  lost: 'Lost',
};

export type LeadScore = 'hot' | 'warm' | 'cold';

/* ── Leads ───────────────────────────────────────────────────────── */

/** SLA flags computed server-side on GET /sales/leads. */
export interface LeadFlags {
  unassigned_sla_breach: boolean;
  uncontacted: boolean;
  unqualified_sla_breach: boolean;
}

export interface Lead {
  id: string;
  name: string;
  phone: string; // E.164
  email: string | null;
  stage: LeadStage;
  score: LeadScore | null;
  branch_id: string | null;
  source_id: string | null;
  source?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
  assigned_to: string | null; // profiles.id
  claimed_at?: string | null;
  notes: string | null;
  interest: string | null;

  // Qualification checklist
  interest_level: 'high' | 'medium' | 'low' | null;
  location_fit: 'good' | 'acceptable' | 'poor' | null;
  fitness_goal:
    | 'weight_loss'
    | 'muscle_gain'
    | 'general_fitness'
    | 'classes'
    | 'pt'
    | 'rehab'
    | null;
  budget_range: string | null;
  join_timeframe: 'immediately' | 'this_month' | '1_3_months' | 'later' | null;

  // Attribution
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;

  // Lifecycle timestamps
  contact_attempts: number;
  first_contacted_at: string | null;
  qualified_at: string | null;
  converted_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  lost_notes?: string | null;
  reengage_at: string | null;

  // Conversion payload
  converted_member_id?: string | null; // gym_members.id
  accepted_offer_id?: string | null;
  agreement_ref?: string | null;
  payment_method?: 'cash' | 'card' | 'instapay' | 'bank_transfer' | 'other' | null;
  final_price?: number | string | null;
  membership_start_date?: string | null;

  created_by?: string | null;
  created_at: string;
  updated_at?: string;

  // Present on list responses (GET /sales/leads) only.
  flags?: LeadFlags;
  speed_to_lead_minutes?: number | null;

  // Present on detail responses (GET /sales/leads/{id}) only.
  stage_history?: StageHistoryEntry[];
  activities?: Activity[];
  appointments?: Appointment[];
  offers?: Offer[];
  objections?: Objection[];
  tasks?: SalesTask[];
}

export interface StageHistoryEntry {
  id: string;
  lead_id: string;
  from_stage: LeadStage | null;
  to_stage: LeadStage;
  changed_by: string | null;
  reason: string | null;
  created_at: string;
}

/** Shape of the 409 duplicate-lead response from POST /sales/leads. */
export interface DuplicateLeadError {
  error: 'duplicate';
  existing_lead: Pick<
    Lead,
    'id' | 'name' | 'phone' | 'email' | 'stage' | 'assigned_to' | 'created_at'
  >;
}

/* ── Activities / Appointments / Offers / Objections / Tasks ────── */

export type ActivityType = 'call' | 'whatsapp' | 'sms' | 'email' | 'note';

export interface Activity {
  id: string;
  gym_id: string;
  lead_id: string;
  user_id: string | null;
  type: ActivityType;
  outcome: string | null;
  notes: string | null;
  created_at: string;
}

export type AppointmentType = 'tour' | 'trial' | 'guest_pass' | 'class_taster';
export type AppointmentStatus = 'scheduled' | 'showed' | 'no_show' | 'cancelled';

export interface Appointment {
  id: string;
  gym_id: string;
  lead_id: string;
  branch_id: string | null;
  host_id: string | null;
  type: AppointmentType;
  scheduled_at: string;
  status: AppointmentStatus;
  reminded_24h: boolean;
  reminded_2h: boolean;
  marked_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Included on GET /sales/appointments.
  lead?: Pick<Lead, 'id' | 'name' | 'phone' | 'stage' | 'assigned_to'>;
}

export type OfferStatus = 'open' | 'accepted' | 'declined';
export type DiscountType = 'percent' | 'fixed' | 'waived_joining_fee' | 'custom';

export interface Offer {
  id: string;
  gym_id: string;
  lead_id: string;
  plan_id: string | null; // membership_plans.id
  discount_type: DiscountType | null;
  discount_value: number | string | null;
  quoted_price: number | string;
  valid_until: string | null;
  incentive_notes: string | null;
  status: OfferStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Objection {
  id: string;
  gym_id: string;
  lead_id: string;
  offer_id: string | null;
  reason: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export type SalesTaskType = 'follow_up' | 'rebook' | 'onboarding' | 'other';
export type SalesTaskStatus = 'open' | 'done' | 'cancelled';

export interface SalesTask {
  id: string;
  gym_id: string;
  lead_id: string | null;
  assigned_to: string | null; // profiles.id
  type: SalesTaskType;
  title: string;
  due_at: string;
  status: SalesTaskStatus;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Included on GET /sales/tasks.
  lead?: Pick<Lead, 'id' | 'name' | 'phone' | 'stage' | 'branch_id' | 'assigned_to'>;
}

/* ── Sources / Settings / Team ───────────────────────────────────── */

export interface LeadSource {
  id: string;
  gym_id: string;
  name: string;
  default_score: LeadScore;
  is_active: boolean;
  sort: number;
  created_at: string;
  updated_at: string;
}

export interface SalesSettings {
  id: string;
  gym_id: string;
  unassigned_sla_minutes: number;
  qualify_sla_hours: number;
  first_contact_minutes: number;
  max_contact_attempts: number;
  cadence_days: number[];
  reminder_hours: number[];
  /** Managers only — stripped from rep responses. */
  intake_token?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Row from GET /sales/team: active staff holding the `sales` module, plus
 * gym admins (who have full access without a staff_members row — their
 * `staff_id` is null and `sales_role` is 'admin').
 */
export interface TeamMember {
  staff_id: string | null;
  user_id: string; // profiles.id — matches Lead.assigned_to
  full_name: string;
  email: string;
  sales_role: 'rep' | 'manager' | 'admin';
  branch_id: string | null;
  manager_branch_ids: string[] | null;
}

/* Integration-compatibility aliases (some view components use Sales-prefixed names). */
/** @deprecated Alias for {@link TeamMember}. */
export type SalesTeamMember = TeamMember;
/** @deprecated Alias for {@link Lead}. */
export type SalesLead = Lead;
/** @deprecated Alias for {@link Appointment}. */
export type SalesAppointment = Appointment;

/** Caller's sales scope, from GET /sales/context. */
export interface SalesContext {
  is_admin: boolean;
  is_manager: boolean;
  user_id: string;
  /** null = all branches in the gym. */
  branch_ids: string[] | null;
  branches: { id: string; name: string }[];
}
