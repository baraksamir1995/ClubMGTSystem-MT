# Members Module — Business Understanding Document

**Module:** Members Management
**Application:** Gym Admin Dashboard
**Last Updated:** 2026-04-16

---

## 1. Purpose

The Members module is the core of the gym management system. It manages the full lifecycle of gym members — from registration and plan assignment through daily check-ins, payments, service packages, and eventual membership expiry or cancellation. It serves as the central hub that connects to attendance, billing, scheduling, and staff modules.

---

## 2. Member Data Model

### 2.1 Core Member Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | Auto | Unique identifier |
| `member_number` | String | Auto-generated | Human-readable member ID |
| `status` | Enum | Yes | `active`, `inactive`, `suspended`, `expired`, `exhausted`, `cancelled`, `paused` |
| `joined_at` | DateTime | Auto | Registration date |
| `notes` | Text | No | Internal staff notes |
| `gym_id` | UUID | Auto | Association with the gym |

### 2.2 User Profile (Linked)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `full_name` | String | Yes | Member's full name |
| `email` | String | No | Email address (with verification tracking) |
| `phone` | String | No | Phone number |
| `gender` | Enum | No | `male` or `female` |
| `date_of_birth` | Date | No | Date of birth |
| `address` | String | No | Physical address |
| `photo_url` | URL | No | Profile picture |
| `email_verified` | Boolean | Auto | Whether email has been verified |

### 2.3 Derived/Computed Indicators

- Days remaining until membership expiry (warning at 14 days)
- Sessions remaining (for session-based plans)
- Current freeze status and history
- Total check-in count

---

## 3. Member Statuses & Transitions

```
                  ┌──────────┐
         ┌──────>│  Active   │<──────┐
         │        └────┬─────┘       │
         │             │             │
    Reactivate    Deactivate    Assign Plan
         │             │             │
         │        ┌────▼─────┐       │
         └────────│Suspended │       │
                  └──────────┘       │
                                     │
  ┌──────────┐                ┌──────┴───┐
  │ Expired  │  (auto, date)  │ Inactive │
  └──────────┘◄───────────────└──────────┘
  ┌──────────┐
  │Exhausted │  (auto, sessions = 0)
  └──────────┘
  ┌──────────┐
  │ Paused   │  (freeze active)
  └──────────┘
```

- **Active** — Member has a valid membership and can access the gym.
- **Inactive** — No active membership assigned. Default state before plan assignment.
- **Suspended** — Manually deactivated by staff (e.g., disciplinary, payment issues).
- **Expired** — Membership end date has passed (automatic).
- **Exhausted** — All sessions consumed on a session-based plan (automatic).
- **Paused** — Membership is frozen (temporary hold).
- **Cancelled** — Membership has been permanently cancelled.

---

## 4. Member Lifecycle

### 4.1 Registration

- Staff creates a member via the **Add Member** modal.
- Only `full_name` is required; all other fields are optional.
- The backend auto-generates a unique `member_number`.
- Member starts in `inactive` status until a plan is assigned.

### 4.2 Plan Assignment

Once registered, a membership plan is assigned to the member. Plans come in three types:

| Plan Type | Description | Tracked By |
|-----------|-------------|------------|
| **Duration** (`monthly`, `annual`, `duration`) | Time-limited access | Start date → End date |
| **Sessions** | Fixed number of visits | Sessions used / Sessions total |
| **Hybrid** (`duration_session`) | Time-limited AND session-limited | Both date range AND session count |

**Assignment includes:**
- Selecting a plan from available options
- Setting a start date
- Optionally applying a discount (promo code or plan promotion)

**Discount types:**
- **Promo codes** — Percentage or fixed-amount discounts with optional date validity and usage limits
- **Plan promotions** — Special pricing set directly on a plan for a date range

**Business rule:** Only one active membership per member at a time. Assigning a new plan cancels the current one.

### 4.3 Ongoing Management

Once active, a membership can be managed with the following operations:

