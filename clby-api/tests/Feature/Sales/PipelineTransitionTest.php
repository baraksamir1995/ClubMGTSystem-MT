<?php

namespace Tests\Feature\Sales;

use App\Models\Sales\SalesOffer;

class PipelineTransitionTest extends SalesTestCase
{
    public function test_lead_advances_one_stage_and_history_is_recorded(): void
    {
        $gym = $this->makeGym();
        $admin = $this->makeAdmin($gym);
        $lead = $this->makeLead($gym);
        $this->actingAsUser($admin);

        $res = $this->postJson("/api/sales/leads/{$lead->id}/transition", ['to' => 'qualified']);

        $res->assertOk()->assertJsonPath('data.stage', 'qualified');
        $this->assertDatabaseHas('sales_lead_stage_history', [
            'lead_id' => $lead->id, 'from_stage' => 'new', 'to_stage' => 'qualified',
            'changed_by' => $admin->id,
        ]);
        $this->assertNotNull($lead->fresh()->qualified_at);
    }

    public function test_skipping_stages_is_rejected(): void
    {
        $gym = $this->makeGym();
        $this->actingAsUser($this->makeAdmin($gym));
        $lead = $this->makeLead($gym);

        $this->postJson("/api/sales/leads/{$lead->id}/transition", ['to' => 'tour_booked'])
            ->assertStatus(422);
        $this->assertSame('new', $lead->fresh()->stage->value);
    }

    public function test_backward_transition_is_rejected(): void
    {
        $gym = $this->makeGym();
        $this->actingAsUser($this->makeAdmin($gym));
        $lead = $this->makeLead($gym, ['stage' => 'contacted']);

        $this->postJson("/api/sales/leads/{$lead->id}/transition", ['to' => 'qualified'])
            ->assertStatus(422);
    }

    public function test_converted_is_not_reachable_via_transition(): void
    {
        $gym = $this->makeGym();
        $this->actingAsUser($this->makeAdmin($gym));
        $lead = $this->makeLead($gym, ['stage' => 'offer_presented']);

        $this->postJson("/api/sales/leads/{$lead->id}/transition", ['to' => 'converted'])
            ->assertStatus(422);
    }

    public function test_mark_lost_requires_reason_and_moves_to_nurture_pool(): void
    {
        $gym = $this->makeGym();
        $this->actingAsUser($this->makeAdmin($gym));
        $lead = $this->makeLead($gym, ['stage' => 'contacted']);

        $this->postJson("/api/sales/leads/{$lead->id}/lost", [])->assertStatus(422);

        $res = $this->postJson("/api/sales/leads/{$lead->id}/lost", [
            'reason' => 'price', 'notes' => 'too expensive',
        ]);
        $res->assertOk()->assertJsonPath('data.stage', 'lost');

        $fresh = $lead->fresh();
        $this->assertNotNull($fresh->reengage_at, 'lost leads get a nurture re-engagement date');
        $this->assertDatabaseHas('sales_lead_stage_history', [
            'lead_id' => $lead->id, 'from_stage' => 'contacted', 'to_stage' => 'lost', 'reason' => 'price',
        ]);
    }

    public function test_lost_lead_can_be_reopened_and_history_is_preserved(): void
    {
        $gym = $this->makeGym();
        $admin = $this->makeAdmin($gym);
        $this->actingAsUser($admin);
        $lead = $this->makeLead($gym, ['stage' => 'contacted']);

        $this->postJson("/api/sales/leads/{$lead->id}/lost", ['reason' => 'timing'])->assertOk();
        $this->postJson("/api/sales/leads/{$lead->id}/reopen", [])->assertOk();

        $fresh = $lead->fresh();
        $this->assertSame('new', $fresh->stage->value);
        $this->assertNull($fresh->lost_reason);
        // created→lost→reopened rows all preserved
        $this->assertSame(2, $fresh->stageHistory()->count());
    }

    public function test_convert_requires_offer_and_creates_onboarding_tasks(): void
    {
        $gym = $this->makeGym();
        $admin = $this->makeAdmin($gym);
        $this->actingAsUser($admin);
        $lead = $this->makeLead($gym, ['stage' => 'offer_presented', 'assigned_to' => $admin->id]);
        $offer = SalesOffer::create([
            'gym_id' => $gym, 'lead_id' => $lead->id,
            'quoted_price' => 1200, 'created_by' => $admin->id,
        ]);

        $res = $this->postJson("/api/sales/leads/{$lead->id}/convert", [
            'offer_id' => $offer->id,
            'payment_method' => 'card',
            'final_price' => 1100,
            'start_date' => now()->addDay()->toDateString(),
            'agreement_ref' => 'AGR-001',
        ]);

        $res->assertOk()->assertJsonPath('data.stage', 'converted');
        $this->assertSame('accepted', $offer->fresh()->status);
        $this->assertSame(3, $lead->tasks()->where('type', 'onboarding')->count());
        $this->assertDatabaseHas('sales_lead_stage_history', [
            'lead_id' => $lead->id, 'from_stage' => 'offer_presented', 'to_stage' => 'converted',
        ]);
    }

    public function test_converted_lead_is_read_only(): void
    {
        $gym = $this->makeGym();
        $admin = $this->makeAdmin($gym);
        $this->actingAsUser($admin);
        $lead = $this->makeLead($gym, ['stage' => 'converted', 'assigned_to' => $admin->id]);

        $this->patchJson("/api/sales/leads/{$lead->id}", ['name' => 'Renamed'])->assertStatus(422);
        $this->postJson("/api/sales/leads/{$lead->id}/transition", ['to' => 'qualified'])->assertStatus(422);
        $this->postJson("/api/sales/leads/{$lead->id}/lost", ['reason' => 'price'])->assertStatus(422);
        $this->postJson("/api/sales/leads/{$lead->id}/activities", ['type' => 'note', 'notes' => 'x'])->assertStatus(422);
    }

    public function test_convert_from_wrong_stage_is_rejected(): void
    {
        $gym = $this->makeGym();
        $admin = $this->makeAdmin($gym);
        $this->actingAsUser($admin);
        $lead = $this->makeLead($gym, ['stage' => 'contacted', 'assigned_to' => $admin->id]);
        $offer = SalesOffer::create(['gym_id' => $gym, 'lead_id' => $lead->id, 'quoted_price' => 900]);

        $this->postJson("/api/sales/leads/{$lead->id}/convert", [
            'offer_id' => $offer->id, 'payment_method' => 'cash',
            'final_price' => 900, 'start_date' => now()->toDateString(),
        ])->assertStatus(422);
    }
}
