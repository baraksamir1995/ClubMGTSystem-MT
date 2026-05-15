# Finding 5: Production builds still ignore TypeScript and ESLint failures

**Severity:** P2  
**Location:** `gym-admin/next.config.mjs:42-43`

## Summary

The admin dashboard is configured to pass production builds even when TypeScript or ESLint errors exist.

## Impact

The dashboard handles payments, permissions, refunds, and member data. Ignoring build errors removes important deploy-time guardrails and can ship broken API contracts or unsafe permission changes.

## Recommended Fix

Remove `typescript.ignoreBuildErrors` and `eslint.ignoreDuringBuilds` once the current build is clean. Make CI/Coolify fail on type or lint errors.