| Operation | Applies To | What It Does |
|-----------|-----------|--------------|
| **Extend** | Duration plans | Adds extra days (presets: 7, 14, 30, 90 or custom) |
| **Add Sessions** | Session/hybrid plans | Adds extra sessions (presets: 5, 10, 20, 50 or custom) |
| **Freeze** | Duration plans (if enabled) | Pauses the membership for N days; extends expiry by the same |
| **Unfreeze** | Frozen memberships | Resumes the membership early; refunds unused freeze days |
| **Transfer** | Any active membership | Moves the membership to a different member |
| **Change Plan** | Any membership | Cancels current plan and assigns a new one |
| **Detach Plan** | Any membership | Removes the plan; member returns to inactive |

### 4.4 Freeze Rules

Freezing is a controlled feature with strict business rules:

1. The plan must have `freeze_enabled = true`.
2. The member selects how many days to freeze (1 to max allowed).
3. **Max allowed** = minimum of:
   - Remaining freeze days (`freeze_max_days` minus days already used)
   - Days until membership expiry
4. **Max freeze count** — Total number of freeze actions is limited by `freeze_max_count`.
5. When frozen, the membership expiry date is extended by the freeze duration.
6. When unfrozen early, unused days are credited back (expiry adjusted down).
7. Freeze history is logged with timestamps: `frozen_at`, `frozen_until`, `resumed_at`.

### 4.5 Membership Transfer

Transfers move a membership from one member to another:

1. Source member must have an active membership.
2. Staff selects a destination member via searchable dropdown (name, number, or email).
3. A review step shows both members and the plan details before confirming.
4. After transfer, the source member becomes inactive and the destination member becomes active.

---

## 5. Member Detail View

The member profile page is organized into three tabs:

### 5.1 Overview Tab

- **Personal Information** — Name, email (with verified/unverified badge), phone, address, DOB, gender.
- **Current Membership** — Plan name, type, price, currency, status, date range, session usage with progress bar.
- **Freeze Details** (if plan supports it) — Days used/max, count used/max, freeze history log.
- **Quick Stats** — Total check-ins, visits in current period, last visit timestamp.
- **Service Packages** — Assigned services with session progress (see Section 7).

### 5.2 Payments Tab

- Full payment history table (paginated, 5 per page).
- Date range filter (from/to).
- Summary metrics: total paid, total pending, total refunded.
- Each payment shows: date, service/item, specialist, method, amount, currency, status.
- Payment statuses: `paid` (green), `pending` (amber), `overdue` (red), `refunded` (blue).
- CSV export for statement generation.

### 5.3 Attendance Tab

- Summary cards: total check-ins, visits in current period, last visit with time.
- Date range filter.
- Log entries: date, time (12-hour format), access point, branch, check-in method.

---

## 6. Payments & Billing

### 6.1 Payment Object

| Field | Type | Description |
|-------|------|-------------|
| `amount` | Decimal | Amount paid |
| `original_amount` | Decimal | Amount before discount (if any) |
| `discount_amount` | Decimal | Discount applied |
| `promo_code` | String | Promo code used (if any) |
| `currency` | String | Default: `EGP` |
| `payment_method` | Enum | `cash`, `bank_transfer`, `card`, `other` |
| `status` | Enum | `paid`, `pending`, `overdue`, `refunded`, `partial_refund` |
| `source` | String | Origin of payment (plan, service, etc.) |
| `item_name` | String | What was paid for |
| `specialist_name` | String | If paid to a specialist |

### 6.2 Currency

- Default currency: **EGP** (Egyptian Pound).
- Formatted via `Intl.NumberFormat` with fallback: `EGP 1,234.56`.

---

## 7. Service Packages

Members can be assigned supplementary service packages beyond their main membership:

| Service Type | Icon | Description |
|-------------|------|-------------|
| `personal_trainer` | Dumbbell | Personal training sessions |
| `nutritionist` | Salad | Nutrition consultations |
| `physiotherapist` | HeartPulse | Physiotherapy sessions |

Each service assignment tracks:
- Package name and type
- Assigned specialist/trainer name
- Sessions used vs. total (with progress bar)
- Status: `active`, `completed`, `cancelled`
- Optional notes

---

