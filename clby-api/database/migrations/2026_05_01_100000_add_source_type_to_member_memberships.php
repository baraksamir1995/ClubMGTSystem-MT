<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Explicit bucket source. Until now we used `transferred_from IS NULL`
        // as a proxy; an explicit column is clearer and lets us drop the
        // proxy from access predicates and ORDER BY clauses.
        Schema::table('member_memberships', function ($table) {
            $table->string('source_type', 20)->default('subscription')->nullable(false);
        });

        // Backfill from the existing proxy. transferred_from NOT NULL means
        // the row was minted by transfer_sessions(); everything else is a
        // direct subscription/purchase.
        DB::statement(<<<'SQL'
            UPDATE member_memberships
            SET source_type = 'transfer'
            WHERE transferred_from IS NOT NULL
        SQL);

        // Constrain values so no other writer can sneak a third type in.
        DB::statement(<<<'SQL'
            ALTER TABLE member_memberships
            ADD CONSTRAINT member_memberships_source_type_check
            CHECK (source_type IN ('subscription', 'transfer'))
        SQL);

        // Business rule: a member can have at most one active subscription
        // bucket at a time per gym. Transfers can stack; subscriptions cannot.
        // Fail loudly if existing data violates the rule so we know to clean
        // up before enforcing.
        DB::statement(<<<'SQL'
            DO $$
            DECLARE
              v_offenders int;
            BEGIN
              SELECT COUNT(*) INTO v_offenders FROM (
                SELECT gym_member_id
                FROM member_memberships
                WHERE source_type = 'subscription'
                  AND status = 'active'
                  AND payment_status = 'paid'
                GROUP BY gym_member_id
                HAVING COUNT(*) > 1
              ) t;
              IF v_offenders > 0 THEN
                RAISE EXCEPTION
                  'Cannot enforce one-subscription-per-member: % gym_members have multiple active+paid subscription rows. Resolve duplicates before re-running.',
                  v_offenders;
              END IF;
            END $$;
        SQL);

        DB::statement(<<<'SQL'
            CREATE UNIQUE INDEX idx_one_active_subscription_per_member
            ON member_memberships (gym_member_id)
            WHERE source_type = 'subscription'
              AND status = 'active'
              AND payment_status = 'paid'
        SQL);
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS idx_one_active_subscription_per_member');
        DB::statement('ALTER TABLE member_memberships DROP CONSTRAINT IF EXISTS member_memberships_source_type_check');
        Schema::table('member_memberships', function ($table) {
            $table->dropColumn('source_type');
        });
    }
};
