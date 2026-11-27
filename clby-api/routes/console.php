<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

// Sales appointment reminders (24h/2h, per-gym configurable offsets).
Schedule::command('sales:send-reminders')->everyFifteenMinutes();

// Recurring expenses: record occurrences whose date has arrived. Hourly so
// every gym gets its occurrence within the hour after its local midnight
// (gyms have their own timezones). Idempotent and catch-up safe — a
// missed or doubled run can't skip or duplicate (see
// App\Services\RecurringExpenses). Runs in the container via
// `schedule:work` under supervisord (docker/supervisor/supervisord.conf).
Schedule::command('expenses:generate-recurring')->hourly()->withoutOverlapping(30);

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');
