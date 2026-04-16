# Auth Module — Technical Documentation

## Overview

The auth module handles all authentication flows for the gym member mobile app. It is built on **Supabase Auth** (email/password) with **supabase_flutter** managing sessions, deep links, and auth state changes.

---

## Files

| File | Role |
|---|---|
| `lib/features/auth/register_screen.dart` | 2-step signup form |
| `lib/features/auth/auth_widgets.dart` | Shared UI components (fields, buttons, branding) |
| `lib/screens/login_screen.dart` | Sign-in screen |
| `lib/screens/forgot_password_screen.dart` | Password reset request |
| `lib/screens/reset_password_screen.dart` | New password entry (opened via deep link) |
| `lib/providers/auth_provider.dart` | Auth state, session management, profile loading |
| `lib/services/api_service.dart` | Low-level Supabase API wrappers (signIn, signOut) |
| `lib/router.dart` | Route guards and deep link redirects |
| `lib/main.dart` | App init — Supabase + Firebase init |

---

## Flows

### 1. Sign Up

```
RegisterScreen (Step 1: name, DOB, gender, password)
       ↓
RegisterScreen (Step 2: phone +20, email)
       ↓
supabase.auth.signUp(email, password, emailRedirectTo: 'gymapp://email-confirmed')
       ↓
Supabase creates auth user → sends confirmation email
       ↓
register_gym_member RPC (creates profiles + gym_members row)
       ↓  [if RPC fails → auth user is deleted to prevent orphan]
Success dialog → auto-redirects to /login after 4 seconds
```

**Key points:**
- Phone is pre-filled with `+20` and normalized to `+201XXXXXXXXX` before the RPC call
- `member_number` is NOT assigned at signup — it is assigned on first membership purchase
- If the RPC fails after the auth user is created, the auth user is immediately deleted so the email is free to re-register

### 2. Email Confirmation

```
User taps link in email (gymapp://email-confirmed?token_hash=...&type=signup)
       ↓
Android/iOS opens app via gymapp:// URL scheme
       ↓
supabase_flutter intercepts the deep link, exchanges token
       ↓
AuthChangeEvent.signedIn fires in auth_provider.dart
       ↓
_loadProfileAndGym() runs → router redirects to /home
```

**Deep link registration:**
- Android: `AndroidManifest.xml` — `<data android:scheme="gymapp"/>`
- iOS: `Info.plist` — `CFBundleURLSchemes: [gymapp, $(PRODUCT_BUNDLE_IDENTIFIER)]`
- Supabase Dashboard → Authentication → URL Configuration → Redirect URLs: `gymapp://email-confirmed`

**Email confirmation must be enabled:**
Supabase Dashboard → Authentication → Email → "Enable email confirmations" = ON

### 3. Sign In

```
LoginScreen (email + password)
       ↓
AuthProvider.signIn() → supabase.auth.signInWithPassword()
       ↓
AuthChangeEvent.signedIn → _loadProfileAndGym()
       ↓
router redirects /login → /home
```

**Error handling:**
- `email not confirmed` → "Please confirm your email first. Check your inbox."
- `invalid login / invalid credentials` → "Incorrect email or password."

### 4. Forgot Password

```
ForgotPasswordScreen (email input)
       ↓
supabase.auth.resetPasswordForEmail(redirectTo: 'com.clubmgt.gymMobileFlutter://reset-password')
       ↓
User receives reset email → taps link → app opens at /reset-password
       ↓
AuthChangeEvent.passwordRecovery fires
       ↓
router forces /reset-password regardless of current route
       ↓
ResetPasswordScreen → supabase.auth.updateUser(password: newPassword)
       ↓
AuthProvider.clearPasswordRecovery() → router allows /home
```

**Redirect URL for password reset:**
- Supabase Dashboard → Redirect URLs: `com.clubmgt.gymMobileFlutter://reset-password`
- iOS: registered via `$(PRODUCT_BUNDLE_IDENTIFIER)` in `CFBundleURLSchemes`

