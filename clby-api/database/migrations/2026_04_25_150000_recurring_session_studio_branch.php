<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Drop the previous 8-arg signature so the new one with studio_id +
        // branch_id can replace it. Postgres treats different arities as
        // distinct functions; CREATE OR REPLACE alone won't free the old name.
        DB::unprepared('DROP FUNCTION IF EXISTS public.create_recurring_session(uuid, uuid, date, time, time, integer, text, text);');

        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.create_recurring_session(
    p_gym_id     uuid,
    p_class_id   uuid,
    p_start_date date,
    p_start_time time without time zone,
    p_end_time   time without time zone,
    p_capacity   integer DEFAULT NULL,
    p_instructor text    DEFAULT NULL,
    p_location   text    DEFAULT NULL,
    p_studio_id  uuid    DEFAULT NULL,
    p_branch_id  uuid    DEFAULT NULL
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

  -- Generate next 4 weeks of sessions, each pinned to the requested studio + branch.
  FOR i IN 0..3 LOOP
    v_date := p_start_date + (i * 7);
    INSERT INTO public.class_sessions
      (gym_id, class_id, recurring_template_id, session_date, start_time, end_time,
       capacity, instructor, location, session_type, studio_id, branch_id)
    VALUES
      (p_gym_id, p_class_id, v_template_id, v_date, p_start_time, p_end_time,
       p_capacity, p_instructor, p_location, 'recurring', p_studio_id, p_branch_id);
  END LOOP;

  RETURN v_template_id;
END;
$function$;
SQL);
    }

    public function down(): void
    {
        // No rollback.
    }
};
