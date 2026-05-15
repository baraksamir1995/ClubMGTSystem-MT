# Finding 3: Payment link proxy bypasses create-payment permission

**Severity:** P2  
**Location:** `gym-admin/app/api/payments/send-link/route.ts:6-15`

## Summary

`/api/payments/send-link` forwards to Paymob intention creation after only `resolveGymId()`. The normal `/api/payments` POST route enforces `payments:create`.

## Impact

This route becomes a side door for staff/trainers to initiate payment links without the expected create-payment permission.

## Recommended Fix

Add the same `denyUnlessPermitted(token, 'payments', 'create')` guard, or introduce a dedicated `payments:send_link` permission.

