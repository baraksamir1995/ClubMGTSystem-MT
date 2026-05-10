# CLBY (ClubMGTSystem) — agent guide

Multi-tenant gym management SaaS. Three apps in one git repo, deployed via Coolify on AWS EC2.

## Repo layout

```
ClubMGTSystem-MT/
├── clby-api/              Laravel 13 / PHP 8.5 / PostgreSQL 17 / Sanctum
├── gym-admin/             Next.js 14 admin (App Router, Tailwind, lucide-react)
├── gym_mobile_flutter/    Flutter 3.11 member app (Provider, GoRouter)
├── gym-super-admin/       Next.js 14 platform admin (separate Coolify deploy)
└── clby-landing/          Next.js marketing site
```

## Local dev

```bash
# API (Laravel) — bind to 0.0.0.0 so phone on LAN can reach it
cd clby-api && php artisan serve --host=0.0.0.0 --port=8081

# Admin (Next.js)
cd gym-admin && npm run dev    # http://localhost:3001

# Mobile (Flutter) — point at API_URL in dart_defines.local.json
cd gym_mobile_flutter && flutter run --dart-define-from-file=dart_defines.local.json
```

`dart_defines.local.json` contains `API_URL=http://<MAC_LAN_IP>:8081`. Keep in sync with `ipconfig getifaddr en0`. Physical-device runs need the LAN IP, not `localhost`.

## Production

- Coolify auto-deploys `main` to `https://api.clbyapp.com` (clby-api), `https://app.clbyapp.com` (gym-admin), `https://superadmin.clbyapp.com` (gym-super-admin), `https://clbyapp.com` (clby-landing).
- See `~/.Codex/projects/-Users-rtg/memory/reference_clby_prod_server.md` for SSH + container details.
- Postgres on prod is in a Coolify-managed container, db `clby_prod`, user `clby`.

## Mobile build

```bash
cd gym_mobile_flutter
flutter build ipa --release --dart-define-from-file=dart_defines.json    # prod API
# Then upload build/ios/ipa/CLBY.ipa via Transporter.app
```

Bundle ID `com.clbyapp.clby` (matches Firebase). Apple closed `1.0.0` train — every release must bump CFBundleShortVersionString. Current pubspec: `1.0.1+11`. Next IPA: `1.0.2+12`.

## Architecture conventions

### Backend (clby-api)

- **Auth:** Sanctum tokens. Login at `POST /api/auth/login`. `User` model maps to `profiles` table (legacy from Supabase migration).
- **Gym scoping:** `RequireGymId` middleware extracts `gym_id` from authenticated user. Most endpoints filter by `gym_id`.
- **Permissions:** `permission:resource,action` middleware (e.g. `permission:classes,create`). Roles: `super_admin`, `gym_admin`, `staff`, `trainer`, `member`.
- **Bucket model for memberships:** `member_memberships` rows distinguish `source_type='subscription'|'transfer'`.
- **Plan-type-aware expiry:** sessions plans expire at 0 remaining; duration plans at end_date. SQL CASE in `MembershipController::index`.
- **Storage:** S3-compatible via `league/flysystem-aws-s3-v3` (uploads, photos, banners).
- **Push:** FCM via `kreait/firebase-php` → `app/Services/PushService.php`. Requires `FIREBASE_CREDENTIALS` env pointing at service-account JSON.

### Admin (gym-admin)

- **Server components** load data via `app/api/<resource>/route.ts` proxies that forward Authorization to clby-api.
- **`resolveGymId()`** from `@/lib/api-gym-id` derives the active gym from session/auth.
- **Sub-tabs** use `?view=` query (e.g. Members → Memberships).
- **sessionStorage** persists table filters between visits within a session.
- **Tailwind** + lucide-react. Dark mode design.

### Mobile (gym_mobile_flutter)

