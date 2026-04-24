<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // When sessions_total IS NULL the membership grants unlimited sessions
        // for the plan's time window. Skip the exhaustion check AND skip the
        // sessions_remaining decrement so the row doesn't accumulate
        // meaningless 0s. sessions_used still increments for analytics.
        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.validate_studio_access(p_studio_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_gym_tz       text;
  v_now          timestamp;
  v_studio       record;
  v_gym_member_id uuid;
  v_membership   record;
  v_session      record;
  v_booking_id   uuid;
  v_booking_st   text;
BEGIN
  SELECT s.id, s.name AS studio_name, s.branch_id, s.gym_id, b.name AS branch_name,
         g.timezone AS gym_timezone
  INTO v_studio
  FROM studios s
    JOIN branches b ON b.id = s.branch_id
    JOIN gyms g ON g.id = s.gym_id
  WHERE s.id = p_studio_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','denied','reason','studio_not_found');
  END IF;

  v_gym_tz := COALESCE(v_studio.gym_timezone, 'UTC');
  v_now := (CURRENT_TIMESTAMP AT TIME ZONE v_gym_tz)::timestamp;

  SELECT gm.id INTO v_gym_member_id
  FROM gym_members gm
  WHERE gm.user_id = p_user_id AND gm.gym_id = v_studio.gym_id AND gm.deleted_at IS NULL
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','denied','reason','not_a_member');
  END IF;

  SELECT mm.id AS mm_id, mm.sessions_used, mm.sessions_remaining, mm.sessions_total,
         mm.allowed_branch_ids, mm.freeze_status, mp.plan_type, mp.session_count
  INTO v_membership
  FROM member_memberships mm JOIN membership_plans mp ON mp.id = mm.plan_id
  WHERE mm.gym_member_id = v_gym_member_id AND mm.status = 'active' AND mm.payment_status = 'paid'
    AND (mm.end_date IS NULL OR mm.end_date >= v_now::date)
  ORDER BY mm.start_date DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','denied','reason','no_active_membership');
  END IF;
  IF v_membership.freeze_status = 'frozen' THEN
    RETURN jsonb_build_object('status','denied','reason','membership_frozen');
  END IF;

  IF v_membership.allowed_branch_ids IS NOT NULL THEN
    IF NOT (v_studio.branch_id::text = ANY(v_membership.allowed_branch_ids)) THEN
      RETURN jsonb_build_object('status','denied','reason','branch_not_allowed');
    END IF;
  END IF;

  SELECT cs.id, cs.session_date, cs.start_time, cs.end_time, cs.walk_in_allowed,
         c.name AS class_name, COALESCE(cs.instructor, c.instructor) AS instructor
  INTO v_session
  FROM class_sessions cs JOIN classes c ON c.id = cs.class_id
  WHERE cs.status <> 'cancelled'
    AND cs.session_date::date = v_now::date
    AND (cs.session_date::date + cs.start_time::time - interval '15 minutes') <= v_now
    AND (cs.session_date::date + cs.end_time::time) >= v_now
    AND (cs.studio_id = p_studio_id OR (cs.studio_id IS NULL AND cs.branch_id = v_studio.branch_id)
         OR (cs.studio_id IS NULL AND cs.branch_id IS NULL AND cs.gym_id = v_studio.gym_id))
  ORDER BY CASE WHEN cs.studio_id = p_studio_id THEN 0 ELSE 1 END,
           cs.session_date::date + cs.start_time::time DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','denied','reason','no_active_session');
  END IF;

  SELECT sb.id, sb.status INTO v_booking_id, v_booking_st
  FROM session_bookings sb
  WHERE sb.session_id = v_session.id AND sb.gym_member_id = v_gym_member_id
    AND sb.status IN ('confirmed','attended')
  LIMIT 1;
  IF FOUND THEN
    IF v_booking_st = 'attended' THEN
      RETURN jsonb_build_object('status','denied','reason','already_attended');
    END IF;
  ELSE
    IF NOT v_session.walk_in_allowed THEN
      RETURN jsonb_build_object('status','denied','reason','no_booking');
    END IF;
    IF EXISTS (SELECT 1 FROM attendance_logs WHERE class_session_id = v_session.id AND gym_member_id = v_gym_member_id) THEN
      RETURN jsonb_build_object('status','denied','reason','already_attended');
    END IF;
  END IF;

  -- Exhaustion check only when the membership is not unlimited. Prefer the
  -- per-row sessions_total (which reflects transfers out) and fall back to
  -- plan.session_count for legacy rows that never had sessions_total set.
  IF v_membership.plan_type = 'sessions'
     OR (v_membership.plan_type = 'duration_session' AND v_booking_id IS NOT NULL) THEN
    IF v_membership.sessions_total IS NOT NULL AND v_membership.sessions_used >= v_membership.sessions_total THEN
      RETURN jsonb_build_object('status','denied','reason','sessions_exhausted');
    ELSIF v_membership.sessions_total IS NULL AND v_membership.session_count IS NOT NULL
          AND v_membership.sessions_used >= v_membership.session_count THEN
      RETURN jsonb_build_object('status','denied','reason','sessions_exhausted');
    END IF;
  END IF;

  IF v_booking_id IS NOT NULL THEN
    UPDATE session_bookings SET status = 'attended' WHERE id = v_booking_id;
  END IF;
  INSERT INTO attendance_logs (gym_member_id, gym_id, branch_id, check_in_at, method, access_point, class_session_id, studio_id, specialist_name)
  VALUES (v_gym_member_id, v_studio.gym_id, v_studio.branch_id, CURRENT_TIMESTAMP, 'qr', v_session.class_name, v_session.id, p_studio_id, v_session.instructor);

  -- Increment sessions_used for analytics on every attended session. Only
  -- decrement sessions_remaining when the membership has a bounded quota
  -- (sessions_total NOT NULL) — unlimited plans leave it NULL.
  IF v_membership.plan_type = 'sessions'
     OR (v_membership.plan_type = 'duration_session' AND v_booking_id IS NOT NULL) THEN
    IF v_membership.sessions_total IS NOT NULL THEN
      UPDATE member_memberships SET
        sessions_used = sessions_used + 1,
        sessions_remaining = GREATEST(0, COALESCE(sessions_remaining, 0) - 1)
      WHERE id = v_membership.mm_id;
    ELSE
      UPDATE member_memberships SET
        sessions_used = sessions_used + 1
      WHERE id = v_membership.mm_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'status', 'allowed', 'session_id', v_session.id,
    'class_name', v_session.class_name, 'session_date', v_session.session_date,
    'start_time', left(v_session.start_time::text, 5), 'end_time', left(v_session.end_time::text, 5),
    'instructor', v_session.instructor, 'studio_name', v_studio.studio_name, 'branch_name', v_studio.branch_name
  );
END;
$function$;
SQL);
    }

    public function down(): void
    {
        // No rollback.
    }
};
