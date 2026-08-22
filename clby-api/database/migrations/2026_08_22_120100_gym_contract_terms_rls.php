<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * RLS for gym_contract_terms, matching the existing tenant convention
 * used by promo_codes / gym_notifications: SELECT is limited to the
 * caller's own gyms via my_gym_ids(); writes are denied at the RLS
 * layer because all mutations go through the Laravel API (which
 * connects as an owner role and enforces gym scoping + the
 * `permission:settings,edit` middleware in-app).
 *
 * This is defence-in-depth, not the primary control — the primary
 * control is that every query in ContractTermsController is filtered
 * by a server-derived gym_id that the client cannot influence.
 */
return new class extends Migration {
    public function up(): void
    {
        DB::statement('ALTER TABLE public.gym_contract_terms ENABLE ROW LEVEL SECURITY');

        DB::statement("CREATE POLICY gym_contract_terms_select ON public.gym_contract_terms
                       FOR SELECT USING (gym_id = ANY (my_gym_ids()))");
        DB::statement("CREATE POLICY gym_contract_terms_insert ON public.gym_contract_terms
                       FOR INSERT WITH CHECK (false)");
        DB::statement("CREATE POLICY gym_contract_terms_update ON public.gym_contract_terms
                       FOR UPDATE USING (false)");
        DB::statement("CREATE POLICY gym_contract_terms_delete ON public.gym_contract_terms
                       FOR DELETE USING (false)");
    }

    public function down(): void
    {
        DB::statement('DROP POLICY IF EXISTS gym_contract_terms_select ON public.gym_contract_terms');
        DB::statement('DROP POLICY IF EXISTS gym_contract_terms_insert ON public.gym_contract_terms');
        DB::statement('DROP POLICY IF EXISTS gym_contract_terms_update ON public.gym_contract_terms');
        DB::statement('DROP POLICY IF EXISTS gym_contract_terms_delete ON public.gym_contract_terms');
        DB::statement('ALTER TABLE public.gym_contract_terms DISABLE ROW LEVEL SECURITY');
    }
};
