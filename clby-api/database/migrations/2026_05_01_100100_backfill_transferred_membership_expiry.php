<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Existing transferred rows were created with end_date = NULL
        // (never expires). New policy: receivers inherit the sender's
        // expiry at the moment of transfer. Backfill so old transfers
        // align with the new rule.
        //
        // If the source row's end_date is also NULL (e.g. the sender had
        // an unbounded plan), we leave the receiver's NULL too — there is
        // nothing more authoritative to copy from.
        DB::statement(<<<'SQL'
            UPDATE member_memberships AS receiver
            SET end_date = sender.end_date,
                updated_at = now()
            FROM member_memberships AS sender
            WHERE receiver.transferred_from = sender.id
              AND receiver.source_type = 'transfer'
              AND receiver.end_date IS NULL
              AND sender.end_date IS NOT NULL
        SQL);
    }

    public function down(): void
    {
        // No safe rollback. Reverting would lose the recovered expiry
        // dates and require the source row's end_date to derive them again.
    }
};