### 5. Sign Out

```
ProfileScreen → AuthProvider.signOut()
       ↓
supabase.auth.signOut()
       ↓
AuthChangeEvent.signedOut → clears _user, _profile, _gym
       ↓
router redirects to /login
```

### 6. Guest Mode

```
LoginScreen → "Continue as Guest"
       ↓
AuthProvider.continueAsGuest() → fetches gym info by GYM_ID dart-define
       ↓
router allows /guest/* routes
       ↓
Locked features (check-in, bookings, profile) show register prompt
```

---

## Auth State (auth_provider.dart)

| State | Meaning |
|---|---|
| `_user != null` | Authenticated session active |
| `_isGuest == true` | Guest mode — no session, limited access |
| `_isPasswordRecovery == true` | Password reset link was tapped — forces /reset-password |
| `_isLoading == true` | Profile/gym data being fetched |

Auth state changes are listened to in `_init()` via `authStateChanges` stream:

| Event | Action |
|---|---|
| `signedIn` / `tokenRefreshed` / `userUpdated` | Load profile + gym, clear password recovery flag |
| `passwordRecovery` | Set `_isPasswordRecovery = true`, trigger redirect |
| `signedOut` | Clear all state |

---

## Route Guards (router.dart)

```dart
const _publicRoutes = {'/splash', '/onboarding', '/login', '/register',
                        '/forgot-password', '/reset-password'};
```

| Condition | Redirect |
|---|---|
| Not authenticated + not public + not guest route | → `/login` |
| Authenticated + not password recovery + on `/login` | → `/home` |
| Not authenticated + not guest + on guest route | → `/login` |
| Password recovery active + not on `/reset-password` | → `/reset-password` |

---

## Supabase Configuration Checklist

| Setting | Value |
|---|---|
| Email confirmations | **Enabled** |
| Redirect URL (signup) | `gymapp://email-confirmed` |
| Redirect URL (password reset) | `com.clubmgt.gymMobileFlutter://reset-password` |
| Minimum password length | 8 characters |

---

## Validation Rules

| Field | Rule |
|---|---|
| First name | Required, 2+ chars |
| Last name | Required |
| Password | Min 8 chars, applied on both signup and reset |
| Phone | Egyptian mobile only: `+201XXXXXXXXX` (normalized from `01XXXXXXXXX`) |
| Email | Standard regex `^[^@]+@[^@]+\.[^@]+` |

---

## Known Behaviours & Edge Cases

### Supabase email enumeration protection
When a user signs up with an email that already has an **unconfirmed** account, Supabase returns a user object with empty `identities` and sends a security email instead of creating a new user. The app no longer checks `identities` — it proceeds to call `register_gym_member` which handles duplicates via upsert.

### Orphaned auth users
If `register_gym_member` RPC fails after `signUp()` succeeds, the auth user is immediately deleted to keep the email free for re-registration.

### Re-registration after admin delete
Deleting a user via raw SQL (`DELETE FROM auth.users`) may leave internal Supabase state. Always use the Supabase Admin API or Dashboard → Authentication → Users → Delete to fully purge a user.

### FCM token registration
On every successful sign-in, the FCM push notification token is saved to `profiles.fcm_token`. This is done in `_loadProfileAndGym()` inside `auth_provider.dart`.

---

## Custom Confirmation Email

The signup confirmation email is sent by a Supabase Edge Function (`supabase/functions/custom-email/`) instead of Supabase's default email. It fetches the gym's name and logo from the database using `APP_GYM_ID` and sends a branded HTML email via Resend.

**Required secrets on the edge function:**
- `RESEND_API_KEY`
- `APP_GYM_ID`
- `FROM_EMAIL` (must be a verified domain in Resend)

The hook must be registered in Supabase Dashboard → Authentication → Hooks → Send email → `custom-email`.
