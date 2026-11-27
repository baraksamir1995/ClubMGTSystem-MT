<?php

namespace Tests\Feature\Expenses;

use Illuminate\Support\Facades\DB;

/** Schedule lifecycle + occurrence generation. "Today" is gym-local (Cairo). */
class RecurringExpensesTest extends ExpensesTestCase
{
    private string $gym;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelToLocal('2026-11-27 12:00');
        $this->gym = $this->makeGym();
        $this->actingAsAdmin($this->gym);
    }

    // ─── Creation + generation per frequency ───────────────────────────

    public function test_spec_example_internet_monthly_from_1_dec(): void
    {
        $s = $this->createRecurring(); // 1,000 EGP monthly from 01 Dec 2026, no end
        $this->assertSame('active', $s['status']);
        $this->assertSame('EGP', $s['currency']);
        $this->assertNull($s['end_date']);
        $this->assertSame('2026-12-01', $s['next_occurrence']);
        $this->assertSame([], $this->occurrenceDates($s['id'])); // nothing recorded in advance

        foreach (['2026-12-01 00:30', '2027-01-01 08:00', '2027-02-01 23:00'] as $t) {
            $this->travelToLocal($t);
            $this->generate();
        }
        $this->assertSame(['2026-12-01', '2027-01-01', '2027-02-01'], $this->occurrenceDates($s['id']));
        $row = DB::table('expenses')->where('recurring_expense_id', $s['id'])->first();
        $this->assertSame($this->gym, $row->gym_id);
        $this->assertSame('Internet', $row->title);
        $this->assertSame('EGP', $row->currency);
        $this->assertNotNull($row->recorded_at);
    }

    public function test_weekly_generation(): void
    {
        // Fridays (ISO 5) from Tue 1 Dec.
        $s = $this->createRecurring(['frequency' => 'weekly', 'recurrence_day' => 5, 'start_date' => '2026-12-01']);
        $this->travelToLocal('2026-12-26 09:00');
        $this->generate();
        $this->assertSame(['2026-12-04', '2026-12-11', '2026-12-18', '2026-12-25'], $this->occurrenceDates($s['id']));
    }

    public function test_quarterly_generation_with_interval(): void
    {
        $s = $this->createRecurring(['frequency' => 'quarterly', 'recurrence_day' => 10, 'start_date' => '2026-12-01']);
        $this->travelToLocal('2027-07-10 09:00');
        $this->generate();
        $this->assertSame(['2026-12-10', '2027-03-10', '2027-06-10'], $this->occurrenceDates($s['id']));
        $this->assertSame('2027-09-10', $this->getJson("/api/expenses/recurring/{$s['id']}")->json('data.next_occurrence'));
    }

    public function test_yearly_generation(): void
    {
        $s = $this->createRecurring(['frequency' => 'yearly', 'recurrence_month' => 1, 'recurrence_day' => 15, 'start_date' => '2026-12-01']);
        $this->travelToLocal('2029-01-15 09:00');
        $this->generate();
        $this->assertSame(['2027-01-15', '2028-01-15', '2029-01-15'], $this->occurrenceDates($s['id']));
    }

    public function test_month_end_fallback_in_generation(): void
    {
        $s = $this->createRecurring(['recurrence_day' => 31, 'start_date' => '2026-12-01']);
        $this->travelToLocal('2027-04-30 09:00');
        $this->generate();
        $this->assertSame(['2026-12-31', '2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30'], $this->occurrenceDates($s['id']));
    }

    public function test_past_start_date_records_due_dates_at_creation(): void
    {
        $s = $this->createRecurring(['start_date' => '2026-09-01']);
        $this->assertSame(['2026-09-01', '2026-10-01', '2026-11-01'], $this->occurrenceDates($s['id']));
        $this->assertSame('2026-11-27', $s['generated_through']);
    }

    public function test_start_and_end_dates_respected_and_schedule_auto_ends(): void
    {
        $s = $this->createRecurring(['start_date' => '2026-12-01', 'end_date' => '2027-02-15']);
        $this->travelToLocal('2027-06-01 09:00');
        $this->generate();
        $this->assertSame(['2026-12-01', '2027-01-01', '2027-02-01'], $this->occurrenceDates($s['id']));
        $show = $this->getJson("/api/expenses/recurring/{$s['id']}")->json('data');
        $this->assertSame('ended', $show['status']);
        $this->assertNull($show['next_occurrence']);
        $this->assertContains('auto_ended', array_column($show['events'], 'action'));
    }

    public function test_validation(): void
    {
        $this->postJson('/api/expenses/recurring', [])->assertStatus(422)
            ->assertJsonValidationErrors(['title', 'amount', 'category', 'frequency', 'start_date', 'recurrence_day']);
        $this->postJson('/api/expenses/recurring', $this->recurringPayload(['frequency' => 'weekly', 'recurrence_day' => 8]))
            ->assertJsonValidationErrors(['recurrence_day']);
        $this->postJson('/api/expenses/recurring', $this->recurringPayload(['frequency' => 'yearly', 'recurrence_day' => 30]))
            ->assertJsonValidationErrors(['recurrence_month']);
        $this->postJson('/api/expenses/recurring', $this->recurringPayload(['frequency' => 'yearly', 'recurrence_month' => 2, 'recurrence_day' => 30]))
            ->assertJsonValidationErrors(['recurrence_day']);
        $this->postJson('/api/expenses/recurring', $this->recurringPayload(['end_date' => '2026-11-01']))
            ->assertJsonValidationErrors(['end_date']);
        $this->postJson('/api/expenses/recurring', $this->recurringPayload(['start_date' => '2025-01-01']))
            ->assertJsonValidationErrors(['start_date']); // > 1 year back
        $this->postJson('/api/expenses/recurring', $this->recurringPayload(['start_date' => '2026-12-02', 'end_date' => '2026-12-20']))
            ->assertJsonValidationErrors(['end_date']); // never occurs
        $this->postJson('/api/expenses/recurring', $this->recurringPayload(['interval' => 0]))
            ->assertJsonValidationErrors(['interval']);
        $this->assertSame(0, DB::table('recurring_expenses')->count());
    }

    // ─── Pause / resume / end ──────────────────────────────────────────

    public function test_pause_stops_generation_and_keeps_history(): void
    {
        $s = $this->createRecurring(['start_date' => '2026-11-01']); // records 1 Nov
        $this->postJson("/api/expenses/recurring/{$s['id']}/pause")->assertOk()
            ->assertJsonPath('data.status', 'paused')
            ->assertJsonPath('data.next_occurrence', null);

        $this->travelToLocal('2027-01-15 09:00');
        $this->generate();
        $this->assertSame(['2026-11-01'], $this->occurrenceDates($s['id']));
        $this->postJson("/api/expenses/recurring/{$s['id']}/pause")->assertStatus(422);
    }

    public function test_pause_first_records_what_was_already_due(): void
    {
        $s = $this->createRecurring(); // from 1 Dec
        // Scheduler hasn't run yet on 1 Dec when the admin pauses at 10:00.
        $this->travelToLocal('2026-12-01 10:00');
        $this->postJson("/api/expenses/recurring/{$s['id']}/pause")->assertOk();
        $this->assertSame(['2026-12-01'], $this->occurrenceDates($s['id']));
    }

    public function test_resume_continues_without_duplicates_or_backfill(): void
    {
        $s = $this->createRecurring(['start_date' => '2026-11-01']);
        $this->postJson("/api/expenses/recurring/{$s['id']}/pause")->assertOk();

        // Paused across 1 Dec and 1 Jan; resume on 10 Jan.
        $this->travelToLocal('2027-01-10 09:00');
        $this->generate();
        $res = $this->postJson("/api/expenses/recurring/{$s['id']}/resume")->assertOk();
        $this->assertSame('active', $res->json('data.status'));
        $this->assertSame('2027-02-01', $res->json('data.next_occurrence'));
        $this->assertSame(['2026-11-01'], $this->occurrenceDates($s['id'])); // no Dec/Jan backfill

        $this->travelToLocal('2027-02-01 09:00');
        $this->generate();
        $this->generate();
        $this->assertSame(['2026-11-01', '2027-02-01'], $this->occurrenceDates($s['id']));

        $events = $this->getJson("/api/expenses/recurring/{$s['id']}")->json('data.events');
        $resumed = collect($events)->firstWhere('action', 'resumed');
        $this->assertSame(['2026-11-28', '2027-01-09'], $resumed['details']['not_backfilled']);
    }

    public function test_resume_on_an_occurrence_day_records_that_day_once(): void
    {
        $s = $this->createRecurring(['start_date' => '2026-11-01']);
        $this->postJson("/api/expenses/recurring/{$s['id']}/pause")->assertOk();
        $this->travelToLocal('2026-12-01 09:00');
        $this->postJson("/api/expenses/recurring/{$s['id']}/resume")->assertOk();
        $this->generate();
        $this->assertSame(['2026-11-01', '2026-12-01'], $this->occurrenceDates($s['id']));
    }

    public function test_pause_and_resume_same_day_does_not_duplicate(): void
    {
        $s = $this->createRecurring(['start_date' => '2026-11-27', 'frequency' => 'weekly', 'recurrence_day' => 5]); // Fri 27 Nov
        $this->assertSame(['2026-11-27'], $this->occurrenceDates($s['id']));
        $this->postJson("/api/expenses/recurring/{$s['id']}/pause")->assertOk();
        $this->postJson("/api/expenses/recurring/{$s['id']}/resume")->assertOk();
        $this->generate();
        $this->assertSame(['2026-11-27'], $this->occurrenceDates($s['id']));
    }

    public function test_end_stops_future_and_keeps_history(): void
    {
        $s = $this->createRecurring(['start_date' => '2026-10-01']);
        $this->travelToLocal('2026-12-05 09:00');
        $this->postJson("/api/expenses/recurring/{$s['id']}/end")->assertOk()
            ->assertJsonPath('data.status', 'ended')
            ->assertJsonPath('data.end_date', '2026-12-05');

        $this->travelToLocal('2027-03-05 09:00');
        $this->generate();
        $this->assertSame(['2026-10-01', '2026-11-01', '2026-12-01'], $this->occurrenceDates($s['id']));
        $this->postJson("/api/expenses/recurring/{$s['id']}/resume")->assertStatus(422);
        $this->postJson("/api/expenses/recurring/{$s['id']}/end")->assertStatus(422);
        $this->putJson("/api/expenses/recurring/{$s['id']}", $this->recurringPayload(['start_date' => '2027-04-01']))->assertStatus(422);

        $audit = $this->getJson("/api/expenses/recurring/{$s['id']}")->json('data.audit');
        $this->assertNotNull($audit['ended_at']);
        $this->assertNotNull($audit['ended_by']);
    }

    public function test_end_a_paused_schedule(): void
    {
        $s = $this->createRecurring(['start_date' => '2026-11-01']);
        $this->postJson("/api/expenses/recurring/{$s['id']}/pause")->assertOk();
        $this->postJson("/api/expenses/recurring/{$s['id']}/end")->assertOk()->assertJsonPath('data.status', 'ended');
        $this->assertSame(['2026-11-01'], $this->occurrenceDates($s['id']));
    }

    // ─── Occurrence-level edits ────────────────────────────────────────

    public function test_edit_recorded_occurrence_only(): void
    {
        $s = $this->createRecurring(['start_date' => '2026-10-01']);
        $oct = DB::table('expenses')->where('recurring_expense_id', $s['id'])->where('scheduled_date', '2026-10-01')->first();

        $this->putJson("/api/expenses/{$oct->id}", ['amount' => 1200, 'title' => 'Internet + upgrade'])->assertOk();

        $this->assertEquals(1000, DB::table('recurring_expenses')->where('id', $s['id'])->value('amount'));
        $this->assertEquals(1000, DB::table('expenses')->where('recurring_expense_id', $s['id'])->where('scheduled_date', '2026-11-01')->value('amount'));
        $this->travelToLocal('2026-12-01 09:00');
        $this->generate();
        $this->assertEquals(1000, DB::table('expenses')->where('recurring_expense_id', $s['id'])->where('scheduled_date', '2026-12-01')->value('amount'));

        $ev = collect($this->getJson("/api/expenses/recurring/{$s['id']}")->json('data.events'))->firstWhere('action', 'occurrence_edited');
        $this->assertEquals(1000, $ev['details']['before']['amount']);
        $this->assertEquals(1200, $ev['details']['changes']['amount']);
    }

    public function test_edit_upcoming_occurrence_only(): void
    {
        $s = $this->createRecurring(['start_date' => '2026-12-01']);
        $this->putJson("/api/expenses/recurring/{$s['id']}/occurrences/2027-01-01", ['amount' => 1500])->assertOk()
            ->assertJsonPath('data.status', 'scheduled');
        $this->putJson("/api/expenses/recurring/{$s['id']}/occurrences/2027-01-02", ['amount' => 1500])->assertStatus(422);

        // Not an actual expense until its date.
        $this->assertEquals(0, $this->summary('2027-01-01', '2027-01-31')['total_expenses']);
        $up = collect($this->getJson('/api/expenses/upcoming?days=60')->json('data'));
        $this->assertTrue($up->firstWhere('scheduled_date', '2027-01-01')['modified']);
        $this->assertEquals(1500, $up->firstWhere('scheduled_date', '2027-01-01')['amount']);

        $this->travelToLocal('2027-02-01 09:00');
        $this->generate();
        $this->assertSame(['2026-12-01', '2027-01-01', '2027-02-01'], $this->occurrenceDates($s['id']));
        $amounts = DB::table('expenses')->where('recurring_expense_id', $s['id'])->orderBy('scheduled_date')->pluck('amount')->map(fn ($a) => (float) $a)->all();
        $this->assertSame([1000.0, 1500.0, 1000.0], $amounts);
        $this->assertEquals(1500, $this->summary('2027-01-01', '2027-01-31')['total_expenses']);
    }

    public function test_skip_upcoming_occurrence(): void
    {
        $s = $this->createRecurring(['start_date' => '2026-12-01']);
        $this->postJson("/api/expenses/recurring/{$s['id']}/occurrences/2026-12-01/skip")->assertOk()->assertJsonPath('data.status', 'skipped');
        $this->assertSame('2027-01-01', $this->getJson("/api/expenses/recurring/{$s['id']}")->json('data.next_occurrence'));

        $this->travelToLocal('2027-01-01 09:00');
        $this->generate();
        $this->assertSame(['2027-01-01'], $this->occurrenceDates($s['id']));
        $this->assertSame(['2026-12-01'], $this->occurrenceDates($s['id'], 'skipped'));
        // Past dates can't be skipped; use cancel on the recorded row instead.
        $this->postJson("/api/expenses/recurring/{$s['id']}/occurrences/2027-01-01/skip")->assertStatus(422);
    }

    public function test_cancel_recorded_occurrence_keeps_row_and_is_not_regenerated(): void
    {
        $s = $this->createRecurring(['start_date' => '2026-11-01']);
        $nov = DB::table('expenses')->where('recurring_expense_id', $s['id'])->first();

        $this->deleteJson("/api/expenses/{$nov->id}")->assertOk()->assertJsonPath('message', 'Occurrence cancelled');
        $this->assertSame('cancelled', DB::table('expenses')->where('id', $nov->id)->value('status'));
        $this->assertEquals(0, $this->summary('2026-11-01', '2026-11-30')['total_expenses']);
        $this->assertSame([], $this->getJson('/api/expenses?from=2026-11-01&to=2026-11-30')->json('data'));

        // Even a forced full re-run can't bring it back.
        DB::table('recurring_expenses')->where('id', $s['id'])->update(['generated_through' => null]);
        $this->generate();
        $this->assertSame([], $this->occurrenceDates($s['id']));
        $this->deleteJson("/api/expenses/{$nov->id}")->assertStatus(422);
        $this->putJson("/api/expenses/{$nov->id}", ['amount' => 5])->assertStatus(422);
    }

    // ─── Edit this and future (split) ──────────────────────────────────

    public function test_edit_this_and_future_splits_and_preserves_history(): void
    {
        $s = $this->createRecurring(['start_date' => '2026-10-01']); // Oct, Nov recorded
        $this->travelToLocal('2026-12-15 09:00');
        $this->generate(); // Dec recorded

        $new = $this->putJson("/api/expenses/recurring/{$s['id']}", $this->recurringPayload([
            'amount' => 1200, 'start_date' => '2027-01-01',
        ]))->assertOk()->json('data');

        $this->assertNotSame($s['id'], $new['id']);
        $this->assertSame($s['id'], $new['previous_id']);
        $old = $this->getJson("/api/expenses/recurring/{$s['id']}")->json('data');
        $this->assertSame('2026-12-31', $old['end_date']);
        $this->assertSame($new['id'], $old['continued_by']);
        $this->assertContains('split', array_column($old['events'], 'action'));
        // Nothing left between today and 31 Dec → the old half ends at once,
        // instead of lingering as "active" with no next occurrence.
        $this->assertSame('ended', $old['status']);
        $this->assertNull($old['next_occurrence']);

        $this->travelToLocal('2027-02-01 09:00');
        $this->generate();
        $this->assertSame(['2026-10-01', '2026-11-01', '2026-12-01'], $this->occurrenceDates($s['id']));
        $this->assertSame(['2027-01-01', '2027-02-01'], $this->occurrenceDates($new['id']));
        $this->assertSame('ended', DB::table('recurring_expenses')->where('id', $s['id'])->value('status'));
        // History untouched.
        $this->assertSame([1000.0], DB::table('expenses')->where('recurring_expense_id', $s['id'])->pluck('amount')->map(fn ($a) => (float) $a)->unique()->values()->all());
        $this->assertSame([1200.0], DB::table('expenses')->where('recurring_expense_id', $new['id'])->pluck('amount')->map(fn ($a) => (float) $a)->unique()->values()->all());
    }

    public function test_split_effective_today_does_not_duplicate_todays_occurrence(): void
    {
        $s = $this->createRecurring(['start_date' => '2026-11-01']);
        $this->travelToLocal('2026-12-01 09:00');
        $this->generate(); // 1 Dec recorded by the old schedule

        $new = $this->putJson("/api/expenses/recurring/{$s['id']}", $this->recurringPayload([
            'amount' => 1100, 'start_date' => '2026-12-01',
        ]))->assertOk()->json('data');
        $this->generate();

        $this->assertSame(['2026-11-01', '2026-12-01'], $this->occurrenceDates($s['id']));
        $this->assertSame([], $this->occurrenceDates($new['id']));
        $this->assertSame('2027-01-01', $new['next_occurrence']);
        $this->assertSame('ended', DB::table('recurring_expenses')->where('id', $s['id'])->value('status'));
        $this->assertEquals(1000, $this->summary('2026-12-01', '2026-12-31')['total_expenses']);
    }

    public function test_edit_before_anything_recorded_updates_in_place(): void
    {
        $s = $this->createRecurring(['start_date' => '2026-12-01']);
        $res = $this->putJson("/api/expenses/recurring/{$s['id']}", $this->recurringPayload([
            'start_date' => '2026-12-01', 'recurrence_day' => 15, 'amount' => 900,
        ]))->assertOk()->json('data');
        $this->assertSame($s['id'], $res['id']);
        $this->assertSame('2026-12-15', $res['next_occurrence']);
        $this->assertSame(1, DB::table('recurring_expenses')->count());
    }

    public function test_edit_this_and_future_cannot_start_in_the_past(): void
    {
        $s = $this->createRecurring(['start_date' => '2026-10-01']);
        $this->putJson("/api/expenses/recurring/{$s['id']}", $this->recurringPayload(['start_date' => '2026-11-01']))
            ->assertStatus(422)->assertJsonValidationErrors(['start_date']);
        $this->assertSame(['2026-10-01', '2026-11-01'], $this->occurrenceDates($s['id']));
    }

    public function test_split_keeps_paused_state(): void
    {
        $s = $this->createRecurring(['start_date' => '2026-10-01']);
        $this->postJson("/api/expenses/recurring/{$s['id']}/pause")->assertOk();
        $new = $this->putJson("/api/expenses/recurring/{$s['id']}", $this->recurringPayload(['start_date' => '2027-01-01']))->json('data');
        $this->assertSame('paused', $new['status']);
    }

    // ─── Listing / details ─────────────────────────────────────────────

    public function test_schedule_list_and_details(): void
    {
        $a = $this->createRecurring(['start_date' => '2026-10-01', 'title' => 'Rent', 'category' => 'rent']);
        $b = $this->createRecurring(['title' => 'Cleaning', 'frequency' => 'weekly', 'recurrence_day' => 1]);
        $this->postJson("/api/expenses/recurring/{$b['id']}/pause")->assertOk();

        $list = $this->getJson('/api/expenses/recurring')->assertOk()->json('data');
        $this->assertSame(['Rent', 'Cleaning'], array_column($list, 'title')); // active first
        $this->assertSame(2, $list[0]['recorded_count']);
        $this->assertEquals(2000, $list[0]['recorded_total']);
        $this->assertSame(['Cleaning'], array_column($this->getJson('/api/expenses/recurring?status=paused')->json('data'), 'title'));

        $d = $this->getJson("/api/expenses/recurring/{$a['id']}")->assertOk()->json('data');
        $this->assertSame(['2026-11-01', '2026-10-01'], array_column($d['occurrences'], 'scheduled_date'));
        $this->assertSame('recorded', $d['occurrences'][0]['status']);
        $this->assertNotNull($d['occurrences'][0]['recorded_at']);
        $this->assertSame(['2026-12-01', '2027-01-01'], array_slice($d['upcoming'], 0, 2));
        $this->assertSame('created', end($d['events'])['action']);
        $this->assertNotNull($d['audit']['created_by']);
        $this->assertArrayNotHasKey('gym_id', $d);

        // Occurrence view carries the schedule.
        $occ = $this->getJson("/api/expenses/{$d['occurrences'][0]['id']}")->assertOk()->json('data');
        $this->assertSame('monthly', $occ['recurring']['frequency']);
    }

    public function test_activity_log_records_lifecycle_actions(): void
    {
        $s = $this->createRecurring();
        $this->postJson("/api/expenses/recurring/{$s['id']}/pause")->assertOk();
        $this->assertGreaterThanOrEqual(2, DB::table('staff_activity_logs')->where('module', 'payments')->count());
        $this->assertTrue(DB::table('staff_activity_logs')->where('description', 'like', '%paused a recurring expense%')->exists());
    }
}
