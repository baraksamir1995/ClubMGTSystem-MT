'use client';

// Shared helpers for the sales manager workspace.
// Domain types come from the shared contract file: @/lib/sales-types

import type { FC, ReactNode } from 'react';
import { Card as UICard } from '@/components/ui';
import { apiErrorMessage, isDisplayableMessage, networkErrorMessage } from '@/lib/api-error';
import {
  STAGE_LABELS,
  type LeadStage,
  type TeamMember,
} from '@/lib/sales-types';

/* ------------------------------------------------------------------ */
/* Card with typed compound slots                                      */
/* ------------------------------------------------------------------ */

// components/ui/card.tsx attaches Header/Body/Footer at runtime but the
// exported binding's type doesn't carry them; this cast restores them.
type CardSlot = FC<{ children: ReactNode; className?: string }>;
export const Card = UICard as typeof UICard & {
  Header: CardSlot;
  Body: CardSlot;
  Footer: CardSlot;
};

/* ------------------------------------------------------------------ */
/* Fetch helpers                                                       */
/* ------------------------------------------------------------------ */

/**
 * All sales endpoints are proxied at /api/sales/<path> and return
 * `{ data: ... }` (list endpoints may also carry pagination meta).
 */
export async function salesFetch<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; meta?: { total?: number; per_page?: number; current_page?: number }; total?: number }> {
  const res = await fetch(`/api/sales/${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = new Error(apiErrorMessage(body, res.status)) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/** User-facing message for a caught error: safe API message or a friendly network fallback. */
export function errMsg(e: unknown): string {
  if (e instanceof Error && isDisplayableMessage(e.message)) return e.message;
  return networkErrorMessage();
}

export const salesGet = <T,>(path: string) => salesFetch<T>(path);

export const salesPost = <T = unknown,>(path: string, body?: unknown) =>
  salesFetch<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const salesPatch = <T = unknown,>(path: string, body: unknown) =>
  salesFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

/* ------------------------------------------------------------------ */
/* Report shapes (from the reports backend contract)                   */
/* ------------------------------------------------------------------ */

export interface FunnelReport {
  /** Ordered new→…→converted, plus a `lost` entry. */
  stages: { stage: string; count: number }[];
  conversion: { from: string; to: string; rate: number }[];
  showed_count: number;
  no_show_count: number;
}

export interface LeaderboardRow {
  user_id: string;
  name: string;
  leads: number;
  avg_speed_to_lead_minutes: number | null;
  show_rate: number;
  close_rate: number;
  conversions: number;
}

export interface SourceReportRow {
  source_id: string;
  name: string;
  leads: number;
  converted: number;
  conversion_rate: number;
}

/* ------------------------------------------------------------------ */
/* Stage / score labels                                                */
/* ------------------------------------------------------------------ */

export const stageLabel = (stage: string) =>
  STAGE_LABELS[stage as LeadStage] ??
  stage.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** "3m", "4h", "2d" style age from an ISO timestamp. */
export function ageFrom(iso: string | null | undefined): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** "34m" / "2h 05m" from a minute count. */
export function fmtMinutes(mins: number | null | undefined): string {
  if (mins === null || mins === undefined || Number.isNaN(mins)) return '—';
  const m = Math.round(mins);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
}

/**
 * Normalise a rate that may arrive as a fraction (0–1) or a percent
 * (0–100) into a percent number.
 */
export function asPercent(rate: number | null | undefined): number {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return 0;
  return rate <= 1 ? rate * 100 : rate;
}

export const fmtPercent = (rate: number | null | undefined) =>
  `${asPercent(rate).toFixed(0)}%`;

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** YYYY-MM-DD in local time, offset by `days` from today. */
export function isoDay(daysFromToday = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return d.toLocaleDateString('en-CA');
}

/**
 * Full ISO timestamp at the start (00:00:00.000) of the local day `days`
 * from today. The appointments endpoint compares against a `scheduled_at`
 * timestamp, so a bare YYYY-MM-DD collapses to a zero-width midnight
 * window — send real day boundaries instead.
 */
export function dayStartIso(daysFromToday = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Full ISO timestamp at the end (23:59:59.999) of that local day. */
export function dayEndIso(daysFromToday = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/* ------------------------------------------------------------------ */
/* Team / branch lookups                                               */
/* ------------------------------------------------------------------ */

export function memberName(
  team: TeamMember[] | null | undefined,
  userId: string | number | null | undefined,
): string {
  if (userId === null || userId === undefined || userId === '') return 'Unassigned';
  const m = (team ?? []).find((t) => String(t.user_id) === String(userId));
  return m?.full_name ?? 'Unknown';
}

export function branchName(
  branches: Array<{ id: string | number; name: string }> | null | undefined,
  branchId: string | number | null | undefined,
): string {
  if (branchId === null || branchId === undefined || branchId === '') return '—';
  const b = (branches ?? []).find((x) => String(x.id) === String(branchId));
  return b?.name ?? '—';
}
