<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Auto-pin the in-force contract terms version onto every new payment.
 *
 * Payments are created from at least six different code paths
 * (admin record-payment, Paymob webhook, membership assignment,
 * renewals, member signup, service packages). Patching each one would
 * silently miss any future path, and an unpinned invoice quietly falls
 * back to "latest terms" — the exact bug versioning exists to prevent.
 *
 * A BEFORE INSERT trigger makes the pin unconditional: whatever creates
 * the row, it records the terms that were in force at that moment.
 * An explicitly supplied contract_terms_id is respected (backfills /
 * data migrations), and gyms with no published terms simply stay NULL.
 */
return new class extends Migration {
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
CREATE OR REPLACE FUNCTION public.pin_contract_terms_on_payment()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.contract_terms_id IS NULL AND NEW.gym_id IS NOT NULL THEN
    SELECT t.id INTO NEW.contract_terms_id
    FROM public.gym_contract_terms t
    WHERE t.gym_id = NEW.gym_id
    ORDER BY t.terms_version DESC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$function$
SQL
        );

        DB::statement('DROP TRIGGER IF EXISTS pin_contract_terms_on_payment_trg ON public.payments');
        DB::statement(<<<'SQL'
CREATE TRIGGER pin_contract_terms_on_payment_trg
BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.pin_contract_terms_on_payment()
SQL
        );
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS pin_contract_terms_on_payment_trg ON public.payments');
        DB::statement('DROP FUNCTION IF EXISTS public.pin_contract_terms_on_payment()');
    }
};
