<?php

namespace Tests\Feature\Expenses;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** One-off expenses must behave exactly as before recurring expenses existed. */
class OneOffExpensesTest extends ExpensesTestCase
{
    private string $gym;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelToLocal('2026-11-27 12:00');
        $this->gym = $this->makeGym();
        $this->actingAsAdmin($this->gym);
    }

    private function oneOff(array $o = []): array
    {
        return $this->postJson('/api/expenses', $o + [
            'title' => 'Plumber', 'amount' => 250.5, 'expense_date' => '2026-11-10',
            'category' => 'maintenance', 'vendor' => 'Ahmed', 'payment_method' => 'cash',
        ])->assertCreated()->json('data');
    }

    public function test_create_records_once_and_counts_in_totals(): void
    {
        $e = $this->oneOff();
        $this->assertEquals(1, DB::table('expenses')->where('gym_id', $this->gym)->count());
        $this->assertSame('recorded', $e['status']);
        $this->assertNull($e['recurring_expense_id']);
        $this->assertSame('EGP', $e['currency']);

        $this->payment($this->gym, 1000, '2026-11-05 09:00');
        $s = $this->summary('2026-11-01', '2026-11-30');
        $this->assertEquals(250.5, $s['total_expenses']);
        $this->assertEquals(1000.0, $s['total_revenue']);
        $this->assertEquals(749.5, $s['net_profit']);
        $this->assertEquals(1, $s['expense_count']);
    }

    public function test_default_period_is_current_month_as_before(): void
    {
        $this->oneOff(['expense_date' => '2026-11-30']); // later this month still counts
        $this->oneOff(['expense_date' => '2026-10-31']);
        $s = $this->getJson('/api/expenses/summary')->assertOk()->json('data');
        $this->assertSame('2026-11-01', $s['from']);
        $this->assertEquals(250.5, $s['total_expenses']);
        $this->assertTrue($s['is_current_month']);
    }

    public function test_recurrence_fields_on_one_off_are_ignored(): void
    {
        $this->oneOff(['frequency' => 'monthly', 'start_date' => '2026-11-01', 'recurrence_day' => 1]);
        $this->assertEquals(0, DB::table('recurring_expenses')->count());
        $this->assertEquals(1, DB::table('expenses')->count());
    }

    public function test_validation_unchanged(): void
    {
        $this->postJson('/api/expenses', ['title' => '', 'amount' => -1])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['title', 'amount', 'expense_date', 'category']);
    }

    public function test_view_edit_delete_unchanged(): void
    {
        $e = $this->oneOff();
        $this->getJson("/api/expenses/{$e['id']}")->assertOk()->assertJsonPath('data.title', 'Plumber');

        $this->putJson("/api/expenses/{$e['id']}", ['amount' => 300])->assertOk()->assertJsonPath('data.amount', 300);

        $this->deleteJson("/api/expenses/{$e['id']}")->assertOk()->assertJsonPath('message', 'Expense deleted');
        $this->assertEquals(0, DB::table('expenses')->count()); // one-off delete is still a real delete
    }

    public function test_search_category_type_filters_sort_and_export(): void
    {
        $this->oneOff(['title' => 'Plumber', 'amount' => 100, 'expense_date' => '2026-11-03']);
        $this->oneOff(['title' => 'Flyers', 'amount' => 50, 'category' => 'marketing', 'vendor' => 'PrintCo', 'expense_date' => '2026-11-04']);
        $r = $this->createRecurring(['start_date' => '2026-11-01', 'amount' => 700]); // records 1 Nov

        $q = '/api/expenses?from=2026-11-01&to=2026-11-30';
        $this->assertCount(3, $this->getJson($q)->json('data'));
        $this->assertSame(['Flyers'], array_column($this->getJson("$q&search=print")->json('data'), 'title'));
        $this->assertSame(['Flyers'], array_column($this->getJson("$q&category=marketing")->json('data'), 'title'));
        $this->assertSame(['Flyers', 'Plumber'], array_column($this->getJson("$q&type=one_off")->json('data'), 'title'));
        $this->assertSame(['Internet'], array_column($this->getJson("$q&type=recurring")->json('data'), 'title'));
        $this->assertSame(['Internet'], array_column($this->getJson("$q&type=active")->json('data'), 'title'));
        $this->assertSame([], $this->getJson("$q&type=paused")->json('data'));
        $this->assertEquals([50.0, 100.0, 700.0], array_column($this->getJson("$q&sort=amount&dir=asc")->json('data'), 'amount'));

        $rec = collect($this->getJson($q)->json('data'))->firstWhere('title', 'Internet');
        $this->assertSame('monthly', $rec['recurring']['frequency']);
        $this->assertSame('2026-12-01', $rec['recurring']['next_occurrence']);

        $x = $this->getJson('/api/expenses/export?from=2026-11-01&to=2026-11-30')->assertOk()->json();
        $this->assertCount(3, $x['data']);
        $this->assertEquals(850.0, $x['summary']['total_expenses']);
        $this->assertEquals(array_sum(array_column($x['data'], 'amount')), $x['summary']['total_expenses']);
    }

    public function test_legacy_rows_without_new_columns_still_work(): void
    {
        // A row as it existed before the migration: no currency, default status.
        $id = (string) Str::uuid();
        DB::table('expenses')->insert([
            'id' => $id, 'gym_id' => $this->gym, 'title' => 'Old rent', 'amount' => 5000,
            'expense_date' => '2026-11-01', 'category' => 'rent', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $row = $this->getJson('/api/expenses?from=2026-11-01&to=2026-11-30')->json('data.0');
        $this->assertSame('Old rent', $row['title']);
        $this->assertSame('EGP', $row['currency']);
        $this->assertSame('recorded', $row['status']);
        $this->assertEquals(5000.0, $this->summary('2026-11-01', '2026-11-30')['total_expenses']);
        $this->putJson("/api/expenses/{$id}", ['title' => 'Old rent (Nov)'])->assertOk();
        $this->deleteJson("/api/expenses/{$id}")->assertOk();
    }

    public function test_members_cannot_reach_expenses(): void
    {
        $this->actingAs($this->makeUser($this->gym, 'member'));
        $this->getJson('/api/expenses')->assertForbidden();
        $this->getJson('/api/expenses/recurring')->assertForbidden();
        $this->postJson('/api/expenses/recurring', $this->recurringPayload())->assertForbidden();
    }
}
