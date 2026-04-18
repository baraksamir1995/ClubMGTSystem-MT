# Backlog

Features and tasks to tackle later. Not in priority order.

## Marketplace Home Screen (Mobile App)

New home screen for the CLBY (marketplace) app mode — shown when `GYM_ID` is empty at build time.

### Top-level sections

- **Hero banner carousel** — managed from super-admin dashboard, promotes specific gyms
- **Location dropdown** at the top — fetches user location, recommends gyms and services nearby
- **Categories section** — Gyms, Boxing, Padel, etc.
- **Top-rated gyms** — sorted list
- **Services carousel**:
  - Personal Training
  - Nutrition — members sign up, see assigned plans from coach
  - Physiotherapy — members sign up, see assigned sessions
  - Flow to be designed later
- **Merchandise entry point** — different brands (e.g. House of Supplements)
  - Search bar
  - Categories (protein, creatine, etc.)
  - Product listing with pricing
  - Add to cart
  - Promo codes
  - Online payment

### Gym detail screen (from marketplace)

- Inner screen when user taps a gym card
- Shows gym info, branches, plans, photos
- "Join Gym" CTA → takes user to signup with that `gym_id` pre-filled

### Super-admin additions needed

- Hero banner management (upload images, select gyms to promote, schedule)
- Category management
- Services catalog (if centralized) or per-gym
- Merchandise brands + product catalog + inventory
- Orders and payment tracking

---

## White-Label App Automation

Automate generation of single-gym branded Flutter builds.

### Phase 1 — Build script

- `scripts/build-whitelabel.sh <gym-id>` — reads gym config from API, generates `.env`, runs Flutter build
- Uses `flutter_flavorizr` or custom script for bundle ID / package name injection
- Uses `flutter_launcher_icons` to auto-generate icons from gym logo
- Manual App Store / Play Store submission

### Phase 2 — CI/CD pipeline

- Super-admin button: "Generate white-label build for gym X"
- Triggers GitHub Actions workflow
- Builds iOS + Android artifacts
- Artifacts downloadable from super-admin
- Optional: auto-upload to TestFlight / Play Console

### Constraints

- Each gym either needs their own Apple/Google developer account, or everything is published under Clby's account
- Signing certificates management per gym (or centralized)
- App Store review process stays manual

---

## Future Ideas (not scoped yet)

- Billing / subscriptions per gym (auto-charge vs manual invoices)
- Super-admin analytics across all gyms (total revenue, active users, churn)
- Email notifications for invoice creation / payment received
- Per-tenant feature flags tied to plan tier
