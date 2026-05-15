# Finding 4: Dashboard layout fails open on permission errors

**Severity:** P2  
**Location:** `gym-admin/app/dashboard/layout.tsx:92-109`

## Summary

If permission loading throws for staff/trainer users, the layout sets `allowedModules = null`, which means show all dashboard navigation items.

## Impact

During permission/API outages, staff/trainer users can see deep links and dashboard actions as if they had unrestricted access. Backend routes may still reject mutations, but the UI fails open.

## Recommended Fix

Fail closed for staff/trainer users by showing a restricted/error shell or redirecting. Keep `allowedModules = null` only for confirmed unrestricted users.

