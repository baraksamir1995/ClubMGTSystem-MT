<?php

namespace Tests\Feature\Expenses;

use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Base for expense / recurring-expense feature tests.
 *
 * Unlike the other feature suites these run on PostgreSQL, not the sqlite
 * default: the Financial Overview's revenue math (App\Support\Revenue)
 * uses Postgres-only SQL (AT TIME ZONE, FILTER), and the generator's
 * duplicate guard is a real unique index + row lock we want to exercise
 * as on prod.
 *
 * The database is a throwaway `clby_expenses_test` on the local server
 * (override with EXPENSES_TEST_DB). It is created if missing and its
 * public schema is rebuilt once per PHPUnit process: the legacy Supabase
 * tables by hand (minimal columns), then the REAL expense migrations on
 * top. Each test runs inside a transaction that is rolled back. If no
 * Postgres server is reachable the tests are skipped, not failed.
 */
abstract class ExpensesTestCase extends TestCase
{
    private static bool $built = false;

    protected function setUp(): void
    {
        parent::setUp();

        $db = env('EXPENSES_TEST_DB', 'clby_expenses_test');
        if (! str_contains($db, 'test')) {
            $this->fail('EXPENSES_TEST_DB must name a throwaway *test* database.');
        }

        $base = [
            'driver' => 'pgsql',
            'host' => env('EXPENSES_TEST_DB_HOST', '127.0.0.1'),
            'port' => env('EXPENSES_TEST_DB_PORT', '5432'),
            'username' => env('EXPENSES_TEST_DB_USERNAME', 'rtg'),
            'password' => env('EXPENSES_TEST_DB_PASSWORD', ''),
            'charset' => 'utf8',
            'prefix' => '',
            'search_path' => 'public',
            'sslmode' => 'prefer',
        ];
        config([
            'database.connections.pg_admin' => $base + ['database' => 'postgres'],
            'database.connections.pgsql' => $base + ['database' => $db],
            'database.default' => 'pgsql',
        ]);
        DB::purge('pgsql');

        if (! self::$built) {
            try {
                $exists = DB::connection('pg_admin')->selectOne('SELECT 1 AS x FROM pg_database WHERE datname = ?', [$db]);
                if (! $exists) {
                    DB::connection('pg_admin')->statement('CREATE DATABASE "' . $db . '"');
                }
                DB::connection('pg_admin')->disconnect();
            } catch (\Throwable $e) {
                $this->markTestSkipped('PostgreSQL not reachable for expense tests: ' . $e->getMessage());
            }
            $this->buildSchema();
            self::$built = true;
        }

        DB::beginTransaction();
    }

