# Coachesapp

CLBY coach mobile app. A login-only Flutter client for coaches/trainers.
Part of the `ClubMGTSystem-MT` monorepo; shares the `clby-api` backend with
`gym_mobile_flutter` and `gym-admin`.

## Scope (current)

Scaffold + auth wiring only:

- Splash → session restore → Login → Home loop
- Sanctum token auth against `POST /api/auth/login`, profile from `GET /api/me`
- **No registration.** Coach credentials are provisioned from the gym
  dashboard (`gym-admin`). The login screen has no sign-up path.

Feature work (schedule, clients, attendance, etc.) lands on top of this.

## Stack

Mirrors `gym_mobile_flutter`'s conventions, trimmed:

- Flutter 3.41 / Dart 3.11
- `provider` for state, `go_router` for routing
- `flutter_secure_storage` (auth token) + `shared_preferences`
- `http` for REST

## Config

All environment values come from `--dart-define-from-file` at build time
(see `lib/utils/env.dart`). Flavor files live in `flavors/`:

- `flavors/coaches.json` — committed, prod (`https://api.clbyapp.com`)
- `flavors/coaches.local.json` — gitignored, your LAN IP for device testing.
  Keep `API_URL` in sync with `ipconfig getifaddr en0`.

## Local dev

```bash
# 1. Run the API (from repo root), bound to 0.0.0.0 so a device can reach it
cd ../clby-api && php artisan serve --host=0.0.0.0 --port=8081

# 2. Run the app
cd coaches_mobile_flutter
flutter pub get
flutter run --dart-define-from-file=flavors/coaches.local.json
```

## Build

```bash
flutter build ipa --release --dart-define-from-file=flavors/coaches.json
```

Bundle ID: `com.clbyapp.coachesapp`.
