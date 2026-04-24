<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Transferred memberships grant session-based studio access only.
        // They must not be considered when validating gym-floor / branch access.
        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.validate_branch_access(p_gym_member_id uuid, p_branch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
  DECLARE
    v_membership record;
  BEGIN
    SELECT allowed_branch_ids, status, payment_status, end_date
    INTO   v_membership
    FROM   member_memberships
    WHERE  gym_member_id = p_gym_member_id
      AND  status        = 'active'
      AND  payment_status = 'paid'
      AND  transferred_from IS NULL
      AND  (end_date IS NULL OR end_date >= current_date)
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'no_active_membership');
    END IF;

    IF v_membership.allowed_branch_ids IS NULL THEN
      RETURN jsonb_build_object('allowed', true);
    END IF;

    IF p_branch_id = ANY(v_membership.allowed_branch_ids) THEN
      RETURN jsonb_build_object('allowed', true);
    END IF;

    RETURN jsonb_build_object('allowed', false, 'reason', 'wrong_branch');
  END;
  $function$;
SQL);
    }

    public function down(): void
    {
        // No rollback — reverting would reintroduce the bug where transferred
        // sessions silently grant gym-floor access.
    }
};
