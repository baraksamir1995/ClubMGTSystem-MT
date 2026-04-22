<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE gym_popups ALTER COLUMN is_active SET DEFAULT true');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE gym_popups ALTER COLUMN is_active SET DEFAULT false');
    }
};
