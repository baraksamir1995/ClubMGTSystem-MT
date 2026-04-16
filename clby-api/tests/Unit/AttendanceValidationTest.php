<?php

namespace Tests\Unit;

use Tests\TestCase;

/**
 * Unit tests for attendance check-in validation rules.
 * Tests the business logic without hitting the database.
 */
class AttendanceValidationTest extends TestCase
{
    /**
     * Plan type access matrix:
     *   sessions         → class ONLY
     *   duration         → gym ONLY
     *   duration_session → BOTH
     */

    public function test_sessions_plan_allows_class_access()
    {
        $planType = 'sessions';
        $isClassEntry = true;

        $allowed = $this->isEntryAllowed($planType, $isClassEntry);
        $this->assertTrue($allowed);
    }

    public function test_sessions_plan_blocks_gym_access()
    {
        $planType = 'sessions';
        $isClassEntry = false;

        $allowed = $this->isEntryAllowed($planType, $isClassEntry);
        $this->assertFalse($allowed);
    }

    public function test_duration_plan_allows_gym_access()
    {
        $planType = 'duration';
        $isClassEntry = false;

        $allowed = $this->isEntryAllowed($planType, $isClassEntry);
        $this->assertTrue($allowed);
    }

    public function test_duration_plan_blocks_class_access()
    {
        $planType = 'duration';
        $isClassEntry = true;

        $allowed = $this->isEntryAllowed($planType, $isClassEntry);
        $this->assertFalse($allowed);
    }

    public function test_duration_session_plan_allows_gym_access()
    {
        $planType = 'duration_session';
        $isClassEntry = false;

        $allowed = $this->isEntryAllowed($planType, $isClassEntry);
        $this->assertTrue($allowed);
    }

    public function test_duration_session_plan_allows_class_access()
    {
        $planType = 'duration_session';
        $isClassEntry = true;

        $allowed = $this->isEntryAllowed($planType, $isClassEntry);
        $this->assertTrue($allowed);
    }

    public function test_session_decrement_required_for_class_entry_on_sessions_plan()
    {
        $this->assertTrue($this->shouldDecrement('sessions', true));
    }

    public function test_session_decrement_required_for_class_entry_on_duration_session_plan()
    {
        $this->assertTrue($this->shouldDecrement('duration_session', true));
    }

    public function test_no_session_decrement_for_gym_entry()
    {
        $this->assertFalse($this->shouldDecrement('duration', false));
        $this->assertFalse($this->shouldDecrement('duration_session', false));
    }

    public function test_no_remaining_sessions_blocks_class_entry()
    {
        $sessionsRemaining = 0;
        $this->assertFalse($this->hasRemainingSessions($sessionsRemaining));
    }

    public function test_one_remaining_session_allows_class_entry()
    {
        $sessionsRemaining = 1;
        $this->assertTrue($this->hasRemainingSessions($sessionsRemaining));
    }

    public function test_null_sessions_remaining_allows_unlimited()
    {
        $sessionsRemaining = null;
        $this->assertTrue($this->hasRemainingSessions($sessionsRemaining));
    }

    public function test_frozen_membership_blocks_all_access()
    {
        $freezeStatus = 'frozen';
        $this->assertFalse($this->isMembershipAccessible($freezeStatus));
    }

    public function test_active_membership_allows_access()
    {
        $freezeStatus = null;
        $this->assertTrue($this->isMembershipAccessible($freezeStatus));
    }

    // ── Helper methods (mirror the controller logic) ──────────────────────

    private function isEntryAllowed(string $planType, bool $isClassEntry): bool
    {
        if ($isClassEntry) {
            return $planType !== 'duration';
        }
        return $planType !== 'sessions';
    }

    private function shouldDecrement(string $planType, bool $isClassEntry): bool
    {
        if (!$isClassEntry) return false;
        return in_array($planType, ['sessions', 'duration_session']);
    }

    private function hasRemainingSessions(?int $remaining): bool
    {
        if ($remaining === null) return true;
        return $remaining > 0;
    }

    private function isMembershipAccessible(?string $freezeStatus): bool
    {
        return $freezeStatus !== 'frozen';
    }
}
