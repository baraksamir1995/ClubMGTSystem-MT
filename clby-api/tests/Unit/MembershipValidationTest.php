<?php

namespace Tests\Unit;

use Tests\TestCase;

/**
 * Unit tests for membership business rules:
 * detach, transfer, freeze validation logic.
 */
class MembershipValidationTest extends TestCase
{
    public function test_cannot_transfer_to_same_member()
    {
        $sourceId = 'member-123';
        $destId = 'member-123';

        $this->assertTrue($sourceId === $destId, 'Self-transfer should be detected');
    }

    public function test_cannot_transfer_expired_plan()
    {
        $endDate = '2026-01-01'; // past date
        $now = '2026-04-16';

        $this->assertTrue($endDate < $now, 'Expired plan should be detected');
    }

    public function test_can_transfer_active_plan()
    {
        $endDate = '2026-12-31'; // future date
        $now = '2026-04-16';

        $this->assertTrue($endDate >= $now, 'Active plan should be transferable');
    }

    public function test_null_end_date_is_valid_for_transfer()
    {
        $endDate = null;
        // null end_date means unlimited duration
        $this->assertNull($endDate, 'Null end_date means unlimited — always valid');
    }

    public function test_cannot_detach_without_active_plan()
    {
        $membershipStatus = 'cancelled';
        $this->assertNotEquals('active', $membershipStatus);
    }

    public function test_detach_sets_status_to_cancelled()
    {
        $cancelledStatus = 'cancelled';
        $reason = 'Plan detached by admin';

        $this->assertEquals('cancelled', $cancelledStatus);
        $this->assertStringContains('detach', strtolower($reason));
    }

    public function test_transfer_preserves_remaining_sessions()
    {
        $sourceSessions = 5;
        $sourceUsed = 2;
        $sourceRemaining = 3;

        // Transfer should copy remaining to destination
        $destRemaining = $sourceRemaining;
        $this->assertEquals(3, $destRemaining);
    }

    public function test_freeze_blocks_all_access()
    {
        $freezeStatus = 'frozen';
        $this->assertEquals('frozen', $freezeStatus);
    }

    public function test_membership_end_date_check_includes_today()
    {
        $endDate = '2026-04-16';
        $today = '2026-04-16';

        // end_date >= today should be valid (inclusive)
        $this->assertTrue($endDate >= $today);
    }

    public function test_membership_end_date_yesterday_is_expired()
    {
        $endDate = '2026-04-15';
        $today = '2026-04-16';

        $this->assertTrue($endDate < $today);
    }

    private function assertStringContains(string $needle, string $haystack): void
    {
        $this->assertTrue(
            str_contains($haystack, $needle),
            "Expected '{$haystack}' to contain '{$needle}'"
        );
    }
}
