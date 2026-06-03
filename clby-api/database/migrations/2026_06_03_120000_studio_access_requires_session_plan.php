<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Studio / group-session access must require a session-capable plan.
 *
 * Background — `validate_studio_access` previously authorized a studio (class)
 * scan against ANY eligible bucket, prioritising the member's own
 * subscription. That had two consequences:
 *
 *   1. A pure `duration` (gym-only) member could be let into a class, and the
 *      duration bucket — which has no session concept — was "consumed"
 *      without deducting anything.
 *   2. When a `duration` member received transferred sessions (which land as a
 *      SEPARATE `source_type='transfer'`, `plan_type='sessions'` bucket), the
 *      duration subscription still sorted first and was picked, so the gifted
 *      sessions were never the bucket that authorized the class.
 *
 * The member-facing bug: the Flutter app worked around (1) with a client-side
 * `hasStudioAccess` gate keyed off the single "current membership" (the
 * duration plan), so a duration member holding transferred sessions was
 * blocked locally — "Studio Access Not Included" — and the request never even
 * reached the backend.
 *
 * Fix — make the backend the single source of truth: studio access is decided
 * PER BUCKET by plan capability. Only `sessions` / `duration_session` buckets
 * can authorize a class scan, so a transferred-sessions bucket on a duration
 * member is now correctly selected and decremented. When no usable
 * session-capable bucket exists, a specific reason is returned so the app can
 * show the right message:
 *
 *   - studio_access_not_included : member's only active plans are gym-only
 *   - sessions_exhausted         : has a session plan but 0 remaining
 *   - no_active_membership       : nothing active (or only frozen/expired)
 *
 * Everything else (timezone, session lookup, booking/walk-in handling,
 * attendance log, decrement) is unchanged from the 2026_05_13 version.
 */
