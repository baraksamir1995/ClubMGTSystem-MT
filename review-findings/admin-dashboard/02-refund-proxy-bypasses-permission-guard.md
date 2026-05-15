# Finding 2: Refund proxy bypasses payment permission guard

**Severity:** P1  
**Location:** `gym-admin/app/api/payments/[id]/refund/route.ts:6-15`

## Summary

The refund route resolves a gym-scoped admin token and forwards directly to `/paymob/refund`, unlike the normal payment update/delete routes that call `denyUnlessPermitted()`.

## Impact

Any staff/trainer who can hit this proxy can attempt refunds without `payments:update` or a dedicated refund permission.

## Recommended Fix

Add a permission guard before forwarding the request. Use `denyUnlessPermitted(token, 'payments', 'update')` as a quick fix, or introduce a dedicated `payments:refund` permission.

