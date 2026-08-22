<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Freeze the package balance onto each attendance row.
 *
 * The listing previously derived "sessions remaining" by joining live to
 * `member_service_assignments`, so every historical row re-rendered with
 * the package's *current* balance: deduct a session today and yesterday's
 * row silently changed too. An attendance record is a historical fact —
 * it must keep the balance it produced at the time.
 *
 * `sessions_remaining_after` is the authoritative display value:
 *   • attended  → the balance the deduction left behind
 *   • absent / cancelled → the balance at that moment (nothing deducted)
 *
 * `sessions_total_at` is stored alongside so the "3 / 10" pairing stays
 * correct even if the package is later resized.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_attendance', function (Blueprint $table) {
            $table->integer('sessions_remaining_after')->nullable();
            $table->integer('sessions_total_at')->nullable();
        });

        // Backfill existing rows by replaying history per package.
        //
        // Walking each assignment's attendance in chronological order and
        // counting the deducting rows reconstructs what the balance was
        // after each one. Reversed rows are excluded from the running
        // count because their session was given back.
        DB::statement(<<<'SQL'
            WITH totals AS (
                SELECT
                    a.id AS assignment_id,
                    a.sessions_total,
                    -- Sessions consumed before any of these attendance rows
                    -- (e.g. coach-app logs), so replaying doesn't erase them.
                    GREATEST(0, a.sessions_used - COALESCE((
                        SELECT COUNT(*) FROM service_attendance x
                        WHERE x.assignment_id = a.id
                          AND x.status = 'attended'
                          AND x.reversed_at IS NULL
                    ), 0)) AS used_before
                FROM member_service_assignments a
            ),
            ordered AS (
                SELECT
                    sa.id,
                    t.sessions_total,
                    t.used_before,
                    SUM(
                        CASE WHEN sa.status = 'attended' AND sa.reversed_at IS NULL
                             THEN 1 ELSE 0 END
                    ) OVER (
                        PARTITION BY sa.assignment_id
                        ORDER BY sa.attended_at, sa.created_at, sa.id
                        ROWS UNBOUNDED PRECEDING
                    ) AS used_through_here
                FROM service_attendance sa
                JOIN totals t ON t.assignment_id = sa.assignment_id
            )
            UPDATE service_attendance sa
            SET sessions_remaining_after =
                    GREATEST(0, o.sessions_total - o.used_before - o.used_through_here),
                sessions_total_at = o.sessions_total
            FROM ordered o
            WHERE o.id = sa.id
        SQL);
    }

    public function down(): void
    {
        Schema::table('service_attendance', function (Blueprint $table) {
            $table->dropColumn(['sessions_remaining_after', 'sessions_total_at']);
        });
    }
};
