# CLBY Gym Management System - Technical Documentation

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Project Structure](#2-project-structure)
3. [Technology Stack](#3-technology-stack)
4. [Database Schema](#4-database-schema)
5. [RPC Functions](#5-rpc-functions)
6. [Row-Level Security (RLS)](#6-row-level-security)
7. [Admin Dashboard API (Next.js)](#7-admin-dashboard-api)
8. [Backend API (NestJS)](#8-backend-api)
9. [Flutter Mobile App Architecture](#9-flutter-mobile-app-architecture)
10. [Authentication & Authorization](#10-authentication--authorization)
11. [Payment Integration](#11-payment-integration)
12. [Push Notifications](#12-push-notifications)
13. [Environment Variables](#13-environment-variables)
14. [Deployment](#14-deployment)
15. [CI/CD](#15-cicd)

---

## 1. Architecture Overview

```
                    +------------------+
                    |   Cloudflare     |
                    |   (DNS/CDN)      |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
   +----------v----------+     +-----------v-----------+
   |  staging.clbyapp.com|     | superadmin.staging     |
   |   (gym-admin)       |     |   .clbyapp.com         |
   |   Next.js 14        |     |   (gym-super-admin)    |
   +----------+----------+     +-----------+-----------+
              |                             |
              +--------------+--------------+
                             |
                    +--------v---------+
                    |  Supabase        |
                    |  PostgreSQL +    |
                    |  Auth + Storage  |
                    |  Edge Functions  |
                    +--------+---------+
                             |
              +--------------+--------------+
              |                             |
   +----------v----------+     +-----------v-----------+
   |  gym-backend         |     |  gym_mobile_flutter   |
   |  NestJS REST API     |     |  Flutter (iOS/Android)|
   +----------------------+     +-----------------------+
```

**Data flow:**
- **gym-admin** (Next.js) talks directly to Supabase via server-side API routes using the service role key
- **gym-backend** (NestJS) provides REST endpoints for the mobile app (QR tokens, bookings, check-ins)
- **gym_mobile_flutter** talks to both Supabase (reads, auth, RPCs) and gym-backend (QR tokens, check-ins, bookings)
- **Supabase Edge Functions** handle Paymob webhooks, payment intentions, refunds, and custom emails

---

## 2. Project Structure

```
ClubMGTSystem/
├── gym-admin/                    # Admin dashboard (Next.js 14)
│   ├── app/
│   │   ├── api/                  # ~60 API routes
│   │   ├── dashboard/            # 13 dashboard pages
│   │   ├── login/
│   │   └── layout.tsx
│   ├── components/               # Feature components
│   ├── lib/                      # Shared utilities
│   │   ├── supabase/             # admin.ts, server.ts, client.ts
│   │   ├── api-gym-id.ts         # Auth resolver for API routes
│   │   ├── get-permissions.ts    # RBAC permission checker
│   │   ├── rate-limit.ts         # Sliding window rate limiter
│   │   ├── logger.ts             # Structured JSON logger
│   │   └── firebase-admin.ts     # FCM push notifications
│   └── next.config.mjs
│
├── gym-super-admin/              # Super admin panel (Next.js 14)
│   ├── app/
│   └── next.config.mjs
│
├── gym-backend/                  # Mobile API (NestJS 10)
│   └── src/
│       ├── main.ts               # Entry point (port 3000)
│       ├── app.module.ts         # Root module (31 feature modules)
│       ├── auth/                 # JWT auth, QR tokens
│       ├── members/              # Member CRUD
│       ├── bookings/             # Class bookings
│       ├── checkins/             # QR check-in
│       ├── payments/             # Payment processing
│       └── ...                   # 25+ more modules
│
├── gym_mobile_flutter/           # Member app (Flutter 3.11+)
│   └── lib/
│       ├── main.dart             # Entry point
│       ├── router.dart           # GoRouter config
│       ├── providers/            # AuthProvider, MemberProvider, etc.
│       ├── services/             # SupabaseService, ApiService
│       ├── screens/              # All screens
│       ├── features/             # Auth, billing, banners, popups, rating
│       ├── models/               # Data models
│       ├── widgets/              # Reusable components
│       └── utils/                # Helpers (env, theme, errors)
│
├── supabase/
│   ├── schema.sql                # Base schema
│   ├── *.sql                     # 35 migration files
│   ├── functions/                # Edge functions
│   │   ├── paymob-intention/     # Create payment intention
│   │   ├── paymob-webhook/       # Handle payment callbacks
│   │   ├── paymob-refund/        # Process refunds
│   │   ├── custom-email/         # Branded email hook
│   │   └── qr-token/             # QR token generation
│   └── email-templates/
│
├── landing/                      # Public landing page
└── stress-tests/                 # Load testing
```

---

## 3. Technology Stack

### Frontend (gym-admin, gym-super-admin)
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.2.5 | React framework (App Router) |
| React | ^18.0.0 | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Styling |
| @supabase/ssr | ^0.5.0 | Server-side Supabase auth |
| react-query | ^3.39.3 | Client data fetching |
| recharts | ^3.8.0 | Analytics charts |
| lucide-react | ^0.400.0 | Icons |
| react-hot-toast | ^2.4.1 | Toast notifications |
| xlsx | ^0.18.5 | Excel export |
| qrcode.react | ^4.2.0 | QR code generation |
| resend | ^6.9.4 | Email service |
| firebase-admin | ^13.7.0 | Push notifications |

### Backend (gym-backend)
| Technology | Version | Purpose |
|------------|---------|---------|
| NestJS | ^10.0.0 | REST API framework |
| TypeScript | 5.x | Type safety |
| @supabase/supabase-js | ^2.0.0 | Database client |
| passport + passport-jwt | ^0.7 / ^4.0 | JWT authentication |
| @nestjs/throttler | ^6.0.0 | Rate limiting |
| @nestjs/schedule | ^4.0.0 | Cron jobs |
| @nestjs/swagger | ^7.0.0 | API documentation |
| class-validator | ^0.14.0 | DTO validation |
| firebase-admin | ^12.0.0 | Push notifications |
| helmet | ^8.0.0 | Security headers |
| stripe | ^14.0.0 | Payment processing |
| cache-manager | ^7.2.8 | Optional Redis cache |

### Mobile (gym_mobile_flutter)
| Technology | Version | Purpose |
|------------|---------|---------|
| Flutter | ^3.11.1 | Cross-platform framework |
| Dart | 3.x | Language |
| supabase_flutter | ^2.8.4 | Database/Auth |
| provider | ^6.1.2 | State management |
| go_router | ^14.8.1 | Navigation |
| firebase_messaging | ^15.1.3 | Push notifications |
| mobile_scanner | ^6.0.0 | QR scanning |
| qr_flutter | ^4.1.0 | QR display |
| flutter_secure_storage | ^9.2.4 | Secure credentials |
| webview_flutter | ^4.10.0 | Payment webviews |
| cached_network_image | ^3.4.1 | Image caching |
| image_picker + image_cropper | latest | Avatar upload |

### Database & Infrastructure
| Technology | Purpose |
|------------|---------|
| Supabase (PostgreSQL) | Database, Auth, Storage, Edge Functions, Real-time |
| Cloudflare | DNS (staging.clbyapp.com, superadmin.staging.clbyapp.com) |
| AWS EC2 (t3.small) | Hosting via Coolify |
| Firebase Cloud Messaging | Push notifications |
| Paymob | Egyptian payment gateway |
| Resend | Transactional email |

---

## 4. Database Schema

### Entity Relationship Summary

```
auth.users (Supabase Auth)
    |
    v
profiles (1:1 with auth.users)
    |
    v
gym_members (users enrolled in a gym)
    |
    +---> member_memberships (active plans)
    |         |
    |         +---> membership_plans (plan templates)
    |         +---> membership_freeze_logs
    |         +---> membership_transfer_logs
    |
    +---> session_bookings (class reservations)
    |         |
    |         +---> class_sessions (session instances)
    |                   |
    |                   +---> classes (class definitions)
    |                   +---> studios --> branches --> gyms
    |
    +---> attendance_logs (check-in records)
    +---> payments (transactions)
    +---> member_invitations (guest passes)
    +---> member_service_assignments (PT, nutrition, etc.)
```

### Core Tables

#### gyms
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, gen_random_uuid() |
| name | text | NOT NULL |
| email | text | |
| phone | text | |
| address | text | |
| max_branches | integer | DEFAULT 1 |
| price_per_branch | numeric(10,2) | |

#### profiles
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, FK -> auth.users(id) ON DELETE CASCADE |
| gym_id | uuid | FK -> gyms(id) |
| role | text | admin, trainer, member, staff, superadmin |
| full_name | text | |
| email | text | NOT NULL |
| phone | text | |
| date_of_birth | date | |
| gender | text | |
| address | text | |
| emergency_contact_name | text | |
| emergency_contact_phone | text | |
| photo_url | text | |
| fcm_token | text | Firebase push token |
| is_active | boolean | DEFAULT true |
| deleted_at | timestamptz | Soft delete |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### gym_members
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| gym_id | uuid | FK -> gyms(id), NOT NULL |
| user_id | uuid | FK -> auth.users(id) |
| member_number | integer | Auto-assigned on first membership |
| status | text | CHECK: active, inactive, expired, suspended, cancelled |
| joined_at | timestamptz | Immutable after creation |
| notes | text | |
| deleted_at | timestamptz | Soft delete |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### membership_plans
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| gym_id | uuid | FK -> gyms(id), NOT NULL |
| name | text | NOT NULL |
| plan_type | text | monthly, annual, duration, sessions, duration_session, sessions_unlimited |
| price | numeric(10,2) | |
| currency | text | DEFAULT 'EGP' |
| duration_days | integer | |
| session_count | integer | |
| session_expiry_days | integer | |
| description | text | |
| freeze_allowed | boolean | DEFAULT false |
| transfer_allowed | boolean | DEFAULT false |
| invitations_enabled | boolean | DEFAULT false |
| invitations_per_cycle | integer | |
| invitation_duration_type | text | per_visit, time_based |
| invitation_duration_days | integer | |
| invitation_validity_days | integer | DEFAULT 7 |
| access_scope | text | all_branches, specific_branches |
| allowed_branch_ids | uuid[] | |
| deleted_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### member_memberships
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| gym_id | uuid | FK -> gyms(id) |
| gym_member_id | uuid | FK -> gym_members(id), NOT NULL |
| plan_id | uuid | FK -> membership_plans(id) |
| status | text | active, frozen, pending, cancelled, expired |
| payment_status | text | pending, paid, failed |
| start_date | date | |
| end_date | date | |
| sessions_total | integer | |
| sessions_used | integer | DEFAULT 0 |
| sessions_remaining | integer | |
| allowed_branch_ids | uuid[] | |
| freeze_status | text | active, frozen |
| freeze_days_used | integer | |
| freeze_count | integer | |
| frozen_at | timestamptz | |
| frozen_until | timestamptz | |
| invitations_remaining | integer | DEFAULT 0 |
| invitations_used | integer | DEFAULT 0 |
| original_price | numeric(10,2) | |
| discount_amount | numeric(10,2) | |
| final_price | numeric(10,2) | |
| promo_code_id | uuid | |
| plan_promotion_id | uuid | |
| cancelled_at | timestamptz | |
| cancellation_reason | text | |
| transferred_from | uuid | |
| transferred_to | uuid | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### classes
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| gym_id | uuid | FK -> gyms(id), NOT NULL |
| name | text | NOT NULL |
| description | text | |
| instructor | text | |
| status | text | DEFAULT 'active' |
| image_url | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### class_sessions
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| class_id | uuid | FK -> classes(id), NOT NULL |
| gym_id | uuid | FK -> gyms(id) |
| branch_id | uuid | FK -> branches(id) |
| studio_id | uuid | FK -> studios(id) |
| session_date | timestamp | NOT NULL |
| start_time | time | NOT NULL |
| end_time | time | NOT NULL |
| capacity | integer | |
| booked_count | integer | DEFAULT 0 |
| status | text | DEFAULT 'scheduled' |
| walk_in_allowed | boolean | DEFAULT false |
| instructor | text | |
| created_at | timestamptz | |

#### branches
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, gen_random_uuid() |
| gym_id | uuid | FK -> gyms(id), NOT NULL |
| name | text | NOT NULL |
| address | text | |
| is_active | boolean | DEFAULT true |
| created_at | timestamptz | |

#### studios
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, gen_random_uuid() |
| gym_id | uuid | FK -> gyms(id), NOT NULL |
| branch_id | uuid | FK -> branches(id), NOT NULL |
| name | text | NOT NULL |
| capacity | integer | |
| created_at | timestamptz | |

#### attendance_logs
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| gym_id | uuid | FK -> gyms(id), NOT NULL |
| gym_member_id | uuid | FK -> gym_members(id), NOT NULL |
| branch_id | uuid | FK -> branches(id) |
| studio_id | uuid | FK -> studios(id) |
| class_session_id | uuid | FK -> class_sessions(id) |
| check_in_at | timestamptz | |
| method | text | qr, manual, api |
| access_point | text | |
| created_at | timestamptz | |

#### payments
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| gym_id | uuid | FK -> gyms(id) |
| gym_member_id | uuid | FK -> gym_members(id) |
| membership_id | uuid | |
| amount | numeric(10,2) | NOT NULL |
| currency | text | DEFAULT 'EGP' |
| payment_method | text | cash, card, bank_transfer, check |
| status | text | pending, paid, succeeded, failed, refunded, partially_refunded, cancelled |
| source | text | admin, mobile_app, web_portal |
| service_type | text | |
| service_name | text | |
| original_amount | numeric(10,2) | |
| discount_amount | numeric(10,2) | |
| promo_code_id | uuid | |
| transaction_id | text | Paymob transaction ID |
| notes | text | |
| paid_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

#### member_invitations
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, gen_random_uuid() |
| gym_id | uuid | FK -> gyms(id), NOT NULL |
| inviter_member_id | uuid | FK -> gym_members(id), NOT NULL |
| membership_id | uuid | FK -> member_memberships(id), NOT NULL |
| guest_name | text | |
| guest_email | text | NOT NULL |
| guest_phone | text | NOT NULL |
| invitation_token | uuid | UNIQUE, gen_random_uuid() |
| status | text | pending, accepted, active, expired, invalidated |
| duration_type | text | per_visit, time_based |
| max_visits | integer | DEFAULT 1 |
| visits_used | integer | DEFAULT 0 |
| expires_at | timestamptz | NOT NULL |
| created_at | timestamptz | |

### Supporting Tables

| Table | Purpose |
|-------|---------|
| promo_codes | Discount codes (percentage or fixed) |
| promo_code_redemptions | Usage audit trail |
| plan_promotions | Temporary plan price overrides |
| trainer_profiles | Trainer details (bio, specializations) |
| staff_members | Staff accounts |
| staff_roles | Custom role definitions |
| staff_member_roles | Staff-to-role assignments (M:N) |
| staff_role_permissions | Permission matrix (module + action) |
| staff_activity_logs | Staff action audit trail |
| session_bookings | Class session reservations |
| membership_freeze_logs | Freeze/unfreeze history |
| membership_transfer_logs | Transfer audit trail |
| member_service_assignments | PT/Nutrition/Physio session tracking |
| service_session_packages | Service package definitions |
| gym_offers | Promotional offers |
| gym_programs | Workout programs |
| gym_partners | Partner branding |
| gym_feature_toggles | Feature flags per gym |
| notifications | User notifications |
| notification_preferences | Push/email/SMS preferences |
| announcements | Gym announcements |
| faqs | FAQ entries |
| audit_logs | System-wide audit trail |
| landing_sections | Landing page CMS |
| contact_submissions | Landing page form entries |
| saas_plans | Platform pricing tiers |
| gym_saas_subscriptions | Gym platform subscriptions |

### Key Indexes

```sql
-- Performance-critical composite indexes
CREATE INDEX idx_payments_gym_status_created ON payments(gym_id, status, created_at DESC);
CREATE INDEX idx_memberships_gym_created ON member_memberships(gym_id, created_at);
CREATE INDEX idx_profiles_gym_role ON profiles(gym_id, role);
CREATE INDEX idx_attendance_gym ON attendance_logs(gym_id);
CREATE INDEX idx_sessions_studio_date ON class_sessions(studio_id, session_date) WHERE status != 'cancelled';
```

---

## 5. RPC Functions

### Account Management

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `delete_own_account()` | none (uses auth.uid()) | void | Soft-deletes member account, anonymizes profile, bans auth user |

### Studio & QR Access

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `validate_studio_access(p_studio_id, p_user_id)` | uuid, uuid | jsonb | Atomic QR check-in: validates membership, branch access, session booking, writes attendance + decrements session credits |
| `get_studio_sessions(p_studio_id, p_from, p_to)` | uuid, date, date | TABLE | Returns sessions for a studio in date range |

### Membership Purchase

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `purchase_membership_mobile(p_gym_id, p_plan_id, p_amount, p_currency, p_payment_method, p_start_date, p_original_amount)` | uuid, uuid, numeric, text, text, date, numeric | uuid | Creates membership + payment from mobile app, cancels existing active memberships |
| `purchase_service_package_mobile(p_gym_id, p_package_id, p_amount, p_currency, p_payment_method)` | uuid, uuid, numeric, text, text | uuid | Creates service assignment + payment from mobile app |

### Booking & Check-in

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `add_booking(p_gym_id, p_class_id, p_member_id)` | uuid, uuid, uuid | uuid | Creates class booking |
| `remove_booking(p_booking_id)` | uuid | void | Cancels booking |
| `get_session_bookings(p_session_id)` | uuid | TABLE | Lists bookings for a session |
| `get_session_bookings_detail(p_session_id)` | uuid | TABLE | Detailed bookings with member info |
| `update_booking_status(p_booking_id, p_status)` | uuid, text | uuid | Updates booking status |
| `checkin_member(p_gym_id, p_member_id, p_session_id)` | uuid, uuid, uuid | uuid | Manual check-in |

### Payments

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `get_gym_payments(p_gym_id)` | uuid | TABLE | All payments with member details |
| `add_payment(...)` | multiple | uuid | Creates payment record |
| `stamp_paymob_transaction_id(p_payment_id, p_transaction_id)` | uuid, text | void | Stamps Paymob transaction ID, sets status=paid |
| `validate_promo_code(p_code, p_gym_id)` | text, uuid | TABLE | Validates promo code, returns discount details |
| `increment_promo_usage(p_id)` | uuid | void | Increments promo code usage count |

### Analytics & Attendance

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `get_attendance_logs(p_gym_id, p_from, p_to, p_member_id, p_access_point, p_limit)` | uuid, timestamptz, timestamptz, uuid, text, int | TABLE | Filtered attendance logs with member + branch info |
| `get_gym_capacity(p_gym_id)` | uuid | TABLE | Current gym capacity metrics |
| `auto_expire_memberships()` | none | void | Bulk-expires memberships past end_date |

### Helpers

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `is_staff_of_gym(p_gym_id)` | uuid | boolean | Checks if authenticated user is staff of a gym |
| `set_updated_at()` | trigger | trigger | Auto-sets updated_at on INSERT/UPDATE |

---

## 6. Row-Level Security

All business tables have RLS enabled. Access patterns:

| Role | Access |
|------|--------|
| **anon** | Public read on gyms, membership_plans (guest browsing) |
| **authenticated (member)** | Own profile, own gym_members, own bookings, own notifications |
| **authenticated (staff/trainer)** | Gym-scoped read/write based on staff_role_permissions |
| **authenticated (gym_admin)** | Full access to own gym's data |
| **service_role** | Bypasses all RLS (used by gym-backend and admin API routes) |

Key policies:
- `profiles`: Own profile + gym admins can see gym members
- `gym_members`: Own record + staff of gym
- `bookings`: Members manage own, staff manage all in gym
- `payments`: Staff insert/update only
- `member_invitations`: Admin full access, members read/insert own
- `studios`: Members select, admins all
- `audit_logs`: Staff read own gym, system insert only

---

## 7. Admin Dashboard API

All API routes are under `/api/` in the gym-admin Next.js app. Every route uses `resolveGymId()` for authentication and gym scoping.

### Auth Flow

```typescript
// lib/api-gym-id.ts
resolveGymId() -> { user, gymId, admin } | { response: 401/403 }
// 1. Validates JWT session via Supabase cookie auth
// 2. Checks profile role is gym_admin, trainer, or staff
// 3. Returns admin Supabase client (service role)
```

### Endpoint Summary

#### Members
| Method | Path | Description | Rate Limit |
|--------|------|-------------|------------|
| GET | `/api/members` | List members (paginated) | - |
| POST | `/api/members` | Create member | 30/min/gym |
| PATCH | `/api/members/[id]` | Update member | - |
| DELETE | `/api/members/[id]` | Soft delete member | - |
| POST | `/api/members/[id]/membership` | Assign membership plan | - |
| POST | `/api/members/[id]/membership/detach` | Remove membership | - |
| POST | `/api/members/[id]/transfer` | Transfer membership | - |

#### Memberships
| Method | Path | Description |
|--------|------|-------------|
| PATCH | `/api/memberships/[id]` | Log/set session usage |
| PATCH | `/api/memberships/[id]/freeze` | Freeze/unfreeze membership |
| PATCH | `/api/memberships/[id]/extend` | Extend end date |
| POST | `/api/memberships/[id]/add-sessions` | Add sessions to plan |

#### Payments
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/payments` | List payments (via RPC) |
| POST | `/api/payments` | Record payment |
| PATCH | `/api/payments/[id]` | Update payment |
| POST | `/api/payments/[id]/refund` | Process refund |
| POST | `/api/payments/[id]/send-invoice` | Email invoice |
| POST | `/api/payments/send-link` | Send payment link |
| POST | `/api/payments/send-reminder` | Send reminder |

#### Classes & Sessions
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/classes` | List/create classes |
| PATCH/DELETE | `/api/classes/[id]` | Update/delete class |
| POST | `/api/classes/image` | Upload class image |
| GET/POST | `/api/sessions` | List/create sessions |
| PATCH | `/api/sessions/[id]` | Update session |
| DELETE | `/api/sessions/[id]` | Cancel session |
| POST | `/api/sessions/[id]/checkin` | Check-in member |
| POST | `/api/sessions/recurring/[id]/stop` | Stop recurring |

#### Attendance
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/attendance` | Filtered attendance logs |
| POST | `/api/attendance` | Manual check-in |

#### Plans
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/plans` | List/create plans |
| PATCH/DELETE | `/api/plans/[id]` | Update/delete plan |

#### Staff & Roles
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/api/staff` | List/create staff |
| PATCH/DELETE | `/api/staff/[id]` | Update/delete staff |
| GET/POST | `/api/staff/roles` | List/create roles |
| PATCH/DELETE | `/api/staff/roles/[id]` | Update/delete role |
| GET | `/api/staff/activity` | Staff activity log |

#### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/dashboard` | Dashboard KPIs |
| GET | `/api/analytics/members` | Member growth/churn |
| GET | `/api/analytics/revenue` | Revenue breakdown |
| GET | `/api/analytics/classes` | Class performance |

#### Content
| Method | Path | Description |
|--------|------|-------------|
| CRUD | `/api/content/announcements/[id]` | Announcements |
| CRUD | `/api/content/banners/[id]` | Banners |
| CRUD | `/api/content/faqs/[id]` | FAQs |
| CRUD | `/api/content/popups/[id]` | Popups |
| CRUD | `/api/content/partners/[id]` | Partners |

#### Other
| Method | Path | Description |
|--------|------|-------------|
| GET/PATCH | `/api/settings` | Gym settings |
| POST | `/api/settings/logo` | Upload logo |
| CRUD | `/api/branches/[id]` | Branch management |
| CRUD | `/api/studios/[id]` | Studio management |
| CRUD | `/api/trainers/[id]` | Trainer management |
| CRUD | `/api/promos/[id]` | Promo codes |
| CRUD | `/api/offers/[id]` | Offers |
| CRUD | `/api/programs/[id]` | Programs |
| CRUD | `/api/service-packages/[id]` | Service packages |
| CRUD | `/api/class-types/[id]` | Class types |
| GET/POST | `/api/notifications` | Broadcast notifications |
| GET/POST | `/api/invitations` | Guest invitations |
| GET | `/api/capacity` | Gym capacity |

---

## 8. Backend API

The NestJS backend at `gym-backend/` serves the mobile app.

### Module Architecture

```
AppModule
├── AuthModule (JWT auth, QR tokens)
├── MembersModule (CRUD, status management)
├── BookingsModule (class bookings, waitlist)
├── SessionsModule (class sessions CRUD)
├── ClassesModule (class definitions, recurring)
├── CheckinsModule (QR check-in validation)
├── PaymentsModule (Stripe/Paymob integration)
├── MembershipsModule (plan lifecycle)
├── PlansModule (membership plans CRUD)
├── AnalyticsModule (dashboard metrics)
├── NotificationsModule (FCM push)
├── StaffModule (staff accounts)
├── TrainerProfilesModule (trainer info)
├── SettingsModule (gym config)
├── ContentModule (banners, FAQs, etc.)
├── InvitationsModule (guest passes)
├── OffersModule (promotional offers)
├── ProgramsModule (workout programs)
├── ServicePackagesModule (PT/Nutrition packages)
├── PromoCodesModule (discount codes)
├── FeatureTogglesModule (feature flags)
├── SchedulerModule (background jobs)
├── FirebaseModule (FCM client)
├── SupabaseModule (DB client)
└── ... more
```

### Key Endpoints

#### Auth (`/auth`)
| Method | Path | Description | Throttle |
|--------|------|-------------|----------|
| POST | `/auth/register` | Register member | 5/min |
| POST | `/auth/login` | Login | 10/min |
| POST | `/auth/logout` | Logout + blacklist token | - |
| POST | `/auth/refresh` | Refresh JWT pair | - |
| POST | `/auth/forgot-password` | Send reset link | 3/min |
| POST | `/auth/reset-password` | Reset with token | 5/min |
| GET | `/auth/me` | Current user profile | - |
| GET | `/auth/qr-token` | Generate 60s HMAC QR token | - |

#### Members (`/members`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/members` | Create member |
| GET | `/members` | List members (search param) |
| GET | `/members/:id` | Get member detail |
| GET | `/members/:id/checkins` | Check-in history |
| PATCH | `/members/:id` | Update member |
| PATCH | `/members/:id/deactivate` | Deactivate |
| PATCH | `/members/:id/reactivate` | Reactivate |
| DELETE | `/members/:id` | Soft delete |

#### Bookings (`/bookings`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/bookings` | Book class |
| GET | `/bookings/my` | My bookings |
| PATCH | `/bookings/:id/cancel` | Cancel booking |
| PATCH | `/bookings/:id/attendance` | Mark attended/absent |
| POST | `/bookings/batch-attendance` | Batch mark attendance |
| POST | `/bookings/waitlist` | Join waitlist |

#### Check-ins (`/checkins`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/checkins` | Validate QR + check in |
| GET | `/checkins?date=YYYY-MM-DD` | Get check-ins for date |

### QR Token System

```
1. Mobile app calls GET /auth/qr-token
2. Backend generates: base64url(JSON{sub, gym, exp}) + "." + base64url(HMAC-SHA256)
3. Token expires in 60 seconds
4. Gym scanner reads QR -> POST /checkins with token
5. Backend validates HMAC (timing-safe) + checks expiry
6. Inserts attendance_log record
```

---

## 9. Flutter Mobile App Architecture

### State Management (Provider)

```
MultiProvider
├── AuthProvider        # User session, profile, gym info
├── MemberProvider      # Member data, membership, sessions, bookings
├── BannerProvider      # Promotional banners
├── BillingProvider     # Invoices and payments
├── BranchProvider      # Gym branches
├── PopupProvider       # In-app popups
└── RatingReminderProvider  # Session rating prompts
```

### Navigation (GoRouter)

```
/ (redirect to /dashboard)
├── /splash             # Auth check + data bootstrap
├── /login              # Email/password login
├── /register           # 2-step registration
├── /forgot-password    # Password reset request
├── /reset-password     # Deep link from email
│
├── StatefulShellRoute (Main - 5 tabs)
│   ├── /home           # Dashboard with banners, membership, sessions
│   ├── /schedule       # Class browsing + booking
│   ├── /checkin        # QR code display + scanner
│   ├── /explore        # Memberships, offers, trainers, programs
│   └── /profile        # Profile management
│
├── Push Routes (stack on tabs)
│   ├── /membership     # Membership details + freeze
│   ├── /my-bookings    # Booking history
│   ├── /invitations    # Guest invitations
│   ├── /billing        # Invoice list
│   ├── /billing/:id    # Invoice detail
│   ├── /notifications  # Notification center
│   ├── /payment-summary # Checkout
│   └── /explore/*      # Detail screens
│
└── StatefulShellRoute (Guest - 5 tabs, 3 locked)
    ├── /guest/home
    ├── /guest/classes
    ├── /guest/checkin   # Locked
    ├── /guest/bookings  # Locked
    └── /guest/profile   # Locked
```

### Service Layer

**SupabaseService** -- Direct Supabase queries for reads and RPCs:
- `getMemberProfile()`, `getGymInfo()`, `getCurrentMembership()`
- `getSchedule()`, `getBookings()`, `getAttendanceLogs()`
- `updateProfile()`, `uploadAvatar()`, `changePassword()`, `deleteAccount()`
- `purchaseMembershipMobile()`, `purchaseServicePackageMobile()`
- `validatePromoCode()`, `validateGymQrToken()`

**ApiService** -- HTTP client for gym-backend (NestJS):
- `getQrToken()` -- 60s HMAC token for check-in
- `recordCheckin()` -- QR check-in submission
- `bookSession()`, `cancelBooking()`, `getMyBookings()`
- Bearer token auth from Supabase session

### Build Configuration

Runtime config via `--dart-define`:
```
SUPABASE_URL      # Supabase project URL
SUPABASE_ANON_KEY # Supabase anonymous key
GYM_ID            # Gym UUID (white-label builds)
BACKEND_URL       # NestJS API URL
IS_STAGING        # Feature flags for staging
```

---

## 10. Authentication & Authorization

### Auth Flow (Admin Dashboard)

```
1. User visits /login
2. Supabase Auth signInWithPassword()
3. Session stored in HTTP-only cookies (via @supabase/ssr)
4. API routes call resolveGymId():
   a. Read session from cookies
   b. Verify profile.role in (gym_admin, trainer, staff)
   c. Return gymId + admin Supabase client
5. RBAC: getStaffPermissions() checks staff_role_permissions
   - gym_admin/owners: unrestricted (returns null)
   - staff: Permission[] with {module, action} pairs
```

### Auth Flow (Mobile App)

```
1. User signs in via Supabase Auth
2. AuthProvider listens to onAuthStateChange
3. On signedIn: loads profile, gym info, registers FCM token
4. GoRouter redirect: unauthenticated -> /login, authenticated -> /home
5. API calls:
   - Supabase SDK: uses JWT from session (RLS enforced)
   - ApiService: passes Bearer token to gym-backend
6. gym-backend validates JWT via passport-jwt strategy
```

### Role Hierarchy

```
superadmin   -> Platform-wide access (gym-super-admin only)
gym_admin    -> Full access to own gym
trainer      -> Limited access (classes, bookings, attendance)
staff        -> Configurable via staff_role_permissions
member       -> Own data only (mobile app)
anon         -> Public read only (guest mode)
```

### RBAC Permission Modules

```
members, plans, payments, classes, trainers,
promotions, attendance, content, notifications,
analytics, settings, staff
```

Each module supports actions: `view`, `create`, `edit`, `delete`.

---

## 11. Payment Integration

### Paymob (Primary - Egypt)

```
Mobile App                    Supabase Edge Function          Paymob
    |                               |                          |
    |-- POST /paymob-intention ---->|                          |
    |                               |-- Create intention ------>|
    |                               |<-- client_secret ---------|
    |<-- { clientSecret } ---------|                          |
    |                               |                          |
    |-- Open PaymobCardScreen ----->|                          |
    |   (card tokenization)         |                          |
    |                               |                          |
    |                               |<-- Webhook callback -----|
    |                               |-- stamp_paymob_txn_id -->|
    |                               |   (RPC: set paid)        |
    |<-- Payment confirmed ---------|                          |
```

**Edge Functions:**
- `paymob-intention/` -- Creates payment intention with Paymob API
- `paymob-webhook/` -- Validates HMAC, stamps transaction ID, updates payment status
- `paymob-refund/` -- Processes refunds via Paymob API

### Stripe (Backend - Alternative)

The gym-backend has Stripe integration for international payments:
- `PaymentIntent` creation via Stripe SDK
- Webhook handling for `payment_intent.succeeded`
- Refund processing via Stripe API

---

## 12. Push Notifications

### Architecture

```
Admin Dashboard                    Firebase
    |                               |
    |-- POST /api/notifications --->|
    |   { title, body, recipients } |
    |                               |
    |   Query profiles.fcm_token    |
    |   for matching recipients     |
    |                               |
    |-- firebase-admin.messaging()  |
    |   .sendEachForMulticast()  -->|
    |                               |--- Push to devices
    |                               |
    
Flutter App
    |
    |-- firebase_messaging listener
    |-- Shows local notification
    |-- Updates notification badge
```

**Recipient targeting:**
- All members in gym
- Members with specific plan IDs
- Members with specific statuses (active, inactive, etc.)
- Scheduled delivery (cron check on page load)

---

## 13. Environment Variables

### gym-admin (.env.local)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role (server-only) |
| `SUPABASE_HOSTNAME` | No | Image domain for next/image |
| `RESEND_API_KEY` | No | Email service |
| `PAYMOB_SECRET_KEY` | No | Payment gateway |
| `PAYMOB_PUBLIC_KEY` | No | Payment gateway |
| `PAYMOB_INTEGRATION_ID` | No | Payment integration |
| `PAYMOB_IFRAME_ID` | No | Payment iframe |
| `PAYMOB_HMAC_SECRET` | No | Payment webhook verification |

### gym-backend (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Database URL |
| `SUPABASE_ANON_KEY` | Yes | Anonymous key |
| `SUPABASE_SERVICE_KEY` | Yes | Service role key |
| `JWT_SECRET` | Yes | Must match Supabase JWT Secret |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing key |
| `QR_TOKEN_SECRET` | Yes | HMAC key for QR tokens |
| `ALLOWED_ORIGINS` | Yes | CORS whitelist (comma-separated) |
| `PORT` | No | Server port (default: 3000) |
| `JWT_EXPIRES_IN` | No | Token expiry (default: 15m) |
| `STRIPE_SECRET_KEY` | No | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook validation |
| `FIREBASE_SERVICE_ACCOUNT` | No | Firebase admin JSON |
| `REDIS_URL` | No | Optional cache backend |

### gym_mobile_flutter (dart_defines.json)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `GYM_ID` | Yes | Gym UUID for white-label build |
| `BACKEND_URL` | Yes | NestJS API base URL |
| `IS_STAGING` | No | Staging feature flag |

### Supabase Edge Functions (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| `PAYMOB_SECRET_KEY` | Yes | Paymob API secret |
| `PAYMOB_PUBLIC_KEY` | Yes | Paymob public key |
| `PAYMOB_INTEGRATION_ID` | Yes | Card payment integration |
| `PAYMOB_HMAC_SECRET` | Yes | Webhook HMAC verification |
| `REFUND_FUNCTION_SECRET` | Yes | Edge function auth token |
| `RESEND_API_KEY` | No | Custom email hook |
| `APP_GYM_ID` | No | Gym UUID for email routing |
| `FROM_EMAIL` | No | Verified sender address |

---

## 14. Deployment

### Infrastructure

| Component | Platform | Details |
|-----------|----------|---------|
| gym-admin | AWS EC2 (Coolify) | t3.small, eu-west-2, Elastic IP 18.168.78.234 |
| gym-super-admin | AWS EC2 (Coolify) | Same instance |
| gym-backend | AWS EC2 (Coolify) | Same instance |
| Database | Supabase Cloud | Managed PostgreSQL |
| DNS | Cloudflare | DNS only (grey cloud) |
| Mobile | App Store / Play Store | Flutter builds |

### Domain Configuration

| Domain | Service | Record |
|--------|---------|--------|
| staging.clbyapp.com | gym-admin | A -> 18.168.78.234 |
| superadmin.staging.clbyapp.com | gym-super-admin | A -> 18.168.78.234 |

### Coolify Setup

- **Instance**: i-0d3be0e97eba56539
- **Coolify dashboard**: http://18.168.78.234:8000
- **GitHub App**: exuberant-earthworm-qa1ane66qz
- **Deploy branch**: claude/init-gym-repos-iLjqx
- **Swap**: 2GB at /swapfile (prevents OOM during builds)
- **Build system**: Nixpacks

### Build Notes

- gym-admin: `NEXT_PUBLIC_*` vars must be available at build time (hardcoded in next.config.mjs for Coolify compatibility)
- gym-super-admin: Supabase vars hardcoded in next.config.mjs (Coolify buildtime vars don't work with Nixpacks)
- Flutter: Uses `--dart-define` flags for runtime configuration

---

## 15. CI/CD

### Dependabot (Automated Dependency Updates)

Configured in `.github/dependabot.yml`:

| Project | Schedule | Max PRs | Grouped |
|---------|----------|---------|---------|
| gym-admin | Weekly (Mon 09:00 UTC) | 5 | Supabase, Next.js, React |
| gym-super-admin | Weekly (Mon 09:00 UTC) | 5 | Supabase, Next.js |
| gym_mobile_flutter | Weekly (Mon 09:00 UTC) | 5 | Supabase, Security |
| supabase/functions | Weekly (Mon 09:00 UTC) | 3 | - |

### No CI Pipelines

There are currently no GitHub Actions workflows. Deployments are triggered manually via Coolify.

---

*Generated April 6, 2026*
