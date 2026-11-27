<?php

namespace Tests\Feature\Attendance;

use App\Services\ServiceSessionService;
use App\Services\SpecialistSessionService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Postgres-only: the online 30-min coach-session guards must hold exactly
 * 30 minutes even when the DB session timezone is not UTC (the bug fixed in
 * fix/specialist-scan d2be08a: a naive cutoff string was read in
 * Africa/Cairo, stretching the window to ~2.5 h).
 *
 * Skipped unless CLBY_PG_TEST_DATABASE names a Postgres database that has
 * the real schema (e.g. clby_offline). Everything runs in one transaction
 * that is rolled back, so the database is left untouched.
 *
 *   CLBY_PG_TEST_DATABASE=clby_offline php artisan test --filter=CoachGuardPostgresTest
 */
class CoachGuardPostgresTest extends TestCase
{
    private const CONN = 'pgsql_guard_test';

    protected function setUp(): void
    {
        parent::setUp();
        $db = getenv('CLBY_PG_TEST_DATABASE');
        if (! $db) {
            $this->markTestSkipped('Set CLBY_PG_TEST_DATABASE to run the Postgres-only guard test.');
        }
        config(['database.connections.' . self::CONN => [
            'driver' => 'pgsql',
            'host' => getenv('CLBY_PG_TEST_HOST') ?: '127.0.0.1',
            'port' => getenv('CLBY_PG_TEST_PORT') ?: '5432',
            'database' => $db,
            'username' => getenv('CLBY_PG_TEST_USER') ?: 'rtg',
            'password' => getenv('CLBY_PG_TEST_PASSWORD') ?: '',
            'charset' => 'utf8', 'prefix' => '', 'search_path' => 'public', 'sslmode' => 'prefer',
        ], 'database.default' => self::CONN]);
        DB::purge(self::CONN);
        DB::connection(self::CONN)->statement("SET TIME ZONE 'Africa/Cairo'");
        DB::connection(self::CONN)->beginTransaction();
    }

    protected function tearDown(): void
    {
        if (getenv('CLBY_PG_TEST_DATABASE')) {
            DB::connection(self::CONN)->rollBack();
            Carbon::setTestNow();
        }
        parent::tearDown();
    }

    /** @return array{0:string,1:string,2:string,3:string} [gym, member, trainer, assignment] */
    private function scene(): array
    {
        $gym = (string) Str::uuid();
        DB::table('gyms')->insert(['id' => $gym, 'name' => 'PG guard test', 'timezone' => 'Africa/Cairo']);
        $mid = (string) Str::uuid();
        DB::table('gym_members')->insert(['id' => $mid, 'gym_id' => $gym]);
        $tp = (string) Str::uuid();
        DB::table('trainer_profiles')->insert(['id' => $tp, 'gym_id' => $gym, 'name' => 'PG Coach', 'is_active' => true]);
        $pkg = (string) Str::uuid();
        DB::table('service_session_packages')->insert(['id' => $pkg, 'gym_id' => $gym, 'name' => 'PG pack', 'session_count' => 10, 'price' => 0]);
        $a = (string) Str::uuid();
        DB::table('member_service_assignments')->insert(['id' => $a, 'gym_id' => $gym, 'gym_member_id' => $mid, 'service_package_id' => $pkg,
            'trainer_id' => $tp, 'package_name' => 'PG pack', 'service_type' => 'personal_training', 'sessions_total' => 10, 'sessions_used' => 0, 'status' => 'active']);
        return [$gym, $mid, $tp, $a];
    }

    private function logAt(string $gym, string $a, string $tp, string $mid, Carbon $at): void
    {
        DB::table('service_session_logs')->insert(['id' => (string) Str::uuid(), 'gym_id' => $gym, 'assignment_id' => $a, 'trainer_id' => $tp,
            'gym_member_id' => $mid, 'delivered_at' => $at->toIso8601String(), 'created_at' => $at->toIso8601String(), 'updated_at' => $at->toIso8601String()]);
    }

    public function test_member_scan_guard_is_exactly_30_minutes_on_a_cairo_session(): void
    {
        Carbon::setTestNow(Carbon::now('UTC')->startOfSecond());
        [$gym, $mid, $tp, $a] = $this->scene();
        $svc = app(SpecialistSessionService::class);

        // 45 min ago: outside the window → allowed (the old naive cutoff blocked this).
        $this->logAt($gym, $a, $tp, $mid, Carbon::now()->subMinutes(45));
        $r = $svc->memberScan($gym, $mid, $tp, []);
        $this->assertArrayHasKey('data', $r, 'a session 45 min ago must not trigger the 30-min guard');

        // The scan just logged now → a second scan is inside the guard.
        $r = $svc->memberScan($gym, $mid, $tp, []);
        $this->assertSame('recently_logged', $r['error']['code'] ?? null);
    }

    public function test_coach_decrement_guard_is_exactly_30_minutes_on_a_cairo_session(): void
    {
        Carbon::setTestNow(Carbon::now('UTC')->startOfSecond());
        [$gym, $mid, $tp, $a] = $this->scene();
        $svc = app(ServiceSessionService::class);

        $this->logAt($gym, $a, $tp, $mid, Carbon::now()->subMinutes(45));
        $r = $svc->deliver($tp, $gym, $a, null);
        $this->assertArrayHasKey('data', $r, 'a session 45 min ago must not trigger the 30-min guard');

        $this->logAt($gym, $a, $tp, $mid, Carbon::now()->subMinutes(20));
        $r = $svc->deliver($tp, $gym, $a, null);
        $this->assertSame('recently_logged', $r['error']['code'] ?? null);
    }
}
