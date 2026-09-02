<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The "target month is not empty" guard counted cancelled sessions, but
     * the copy itself skips them (`AND cs.status <> 'cancelled'`). A month
     * whose only sessions were cancelled therefore blocked the copy while
     * containing nothing the copy could collide with — and cancelling is how
     * the admin UI removes a session, so from the user's side the month
     * looked empty and the refusal looked like a bug.
     *
     * Aligns the guard with the copy in both functions. Only the COUNT(*)
     * predicate changes; everything else is byte-identical to the previous
     * definitions.
     */
    public function up(): void
    {
        // ── 3-arg: current month -> next month (the original button) ──
        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.copy_recurring_sessions_to_month(p_gym_id uuid, p_branch_id uuid, p_source_date date DEFAULT CURRENT_DATE)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_source_start  date := date_trunc('month', p_source_date)::date;
  v_source_end    date := (date_trunc('month', p_source_date) + interval '1 month - 1 day')::date;
  v_target_start  date := (date_trunc('month', p_source_date) + interval '1 month')::date;
  v_target_end    date := (date_trunc('month', p_source_date) + interval '2 months - 1 day')::date;
  v_existing      int;
  v_created       int := 0;
  v_templates     int := 0;
  v_pattern       record;
  v_template_id   uuid;
  v_session_date  date;
BEGIN
  IF NOT pg_try_advisory_xact_lock(
       hashtext('copy_month'),
       hashtext(p_gym_id::text || ':' || COALESCE(p_branch_id::text, ''))
     ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'busy');
  END IF;

  -- Cancelled sessions are excluded: the copy below skips them, so they
  -- cannot collide with anything it creates.
  SELECT COUNT(*) INTO v_existing
  FROM class_sessions
  WHERE gym_id = p_gym_id
    AND ((p_branch_id IS NULL AND branch_id IS NULL) OR branch_id = p_branch_id)
    AND session_date BETWEEN v_target_start AND v_target_end
    AND status <> 'cancelled';

  IF v_existing > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'target_month_not_empty',
      'existing_count', v_existing,
      'source_start', v_source_start,
      'source_end', v_source_end,
      'target_start', v_target_start,
      'target_end', v_target_end
    );
  END IF;

  FOR v_pattern IN
    SELECT DISTINCT ON (
        cs.class_id, EXTRACT(DOW FROM cs.session_date)::int,
        cs.start_time, cs.end_time, cs.studio_id, cs.capacity,
        cs.instructor, cs.walk_in_allowed, cs.location
      )
      cs.class_id,
      EXTRACT(DOW FROM cs.session_date)::int AS day_of_week,
      cs.start_time,
      cs.end_time,
      cs.capacity,
      cs.instructor,
      cs.location,
      cs.branch_id,
      cs.studio_id,
      cs.walk_in_allowed
    FROM class_sessions cs
    WHERE cs.gym_id = p_gym_id
      AND ((p_branch_id IS NULL AND cs.branch_id IS NULL) OR cs.branch_id = p_branch_id)
      AND cs.session_date BETWEEN v_source_start AND v_source_end
      AND cs.session_type = 'recurring'
      AND cs.status <> 'cancelled'
    ORDER BY
        cs.class_id, EXTRACT(DOW FROM cs.session_date)::int,
        cs.start_time, cs.end_time, cs.studio_id, cs.capacity,
        cs.instructor, cs.walk_in_allowed, cs.location
  LOOP
    INSERT INTO recurring_session_templates
      (gym_id, class_id, day_of_week, start_time, end_time, capacity, instructor, location)
    VALUES
      (p_gym_id, v_pattern.class_id, v_pattern.day_of_week, v_pattern.start_time, v_pattern.end_time,
       v_pattern.capacity, v_pattern.instructor, v_pattern.location)
    RETURNING id INTO v_template_id;
    v_templates := v_templates + 1;

    FOR v_session_date IN
      SELECT d::date
      FROM generate_series(v_target_start, v_target_end, '1 day'::interval) d
      WHERE EXTRACT(DOW FROM d)::int = v_pattern.day_of_week
    LOOP
      INSERT INTO class_sessions
        (gym_id, class_id, recurring_template_id, session_date, start_time, end_time,
         capacity, instructor, location, session_type, studio_id, branch_id, walk_in_allowed,
         is_published, status)
      VALUES
        (p_gym_id, v_pattern.class_id, v_template_id, v_session_date,
         v_pattern.start_time, v_pattern.end_time,
         v_pattern.capacity, v_pattern.instructor, v_pattern.location, 'recurring',
         v_pattern.studio_id, v_pattern.branch_id, v_pattern.walk_in_allowed,
         false, 'scheduled');
      v_created := v_created + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'created', v_created,
    'templates', v_templates,
    'source_start', v_source_start,
    'source_end', v_source_end,
    'target_start', v_target_start,
    'target_end', v_target_end
  );
