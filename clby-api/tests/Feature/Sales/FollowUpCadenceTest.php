<?php

namespace Tests\Feature\Sales;

use App\Models\Sales\SalesTask;

class FollowUpCadenceTest extends SalesTestCase
{
    public function test_no_answer_creates_day_1_3_7_follow_up_tasks(): void
    {
        $gym = $this->makeGym();
        $branch = $this->makeBranch($gym);
        $rep = $this->makeSalesStaff($gym, $branch);
        $lead = $this->makeLead($gym, ['branch_id' => $branch, 'assigned_to' => $rep->id]);

        $this->actingAsUser($rep);
        $res = $this->postJson("/api/sales/leads/{$lead->id}/activities", [
            'type' => 'call', 'outcome' => 'no_answer',
        ]);

        $res->assertStatus(201)->assertJsonPath('follow_up_tasks_created', 3);

        $tasks = SalesTask::where('lead_id', $lead->id)->where('type', 'follow_up')
            ->orderBy('due_at')->get();
        $this->assertCount(3, $tasks);
        $this->assertEqualsWithDelta(1, now()->diffInDays($tasks[0]->due_at), 0.1);
        $this->assertEqualsWithDelta(3, now()->diffInDays($tasks[1]->due_at), 0.1);
        $this->assertEqualsWithDelta(7, now()->diffInDays($tasks[2]->due_at), 0.1);
        $this->assertTrue($tasks->every(fn ($t) => $t->assigned_to === $rep->id));
    }

    public function test_repeat_no_answer_does_not_stack_open_tasks(): void
    {
        $gym = $this->makeGym();
        $rep = $this->makeSalesStaff($gym);
        $lead = $this->makeLead($gym, ['assigned_to' => $rep->id]);

        $this->actingAsUser($rep);
        $this->postJson("/api/sales/leads/{$lead->id}/activities", ['type' => 'call', 'outcome' => 'no_answer']);
        $this->postJson("/api/sales/leads/{$lead->id}/activities", ['type' => 'whatsapp', 'outcome' => 'no_answer']);

        $this->assertSame(3, SalesTask::where('lead_id', $lead->id)->where('type', 'follow_up')->count());
    }

    public function test_speed_to_lead_stamped_and_attempts_counted(): void
    {
        $gym = $this->makeGym();
        $rep = $this->makeSalesStaff($gym);
        $lead = $this->makeLead($gym, ['assigned_to' => $rep->id]);
        $this->assertNull($lead->first_contacted_at);

        $this->actingAsUser($rep);
        $this->postJson("/api/sales/leads/{$lead->id}/activities", ['type' => 'call', 'outcome' => 'answered']);

        $fresh = $lead->fresh();
        $this->assertNotNull($fresh->first_contacted_at);
        $this->assertSame(1, $fresh->contact_attempts);

        // Notes are not contact attempts.
        $this->postJson("/api/sales/leads/{$lead->id}/activities", ['type' => 'note', 'notes' => 'hi']);
        $this->assertSame(1, $lead->fresh()->contact_attempts);
    }

    public function test_prompt_lost_after_max_attempts(): void
    {
        $gym = $this->makeGym();
        $rep = $this->makeSalesStaff($gym);
        $lead = $this->makeLead($gym, ['assigned_to' => $rep->id, 'contact_attempts' => 4]);

        $this->actingAsUser($rep);
        $res = $this->postJson("/api/sales/leads/{$lead->id}/activities", [
            'type' => 'call', 'outcome' => 'no_answer',
        ]);

        // 5th attempt hits the default max_contact_attempts=5.
        $res->assertStatus(201)->assertJsonPath('prompt_lost', true);
    }
}
