<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Composite index to back the Laravel database-queue poll.
 *
 * The `database` queue driver's pop query is roughly:
 *
 *   SELECT * FROM jobs
 *   WHERE queue = ?
 *     AND ((reserved_at IS NULL AND available_at <= ?) OR reserved_at <= ?)
 *   ORDER BY id ASC
 *   FOR UPDATE SKIP LOCKED LIMIT 1
 *
 * The stock schema only ships `jobs_queue_index (queue)`, so every poll
 * does a queue-filtered scan + sort. At one worker on `--sleep=3` this is
 * cheap, but it degrades as worker count / backlog grows. A
 * (queue, available_at) index lets the planner satisfy the WHERE + ORDER
 * without a heap sort.
 *
 * CREATE INDEX IF NOT EXISTS = idempotent + safe to run across prod and
 * staging (which run migrate-on-boot and abort the container on failure).
 * Done outside a transaction would normally use CONCURRENTLY, but the
 * jobs table is tiny (drains continuously), so a brief lock is fine and
 * keeps the migration transaction-safe with the rest of the boot run.
 */
return new class extends Migration {
    public function up(): void
    {
        DB::statement('CREATE INDEX IF NOT EXISTS jobs_queue_available_at_index ON jobs (queue, available_at)');
    }

    public function down(): void
    {
        DB::statement('DROP INDEX IF EXISTS jobs_queue_available_at_index');
    }
};
