<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("
            CREATE OR REPLACE FUNCTION public.get_gym_payments(p_gym_id uuid)
            RETURNS TABLE (
              id              uuid,
              gym_id          uuid,
              gym_member_id   uuid,
              membership_id   uuid,
              amount          numeric,
              original_amount numeric,
              discount_amount numeric,
              promo_code      text,
              currency        text,
              payment_method  text,
              status          text,
              notes           text,
              paid_at         timestamptz,
              source          text,
              service_type    text,
              service_name    text,
              specialist_name text,
              branch_name     text,
              created_at      timestamptz
            ) LANGUAGE plpgsql SECURITY DEFINER AS \$\$
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
              ORDER BY p.created_at DESC;
            END;
            \$\$;
        ");
    }

    public function down(): void
    {
        // Revert would restore the original without ::uuid[] casts
    }
};
