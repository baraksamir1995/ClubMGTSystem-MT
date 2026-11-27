<?php

namespace App\Console\Commands;

use App\Services\RecurringExpenses;
use Illuminate\Console\Command;

/**
 * Record every recurring-expense occurrence whose date has arrived (in the
 * gym's timezone). Safe to run any number of times, concurrently, or after
 * a gap: see App\Services\RecurringExpenses.
 */
class GenerateRecurringExpenses extends Command
{
    protected $signature = 'expenses:generate-recurring {--gym= : Only this gym id}';

    protected $description = 'Record due occurrences of active recurring expenses';

    public function handle(RecurringExpenses $svc): int
    {
        $r = $svc->generateAll($this->option('gym') ?: null);
        $this->info("Schedules checked: {$r['schedules']}, occurrences recorded: {$r['created']}, failed: {$r['failed']}");

        return $r['failed'] > 0 ? self::FAILURE : self::SUCCESS;
    }
}