## 8. Members List & Search

### 8.1 List View

- Paginated table: **20 members per page**.
- Displays: member number, name, email, phone, status badge, plan name, join date.
- Total member count shown.

### 8.2 Search

- Full-text search across: name, email, phone, member number.
- Debounced input (350ms) for responsive UX.

### 8.3 Filters & Sorting

| Filter | Options |
|--------|---------|
| Status | All, Active, Inactive/Expired, Suspended |
| Sort | Newest first (default), Oldest first |

### 8.4 Export

- Formats: **CSV** and **Excel (XLSX)**.
- Selectable rows with Select All / Deselect All.
- Exported columns: Member #, Full Name, Email, Phone, Status, Plan Name, Plan Type, Joined Date.
- Filename: `members_export_YYYY-MM-DD.csv` or `.xlsx`.

---

## 9. Permissions & Access Control

### 9.1 Permission Model

Permissions are module + action pairs: `{ module: 'members', action: 'create' }`.

### 9.2 Roles

| Role | Access Level |
|------|-------------|
| **Gym Admin** | Unrestricted — all operations allowed |
| **Staff / Trainer** | Role-based — permissions aggregated from assigned roles |

### 9.3 Member Module Permissions

| Permission | Controls |
|-----------|----------|
| `members.create` | Add Member button, create API |
| `members.edit` | Edit member, deactivate/reactivate, verify email, all membership operations |
| *(implied)* | All authenticated staff can view/read member data |

### 9.4 Enforcement

- **Client-side:** `can(permissions, 'members', 'action')` hides/shows UI elements.
- **Server-side:** `denyUnlessPermitted(token, 'members', 'action')` returns 403 if unauthorized.

---

## 10. Technical Architecture

### 10.1 Frontend

- **Framework:** Next.js 14 (App Router) with TypeScript
- **Styling:** Tailwind CSS
- **State:** React hooks (`useState`, `useCallback`, `useMemo`)
- **Icons:** Lucide React
- **Export:** XLSX library for Excel generation
- **Notifications:** react-hot-toast

### 10.2 API Pattern

The Next.js frontend proxies all requests to a Laravel backend:

```
Browser → Next.js API Route → Laravel Backend API
```

- Authentication via Bearer token (stored in `auth_token` cookie).
- Consistent pagination response: `{ page, pages, total, limit }`.
- Error responses: `{ error, message }`.

### 10.3 Key API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/members` | List members (paginated, filterable) |
| `POST` | `/api/members` | Create member |
| `GET` | `/api/members/list` | Flat member list (for dropdowns) |
| `GET` | `/api/members/{id}` | Member detail with relationships |
| `PATCH` | `/api/members/{id}` | Update member |
| `DELETE` | `/api/members/{id}` | Delete member |
| `POST` | `/api/members/{id}/membership` | Assign plan |
| `POST` | `/api/members/{id}/membership/detach` | Detach plan |
| `POST` | `/api/members/{id}/transfer` | Transfer membership |
| `POST` | `/api/members/{id}/verify-email` | Verify email |
| `POST` | `/api/members/{id}/services` | Assign service package |
| `POST` | `/api/memberships/{id}/extend` | Extend duration |
| `POST` | `/api/memberships/{id}/add-sessions` | Add sessions |
| `POST` | `/api/memberships/{id}/freeze` | Freeze or unfreeze |

---

## 11. Key Business Rules Summary

1. **One active membership per member** — assigning a new plan cancels the old one.
2. **Full name is the only required field** for member registration.
3. **Member numbers are auto-generated** by the backend — never manually set.
4. **Freeze requires plan opt-in** — `freeze_enabled` must be true on the plan.
5. **Freeze has hard limits** — max days and max freeze count enforced.
6. **Transfers require an active source membership** and a valid destination member.
7. **Session-based plans auto-exhaust** when `sessions_remaining` hits zero.
8. **Duration-based plans auto-expire** when the end date passes.
9. **Promo codes are validated** for: active status, date range, and usage limits.
10. **Permissions are enforced** both client-side (UI visibility) and server-side (API guards).
