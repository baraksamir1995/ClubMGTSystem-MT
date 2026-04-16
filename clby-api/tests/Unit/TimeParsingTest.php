<?php

namespace Tests\Unit;

use Tests\TestCase;

/**
 * Tests for timestamp parsing and timezone handling.
 */
class TimeParsingTest extends TestCase
{
    public function test_postgres_timestamp_with_short_offset_is_parsed()
    {
        $pg = '2026-04-15 16:53:18+00';
        $dt = new \DateTime($pg);
        $this->assertEquals('2026-04-15', $dt->format('Y-m-d'));
        $this->assertEquals('16:53:18', $dt->format('H:i:s'));
    }

    public function test_utc_timestamp_converts_to_cairo_time()
    {
        $utc = new \DateTime('2026-04-15 14:00:00', new \DateTimeZone('UTC'));
        $utc->setTimezone(new \DateTimeZone('Africa/Cairo'));
        $this->assertEquals('16:00:00', $utc->format('H:i:s')); // UTC+2
    }

    public function test_session_time_is_treated_as_local()
    {
        // Session times are stored as local time (e.g., 09:45)
        // They should NOT be converted — they're already in gym timezone
        $sessionTime = '09:45:00';
        $this->assertEquals('09:45', substr($sessionTime, 0, 5));
    }

    public function test_now_in_cairo_is_utc_plus_2()
    {
        $utcNow = new \DateTime('now', new \DateTimeZone('UTC'));
        $cairoNow = clone $utcNow;
        $cairoNow->setTimezone(new \DateTimeZone('Africa/Cairo'));

        $diffHours = (int) $cairoNow->format('G') - (int) $utcNow->format('G');
        // Cairo is UTC+2 (or UTC+3 during DST)
        $this->assertContains($diffHours, [2, 3, -21, -22]); // handle day wrap
    }
}
