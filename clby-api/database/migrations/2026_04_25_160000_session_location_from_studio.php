<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Backfill: any existing class_sessions row with a studio set but no
        // free-text location gets the studio name copied in. The mobile app
        // reads this field for display.
        DB::statement(<<<'SQL'
UPDATE class_sessions cs
   SET location = s.name
  FROM studios s
 WHERE cs.studio_id = s.id
   AND cs.studio_id IS NOT NULL
   AND (cs.location IS NULL OR cs.location = '');
SQL);

        // Trigger: keep location in sync with the studio name on insert /
        // update, but only when location wasn't explicitly set. This way
        // older mobile builds that read only the legacy location column
        // still see the studio, and admins who type a custom location
        // (e.g. "Outdoor Patio") aren't overridden.
        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.tg_class_sessions_fill_location_from_studio()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.studio_id IS NOT NULL
     AND (NEW.location IS NULL OR NEW.location = '') THEN
    SELECT name INTO NEW.location FROM studios WHERE id = NEW.studio_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS class_sessions_fill_location ON public.class_sessions;
CREATE TRIGGER class_sessions_fill_location
BEFORE INSERT OR UPDATE OF studio_id, location
ON public.class_sessions
FOR EACH ROW EXECUTE FUNCTION public.tg_class_sessions_fill_location_from_studio();
SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
DROP TRIGGER IF EXISTS class_sessions_fill_location ON public.class_sessions;
DROP FUNCTION IF EXISTS public.tg_class_sessions_fill_location_from_studio();
SQL);
    }
};
