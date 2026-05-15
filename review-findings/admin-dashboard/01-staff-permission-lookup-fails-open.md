# Finding 1: Staff permission lookup still fails open when staff row is missing

**Severity:** P1  
**Location:** `gym-admin/lib/get-permissions.ts:52-55`

## Summary

For staff/trainer users, `getStaffPermissions()` returns `null` when the current user is not found in `/staff`, and `null` means unrestricted owner access in `can()`.

## Impact

A stale/missing staff row or unexpected API response shape can make a staff user look like a gym admin to dashboard guards. This can expose unrestricted dashboard navigation and proxy permissions.

## Recommended Fix

Return `[]` or a hard 403 state when the staff row is missing. Reserve `null` only for confirmed `gym_admin` users.

