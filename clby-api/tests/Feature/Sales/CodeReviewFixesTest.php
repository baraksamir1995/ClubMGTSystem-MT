<?php

namespace Tests\Feature\Sales;

use App\Models\Sales\SalesLead;
use App\Models\Sales\SalesLeadSource;
use App\Models\Sales\SalesOffer;
use App\Models\Sales\SalesTask;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Regression coverage for the code-review findings fixed in this change.
 */
class CodeReviewFixesTest extends SalesTestCase
{
    /* ── cross-gym source_id / branch_id ─────────────────────────── */

    public function test_create_rejects_branch_from_another_gym(): void
    {
        $gymA = $this->makeGym();
        $gymB = $this->makeGym();
        $foreignBranch = $this->makeBranch($gymB);
        $this->actingAsUser($this->makeAdmin($gymA));

        $this->postJson('/api/sales/leads', [
            'name' => 'X', 'phone' => '01011112222', 'branch_id' => $foreignBranch,
        ])->assertStatus(422)->assertJsonPath('errors.branch_id.0', 'Unknown branch for this gym.');

        $this->assertDatabaseCount('sales_leads', 0);
    }

    public function test_create_rejects_unknown_source(): void
    {
        $gym = $this->makeGym();
        $this->actingAsUser($this->makeAdmin($gym));

        $this->postJson('/api/sales/leads', [
            'name' => 'X', 'phone' => '01011112222', 'source_id' => (string) Str::uuid(),
        ])->assertStatus(422)->assertJsonPath('errors.source_id.0', 'Unknown lead source for this gym.');
    }

    public function test_create_accepts_own_gym_branch(): void
    {
        $gym = $this->makeGym();
        $branch = $this->makeBranch($gym);
        $this->actingAsUser($this->makeAdmin($gym));

        $this->postJson('/api/sales/leads', [
            'name' => 'X', 'phone' => '01011112222', 'branch_id' => $branch,
        ])->assertStatus(201);
    }

    /* ── assign() with no body key ───────────────────────────────── */

    public function test_assign_with_empty_body_unassigns_cleanly(): void
    {
        $gym = $this->makeGym();
        $admin = $this->makeAdmin($gym);
        $this->actingAsUser($admin);
        $lead = $this->makeLead($gym, ['assigned_to' => $admin->id]);

        // Omitting assigned_to is the "unassign" shape — must be a clean 200,
        // not a 500 on an undefined array key.
        $this->postJson("/api/sales/leads/{$lead->id}/assign", [])->assertOk();
        $this->assertNull($lead->fresh()->assigned_to);
    }

    /* ── convert() with a declined / expired offer ───────────────── */

    public function test_convert_rejects_declined_offer(): void
    {
        $gym = $this->makeGym();
        $admin = $this->makeAdmin($gym);
        $this->actingAsUser($admin);
        $lead = $this->makeLead($gym, ['stage' => 'offer_presented', 'assigned_to' => $admin->id]);
        $offer = SalesOffer::create([
            'gym_id' => $gym, 'lead_id' => $lead->id, 'quoted_price' => 1000,
            'status' => 'declined', 'created_by' => $admin->id,
        ]);

        $this->postJson("/api/sales/leads/{$lead->id}/convert", [
            'offer_id' => $offer->id, 'payment_method' => 'cash',
            'final_price' => 1000, 'start_date' => now()->toDateString(),
        ])->assertStatus(422);

        $this->assertSame('offer_presented', $lead->fresh()->stage->value);
        $this->assertSame('declined', $offer->fresh()->status);
    }

    public function test_convert_rejects_expired_offer(): void
    {
        $gym = $this->makeGym();
        $admin = $this->makeAdmin($gym);
        $this->actingAsUser($admin);
        $lead = $this->makeLead($gym, ['stage' => 'offer_presented', 'assigned_to' => $admin->id]);
        $offer = SalesOffer::create([
            'gym_id' => $gym, 'lead_id' => $lead->id, 'quoted_price' => 1000,
            'valid_until' => now()->subDay()->toDateString(), 'created_by' => $admin->id,
        ]);

        $this->postJson("/api/sales/leads/{$lead->id}/convert", [
            'offer_id' => $offer->id, 'payment_method' => 'cash',
            'final_price' => 1000, 'start_date' => now()->toDateString(),
        ])->assertStatus(422);
    }

    /* ── activity on a lost lead ─────────────────────────────────── */

    public function test_activity_blocked_on_lost_lead_no_zombie_tasks(): void
    {
        $gym = $this->makeGym();
        $rep = $this->makeSalesStaff($gym);
        $lead = $this->makeLead($gym, ['stage' => 'lost', 'assigned_to' => $rep->id]);

        $this->actingAsUser($rep);
        $this->postJson("/api/sales/leads/{$lead->id}/activities", [
            'type' => 'call', 'outcome' => 'no_answer',
        ])->assertStatus(422);

        // The cadence must not have recreated follow-ups on a lost lead.
        $this->assertSame(0, SalesTask::where('lead_id', $lead->id)->count());
    }

    /* ── /sales/team includes gym admins ─────────────────────────── */

    public function test_team_roster_includes_gym_admins(): void
    {
        $gym = $this->makeGym();
        $admin = $this->makeAdmin($gym);
        $this->actingAsUser($admin);

        $team = $this->getJson('/api/sales/team')->assertOk()->json('data');
        $ids = collect($team)->pluck('user_id');
        $this->assertTrue($ids->contains($admin->id), 'gym admin should appear in the sales team roster');
        $adminRow = collect($team)->firstWhere('user_id', $admin->id);
        $this->assertSame('admin', $adminRow['sales_role']);
        $this->assertNull($adminRow['staff_id']);
    }

    /* ── phone normalization length (E.164 cap on normalized value) ── */

    public function test_phone_rejects_when_country_prefix_overflows_e164(): void
    {
        // 15 raw digits pass a naive raw-length check, but +20 makes 17 → invalid.
        $this->assertNull(\App\Support\Phone::toE164('123456789012345'));
        // Legit numbers still normalize.
        $this->assertSame('+201011112222', \App\Support\Phone::toE164('01011112222'));
        $this->assertSame('+447911123456', \App\Support\Phone::toE164('+447911123456'));
    }

    /* ── reminder command fires the closest (smallest) due offset ──── */

    public function test_reminder_fires_smallest_due_offset_first(): void
    {
        $gym = $this->makeGym();
        DB::table('sales_settings')->insert([
            'id' => (string) Str::uuid(), 'gym_id' => $gym,
            'reminder_hours' => json_encode([2, 24]),
            'created_at' => now(), 'updated_at' => now(),
        ]);
        $lead = $this->makeLead($gym, ['name' => 'Rem Lead']);
        // Appointment 1.5h away — both 2h and 24h windows are open.
        $apptId = (string) Str::uuid();
        DB::table('sales_appointments')->insert([
            'id' => $apptId, 'gym_id' => $gym, 'lead_id' => $lead->id,
            'type' => 'tour', 'scheduled_at' => now()->addMinutes(90),
            'status' => 'scheduled', 'reminders_sent' => null,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->artisan('sales:send-reminders')->assertSuccessful();

        // Must mark the 2h offset sent (the closest window), not just 24h.
        $sent = json_decode(DB::table('sales_appointments')->where('id', $apptId)->value('reminders_sent'), true);
        $this->assertContains(2, $sent, 'closest (2h) offset should be the one fired');
    }
}
