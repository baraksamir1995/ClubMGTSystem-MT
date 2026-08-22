<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Indexes for the Memberships sub-tab (MembershipController::index).
 *
 * That endpoint runs three passes over member_memberships per request —
 * count, page, and summary — and none of the pre-existing indexes cover
 * them: member_memberships had only the PK plus two partial indexes whose
 * predicates require status='active', which the tab's queries do not
 * constrain (they list expired and cancelled rows too).
 *
 * CONCURRENTLY so this is safe to run against a live gym; that requires
 * running outside a transaction, hence $withinTransaction = false.
 */
return new class extends Migration
{
    public $withinTransaction = false;

    public function up(): void
    {
        // Main list: WHERE mm.gym_id = ? ORDER BY end_date. Was a full scan
        // of the gym's rows plus an external sort on every page request.
        DB::statement('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_member_memberships_gym_end_date
            ON member_memberships (gym_id, end_date)');

        // New/Renew classification. The correlated EXISTS runs once per
        // returned row and probes exactly these four columns; without a
        // covering index each probe fell back to the PK-only table.
        DB::statement("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_member_memberships_kind_lookup
            ON member_memberships (gym_member_id, gym_id, start_date, created_at, id)
            WHERE source_type = 'subscription' AND payment_status = 'paid'");

        // last_check_in_at LATERAL. attendance_logs had (gym_id, check_in_at
        // DESC) and (gym_member_id) separately, but not the composite the
        // LATERAL's ORDER BY ... LIMIT 1 needs — so it sorted a per-member
        // bucket for every row on the page.
        DB::statement('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_attendance_logs_member_checkin
            ON attendance_logs (gym_member_id, check_in_at DESC)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX CONCURRENTLY IF EXISTS idx_member_memberships_gym_end_date');
        DB::statement('DROP INDEX CONCURRENTLY IF EXISTS idx_member_memberships_kind_lookup');
        DB::statement('DROP INDEX CONCURRENTLY IF EXISTS idx_attendance_logs_member_checkin');
    }
};