- **State:** Provider per feature (`AuthProvider`, `MemberProvider`, `BannerProvider`, `BranchProvider`, `PopupProvider`).
- **Routing:** GoRouter with `_publicRoutes` allowlist for unauthenticated screens.
- **Storage:** `flutter_secure_storage` (auth token, gym branding cache) + `shared_preferences` (FreshInstallGuard sentinel).
- **Design tokens:** warm cream `#F7F6F2` / ink `#1F1A14` / peach `#F4DCC1` / primary orange `#E07A3B` / success `#3F8B5C`.
- **API helper:** `services/api_service.dart` — 1500+ lines, all REST calls. Generic `_get`, `_post`, `_put`, `_patch`, `_delete`.
- **FCM token** auto-saves to backend on login via `PUT /api/me`.

## Key DB tables

- `profiles` — users (members + admins + super-admins). Has `fcm_token` column.
- `gym_members` — gym-specific member record (linked to profile via `user_id`).
- `member_memberships` — active/past memberships, `source_type='subscription'|'transfer'`.
- `membership_plans` — plan definitions, `plan_type='sessions'|'duration'|'duration_session'`.
- `class_sessions`, `session_bookings` — schedule + bookings.
- `trainer_profiles` — trainers, optional `profile_id` link to profiles for trainer-staff users.
- `service_packages` — PT/Physio/Nutrition session bundles.
- `gym_notifications` — gym-wide announcements (now also fan out as FCM pushes).
- `auth.users` — Supabase-shim mirror; the `super-admin:seed` command writes both `profiles` and `auth.users`. Login reads from `profiles` only.

## Known quirks

- **Laravel rejects `$2a$` bcrypt hashes.** When resetting passwords from psql/pgcrypto, rewrite the prefix to `$2y$` or use `php artisan tinker` with `Hash::make`. Details in `~/.Codex/projects/-Users-rtg/memory/feedback_laravel_bcrypt_prefix.md`.
- **`TrainerController::index` ignores `?name=`** query param. The mobile `getTrainerFullProfile()` originally relied on this and grabbed `list.first`, which always returned the most recently created trainer (creating a "trainer detail swap" bug). Fixed by filtering by `id` instead.
- **iOS aps-environment is `production`.** Set in `Runner.entitlements`. TestFlight/App Store builds receive pushes; `flutter run` debug builds don't (mismatch with APNs sandbox). To restore dev-push testing, would need separate per-config `.entitlements` files.
- **Gym-admin runs in Coolify with no internet at build time** — don't add `next/font/google` Inter imports; they fail. Use Tailwind font-sans stack with Inter biased.
- **iOS Keychain survives app uninstall.** `FreshInstallGuard` writes a SharedPreferences sentinel and wipes secure storage on first install to prevent stale auth state.

## Active work / pending items

- **Push notifications** — code complete, manual setup pending. Need APNs key in Firebase Console + service-account JSON on prod with `FIREBASE_CREDENTIALS` env. See `project_clby_push_notifications.md` memory.
- **Next IPA:** `1.0.2+12`, includes the trainer-detail bugfix and `aps-environment=production`. Not yet built.
- **White-label per-gym apps** — discussed but not started. Path: gym signs up for own Apple Developer account, SaaS provides Flutter flavor + asset pipeline. Cheap MVP path; Apple 4.3 risk if shipping under one dev account.

## Test accounts

- Member (local dev, `clby_dev`): `barak@swap.com` / `123456`
- Member (any gym): `test@clby.com` / `12345678`
- Super-admin (prod): `barak@clby.com` / `Familycomes1@`

## Commit style

`<type>(<scope>): <subject>` matching existing history:

```
feat(api): FCM push infrastructure + iOS prod entitlement
fix(mobile): trainer detail swap + explore/schedule UX cleanup
chore(admin): drop next/font/google to unblock offline Coolify build
```

Co-author trailer:
```
Co-Authored-By: Codex Opus 4.7 (1M context) <noreply@anthropic.com>
```
