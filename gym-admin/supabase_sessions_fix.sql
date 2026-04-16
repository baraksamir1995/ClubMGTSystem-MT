-- ─── 1. Add sessions_used column (safe to run multiple times) ───────────────
ALTER TABLE member_memberships
  ADD COLUMN IF NOT EXISTS sessions_used integer NOT NULL DEFAULT 0;

-- ─── 2. Back-fill existing sessions memberships ───────────────────────────────
-- If sessions_remaining exists, derive sessions_used from it.
-- This is a best-effort back-fill; safe to skip if the column is brand new.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'member_memberships'
      AND column_name = 'sessions_remaining'
  ) THEN
    UPDATE member_memberships mm
    SET sessions_used = GREATEST(0, COALESCE(mp.session_count, 0) - COALESCE(mm.sessions_remaining, mp.session_count, 0))
    FROM membership_plans mp
    WHERE mp.id = mm.plan_id
      AND mp.plan_type = 'sessions'
      AND mm.sessions_used = 0
      AND mm.sessions_remaining IS NOT NULL;
  END IF;
END
$$;

-- ─── 3. RPC: consume one session (SECURITY DEFINER bypasses RLS) ─────────────
CREATE OR REPLACE FUNCTION consume_class_session(p_gym_member_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership_id  uuid;
  v_session_count  integer;
  v_sessions_used  integer;
  v_new_used       integer;
BEGIN
  -- Find the active sessions-plan membership for this member
  SELECT mm.id, mp.session_count, COALESCE(mm.sessions_used, 0)
    INTO v_membership_id, v_session_count, v_sessions_used
    FROM member_memberships mm
    JOIN membership_plans   mp ON mp.id = mm.plan_id
   WHERE mm.gym_member_id = p_gym_member_id
     AND mm.status        = 'active'
     AND mp.plan_type     IN ('sessions', 'duration_session')
   LIMIT 1;

  IF v_membership_id IS NULL THEN
    RETURN jsonb_build_object('updated', false, 'reason', 'no_sessions_plan');
  END IF;

  -- Increment, capped at session_count (if finite)
  v_new_used := v_sessions_used + 1;
  IF v_session_count IS NOT NULL AND v_new_used > v_session_count THEN
    v_new_used := v_session_count;
  END IF;

  UPDATE member_memberships
     SET sessions_used = v_new_used
   WHERE id = v_membership_id;

  RETURN jsonb_build_object(
    'updated',             true,
    'membership_id',       v_membership_id,
    'sessions_used',       v_new_used,
    'sessions_remaining',  GREATEST(0, COALESCE(v_session_count, 0) - v_new_used)
  );
END;
$$;

-- Grant execute to the authenticated role so the mobile app can call it
GRANT EXECUTE ON FUNCTION consume_class_session(uuid) TO authenticated;
