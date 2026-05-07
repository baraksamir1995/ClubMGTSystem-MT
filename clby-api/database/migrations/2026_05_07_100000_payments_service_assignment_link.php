<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Add `payments.service_assignment_id` so the Paymob webhook can
     * activate the corresponding `member_service_assignments` row when
     * a service-package payment is confirmed.
     *
     * Mirrors `payments.membership_id` (already exists), which the webhook
     * uses to flip `member_memberships.payment_status` to paid.
     */
    public function up(): void
    {
        DB::statement('ALTER TABLE payments ADD COLUMN IF NOT EXISTS service_assignment_id uuid');
        DB::statement('CREATE INDEX IF NOT EXISTS idx_payments_service_assignment ON payments(service_assignment_id) WHERE service_assignment_id IS NOT NULL');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS idx_payments_service_assignment');
        DB::statement('ALTER TABLE payments DROP COLUMN IF EXISTS service_assignment_id');
    }
};
