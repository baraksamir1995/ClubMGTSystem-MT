<?php

namespace Tests\Feature\Attendance;

use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use App\Services\MemberPassService;

/** Helpers for POST /api/attendance/sync tests. */
abstract class OfflineSyncTestCase extends AttendanceTestCase
{
    protected string $deviceId;

    protected function setUp(): void
    {
        parent::setUp();
        $this->deviceId = (string) Str::uuid();
        // Most tests replay events recorded minutes ago (i.e. "offline"), so
        // the offline gate (CONTRACT §6.2) is opened here; the gate itself is
        // covered by OfflineGateTest.
        config([
            'attendance_offline.enabled' => true,
            'attendance_offline.allow_member_qr_offline' => true,
        ]);
    }

    protected static function at(Carbon $t): string
    {
        return $t->copy()->format('Y-m-d\TH:i:s.vP');
    }

    protected function attendanceEvent(string $gymId, array $overrides = []): array
    {
        return array_merge([
            'event_id' => (string) Str::uuid(),
            'kind' => 'attendance',
            'attendance_method' => 'manual',
            'gym_id' => $gymId,
            'branch_id' => null,
            'member_id' => null,
            'class_session_id' => null,
            'studio_id' => null,
            'service_assignment_id' => null,
            'device_recorded_at' => self::at(Carbon::now()->subMinutes(5)->setTimezone('Africa/Cairo')),
            'device_timezone' => 'Africa/Cairo',
            'qr' => null,
            'note' => null,
            'metadata' => ['screen' => 'test'],
        ], $overrides);
    }

    /** A valid signed member pass (QR text) for a gym member. */
    protected function passQr(string $gymId, string $memberId, ?Carbon $at = null): string
    {
        $n = DB::table('gym_members')->where('id', $memberId)->value('member_number');
        // Default: issued an hour ago, so it predates the (minutes-old) scans in tests.
        return app(MemberPassService::class)->issue($gymId, $memberId, $n !== null ? (int) $n : null, null, $at ?? Carbon::now()->subHour())['qr'];
    }

    protected function serviceEvent(string $gymId, string $assignmentId, array $overrides = []): array
    {
        return $this->attendanceEvent($gymId, array_merge([
            'kind' => 'service_session',
            'attendance_method' => null,
            'service_assignment_id' => $assignmentId,
            'note' => 'offline note',
        ], $overrides));
    }

    protected function sync(User $user, array $events, ?string $deviceId = null, string $app = 'admin')
    {
        $this->actingAsUser($user);
        return $this->postJson('/api/attendance/sync', [
            'device_id' => $deviceId ?? $this->deviceId,
            'app' => $app,
            'app_version' => '1.0.7',
            'events' => $events,
        ]);
    }

    /** The single result for a one-event batch (asserts 200). */
    protected function syncOne(User $user, array $event, ?string $deviceId = null, string $app = 'admin'): array
    {
        $res = $this->sync($user, [$event], $deviceId, $app);
        $res->assertOk();
        $this->assertCount(1, $res->json('results'));
        return $res->json('results.0');
    }
}
