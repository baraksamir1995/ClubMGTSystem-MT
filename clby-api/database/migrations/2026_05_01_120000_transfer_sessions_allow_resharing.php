<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Allow re-sharing: receivers of a transfer can pass sessions on to
        // a third member. The function now picks any eligible bucket
        // (subscription OR transfer) to debit, preferring subscriptions and
        // earliest-expiring within each group — same priority as consumption
        // so the sender drains their own paid-for sessions first and
        // received gifts last.
        //
        // The receiver's new row inherits the *picked source bucket's*
        // expiry, so re-shares can never extend the original expiry chain.
        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.transfer_sessions(
    p_sender_user_id uuid,
    p_gym_id         uuid,
    p_receiver_phone text,
    p_count          int
) RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  v_sender_gm       uuid;
  v_receiver_user   uuid;
  v_receiver_name   text;
  v_receiver_photo  text;
  v_receiver_gm     uuid;
  v_src_mm          record;
  v_new_mm_id       uuid;
  v_transfer_id     uuid;
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

  -- Pick the highest-priority eligible bucket. Subscription first, then
  -- transfers, earliest end_date inside each group, so sender preserves
  -- their longest-dated entitlements as long as possible.
  SELECT mm.id, mm.plan_id, mm.sessions_remaining, mm.sessions_total,
         mm.allowed_branch_ids, mm.branch_id, mm.end_date, mm.source_type,
         mp.plan_type
  INTO v_src_mm
  FROM member_memberships mm
  JOIN membership_plans mp ON mp.id = mm.plan_id
  WHERE mm.gym_member_id = v_sender_gm
    AND mm.status         = 'active'
    AND mm.payment_status = 'paid'
    AND (mm.end_date IS NULL OR mm.end_date >= CURRENT_TIMESTAMP)
    AND mp.plan_type IN ('sessions','duration_session')
    AND COALESCE(mm.sessions_remaining, 0) >= p_count
  ORDER BY
    CASE mm.source_type WHEN 'subscription' THEN 0 ELSE 1 END,
    mm.end_date ASC NULLS LAST,
    mm.created_at ASC
  LIMIT 1
  FOR UPDATE;
  IF v_src_mm IS NULL THEN
    RETURN jsonb_build_object('status','error','reason','no_eligible_membership');
  END IF;

  -- Decrement the chosen bucket: both remaining and total drop, hiding the
  -- transferred amount entirely from the sender's UI on this row.
  UPDATE member_memberships
  SET sessions_remaining = sessions_remaining - p_count,
      sessions_total     = GREATEST(0, COALESCE(sessions_total, 0) - p_count),
      updated_at         = now()
  WHERE id = v_src_mm.id;

  -- Receiver bucket: source_type='transfer', expiry copied from the picked
  -- bucket (which itself may already be a transfer chain).
  v_new_mm_id := gen_random_uuid();
  INSERT INTO member_memberships (
    id, gym_member_id, plan_id, status, start_date, end_date,
    sessions_total, sessions_used, sessions_remaining,
    original_price, discount_amount, final_price,
    gym_id, payment_status, transferred_from, source_type,
    branch_id, allowed_branch_ids, created_at, updated_at
  ) VALUES (
    v_new_mm_id, v_receiver_gm, v_src_mm.plan_id, 'active', now(), v_src_mm.end_date,
    p_count, 0, p_count,
    0, 0, 0,
    p_gym_id, 'paid', v_src_mm.id, 'transfer',
    v_src_mm.branch_id, v_src_mm.allowed_branch_ids, now(), now()
  );

  v_transfer_id := gen_random_uuid();
  INSERT INTO session_transfers (
    id, gym_id, sender_gym_member_id, receiver_gym_member_id,
    source_membership_id, receiver_membership_id, count, created_at
  ) VALUES (
    v_transfer_id, p_gym_id, v_sender_gm, v_receiver_gm,
    v_src_mm.id, v_new_mm_id, p_count, now()
  );

  RETURN jsonb_build_object(
    'status','ok',
    'transfer_id', v_transfer_id,
    'receiver_full_name', v_receiver_name,
    'receiver_photo_url', v_receiver_photo,
    'count', p_count,
    'consumed_source_type', v_src_mm.source_type
  );
END;
$function$;
SQL);
    }

    public function down(): void
    {
        // No-op rollback. Reverting would lock down re-sharing and might
        // leave already-completed transfer chains in an inconsistent state.
    }
};
