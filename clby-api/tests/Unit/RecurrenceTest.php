<?php

namespace Tests\Unit;

use App\Support\Recurrence;
use PHPUnit\Framework\TestCase;

/** Pure schedule math — no DB, no clock. */
class RecurrenceTest extends TestCase
{
    public function test_monthly_on_day_one(): void
    {
        $r = new Recurrence('monthly', 1, '2026-12-01', null, 1);
        $this->assertSame(['2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01'], $r->between('2026-11-01', '2027-03-31'));
    }

    public function test_monthly_first_occurrence_is_first_date_on_or_after_start(): void
    {
        // Start on the 15th, pay on the 1st → first occurrence is next month.
        $r = new Recurrence('monthly', 1, '2026-11-15', null, 1);
        $this->assertSame('2026-12-01', $r->nextOnOrAfter('2026-01-01'));
        $r = new Recurrence('monthly', 1, '2026-11-15', null, 20);
        $this->assertSame('2026-11-20', $r->nextOnOrAfter('2026-11-15'));
    }

    public function test_month_end_clamps_to_last_day_without_drift(): void
    {
        $r = new Recurrence('monthly', 1, '2027-01-01', null, 31);
        $this->assertSame(
            ['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30', '2027-05-31'],
            $r->between('2027-01-01', '2027-05-31'),
        );
        // Leap year February.
        $r = new Recurrence('monthly', 1, '2028-02-01', null, 30);
        $this->assertSame(['2028-02-29', '2028-03-30'], $r->between('2028-02-01', '2028-03-31'));
    }

    public function test_monthly_interval(): void
    {
        $r = new Recurrence('monthly', 2, '2026-01-10', null, 10);
        $this->assertSame(['2026-01-10', '2026-03-10', '2026-05-10'], $r->between('2026-01-01', '2026-06-30'));
    }

    public function test_weekly_on_weekday_with_interval(): void
    {
        // 2026-12-01 is a Tuesday; ISO 5 = Friday.
        $r = new Recurrence('weekly', 1, '2026-12-01', null, 5);
        $this->assertSame(['2026-12-04', '2026-12-11', '2026-12-18'], $r->between('2026-12-01', '2026-12-20'));
        $r = new Recurrence('weekly', 2, '2026-12-01', null, 2);
        $this->assertSame(['2026-12-01', '2026-12-15', '2026-12-29'], $r->between('2026-11-01', '2026-12-31'));
    }

    public function test_weekly_scan_from_late_window_keeps_phase(): void
    {
        $r = new Recurrence('weekly', 2, '2020-01-07', null, 2); // Tuesdays, fortnightly
        $dates = $r->between('2026-12-01', '2026-12-31');
        $this->assertNotEmpty($dates);
        foreach ($dates as $d) {
            $days = (new \DateTime('2020-01-07'))->diff(new \DateTime($d))->days;
            $this->assertSame(0, $days % 14, $d);
        }
    }

    public function test_quarterly_every_three_months_from_start_month(): void
    {
        $r = new Recurrence('quarterly', 1, '2026-01-01', null, 15);
        $this->assertSame(['2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15', '2027-01-15'], $r->between('2026-01-01', '2027-01-31'));
        $r = new Recurrence('quarterly', 2, '2026-01-01', null, 31);
        $this->assertSame(['2026-01-31', '2026-07-31', '2027-01-31'], $r->between('2026-01-01', '2027-01-31'));
    }

    public function test_yearly_on_month_and_day_with_feb_29_fallback(): void
    {
        $r = new Recurrence('yearly', 1, '2026-01-01', null, 15, 3);
        $this->assertSame(['2026-03-15', '2027-03-15', '2028-03-15'], $r->between('2026-01-01', '2028-12-31'));

        $r = new Recurrence('yearly', 1, '2027-01-01', null, 29, 2);
        $this->assertSame(['2027-02-28', '2028-02-29', '2029-02-28'], $r->between('2027-01-01', '2029-12-31'));

        // Start after this year's date → first occurrence next year.
        $r = new Recurrence('yearly', 1, '2026-06-01', null, 15, 3);
        $this->assertSame('2027-03-15', $r->nextOnOrAfter('2026-06-01'));
    }

    public function test_end_date_is_respected_and_null_end_is_ongoing(): void
    {
        $r = new Recurrence('monthly', 1, '2026-12-01', '2027-02-15', 1);
        $this->assertSame(['2026-12-01', '2027-01-01', '2027-02-01'], $r->between('2026-01-01', '2030-01-01'));
        $this->assertNull($r->nextOnOrAfter('2027-02-02'));

        $ongoing = new Recurrence('monthly', 1, '2026-12-01', null, 1);
        $this->assertSame('2046-12-01', $ongoing->nextOnOrAfter('2046-11-02'));
    }

    public function test_occurs_on_and_next(): void
    {
        $r = new Recurrence('monthly', 1, '2026-12-01', null, 1);
        $this->assertTrue($r->occursOn('2027-01-01'));
        $this->assertFalse($r->occursOn('2027-01-02'));
        $this->assertFalse($r->occursOn('2026-11-01')); // before start
        $this->assertSame(['2026-12-01', '2027-01-01', '2027-02-01'], $r->next('2026-11-27', 3));
    }

    public function test_rejects_bad_input(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        new Recurrence('daily', 1, '2026-01-01', null, 1);
    }
}