    protected function tearDown(): void
    {
        if (DB::transactionLevel() > 0) {
            DB::rollBack();
        }
        Carbon::setTestNow();
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    private function buildSchema(): void
    {
        DB::statement('DROP SCHEMA IF EXISTS public CASCADE');
        DB::statement('CREATE SCHEMA public');
        DB::statement('CREATE EXTENSION IF NOT EXISTS pgcrypto');
        // Supabase RLS helpers referenced by the expense policies.
        DB::statement('CREATE FUNCTION my_gym_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$');
        DB::statement('CREATE FUNCTION my_role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULL::text $$');

        Schema::create('gyms', function ($t) {
            $t->uuid('id')->primary();
            $t->string('name');
            $t->string('timezone')->nullable();
            $t->timestampsTz();
        });
        Schema::create('profiles', function ($t) {
            $t->uuid('id')->primary();
            $t->string('email');
            $t->string('password')->nullable();
            $t->string('full_name')->nullable();
            $t->string('role')->default('member');
            $t->uuid('gym_id')->nullable();
            $t->boolean('is_active')->default(true);
            $t->boolean('email_verified')->default(true);
            $t->timestampsTz();
        });
        Schema::create('payments', function ($t) {
            $t->uuid('id')->primary();
            $t->uuid('gym_id')->nullable();
            $t->decimal('amount', 12, 2);
            $t->string('currency')->default('EGP');
            $t->string('status')->default('paid');
            $t->timestampTz('paid_at')->nullable();
            $t->decimal('refunded_amount', 12, 2)->default(0);
            $t->timestampTz('refunded_at')->nullable();
            $t->timestampTz('created_at')->nullable();
        });
        Schema::create('staff_activity_logs', function ($t) {
            $t->uuid('id')->nullable();
            $t->uuid('gym_id')->nullable();
            $t->uuid('staff_id')->nullable();
            $t->string('staff_name')->nullable();
            $t->string('action')->nullable();
            $t->string('action_type')->nullable();
            $t->string('module')->nullable();
            $t->text('description')->nullable();
            $t->string('entity')->nullable();
            $t->string('entity_id')->nullable();
            $t->string('ip_address')->nullable();
            $t->timestampTz('created_at')->nullable();
        });
        Schema::create('personal_access_tokens', function ($t) {
            $t->id();
            $t->uuidMorphs('tokenable');
            $t->text('name');
            $t->string('token', 64)->unique();
            $t->text('abilities')->nullable();
            $t->timestamp('last_used_at')->nullable();
            $t->timestamp('expires_at')->nullable();
            $t->timestamps();
        });

        // The real migrations, in order.
        (require base_path('database/migrations/2026_10_21_100000_create_expenses_table.php'))->up();
        (require base_path('database/migrations/2026_11_27_100000_create_recurring_expenses.php'))->up();
        // Prod runs migrate-on-boot: the recurring migration must be re-runnable.
        (require base_path('database/migrations/2026_11_27_100000_create_recurring_expenses.php'))->up();
    }

    // ─── Factories / helpers ────────────────────────────────────────────

    /** Freeze "now" at a gym-local wall-clock time. */
    protected function travelToLocal(string $datetime, string $tz = 'Africa/Cairo'): void
    {
        $t = CarbonImmutable::parse($datetime, $tz)->utc();
        Carbon::setTestNow($t);
        CarbonImmutable::setTestNow($t);
    }

    protected function makeGym(string $tz = 'Africa/Cairo', ?string $currency = 'EGP'): string
    {
        $id = (string) Str::uuid();
        DB::table('gyms')->insert(['id' => $id, 'name' => 'Gym ' . substr($id, 0, 4), 'timezone' => $tz, 'created_at' => now(), 'updated_at' => now()]);
        if ($currency) {
            // Gym currency is derived from the latest payment.
            $this->payment($id, 1, '2020-01-01 10:00', $currency);
        }

        return $id;
    }

    protected function makeUser(string $gymId, string $role = 'gym_admin'): User
    {
        $id = (string) Str::uuid();
        DB::table('profiles')->insert([
            'id' => $id, 'email' => "u{$id}@test.local", 'full_name' => 'Owner ' . substr($id, 0, 4),
            'role' => $role, 'gym_id' => $gymId, 'is_active' => true, 'created_at' => now(), 'updated_at' => now(),
        ]);

        return User::findOrFail($id);
    }

    protected function actingAsAdmin(string $gymId): User
    {
        $u = $this->makeUser($gymId);
        Sanctum::actingAs($u);

        return $u;
    }

    protected function payment(string $gymId, float $amount, string $paidAtLocal, string $currency = 'EGP', string $tz = 'Africa/Cairo'): void
    {
        $at = CarbonImmutable::parse($paidAtLocal, $tz)->utc();
        DB::table('payments')->insert([
            'id' => (string) Str::uuid(), 'gym_id' => $gymId, 'amount' => $amount, 'currency' => $currency,
            'status' => 'paid', 'paid_at' => $at, 'created_at' => $at,
        ]);
    }

    /** @param array<string, mixed> $overrides */
    protected function recurringPayload(array $overrides = []): array
    {
        return $overrides + [
            'title' => 'Internet',
            'amount' => 1000,
            'category' => 'utilities',
            'payment_method' => 'bank_transfer',
            'vendor' => 'ISP',
            'description' => null,
            'frequency' => 'monthly',
            'interval' => 1,
            'start_date' => '2026-12-01',
            'end_date' => null,
            'recurrence_day' => 1,
        ];
    }

    /** @param array<string, mixed> $overrides */
    protected function createRecurring(array $overrides = []): array
    {
        $res = $this->postJson('/api/expenses/recurring', $this->recurringPayload($overrides));
        $res->assertCreated();

        return $res->json('data');
    }

    protected function generate(): void
    {
        $this->assertSame(0, Artisan::call('expenses:generate-recurring'));
    }

    /** @return list<string> scheduled dates of a schedule's rows with $status */
    protected function occurrenceDates(string $scheduleId, string $status = 'recorded'): array
    {
        return DB::table('expenses')
            ->where('recurring_expense_id', $scheduleId)
            ->where('status', $status)
            ->orderBy('scheduled_date')
            ->pluck('scheduled_date')
            ->map(fn ($d) => substr((string) $d, 0, 10))
            ->all();
    }

    protected function summary(string $from, string $to): array
    {
        return $this->getJson("/api/expenses/summary?from={$from}&to={$to}")->assertOk()->json('data');
    }
}