return new class extends Migration {
    public function up(): void
    {
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

  -- Studio/class access requires a SESSION-CAPABLE plan. A duration (gym-only)
  -- subscription does not grant class access, but transferred sessions land as
  -- their own 'sessions' bucket and DO — eligibility is per-bucket by plan_type.
  SELECT mm.id AS mm_id, mm.sessions_used, mm.sessions_remaining, mm.sessions_total,
         mm.allowed_branch_ids, mm.freeze_status, mm.source_type, mm.end_date,
         mp.plan_type, mp.session_count
  INTO v_membership
  FROM member_memberships mm
  JOIN membership_plans mp ON mp.id = mm.plan_id
  WHERE mm.gym_member_id = v_gym_member_id
    AND mm.status = 'active'
    AND mm.payment_status = 'paid'
    AND COALESCE(mm.freeze_status, '') <> 'frozen'
    AND mp.plan_type IN ('sessions','duration_session')
    AND (mm.end_date IS NULL OR mm.end_date >= v_now::date)
    AND (
      mm.allowed_branch_ids IS NULL
      OR v_studio.branch_id::text = ANY(mm.allowed_branch_ids)
    )
    AND (
      mm.sessions_total IS NULL
      OR COALESCE(mm.sessions_remaining, 0) > 0
    )
  ORDER BY
    CASE mm.source_type WHEN 'subscription' THEN 0 ELSE 1 END,
    mm.end_date ASC NULLS LAST,
    mm.created_at ASC
  LIMIT 1;
  IF NOT FOUND THEN
    -- No usable session-capable bucket. Classify the denial so the client can
    -- show an accurate message.

    -- (a) Member has no active session-capable plan at all.
    IF NOT EXISTS (
      SELECT 1 FROM member_memberships mmx
      JOIN membership_plans mpx ON mpx.id = mmx.plan_id
      WHERE mmx.gym_member_id = v_gym_member_id
        AND mmx.status = 'active'
        AND mmx.payment_status = 'paid'
        AND mpx.plan_type IN ('sessions','duration_session')
    ) THEN
      -- Gym-only plan present → "not included"; otherwise nothing active.
      IF EXISTS (
        SELECT 1 FROM member_memberships mmy
        WHERE mmy.gym_member_id = v_gym_member_id
          AND mmy.status = 'active'
          AND mmy.payment_status = 'paid'
      ) THEN
        RETURN jsonb_build_object('status','denied','reason','studio_access_not_included');
      END IF;
      RETURN jsonb_build_object('status','denied','reason','no_active_membership');
    END IF;

    -- (b) Has a session-capable plan but every usable bucket is spent.
    IF EXISTS (
      SELECT 1 FROM member_memberships mmz
      JOIN membership_plans mpz ON mpz.id = mmz.plan_id
      WHERE mmz.gym_member_id = v_gym_member_id
        AND mmz.status = 'active'
        AND mmz.payment_status = 'paid'
        AND COALESCE(mmz.freeze_status, '') <> 'frozen'
        AND mpz.plan_type IN ('sessions','duration_session')
        AND mmz.sessions_total IS NOT NULL
        AND COALESCE(mmz.sessions_remaining, 0) <= 0
    ) THEN
      RETURN jsonb_build_object('status','denied','reason','sessions_exhausted');
    END IF;

    -- (c) Session-capable plan exists but is frozen / expired / wrong branch.
    RETURN jsonb_build_object('status','denied','reason','no_active_membership');
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

  IF v_booking_id IS NOT NULL THEN
    UPDATE session_bookings SET status = 'attended' WHERE id = v_booking_id;
  END IF;
  INSERT INTO attendance_logs (gym_member_id, gym_id, branch_id, check_in_at, method, access_point, class_session_id, studio_id, specialist_name)
  VALUES (v_gym_member_id, v_studio.gym_id, v_studio.branch_id, CURRENT_TIMESTAMP, 'qr', v_session.class_name, v_session.id, p_studio_id, v_session.instructor);

  -- The selected bucket is always session-capable now. Bounded buckets drop
  -- sessions_remaining; unbounded (sessions_total NULL) only bump sessions_used.
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

  RETURN jsonb_build_object(
    'status', 'allowed', 'session_id', v_session.id,
    'class_name', v_session.class_name, 'session_date', v_session.session_date,
    'start_time', left(v_session.start_time::text, 5), 'end_time', left(v_session.end_time::text, 5),
    'instructor', v_session.instructor, 'studio_name', v_studio.studio_name, 'branch_name', v_studio.branch_name,
    'consumed_bucket', v_membership.mm_id, 'consumed_source_type', v_membership.source_type
  );
END;
$function$;
SQL
        );
    }

    public function down(): void
    {
        // Restore the 2026_05_13 version: any eligible bucket (subscription
        // first) authorizes a studio scan, with no plan-capability gate.
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
         mm.allowed_branch_ids, mm.freeze_status, mm.source_type, mm.end_date,
         mp.plan_type, mp.session_count
  INTO v_membership
  FROM member_memberships mm
  JOIN membership_plans mp ON mp.id = mm.plan_id
  WHERE mm.gym_member_id = v_gym_member_id
    AND mm.status = 'active'
    AND mm.payment_status = 'paid'
    AND COALESCE(mm.freeze_status, '') <> 'frozen'
    AND (mm.end_date IS NULL OR mm.end_date >= v_now::date)
    AND (
      mm.allowed_branch_ids IS NULL
      OR v_studio.branch_id::text = ANY(mm.allowed_branch_ids)
    )
    AND (
      mm.sessions_total IS NULL
      OR COALESCE(mm.sessions_remaining, 0) > 0
    )
  ORDER BY
    CASE mm.source_type WHEN 'subscription' THEN 0 ELSE 1 END,
    mm.end_date ASC NULLS LAST,
    mm.created_at ASC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','denied','reason','no_active_membership');
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

  IF v_booking_id IS NOT NULL THEN
    UPDATE session_bookings SET status = 'attended' WHERE id = v_booking_id;
  END IF;
  INSERT INTO attendance_logs (gym_member_id, gym_id, branch_id, check_in_at, method, access_point, class_session_id, studio_id, specialist_name)
  VALUES (v_gym_member_id, v_studio.gym_id, v_studio.branch_id, CURRENT_TIMESTAMP, 'qr', v_session.class_name, v_session.id, p_studio_id, v_session.instructor);

  IF v_membership.plan_type IN ('sessions', 'duration_session') THEN
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
    'instructor', v_session.instructor, 'studio_name', v_studio.studio_name, 'branch_name', v_studio.branch_name,
    'consumed_bucket', v_membership.mm_id, 'consumed_source_type', v_membership.source_type
  );
END;
$function$;
SQL
        );
    }
};
