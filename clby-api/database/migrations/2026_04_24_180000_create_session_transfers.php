<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('session_transfers', function ($table) {
            $table->uuid('id')->primary();
            $table->uuid('gym_id');
            $table->uuid('sender_gym_member_id');
            $table->uuid('receiver_gym_member_id');
            $table->uuid('source_membership_id');
            $table->uuid('receiver_membership_id');
            $table->integer('count');
            $table->timestampTz('created_at')->useCurrent();

            $table->foreign('gym_id')->references('id')->on('gyms')->cascadeOnDelete();
            $table->foreign('sender_gym_member_id')->references('id')->on('gym_members');
            $table->foreign('receiver_gym_member_id')->references('id')->on('gym_members');
            $table->foreign('source_membership_id')->references('id')->on('member_memberships');
            $table->foreign('receiver_membership_id')->references('id')->on('member_memberships');

            $table->index(['sender_gym_member_id', 'created_at']);
            $table->index(['receiver_gym_member_id', 'created_at']);
        });

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

  -- Sender gym_member
  SELECT gm.id INTO v_sender_gm
  FROM gym_members gm
  WHERE gm.user_id = p_sender_user_id AND gm.gym_id = p_gym_id AND gm.deleted_at IS NULL
  LIMIT 1;
  IF v_sender_gm IS NULL THEN
    RETURN jsonb_build_object('status','error','reason','sender_not_a_member');
  END IF;

  -- Receiver profile + gym_member in same gym
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

  -- Sender's active, paid, session-capable, non-expired membership
  SELECT mm.id, mm.plan_id, mm.sessions_remaining, mm.sessions_total, mm.allowed_branch_ids,
         mm.branch_id, mp.plan_type
  INTO v_src_mm
  FROM member_memberships mm
  JOIN membership_plans mp ON mp.id = mm.plan_id
  WHERE mm.gym_member_id = v_sender_gm
    AND mm.status = 'active'
    AND mm.payment_status = 'paid'
    AND (mm.end_date IS NULL OR mm.end_date >= CURRENT_TIMESTAMP)
    AND mp.plan_type IN ('sessions','duration_session')
    AND COALESCE(mm.sessions_remaining, 0) > 0
  ORDER BY mm.start_date DESC
  LIMIT 1
  FOR UPDATE;
  IF v_src_mm IS NULL THEN
    RETURN jsonb_build_object('status','error','reason','no_eligible_membership');
  END IF;
  IF v_src_mm.sessions_remaining < p_count THEN
    RETURN jsonb_build_object('status','error','reason','insufficient_sessions',
      'available', v_src_mm.sessions_remaining);
  END IF;

  -- Decrement sender: remaining AND total both drop, so the sender's UI shows
  -- only the reduced balance (no "sent X" anywhere on their side).
  UPDATE member_memberships
  SET sessions_remaining = sessions_remaining - p_count,
      sessions_total     = GREATEST(0, COALESCE(sessions_total, 0) - p_count),
      updated_at         = now()
  WHERE id = v_src_mm.id;

  -- Create receiver membership row. end_date NULL = never expires.
  v_new_mm_id := gen_random_uuid();
  INSERT INTO member_memberships (
    id, gym_member_id, plan_id, status, start_date, end_date,
    sessions_total, sessions_used, sessions_remaining,
    original_price, discount_amount, final_price,
    gym_id, payment_status, transferred_from,
    branch_id, allowed_branch_ids, created_at, updated_at
  ) VALUES (
    v_new_mm_id, v_receiver_gm, v_src_mm.plan_id, 'active', now(), NULL,
    p_count, 0, p_count,
    0, 0, 0,
    p_gym_id, 'paid', v_src_mm.id,
    v_src_mm.branch_id, v_src_mm.allowed_branch_ids, now(), now()
  );

  -- Audit log
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
    'count', p_count
  );
END;
$function$;
SQL);
    }

    public function down(): void
    {
        DB::unprepared('DROP FUNCTION IF EXISTS public.transfer_sessions(uuid, uuid, text, int);');
        Schema::dropIfExists('session_transfers');
    }
};
