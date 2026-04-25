<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Generate the next 4 weeks of recurring sessions instead of 12 —
        // admins regenerate as needed and don't want a full quarter of rows
        // sitting around when the schedule isn't yet stable.
        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.create_recurring_session(
    p_gym_id     uuid,
    p_class_id   uuid,
    p_start_date date,
    p_start_time time without time zone,
    p_end_time   time without time zone,
    p_capacity   integer DEFAULT NULL,
    p_instructor text    DEFAULT NULL,
    p_location   text    DEFAULT NULL
) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $function$
DECLARE
  v_template_id uuid;
  v_date        date;
BEGIN
  INSERT INTO public.recurring_session_templates
    (gym_id, class_id, day_of_week, start_time, end_time, capacity, instructor, location)
  VALUES
    (p_gym_id, p_class_id, EXTRACT(DOW FROM p_start_date)::int, p_start_time, p_end_time, p_capacity,
     p_instructor, p_location)
  RETURNING id INTO v_template_id;

  -- Generate next 4 weeks of sessions (was 12).
  FOR i IN 0..3 LOOP
    v_date := p_start_date + (i * 7);
    INSERT INTO public.class_sessions
      (gym_id, class_id, recurring_template_id, session_date, start_time, end_time,
       capacity, instructor, location, session_type)
    VALUES
      (p_gym_id, p_class_id, v_template_id, v_date, p_start_time, p_end_time,
       p_capacity, p_instructor, p_location, 'recurring');
  END LOOP;

  RETURN v_template_id;
END;
$function$;
SQL);
    }

    public function down(): void
    {
        // No rollback — this is a UX/scope change, not a schema change.
    }
};
