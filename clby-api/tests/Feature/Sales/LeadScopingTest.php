<?php

namespace Tests\Feature\Sales;

class LeadScopingTest extends SalesTestCase
{
    public function test_rep_never_sees_another_reps_leads(): void
    {
        $gym = $this->makeGym();
        $branch = $this->makeBranch($gym);
        $repA = $this->makeSalesStaff($gym, $branch);
        $repB = $this->makeSalesStaff($gym, $branch);
        $leadA = $this->makeLead($gym, ['branch_id' => $branch, 'assigned_to' => $repA->id]);

        $this->actingAsUser($repB);
        $ids = collect($this->getJson('/api/sales/leads')->assertOk()->json('data'))->pluck('id');
        $this->assertFalse($ids->contains($leadA->id));

        // Direct fetch is a 404, not 403 — ids must not be probeable.
        $this->getJson("/api/sales/leads/{$leadA->id}")->assertStatus(404);
        $this->postJson("/api/sales/leads/{$leadA->id}/activities", ['type' => 'note', 'notes' => 'x'])
            ->assertStatus(404);
    }

    public function test_rep_sees_and_claims_unassigned_leads_in_own_branch(): void
    {
        $gym = $this->makeGym();
        $branch1 = $this->makeBranch($gym, 'One');
        $branch2 = $this->makeBranch($gym, 'Two');
        $rep = $this->makeSalesStaff($gym, $branch1);
        $inBranch = $this->makeLead($gym, ['branch_id' => $branch1]);
        $otherBranch = $this->makeLead($gym, ['branch_id' => $branch2]);

        $this->actingAsUser($rep);
        $ids = collect($this->getJson('/api/sales/leads?unassigned=1')->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($inBranch->id));
        $this->assertFalse($ids->contains($otherBranch->id));

        $this->postJson("/api/sales/leads/{$inBranch->id}/claim")->assertOk();
        $this->assertSame($rep->id, $inBranch->fresh()->assigned_to);

        // Second claim (by anyone) hits the atomic guard.
        $this->postJson("/api/sales/leads/{$inBranch->id}/claim")->assertStatus(409);
    }

    public function test_rep_cannot_assign_but_manager_can(): void
    {
        $gym = $this->makeGym();
        $branch = $this->makeBranch($gym);
        $rep = $this->makeSalesStaff($gym, $branch);
        $manager = $this->makeSalesStaff($gym, $branch, 'manager');
        $lead = $this->makeLead($gym, ['branch_id' => $branch]);

        $this->actingAsUser($rep);
        $this->postJson("/api/sales/leads/{$lead->id}/assign", ['assigned_to' => $rep->id])
            ->assertStatus(403);

        $this->actingAsUser($manager);
        $this->postJson("/api/sales/leads/{$lead->id}/assign", ['assigned_to' => $rep->id])
            ->assertOk();
        $this->assertSame($rep->id, $lead->fresh()->assigned_to);
    }

    public function test_manager_scope_is_limited_to_their_branches(): void
    {
        $gym = $this->makeGym();
        $branch1 = $this->makeBranch($gym, 'One');
        $branch2 = $this->makeBranch($gym, 'Two');
        $manager = $this->makeSalesStaff($gym, null, 'manager', [$branch1]);
        $rep = $this->makeSalesStaff($gym, $branch2);
        $inScope = $this->makeLead($gym, ['branch_id' => $branch1, 'assigned_to' => $rep->id]);
        $outOfScope = $this->makeLead($gym, ['branch_id' => $branch2, 'assigned_to' => $rep->id]);

        $this->actingAsUser($manager);
        $ids = collect($this->getJson('/api/sales/leads')->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($inScope->id));
        $this->assertFalse($ids->contains($outOfScope->id));
    }

    public function test_gym_admin_sees_everything_and_cross_gym_is_invisible(): void
    {
        $gymA = $this->makeGym();
        $gymB = $this->makeGym();
        $admin = $this->makeAdmin($gymA);
        $mine = $this->makeLead($gymA);
        $foreign = $this->makeLead($gymB);

        $this->actingAsUser($admin);
        $ids = collect($this->getJson('/api/sales/leads')->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($mine->id));
        $this->assertFalse($ids->contains($foreign->id));
        $this->getJson("/api/sales/leads/{$foreign->id}")->assertStatus(404);
    }

    public function test_member_role_is_blocked_from_the_module(): void
    {
        $gym = $this->makeGym();
        $member = \App\Models\User::forceCreate([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'email' => 'member@test.com', 'role' => 'member',
            'gym_id' => $gym, 'is_active' => true,
        ]);

        $this->actingAsUser($member);
        $this->getJson('/api/sales/leads')->assertStatus(403);
    }

    public function test_staff_without_sales_module_is_blocked(): void
    {
        $gym = $this->makeGym();
        $staff = \App\Models\User::forceCreate([
            'id' => (string) \Illuminate\Support\Str::uuid(),
            'email' => 'nosales@test.com', 'role' => 'staff',
            'gym_id' => $gym, 'is_active' => true,
        ]);

        $this->actingAsUser($staff);
        $this->getJson('/api/sales/leads')->assertStatus(403);
    }
}
