<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Bound get_gym_payments() so the admin "all gym payments" read can't
 * return an unbounded result set that pins an FPM worker + its PG
 * connection while the per-row LEFT JOINs and correlated branch
 * string_agg subqueries materialise.
 *
 * Adds p_limit / p_offset (defaults 5000 / 0). The scan+sort is already
 * index-backed by idx_payments_gym_id_created (gym_id, created_at DESC);
 * the cost is per-row joins, so capping rows is the real lever.
 *
 * Backward compatible: existing single-arg callers
 * (`SELECT * FROM get_gym_payments(?)`) resolve to this via the
 * defaults — no controller/FE change required, and the admin payments
 * table keeps computing its client-side money stats correctly for any
 * gym under 5000 payments (true server-side pagination + server
 * aggregates is a separate, money-sensitive FE+BE project).
 *
 * Signature change (added params) can't be done via CREATE OR REPLACE,
 * so DROP + CREATE. Only caller is PaymentController::index. Migration
 * is transaction-wrapped on boot so the DROP+CREATE is atomic.
 */
return new class extends Migration {
    public function up(): void
    {
        DB::statement('DROP FUNCTION IF EXISTS public.get_gym_payments(uuid)');
        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.get_gym_payments(
  p_gym_id uuid,
  p_limit  integer DEFAULT 5000,
  p_offset integer DEFAULT 0
)
 RETURNS TABLE(id uuid, gym_id uuid, gym_member_id uuid, membership_id uuid, amount numeric, original_amount numeric, discount_amount numeric, promo_code text, currency text, payment_method text, status text, notes text, paid_at timestamp with time zone, source text, service_type text, service_name text, specialist_name text, branch_name text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
            BEGIN
              RETURN QUERY
              SELECT
                p.id,
                p.gym_id,
                p.gym_member_id,
                p.membership_id,
                p.amount,
                p.original_amount,
                p.discount_amount,
                pc.code        AS promo_code,
                p.currency,
                p.payment_method,
                p.status,
                p.notes,
                p.paid_at,
                p.source,
                p.service_type,
                p.service_name,
                p.specialist_name,
                COALESCE(
                  b.name,
                  CASE
                    WHEN mp.access_scope = 'all_branches' THEN 'All Branches'
                    WHEN mp.allowed_branch_ids IS NOT NULL AND array_length(mp.allowed_branch_ids, 1) > 0 THEN (
                      SELECT string_agg(br.name, ', ' ORDER BY br.name)
                      FROM public.branches br
                      WHERE br.id = ANY(mp.allowed_branch_ids::uuid[])
                    )
                    ELSE NULL
                  END,
                  CASE
                    WHEN mp2.access_scope = 'all_branches' THEN 'All Branches'
                    WHEN mp2.allowed_branch_ids IS NOT NULL AND array_length(mp2.allowed_branch_ids, 1) > 0 THEN (
                      SELECT string_agg(br.name, ', ' ORDER BY br.name)
                      FROM public.branches br
                      WHERE br.id = ANY(mp2.allowed_branch_ids::uuid[])
                    )
                    ELSE NULL
                  END
                ) AS branch_name,
                p.created_at
              FROM public.payments p
              LEFT JOIN public.promo_codes pc ON pc.id = p.promo_code_id
              LEFT JOIN public.branches b ON b.id = p.branch_id
              LEFT JOIN public.member_memberships mm ON mm.id = p.membership_id
              LEFT JOIN public.membership_plans mp ON mp.id = mm.plan_id
              LEFT JOIN public.membership_plans mp2
                ON mp2.gym_id = p.gym_id
                AND mp2.name = p.service_name
                AND p.membership_id IS NULL
                AND mp2.is_active = true
              WHERE p.gym_id = p_gym_id
              ORDER BY p.created_at DESC
              LIMIT GREATEST(p_limit, 0) OFFSET GREATEST(p_offset, 0);
            END;
            $function$
SQL
        );
    }

    public function down(): void
    {
        DB::statement('DROP FUNCTION IF EXISTS public.get_gym_payments(uuid, integer, integer)');
        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.get_gym_payments(p_gym_id uuid)
 RETURNS TABLE(id uuid, gym_id uuid, gym_member_id uuid, membership_id uuid, amount numeric, original_amount numeric, discount_amount numeric, promo_code text, currency text, payment_method text, status text, notes text, paid_at timestamp with time zone, source text, service_type text, service_name text, specialist_name text, branch_name text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
            BEGIN
              RETURN QUERY
              SELECT
                p.id, p.gym_id, p.gym_member_id, p.membership_id, p.amount,
                p.original_amount, p.discount_amount, pc.code AS promo_code,
                p.currency, p.payment_method, p.status, p.notes, p.paid_at,
                p.source, p.service_type, p.service_name, p.specialist_name,
                COALESCE(
                  b.name,
                  CASE
                    WHEN mp.access_scope = 'all_branches' THEN 'All Branches'
                    WHEN mp.allowed_branch_ids IS NOT NULL AND array_length(mp.allowed_branch_ids, 1) > 0 THEN (
                      SELECT string_agg(br.name, ', ' ORDER BY br.name)
                      FROM public.branches br WHERE br.id = ANY(mp.allowed_branch_ids::uuid[])
                    )
                    ELSE NULL
                  END,
                  CASE
                    WHEN mp2.access_scope = 'all_branches' THEN 'All Branches'
                    WHEN mp2.allowed_branch_ids IS NOT NULL AND array_length(mp2.allowed_branch_ids, 1) > 0 THEN (
                      SELECT string_agg(br.name, ', ' ORDER BY br.name)
                      FROM public.branches br WHERE br.id = ANY(mp2.allowed_branch_ids::uuid[])
                    )
                    ELSE NULL
                  END
                ) AS branch_name,
                p.created_at
              FROM public.payments p
              LEFT JOIN public.promo_codes pc ON pc.id = p.promo_code_id
              LEFT JOIN public.branches b ON b.id = p.branch_id
              LEFT JOIN public.member_memberships mm ON mm.id = p.membership_id
              LEFT JOIN public.membership_plans mp ON mp.id = mm.plan_id
              LEFT JOIN public.membership_plans mp2
                ON mp2.gym_id = p.gym_id AND mp2.name = p.service_name
                AND p.membership_id IS NULL AND mp2.is_active = true
              WHERE p.gym_id = p_gym_id
              ORDER BY p.created_at DESC;
            END;
            $function$
SQL
        );
    }
};
