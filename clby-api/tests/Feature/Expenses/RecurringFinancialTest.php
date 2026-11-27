<?php

namespace Tests\Feature\Expenses;

use App\Services\RecurringExpenses;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** Financial Overview integration, generator reliability and tenant isolation. */
class RecurringFinancialTest extends ExpensesTestCase
{
    private string $gym;

    protected function setUp(): void
    {
        parent::setUp();
        $this->travelToLocal('2026-11-27 12:00');
        $this->gym = $this->makeGym();
        $this->actingAsAdmin($this->gym);
    }

    // ─── Financial ─────────────────────────────────────────────────────

    public function test_future_occurrence_is_excluded_until_its_date(): void
    {
        $this->payment($this->gym, 5000, '2026-11-10 10:00');
        $this->createRecurring(); // 1 Dec
        // Also a same-month date that hasn't arrived yet: 30 Nov.
        $this->createRecurring(['title' => 'Cleaning', 'amount' => 300, 'start_date' => '2026-11-28', 'recurrence_day' => 30]);

        $nov = $this->summary('2026-11-01', '2026-11-30');
        $this->assertEquals(0, $nov['total_expenses']);
        $this->assertEquals(5000, $nov['net_profit']);
        $this->assertEquals(0, $this->summary('2026-12-01', '2026-12-31')['total_expenses']);

        $up = $this->getJson('/api/expenses/upcoming?days=30')->assertOk()->json();
        $this->assertSame(['2026-11-30', '2026-12-01'], array_column($up['data'], 'scheduled_date'));
        $this->assertEquals(1300, $up['totals']['EGP']);
        $this->assertSame('monthly', $up['data'][0]['frequency']);
        $this->assertSame('EGP', $up['data'][0]['currency']);

        $this->travelToLocal('2026-11-30 06:00');
        $this->generate();
        $this->assertEquals(300, $this->summary('2026-11-01', '2026-11-30')['total_expenses']);
        $this->assertEquals(0, $this->summary('2026-12-01', '2026-12-31')['total_expenses']);
    }

    public function test_due_occurrence_counted_once_in_the_right_period(): void
    {
        $this->payment($this->gym, 4000, '2026-12-03 10:00');
        $this->createRecurring();
        $this->travelToLocal('2026-12-01 00:05'); // just after Cairo midnight
        $this->generate();
        $this->generate();
        (new RecurringExpenses)->generateAll();

        $dec = $this->summary('2026-12-01', '2026-12-31');
        $this->assertEquals(1000, $dec['total_expenses']);
        $this->assertSame(1, $dec['expense_count']);
        $this->assertEquals(4000, $dec['total_revenue']);
        $this->assertEquals(3000, $dec['net_profit']);
        $this->assertEquals(0, $this->summary('2026-11-01', '2026-11-30')['total_expenses']);
        // The default (current month) view agrees.
        $this->assertEquals(1000, $this->getJson('/api/expenses/summary')->json('data.total_expenses'));
    }

    public function test_gym_timezone_decides_the_date(): void
    {
        $s = $this->createRecurring();
        // 23:30 UTC on 30 Nov is already 1 Dec 01:30 in Cairo.
        $this->travelToLocal('2026-11-30 23:30', 'UTC');
        $this->generate();
        $this->assertSame(['2026-12-01'], $this->occurrenceDates($s['id']));

        $la = $this->makeGym('America/Los_Angeles');
        $this->actingAsAdmin($la);
        $s2 = $this->createRecurring(['start_date' => '2026-12-01']);
        $this->generate(); // still 30 Nov in LA
        $this->assertSame([], $this->occurrenceDates($s2['id']));
    }

    public function test_historical_periods_unchanged_by_later_changes(): void
    {
        $s = $this->createRecurring(['start_date' => '2026-09-01']);
        $this->createRecurring(['title' => 'Gym software', 'amount' => 200, 'category' => 'software', 'start_date' => '2026-09-05', 'recurrence_day' => 5]);
        $before = [
            $this->summary('2026-09-01', '2026-09-30'),
            $this->summary('2026-10-01', '2026-10-31'),
            $this->summary('2026-11-01', '2026-11-30'),
        ];

        $this->travelToLocal('2026-12-10 09:00');
        $new = $this->putJson("/api/expenses/recurring/{$s['id']}", $this->recurringPayload(['amount' => 5000, 'start_date' => '2027-01-01']))->assertOk()->json('data');
        // The pre-split half has nothing left before 31 Dec, so it's already ended.
        $this->postJson("/api/expenses/recurring/{$s['id']}/end")->assertStatus(422);
        $this->postJson("/api/expenses/recurring/{$new['id']}/end")->assertOk();
        $this->generate();

        $this->assertEquals($before[0]['total_expenses'], $this->summary('2026-09-01', '2026-09-30')['total_expenses']);
        $this->assertEquals($before[1]['total_expenses'], $this->summary('2026-10-01', '2026-10-31')['total_expenses']);
        $this->assertEquals($before[2]['total_expenses'], $this->summary('2026-11-01', '2026-11-30')['total_expenses']);
        $this->assertEquals(1200, $before[1]['total_expenses']);
    }