END;
$function$;
SQL);

        // ── 4-arg: arbitrary source month -> target month ──
        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.copy_recurring_sessions_between_months(
  p_gym_id      uuid,
  p_branch_id   uuid,
  p_source_date date,
  p_target_date date
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_source_start  date := date_trunc('month', p_source_date)::date;
  v_source_end    date := (date_trunc('month', p_source_date) + interval '1 month - 1 day')::date;
  v_target_start  date := date_trunc('month', p_target_date)::date;
  v_target_end    date := (date_trunc('month', p_target_date) + interval '1 month - 1 day')::date;
  v_this_month    date := date_trunc('month', CURRENT_DATE)::date;
  v_existing      int;
  v_created       int := 0;
  v_templates     int := 0;
  v_pattern       record;
  v_template_id   uuid;
  v_session_date  date;
BEGIN
  IF v_target_start < v_this_month THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'target_in_past',
      'source_start', v_source_start,
      'source_end', v_source_end,
      'target_start', v_target_start,
      'target_end', v_target_end
    );
  END IF;

  IF v_source_start = v_target_start THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'same_month',
      'source_start', v_source_start,
      'source_end', v_source_end,
      'target_start', v_target_start,
      'target_end', v_target_end
    );
  END IF;

  IF NOT pg_try_advisory_xact_lock(
       hashtext('copy_month'),
       hashtext(p_gym_id::text || ':' || COALESCE(p_branch_id::text, ''))
     ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'busy');
  END IF;

  -- Cancelled sessions are excluded: the copy below skips them, so they
  -- cannot collide with anything it creates.
  SELECT COUNT(*) INTO v_existing
  FROM class_sessions
  WHERE gym_id = p_gym_id
    AND ((p_branch_id IS NULL AND branch_id IS NULL) OR branch_id = p_branch_id)
    AND session_date BETWEEN v_target_start AND v_target_end
    AND status <> 'cancelled';

  IF v_existing > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'target_month_not_empty',
      'existing_count', v_existing,
      'source_start', v_source_start,
      'source_end', v_source_end,
      'target_start', v_target_start,
      'target_end', v_target_end
    );
  END IF;

  FOR v_pattern IN
    SELECT DISTINCT ON (
        cs.class_id, EXTRACT(DOW FROM cs.session_date)::int,
        cs.start_time, cs.end_time, cs.studio_id, cs.capacity,
        cs.instructor, cs.walk_in_allowed, cs.location
      )
      cs.class_id,
      EXTRACT(DOW FROM cs.session_date)::int AS day_of_week,
      cs.start_time,
      cs.end_time,
      cs.capacity,
      cs.instructor,
      cs.location,
      cs.branch_id,
      cs.studio_id,
      cs.walk_in_allowed
    FROM class_sessions cs
    WHERE cs.gym_id = p_gym_id
      AND ((p_branch_id IS NULL AND cs.branch_id IS NULL) OR cs.branch_id = p_branch_id)
      AND cs.session_date BETWEEN v_source_start AND v_source_end
      AND cs.session_type = 'recurring'
      AND cs.status <> 'cancelled'
    ORDER BY
        cs.class_id, EXTRACT(DOW FROM cs.session_date)::int,
        cs.start_time, cs.end_time, cs.studio_id, cs.capacity,
        cs.instructor, cs.walk_in_allowed, cs.location
  LOOP
    INSERT INTO recurring_session_templates
      (gym_id, class_id, day_of_week, start_time, end_time, capacity, instructor, location)
    VALUES
      (p_gym_id, v_pattern.class_id, v_pattern.day_of_week, v_pattern.start_time, v_pattern.end_time,
       v_pattern.capacity, v_pattern.instructor, v_pattern.location)
    RETURNING id INTO v_template_id;
    v_templates := v_templates + 1;

    FOR v_session_date IN
      SELECT d::date
      FROM generate_series(v_target_start, v_target_end, '1 day'::interval) d
      WHERE EXTRACT(DOW FROM d)::int = v_pattern.day_of_week
    LOOP
      INSERT INTO class_sessions
        (gym_id, class_id, recurring_template_id, session_date, start_time, end_time,
         capacity, instructor, location, session_type, studio_id, branch_id, walk_in_allowed,
         is_published, status)
      VALUES
        (p_gym_id, v_pattern.class_id, v_template_id, v_session_date,
         v_pattern.start_time, v_pattern.end_time,
         v_pattern.capacity, v_pattern.instructor, v_pattern.location, 'recurring',
         v_pattern.studio_id, v_pattern.branch_id, v_pattern.walk_in_allowed,
         false, 'scheduled');
      v_created := v_created + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'created', v_created,
    'templates', v_templates,
    'source_start', v_source_start,
    'source_end', v_source_end,
    'target_start', v_target_start,
    'target_end', v_target_end
  );
END;
$function$;
SQL);
    }

    public function down(): void
    {
        // Intentionally a no-op: reverting would restore a guard that counts
        // cancelled sessions and blocks legitimate copies. The prior
        // definitions remain in the two migrations that created them.
    }
};
