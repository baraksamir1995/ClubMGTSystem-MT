// Shapes returned by clby-api for the Store and Events modules.
// Contract: docs/store-and-events.md

export interface ProductVariant {
  id: string;
  name: string;
  image_url: string | null;
  before_price: number | null;
  price: number;
  /** null = stock not tracked (unlimited). */
  stock: number | null;
  is_active: boolean;
  display_order: number;
}

export interface GymProduct {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  before_price: number | null;
  price: number;
  currency: string;
  /** null = not tracked. Ignored by the API when the product has variants. */
  stock: number | null;
  is_active: boolean;
  display_order: number;
  variants: ProductVariant[];
  created_at: string;
  updated_at: string;
}

export interface EventConfiguration {
  id: string;
  name: string;
  sort_order: number;
}

export interface GymEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  image_url: string | null;
  starts_at: string;
  ends_at: string | null;
  registration_deadline: string | null;
  /** null = unlimited. */
  capacity: number | null;
  is_paid: boolean;
  price_cents: number | null;
  currency: string | null;
  is_published: boolean;
  configuration_label: string | null;
  configurations: EventConfiguration[];
  /** Plans this event is targeted at. Empty = every member. */
  plan_targets: { id: string; name: string }[];
  registrations_count: number;
  pending_count: number;
  attended_count: number;
}

export interface EventRegistration {
  id: string;
  gym_member_id: string;
  status: 'confirmed' | 'pending_payment' | 'cancelled' | string;
  payment_status: 'na' | 'unpaid' | 'paid' | 'refunded' | string;
  attended: boolean;
  configuration_name: string | null;
  created_at: string;
  member_name: string | null;
  member_photo_url: string | null;
  member_phone: string | null;
  member_number: string | number | null;
}

export interface PlanOption {
  id: string;
  name: string;
  is_active: boolean;
}

export interface BranchOption {
  id: string;
  name: string;
}

/** Payment methods accepted by the sell / mark-paid endpoints. */
export const DESK_PAYMENT_METHODS = ['cash', 'card', 'bank_transfer', 'instapay', 'wallet', 'other'] as const;
export type DeskPaymentMethod = (typeof DESK_PAYMENT_METHODS)[number];

/** i18n key under `payments.method.*` for each desk payment method. */
export const METHOD_LABEL_KEY: Record<DeskPaymentMethod, string> = {
  cash: 'cash',
  card: 'card',
  bank_transfer: 'bankTransfer',
  instapay: 'instapay',
  wallet: 'wallet',
  other: 'other',
};

/** Defensive defaults so a missing array never crashes the page. */
export function normalizeEvents(raw: unknown): GymEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e: GymEvent) => ({
    ...e,
    plan_targets: e.plan_targets ?? [],
    configurations: [...(e.configurations ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    configuration_label: e.configuration_label ?? null,
    registrations_count: Number(e.registrations_count ?? 0),
    pending_count: Number(e.pending_count ?? 0),
    attended_count: Number(e.attended_count ?? 0),
  }));
}

export function fmtEventPrice(e: Pick<GymEvent, 'price_cents' | 'currency'>): string {
  const amount = (e.price_cents ?? 0) / 100;
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${e.currency ?? 'EGP'}`;
}
