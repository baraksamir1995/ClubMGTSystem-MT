<?php

namespace Tests\Feature\Sales;

use App\Models\Sales\SalesLead;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SalesReportsTest extends SalesTestCase
{
    /** Insert stage-history rows walking a lead through the given stages. */
    private function walkStages(SalesLead $lead, array $stages): void
    {
        $from = null;
        $at = now()->subHour();
        foreach ($stages as $stage) {
            DB::table('sales_lead_stage_history')->insert([
                'id' => (string) Str::uuid(),
                'lead_id' => $lead->id,
                'from_stage' => $from,
                'to_stage' => $stage,
                'created_at' => $at,
            ]);
            $from = $stage;
            $at = $at->copy()->addMinute();
        }
        $lead->update(['stage' => end($stages)]);
    }

    private function makeAppointment(SalesLead $lead, string $status): void
    {
        DB::table('sales_appointments')->insert([
            'id' => (string) Str::uuid(),
            'gym_id' => $lead->gym_id,
            'lead_id' => $lead->id,
            'type' => 'tour',
            'scheduled_at' => now(),
            'status' => $status,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /* ── funnel ──────────────────────────────────────────────────── */

    public function test_funnel_counts_reached_stages_and_conversion_rates(): void
    {
        $gym = $this->makeGym();
        $admin = $this->makeAdmin($gym);

        // 4 leads: all reach new, 3 reach qualified, 1 goes all the way, 1 lost.
        $this->walkStages($this->makeLead($gym), ['new']);
        $this->walkStages($this->makeLead($gym), ['new', 'qualified']);
        $winner = $this->makeLead($gym);
        $this->walkStages($winner, ['new', 'qualified', 'contacted', 'tour_booked', 'offer_presented', 'converted']);
        $this->walkStages($this->makeLead($gym), ['new', 'qualified', 'lost']);

        $this->makeAppointment($winner, 'showed');
        $this->makeAppointment($winner, 'no_show');

        $res = $this->actingAsUser($admin)->getJson('/api/sales/reports/funnel');
        $res->assertOk();
        $data = $res->json('data');

        $this->assertSame([
            ['stage' => 'new', 'count' => 4],
            ['stage' => 'qualified', 'count' => 3],
            ['stage' => 'contacted', 'count' => 1],
            ['stage' => 'tour_booked', 'count' => 1],
            ['stage' => 'offer_presented', 'count' => 1],
            ['stage' => 'converted', 'count' => 1],
            ['stage' => 'lost', 'count' => 1],
        ], $data['stages']);

        $first = $data['conversion'][0];
        $this->assertSame('new', $first['from']);
        $this->assertSame('qualified', $first['to']);
        $this->assertEqualsWithDelta(0.75, $first['rate'], 0.0001);

        $this->assertSame(1, $data['showed_count']);
        $this->assertSame(1, $data['no_show_count']);
    }

    public function test_rep_funnel_excludes_other_reps_leads(): void
    {
        $gym = $this->makeGym();
        $repA = $this->makeSalesStaff($gym);
        $repB = $this->makeSalesStaff($gym);

        foreach (range(1, 2) as $i) {
            $this->walkStages($this->makeLead($gym, ['assigned_to' => $repA->id]), ['new']);
        }
        foreach (range(1, 3) as $i) {
            $this->walkStages($this->makeLead($gym, ['assigned_to' => $repB->id]), ['new', 'qualified']);
        }

        $res = $this->actingAsUser($repA)->getJson('/api/sales/reports/funnel');
        $res->assertOk();
        $stages = collect($res->json('data.stages'))->pluck('count', 'stage');

        $this->assertSame(2, $stages['new']);
        $this->assertSame(0, $stages['qualified']);
    }

    /* ── leaderboard ─────────────────────────────────────────────── */

    public function test_leaderboard_forbidden_for_reps(): void
    {
        $gym = $this->makeGym();
        $rep = $this->makeSalesStaff($gym);

        $this->actingAsUser($rep)->getJson('/api/sales/reports/leaderboard')->assertStatus(403);
    }

    public function test_leaderboard_visible_to_manager_with_correct_math(): void
    {
        $gym = $this->makeGym();
        $manager = $this->makeSalesStaff($gym, salesRole: 'manager');
        $rep = $this->makeSalesStaff($gym);

        $converted = $this->makeLead($gym, [
            'assigned_to' => $rep->id,
            'first_contacted_at' => now()->addMinutes(10),
        ]);
        $this->walkStages($converted, ['new', 'qualified', 'contacted', 'tour_booked', 'offer_presented', 'converted']);
        $open = $this->makeLead($gym, ['assigned_to' => $rep->id]);
        $this->walkStages($open, ['new']);

        $this->makeAppointment($converted, 'showed');

        $res = $this->actingAsUser($manager)
            ->getJson('/api/sales/reports/leaderboard?month=' . now()->format('Y-m'));
        $res->assertOk();

        $row = collect($res->json('data'))->firstWhere('user_id', $rep->id);
        $this->assertNotNull($row);
        $this->assertSame('Sales rep', $row['name']);
        $this->assertSame(2, $row['leads']);
        $this->assertSame(1, $row['conversions']);
        $this->assertEqualsWithDelta(0.5, $row['close_rate'], 0.0001);
        $this->assertEqualsWithDelta(1.0, $row['show_rate'], 0.0001);
        $this->assertEqualsWithDelta(10.0, $row['avg_speed_to_lead_minutes'], 1.0);
    }

    /* ── sources ─────────────────────────────────────────────────── */

    public function test_sources_report_math_including_unknown(): void
    {
        $gym = $this->makeGym();
        $admin = $this->makeAdmin($gym);

        $sourceA = (string) Str::uuid();
        $sourceB = (string) Str::uuid();
        DB::table('sales_lead_sources')->insert([
            ['id' => $sourceA, 'gym_id' => $gym, 'name' => 'Walk-in', 'created_at' => now(), 'updated_at' => now()],
            ['id' => $sourceB, 'gym_id' => $gym, 'name' => 'Website Form', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->makeLead($gym, ['source_id' => $sourceA, 'stage' => 'converted']);
        $this->makeLead($gym, ['source_id' => $sourceA]);
        $this->makeLead($gym, ['source_id' => $sourceA]);
        $this->makeLead($gym, ['source_id' => $sourceB]);
        $this->makeLead($gym); // null source x2
        $this->makeLead($gym);

        $res = $this->actingAsUser($admin)->getJson('/api/sales/reports/sources');
        $res->assertOk();
        $rows = $res->json('data');

        // Sorted by lead volume desc: Walk-in (3), Unknown (2), Website Form (1).
        $this->assertSame(['Walk-in', 'Unknown', 'Website Form'], array_column($rows, 'name'));

        $walkIn = $rows[0];
        $this->assertSame($sourceA, $walkIn['source_id']);
        $this->assertSame(3, $walkIn['leads']);
        $this->assertSame(1, $walkIn['converted']);
        $this->assertEqualsWithDelta(1 / 3, $walkIn['conversion_rate'], 0.001);

        $unknown = $rows[1];
        $this->assertNull($unknown['source_id']);
        $this->assertSame(2, $unknown['leads']);
        $this->assertSame(0, $unknown['converted']);
        $this->assertEqualsWithDelta(0.0, $unknown['conversion_rate'], 0.0001);
    }

    /* ── context ─────────────────────────────────────────────────── */

    public function test_context_shape_for_admin_and_rep(): void
    {
        $gym = $this->makeGym();
        $branch = $this->makeBranch($gym);
        $admin = $this->makeAdmin($gym);

        $res = $this->actingAsUser($admin)->getJson('/api/sales/context');
        $res->assertOk()->assertJsonPath('data.is_admin', true)
            ->assertJsonPath('data.is_manager', true)
            ->assertJsonPath('data.user_id', $admin->id)
            ->assertJsonPath('data.branch_ids', null);
        $this->assertSame([['id' => $branch, 'name' => 'Main']], $res->json('data.branches'));

        $rep = $this->makeSalesStaff($gym, branchId: $branch);
        $res = $this->actingAsUser($rep)->getJson('/api/sales/context');
        $res->assertOk()->assertJsonPath('data.is_admin', false)
            ->assertJsonPath('data.is_manager', false)
            ->assertJsonPath('data.branch_ids', [$branch]);
    }
}
