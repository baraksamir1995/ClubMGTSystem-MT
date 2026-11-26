<?php

namespace Tests\Feature\Attendance;

use App\Services\MemberPassService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** PHASE2-CONTRACT: server re-verification of member passes on sync + review endpoint. */
class StaffQrSyncTest extends OfflineSyncTestCase
{
    private function staffQr(string $gym, string $mid, ?string $qr, array $extra = []): array
    {
        return $this->attendanceEvent($gym, array_merge(
            ['member_id' => $mid, 'attendance_method' => 'staff_qr', 'qr' => $qr === null ? null : ['raw' => $qr]],
            $extra
        ));
    }

    public function test_staff_qr_valid_forged_other_member_other_gym(): void
    {
        $gym = $this->makeGym();
        $other = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        [, $mid2] = $this->makeMember($gym);
        [, $foreign] = $this->makeMember($other);
        $this->makeMembership($gym, $mid, 'duration');
        $this->makeMembership($gym, $mid2, 'duration');
        $good = $this->passQr($gym, $mid);
        $forged = json_decode($good, true);
        $forged['m'] = $mid2; // swap the member, keep the old signature

        $results = $this->sync($this->makeStaff($gym), [
            $this->staffQr($gym, $mid, $good),
            $this->staffQr($gym, $mid2, json_encode($forged)),
            $this->staffQr($gym, $mid2, $good),                        // pass names another member
            $this->staffQr($gym, $mid, $this->passQr($other, $foreign)),
            $this->staffQr($gym, $mid, null),                          // no pass at all
            $this->staffQr($gym, $mid, $this->passQr($gym, $mid, Carbon::now()->subDays(31))),
        ])->assertOk()->json('results');

        $this->assertSame(
            ['created', 'qr_invalid', 'qr_member_mismatch', 'qr_wrong_gym', 'qr_invalid', 'pass_expired'],
            array_column($results, 'code')
        );
        $this->assertSame(1, DB::table('attendance_logs')->count());
        $this->assertSame('qr', DB::table('attendance_logs')->value('method'));
        $meta = json_decode(DB::table('attendance_events')->where('result', 'accepted')->value('qr_meta'), true);
        $this->assertSame('clby_mp', $meta['format']);
        $this->assertArrayNotHasKey('sig', $meta);
    }

