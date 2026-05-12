<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Reject session transfers when sender or receiver is suspended, inactive,
 * or soft-deleted at the profile level.
 *
 * Background — a typo'd duplicate account ("saraelsallamy@gmail.con") was a
 * valid transfer recipient on prod earlier today. Two transfers (2 sessions
 * total) landed there instead of the real Sara, because the picker
 * (SessionTransferController::lookup) and this PL/pgSQL function both
 * accepted any gym_members row whose `deleted_at IS NULL`, regardless of
 * `status` or `profiles.is_active`. Controller fix in the same PR; this
 * migration is the defense-in-depth so direct API hits (or future paths)
 * can't bypass the active check.
 *
 * Added rejections (new `reason` values mobile clients should map to a
 * friendly error string):
 *   - `sender_not_active`   — the sender's gym_member.status != 'active'
 *                             or profiles.is_active is false. Should never
 *                             happen in practice (login blocks them) but
 *                             the guard is cheap.
 *   - `receiver_not_active` — same for the receiver. This is the one that
 *                             would have stopped the typo'd-Sara incident.
 */
return new class extends Migration {
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.transfer_sessions(p_sender_user_id uuid, p_gym_id uuid, p_receiver_phone text, p_count integer)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_sender_gm        uuid;
  v_receiver_user    uuid;
  v_receiver_name    text;
  v_receiver_photo   text;
  v_receiver_gm      uuid;
  v_total_available  int := 0;
  v_remaining_to_take int;
  v_take             int;
  v_bucket           record;
  v_first_plan_id    uuid;
  v_first_bucket_id  uuid;
  v_first_branch_id  uuid;
  v_first_allowed    text[];
  v_min_end_date     timestamp with time zone;
  v_new_mm_id        uuid;
  v_transfer_id      uuid;
  v_consumed_ids     uuid[] := '{}';
  v_consumed_counts  int[]  := '{}';
  v_consumed_subscription boolean := false;
  v_consumed_transfer     boolean := false;
  i                  int;
BEGIN
  IF p_count IS NULL OR p_count <= 0 THEN
    RETURN jsonb_build_object('status','error','reason','invalid_count');
  END IF;

  -- Sender must be an ACTIVE member in the gym AND have an active profile.
  SELECT gm.id INTO v_sender_gm
  FROM gym_members gm
  JOIN profiles p ON p.id = gm.user_id
  WHERE gm.user_id = p_sender_user_id
    AND gm.gym_id = p_gym_id
    AND gm.deleted_at IS NULL
    AND gm.status = 'active'
    AND p.is_active = true
    AND p.deleted_at IS NULL
  LIMIT 1;
  IF v_sender_gm IS NULL THEN
    -- Disambiguate sender_not_a_member (no gym_member row) vs sender_not_active
    -- so the client can show a useful error.
    IF EXISTS (
      SELECT 1 FROM gym_members
      WHERE user_id = p_sender_user_id AND gym_id = p_gym_id AND deleted_at IS NULL
    ) THEN
      RETURN jsonb_build_object('status','error','reason','sender_not_active');
    END IF;
    RETURN jsonb_build_object('status','error','reason','sender_not_a_member');
  END IF;

  -- Receiver lookup by phone — profile must be active + non-deleted.
  SELECT p.id, p.full_name, p.photo_url
  INTO v_receiver_user, v_receiver_name, v_receiver_photo
  FROM profiles p
  WHERE p.phone = p_receiver_phone
    AND p.is_active = true
    AND p.deleted_at IS NULL
  LIMIT 1;
  IF v_receiver_user IS NULL THEN
    RETURN jsonb_build_object('status','error','reason','receiver_not_found');
  END IF;

  -- Receiver must be an ACTIVE member in the same gym.
  SELECT gm.id INTO v_receiver_gm
  FROM gym_members gm
  WHERE gm.user_id = v_receiver_user
    AND gm.gym_id = p_gym_id
    AND gm.deleted_at IS NULL
    AND gm.status = 'active'
  LIMIT 1;
  IF v_receiver_gm IS NULL THEN
    -- Same disambiguation: do they exist in the gym at all?
    IF EXISTS (
      SELECT 1 FROM gym_members
      WHERE user_id = v_receiver_user AND gym_id = p_gym_id AND deleted_at IS NULL
    ) THEN
      RETURN jsonb_build_object('status','error','reason','receiver_not_active');
    END IF;
    RETURN jsonb_build_object('status','error','reason','receiver_not_in_gym');
  END IF;

  IF v_sender_gm = v_receiver_gm THEN
    RETURN jsonb_build_object('status','error','reason','cannot_transfer_to_self');
  END IF;

  SELECT COALESCE(SUM(mm.sessions_remaining), 0)::int INTO v_total_available
  FROM member_memberships mm
  JOIN membership_plans mp ON mp.id = mm.plan_id
  WHERE mm.gym_member_id = v_sender_gm
    AND mm.status         = 'active'
    AND mm.payment_status = 'paid'
    AND (mm.end_date IS NULL OR mm.end_date >= CURRENT_TIMESTAMP)
    AND mp.plan_type IN ('sessions','duration_session')
    AND COALESCE(mm.sessions_remaining, 0) > 0;

  IF v_total_available < p_count THEN
    RETURN jsonb_build_object(
      'status','error',
      'reason', CASE WHEN v_total_available = 0 THEN 'no_eligible_membership' ELSE 'insufficient_sessions' END,
      'available', v_total_available
    );
  END IF;

  v_remaining_to_take := p_count;
  v_min_end_date := NULL;
  v_new_mm_id := gen_random_uuid();
  v_transfer_id := gen_random_uuid();

  FOR v_bucket IN
    SELECT mm.id, mm.plan_id, mm.sessions_remaining, mm.allowed_branch_ids,
           mm.branch_id, mm.end_date, mm.source_type
    FROM member_memberships mm
    JOIN membership_plans mp ON mp.id = mm.plan_id
    WHERE mm.gym_member_id = v_sender_gm
      AND mm.status         = 'active'
      AND mm.payment_status = 'paid'
      AND (mm.end_date IS NULL OR mm.end_date >= CURRENT_TIMESTAMP)
      AND mp.plan_type IN ('sessions','duration_session')
      AND COALESCE(mm.sessions_remaining, 0) > 0
    ORDER BY
      CASE mm.source_type WHEN 'subscription' THEN 0 ELSE 1 END,
      mm.end_date ASC NULLS LAST,
      mm.created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining_to_take <= 0;

    IF v_first_bucket_id IS NULL THEN
      v_first_bucket_id := v_bucket.id;
      v_first_plan_id   := v_bucket.plan_id;
      v_first_branch_id := v_bucket.branch_id;
      v_first_allowed   := v_bucket.allowed_branch_ids;
    END IF;

    v_take := LEAST(v_bucket.sessions_remaining, v_remaining_to_take);

    UPDATE member_memberships
    SET sessions_remaining = sessions_remaining - v_take,
        sessions_total     = GREATEST(0, COALESCE(sessions_total, 0) - v_take),
        updated_at         = now()
    WHERE id = v_bucket.id;

    IF v_bucket.end_date IS NOT NULL THEN
      IF v_min_end_date IS NULL OR v_bucket.end_date < v_min_end_date THEN
        v_min_end_date := v_bucket.end_date;
      END IF;
    END IF;

    v_consumed_ids := array_append(v_consumed_ids, v_bucket.id);
    v_consumed_counts := array_append(v_consumed_counts, v_take);

    IF v_bucket.source_type = 'subscription' THEN
      v_consumed_subscription := true;
    ELSE
      v_consumed_transfer := true;
    END IF;

    v_remaining_to_take := v_remaining_to_take - v_take;
  END LOOP;

  IF v_remaining_to_take > 0 THEN
    RAISE EXCEPTION 'transfer_sessions: failed to fulfil count, remaining=%', v_remaining_to_take;
  END IF;

  INSERT INTO member_memberships (
    id, gym_member_id, plan_id, status, start_date, end_date,
    sessions_total, sessions_used, sessions_remaining,
    original_price, discount_amount, final_price,
    gym_id, payment_status, transferred_from, source_type,
    branch_id, allowed_branch_ids, created_at, updated_at
  ) VALUES (
    v_new_mm_id, v_receiver_gm, v_first_plan_id, 'active', now(), v_min_end_date,
    p_count, 0, p_count,
    0, 0, 0,
    p_gym_id, 'paid', v_first_bucket_id, 'transfer',
    v_first_branch_id, v_first_allowed, now(), now()
  );

  FOR i IN 1 .. array_length(v_consumed_ids, 1) LOOP
    INSERT INTO session_transfers (
      id, gym_id, sender_gym_member_id, receiver_gym_member_id,
      source_membership_id, receiver_membership_id, count, created_at
    ) VALUES (
      gen_random_uuid(), p_gym_id, v_sender_gm, v_receiver_gm,
      v_consumed_ids[i], v_new_mm_id, v_consumed_counts[i], now()
    );
  END LOOP;

  RETURN jsonb_build_object(
    'status','ok',
    'transfer_id', v_transfer_id,
    'receiver_full_name', v_receiver_name,
    'receiver_photo_url', v_receiver_photo,
    'count', p_count,
    'consumed_subscription', v_consumed_subscription,
    'consumed_transfer', v_consumed_transfer,
    'receiver_membership_id', v_new_mm_id,
    'consumed_buckets', array_length(v_consumed_ids, 1)
  );
END;
$function$;
SQL
        );
    }

    public function down(): void
    {
        // Restore the prior body (without the sender/receiver active checks).
        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.transfer_sessions(p_sender_user_id uuid, p_gym_id uuid, p_receiver_phone text, p_count integer)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_sender_gm        uuid;
  v_receiver_user    uuid;
  v_receiver_name    text;
  v_receiver_photo   text;
  v_receiver_gm      uuid;
  v_total_available  int := 0;
  v_remaining_to_take int;
  v_take             int;
  v_bucket           record;
  v_first_plan_id    uuid;
  v_first_bucket_id  uuid;
  v_first_branch_id  uuid;
  v_first_allowed    text[];
  v_min_end_date     timestamp with time zone;
  v_new_mm_id        uuid;
  v_transfer_id      uuid;
  v_consumed_ids     uuid[] := '{}';
  v_consumed_counts  int[]  := '{}';
  v_consumed_subscription boolean := false;
  v_consumed_transfer     boolean := false;
  i                  int;
BEGIN
  IF p_count IS NULL OR p_count <= 0 THEN
    RETURN jsonb_build_object('status','error','reason','invalid_count');
  END IF;

  SELECT gm.id INTO v_sender_gm
  FROM gym_members gm
  WHERE gm.user_id = p_sender_user_id AND gm.gym_id = p_gym_id AND gm.deleted_at IS NULL
  LIMIT 1;
  IF v_sender_gm IS NULL THEN
    RETURN jsonb_build_object('status','error','reason','sender_not_a_member');
  END IF;

  SELECT p.id, p.full_name, p.photo_url
  INTO v_receiver_user, v_receiver_name, v_receiver_photo
  FROM profiles p
  WHERE p.phone = p_receiver_phone
  LIMIT 1;
  IF v_receiver_user IS NULL THEN
    RETURN jsonb_build_object('status','error','reason','receiver_not_found');
  END IF;

  SELECT gm.id INTO v_receiver_gm
  FROM gym_members gm
  WHERE gm.user_id = v_receiver_user AND gm.gym_id = p_gym_id AND gm.deleted_at IS NULL
  LIMIT 1;
  IF v_receiver_gm IS NULL THEN
    RETURN jsonb_build_object('status','error','reason','receiver_not_in_gym');
  END IF;

  IF v_sender_gm = v_receiver_gm THEN
    RETURN jsonb_build_object('status','error','reason','cannot_transfer_to_self');
  END IF;

  SELECT COALESCE(SUM(mm.sessions_remaining), 0)::int INTO v_total_available
  FROM member_memberships mm
  JOIN membership_plans mp ON mp.id = mm.plan_id
  WHERE mm.gym_member_id = v_sender_gm
    AND mm.status         = 'active'
    AND mm.payment_status = 'paid'
    AND (mm.end_date IS NULL OR mm.end_date >= CURRENT_TIMESTAMP)
    AND mp.plan_type IN ('sessions','duration_session')
    AND COALESCE(mm.sessions_remaining, 0) > 0;

  IF v_total_available < p_count THEN
    RETURN jsonb_build_object(
      'status','error',
      'reason', CASE WHEN v_total_available = 0 THEN 'no_eligible_membership' ELSE 'insufficient_sessions' END,
      'available', v_total_available
    );
  END IF;

  v_remaining_to_take := p_count;
  v_min_end_date := NULL;
  v_new_mm_id := gen_random_uuid();
  v_transfer_id := gen_random_uuid();

  FOR v_bucket IN
    SELECT mm.id, mm.plan_id, mm.sessions_remaining, mm.allowed_branch_ids,
           mm.branch_id, mm.end_date, mm.source_type
    FROM member_memberships mm
    JOIN membership_plans mp ON mp.id = mm.plan_id
    WHERE mm.gym_member_id = v_sender_gm
      AND mm.status         = 'active'
      AND mm.payment_status = 'paid'
      AND (mm.end_date IS NULL OR mm.end_date >= CURRENT_TIMESTAMP)
      AND mp.plan_type IN ('sessions','duration_session')
      AND COALESCE(mm.sessions_remaining, 0) > 0
    ORDER BY
      CASE mm.source_type WHEN 'subscription' THEN 0 ELSE 1 END,
      mm.end_date ASC NULLS LAST,
      mm.created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining_to_take <= 0;

    IF v_first_bucket_id IS NULL THEN
      v_first_bucket_id := v_bucket.id;
      v_first_plan_id   := v_bucket.plan_id;
      v_first_branch_id := v_bucket.branch_id;
      v_first_allowed   := v_bucket.allowed_branch_ids;
    END IF;

    v_take := LEAST(v_bucket.sessions_remaining, v_remaining_to_take);

    UPDATE member_memberships
    SET sessions_remaining = sessions_remaining - v_take,
        sessions_total     = GREATEST(0, COALESCE(sessions_total, 0) - v_take),
        updated_at         = now()
    WHERE id = v_bucket.id;

    IF v_bucket.end_date IS NOT NULL THEN
      IF v_min_end_date IS NULL OR v_bucket.end_date < v_min_end_date THEN
        v_min_end_date := v_bucket.end_date;
      END IF;
    END IF;

    v_consumed_ids := array_append(v_consumed_ids, v_bucket.id);
    v_consumed_counts := array_append(v_consumed_counts, v_take);

    IF v_bucket.source_type = 'subscription' THEN
      v_consumed_subscription := true;
    ELSE
      v_consumed_transfer := true;
    END IF;

    v_remaining_to_take := v_remaining_to_take - v_take;
  END LOOP;

  IF v_remaining_to_take > 0 THEN
    RAISE EXCEPTION 'transfer_sessions: failed to fulfil count, remaining=%', v_remaining_to_take;
  END IF;

  INSERT INTO member_memberships (
    id, gym_member_id, plan_id, status, start_date, end_date,
    sessions_total, sessions_used, sessions_remaining,
    original_price, discount_amount, final_price,
    gym_id, payment_status, transferred_from, source_type,
    branch_id, allowed_branch_ids, created_at, updated_at
  ) VALUES (
    v_new_mm_id, v_receiver_gm, v_first_plan_id, 'active', now(), v_min_end_date,
    p_count, 0, p_count,
    0, 0, 0,
    p_gym_id, 'paid', v_first_bucket_id, 'transfer',
    v_first_branch_id, v_first_allowed, now(), now()
  );

  FOR i IN 1 .. array_length(v_consumed_ids, 1) LOOP
    INSERT INTO session_transfers (
      id, gym_id, sender_gym_member_id, receiver_gym_member_id,
      source_membership_id, receiver_membership_id, count, created_at
    ) VALUES (
      gen_random_uuid(), p_gym_id, v_sender_gm, v_receiver_gm,
      v_consumed_ids[i], v_new_mm_id, v_consumed_counts[i], now()
    );
  END LOOP;

  RETURN jsonb_build_object(
    'status','ok',
    'transfer_id', v_transfer_id,
    'receiver_full_name', v_receiver_name,
    'receiver_photo_url', v_receiver_photo,
    'count', p_count,
    'consumed_subscription', v_consumed_subscription,
    'consumed_transfer', v_consumed_transfer,
    'receiver_membership_id', v_new_mm_id,
    'consumed_buckets', array_length(v_consumed_ids, 1)
  );
END;
$function$;
SQL
        );
    }
};