    public function test_currency_is_preserved_and_never_mixed(): void
    {
        $usd = $this->makeGym('Africa/Cairo', 'USD');
        $this->actingAsAdmin($usd);
        $s = $this->createRecurring(['start_date' => '2026-11-01', 'amount' => 50]);
        $this->assertSame('USD', $s['currency']);
        $this->assertSame('USD', DB::table('expenses')->where('recurring_expense_id', $s['id'])->value('currency'));

        // The gym later starts charging in EGP → gym currency flips. The USD
        // occurrence is reported, not summed into EGP.
        $this->payment($usd, 900, '2026-11-20 10:00', 'EGP');
        $sum = $this->summary('2026-11-01', '2026-11-30');
        $this->assertSame('EGP', $sum['currency']);
        $this->assertEquals(0, $sum['total_expenses']);
        $this->assertSame(['USD'], $sum['excluded_expense_currencies']);
        $this->assertEquals(900, $sum['net_profit']);

        $row = $this->getJson('/api/expenses?from=2026-11-01&to=2026-11-30')->json('data.0');
        $this->assertSame('USD', $row['currency']);
    }

    // ─── Reliability ───────────────────────────────────────────────────

    public function test_repeated_and_crashed_runs_do_not_duplicate(): void
    {
        $s = $this->createRecurring(['start_date' => '2026-08-01']);
        $this->assertCount(4, $this->occurrenceDates($s['id']));

        // A run that inserted rows but died before advancing the cursor —
        // the retry re-walks the same dates; the unique index absorbs them.
        DB::table('recurring_expenses')->where('id', $s['id'])->update(['generated_through' => null]);
        $this->generate();
        $this->generate();
        $this->assertSame(['2026-08-01', '2026-09-01', '2026-10-01', '2026-11-01'], $this->occurrenceDates($s['id']));
        $this->assertSame(4, DB::table('expenses')->where('recurring_expense_id', $s['id'])->count());
    }

    public function test_unique_index_rejects_a_second_row_for_the_same_date(): void
    {
        $s = $this->createRecurring(['start_date' => '2026-11-01']);
        $this->expectException(\Illuminate\Database\QueryException::class);
        DB::table('expenses')->insert([
            'id' => (string) Str::uuid(), 'gym_id' => $this->gym, 'recurring_expense_id' => $s['id'],
            'scheduled_date' => '2026-11-01', 'expense_date' => '2026-11-01', 'title' => 'dup',
            'amount' => 1, 'category' => 'other', 'status' => 'recorded',
        ]);
    }

    public function test_missed_runs_are_recovered(): void
    {
        $s = $this->createRecurring(['frequency' => 'weekly', 'recurrence_day' => 1, 'start_date' => '2026-12-01']);
        // Scheduler down for ~5 weeks.
        $this->travelToLocal('2027-01-06 09:00');
        $this->generate();
        $this->assertSame(['2026-12-07', '2026-12-14', '2026-12-21', '2026-12-28', '2027-01-04'], $this->occurrenceDates($s['id']));
        // Each lands in its own month.
        $this->assertEquals(4000, $this->summary('2026-12-01', '2026-12-31')['total_expenses']);
        $this->assertEquals(1000, $this->summary('2027-01-01', '2027-01-31')['total_expenses']);
    }

    public function test_one_failing_schedule_does_not_block_others(): void
    {
        $good = $this->createRecurring();
        $bad = $this->createRecurring(['title' => 'Bad']);
        DB::table('recurring_expenses')->where('id', $bad['id'])->update(['frequency' => 'daily']); // corrupt
        $this->travelToLocal('2026-12-01 09:00');
        $r = (new RecurringExpenses)->generateAll();
        $this->assertSame(1, $r['failed']);
        $this->assertSame(['2026-12-01'], $this->occurrenceDates($good['id']));
    }

    // ─── Tenant isolation ──────────────────────────────────────────────

    public function test_tenant_isolation(): void
    {
        $mine = $this->createRecurring(['start_date' => '2026-11-01']);
        $myOcc = DB::table('expenses')->where('recurring_expense_id', $mine['id'])->value('id');

        $other = $this->makeGym();
        $this->actingAsAdmin($other);
        $theirs = $this->createRecurring(['start_date' => '2026-11-01', 'title' => 'Theirs']);
        $this->assertSame($other, DB::table('expenses')->where('recurring_expense_id', $theirs['id'])->value('gym_id'));

        foreach ([
            ['get', "/api/expenses/recurring/{$mine['id']}"],
            ['put', "/api/expenses/recurring/{$mine['id']}"],
            ['post', "/api/expenses/recurring/{$mine['id']}/pause"],
            ['post', "/api/expenses/recurring/{$mine['id']}/resume"],
            ['post', "/api/expenses/recurring/{$mine['id']}/end"],
            ['put', "/api/expenses/recurring/{$mine['id']}/occurrences/2026-12-01"],
            ['post', "/api/expenses/recurring/{$mine['id']}/occurrences/2026-12-01/skip"],
            ['get', "/api/expenses/{$myOcc}"],
            ['put', "/api/expenses/{$myOcc}"],
            ['delete', "/api/expenses/{$myOcc}"],
        ] as [$m, $url]) {
            $this->json($m, $url, $this->recurringPayload(['start_date' => '2026-12-01']))->assertNotFound();
        }

        $this->assertSame(['Theirs'], array_column($this->getJson('/api/expenses/recurring')->json('data'), 'title'));
        $this->assertSame(['Theirs'], array_column($this->getJson('/api/expenses?from=2026-11-01&to=2026-11-30')->json('data'), 'title'));
        $this->assertSame(['Theirs'], array_unique(array_column($this->getJson('/api/expenses/upcoming')->json('data'), 'title')));
        $this->assertEquals(1000, $this->summary('2026-11-01', '2026-11-30')['total_expenses']);
        $this->assertSame('active', DB::table('recurring_expenses')->where('id', $mine['id'])->value('status'));

        // gym_id in the body is ignored.
        $s = $this->createRecurring(['gym_id' => $this->gym, 'title' => 'Sneaky']);
        $this->assertSame($other, DB::table('recurring_expenses')->where('id', $s['id'])->value('gym_id'));
    }
}