    public function test_pass_expiry_is_judged_at_scan_time(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'duration', ['end_date' => null]);
        // Issued 30 days − 1 h ago: still valid when scanned 2 h ago, expired now.
        $qr = $this->passQr($gym, $mid, Carbon::now()->subDays(30)->addHour());
        $r = $this->syncOne($this->makeAdmin($gym), $this->staffQr($gym, $mid, $qr, [
            'device_recorded_at' => self::at(Carbon::now()->subHours(2)),
        ]));
        $this->assertSame('accepted', $r['status']);
    }

    public function test_coach_qr_sourced_service_session_is_verified(): void
    {
        $gym = $this->makeGym();
        [$coach, $tp] = $this->makeCoach($gym);
        [, $mid] = $this->makeMember($gym);
        [, $mid2] = $this->makeMember($gym);
        $a = $this->makeAssignment($gym, $mid, $tp);
        $b = $this->makeAssignment($gym, $mid, $tp);
        $c = $this->makeAssignment($gym, $mid, $tp);

        $results = $this->sync($coach, [
            $this->serviceEvent($gym, $a, ['metadata' => ['source' => 'qr'], 'qr' => ['raw' => $this->passQr($gym, $mid)]]),
            $this->serviceEvent($gym, $b, ['metadata' => ['source' => 'qr'], 'qr' => ['raw' => $this->passQr($gym, $mid2)]]),
            $this->serviceEvent($gym, $c, ['metadata' => ['source' => 'manual']]),   // manual unchanged
        ], null, 'coach')->assertOk()->json('results');

        $this->assertSame(['created', 'qr_member_mismatch', 'created'], array_column($results, 'code'));
        $this->assertSame(2, DB::table('service_session_logs')->count());
    }

    /* ── GET /api/attendance/offline/events ─────────────────────── */

    public function test_review_endpoint_scoping_filters_and_paging(): void
    {
        $gym = $this->makeGym();
        $other = $this->makeGym();
        [, $mid] = $this->makeMember($gym, 'Sara');
        $this->makeMembership($gym, $mid, 'duration');
        [, $foreignMid] = $this->makeMember($other);
        $this->makeMembership($other, $foreignMid, 'duration');
        $staff = $this->makeStaff($gym);

        $this->sync($staff, [
            $this->attendanceEvent($gym, ['member_id' => $mid]),
            $this->staffQr($gym, $mid, 'garbage'),
            $this->attendanceEvent($gym, ['member_id' => $mid, 'device_recorded_at' => self::at(Carbon::now()->subMinute())]),
        ])->assertOk();
        $this->sync($this->makeAdmin($other), [$this->attendanceEvent($other, ['member_id' => $foreignMid])], (string) Str::uuid())->assertOk();

        $admin = $this->makeAdmin($gym);
        $all = $this->actingAsUser($admin)->getJson('/api/attendance/offline/events')->assertOk();
        $this->assertCount(3, $all->json('data'), "other gym's events never visible");
        $this->assertNull($all->json('next_cursor'));
        $row = collect($all->json('data'))->firstWhere('result', 'rejected');
        $this->assertSame('qr_invalid', $row['code']);
        $this->assertNull($row['member'], 'unverified pass: no server-derived member');
        $this->assertSame('Sara', collect($all->json('data'))->firstWhere('result', 'accepted')['member']['full_name']);
        $this->assertSame($staff->full_name, $row['actor']['full_name']);
        $this->assertSame($this->deviceId, $row['device']['device_id']);
        $this->assertNotNull($row['device']['label']);
        $this->assertSame('staff_qr', $row['method']);

        $rejected = $this->getJson('/api/attendance/offline/events?result=rejected')->assertOk()->json('data');
        $this->assertSame(['rejected'], array_values(array_unique(array_column($rejected, 'result'))));
        $this->assertCount(1, $rejected);

        // Paging: 2 + 1, no overlap, newest first.
        $p1 = $this->getJson('/api/attendance/offline/events?limit=2')->assertOk();
        $this->assertCount(2, $p1->json('data'));
        $p2 = $this->getJson('/api/attendance/offline/events?limit=2&cursor=' . $p1->json('next_cursor'))->assertOk();
        $this->assertCount(1, $p2->json('data'));
        $this->assertNull($p2->json('next_cursor'));
        $ids = array_merge(array_column($p1->json('data'), 'event_id'), array_column($p2->json('data'), 'event_id'));
        $this->assertCount(3, array_unique($ids));
        $this->assertEqualsCanonicalizing(array_column($all->json('data'), 'event_id'), $ids);

        // needs_review filter.
        $this->assertCount(0, $this->getJson('/api/attendance/offline/events?needs_review=1')->json('data'));

        // Permissions: attendance view required; members never.
        $this->actingAsUser($this->makeStaff($gym, ['members']))->getJson('/api/attendance/offline/events')->assertStatus(403);
        [$member] = $this->makeMember($gym);
        $this->actingAsUser($member)->getJson('/api/attendance/offline/events')->assertStatus(403);
        $this->actingAsUser($admin)->getJson('/api/attendance/offline/events?cursor=bogus')->assertStatus(422);
    }

    public function test_review_endpoint_needs_review_filter(): void
    {
        $gym = $this->makeGym();
        [, $mid] = $this->makeMember($gym);
        $this->makeMembership($gym, $mid, 'sessions', ['sessions_total' => 2, 'sessions_used' => 2, 'sessions_remaining' => 0]);
        $cs = $this->makeClassSession($gym);
        $admin = $this->makeAdmin($gym);
        $this->sync($admin, [
            $this->attendanceEvent($gym, ['member_id' => $mid, 'class_session_id' => $cs]),
            $this->attendanceEvent($gym, ['member_id' => $mid]),
        ])->assertOk();

        $flagged = $this->actingAsUser($admin)->getJson('/api/attendance/offline/events?needs_review=1')->assertOk()->json('data');
        $this->assertCount(1, $flagged);
        $this->assertSame(['sessions_exhausted'], $flagged[0]['flags']);
        $this->assertTrue($flagged[0]['needs_review']);
        $this->assertNotNull($flagged[0]['attendance_id']);
    }
}
