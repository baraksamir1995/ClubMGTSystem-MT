# Sales & Leads pipeline

Gym-level CRM inside CLBY: lead capture (manual + public web intake), a strict six-stage pipeline, contact logging with automatic follow-up cadence, tour/trial appointments with reminders, offers & objections, task queues, and funnel/leaderboard/source reports. All data is gym-scoped; row-level visibility inside a gym is per sales role (rep / manager / admin).

Backend lives in `clby-api` (`app/Http/Controllers/Sales`, `app/Services/Sales`, `app/Models/Sales`, `app/Enums/Sales`); the admin UI is the **Sales & Leads** tab in `gym-admin` (`app/dashboard/sales`).

## 1. Pipeline

| # | Stage | `stage` value | Entered by |
|---|-------|---------------|------------|
| 1 | New | `new` | Lead created (manual, intake, seeder) |
| 2 | Qualified | `qualified` | Manual transition (stamps `qualified_at`) |
| 3 | Contacted | `contacted` | Manual transition (stamps `first_contacted_at` if unset) |
| 4 | Tour/Trial Booked | `tour_booked` | Manual transition, or auto when an appointment is booked while `contacted` |
| 5 | Offer Presented | `offer_presented` | Manual transition, or auto when the first offer is created while `tour_booked` |
| 6 | Converted | `converted` | The `convert` action only |
| — | Lost | `lost` | The `lost` action only, from any non-terminal stage |

There is no `nurture` stage: **the nurture pool = lost leads**. `markLost` sets `reengage_at` (default now + 90 days, overridable) and cancels the lead's open tasks; `GET /sales/leads?nurture=1` lists them; `reopen` moves `lost → new` with fields cleared.

Hard rules — all enforced in `app/Services/Sales/LeadPipeline.php`, the *single writer* of `sales_leads.stage`:

- Forward moves go exactly **one stage at a time** (`LeadStage::next()`); skipping or moving backward returns `422` with the message `Invalid transition <from> → <to>; next stage is <next>.`
- `converted` is unreachable via `transition` — only `POST …/convert`, which requires the lead to be at `offer_presented` and to reference an offer on the lead (the offer is flipped to `accepted` inside the same DB transaction).
- `lost` is unreachable via `transition` — only `POST …/lost`, and a `reason` from the `LostReason` enum is required.
- Converted leads are terminal and **read-only** (mutating endpoints return `422 Converted leads are read-only.`); lost leads must be reopened before being worked (`422 Lead is lost — reopen it first.`).
- Every stage change (including creation and reopen) is appended to `sales_lead_stage_history` — full history is preserved.

Convert also cancels open follow-up tasks and creates a 3-item onboarding checklist ("App / QR access setup", "Book welcome session / PT assessment", "First-visit follow-up") due on days +1/+2/+3.

## 2. Roles & scoping

Route entry into the module is gated by the existing staff-permission middleware: every sales route carries `permission:sales,view|create|edit`, so only staff whose role grants the `sales` module (or gym admins) get in at all. *Which rows* a caller sees is decided by `app/Services/Sales/SalesAccess.php`:

| Spec role | In this codebase | Sees | Can do |
|-----------|------------------|------|--------|
| Admin | `profiles.role = 'gym_admin'` (or `super_admin`) | Whole gym | Everything, incl. rotate intake token, manage sources, designate managers |
| Manager | `staff_members.sales_role = 'manager'`; `manager_branch_ids` (json) limits branches, null/empty = whole gym | Their branches + branchless leads | Assign/reassign leads, work any lead in scope, edit settings & team, leaderboard, see intake token |
| Rep | Any other staff holding the `sales` module (`sales_role` null → rep); `staff_members.branch_id` = home branch | Own leads + the **unassigned queue** of their branch (and branchless unassigned leads) | Claim, and work only leads assigned to them (`canWork`) |

Notes verified against code:

- A rep can *view* unassigned queue leads but must **claim** (or be assigned) before mutating — otherwise `403 Claim or get assigned this lead to work it.`
- Out-of-scope lead ids return **404, not 403**, so reps can't probe other reps' leads.
- Managers-only: `assign`, `PATCH /sales/settings`, `PATCH /sales/team/{staffId}`, `GET /sales/reports/leaderboard`. Gym-admin-only: source create/update, `rotate-intake-token`, promoting a staff member to `sales_role='manager'`.
- `GET /sales/context` returns `{is_admin, is_manager, user_id, branch_ids, branches}` so the UI can pick rep vs manager views.

### Admin UI (gym-admin)

The module surfaces as the **Sales & Leads** tab (`/dashboard/sales`, `TrendingUp` icon in `components/nav-links.tsx`), visible only when the session's permissions include the `sales` module (nav `allowedHrefs` filtering + the API's `permission:sales,*` gate). The workspace shell (`components/sales/sales-page.tsx`) renders role-aware views driven by `GET /sales/context`, switched via the repo's `?view=` sub-tab convention:

- **Reps** — `myday` (default: today's tasks, uncontacted leads, branch claim queue, today's appointments), `pipeline` (kanban with native drag-and-drop; invalid moves snap back with the server's message), `leads` (filterable list + create with duplicate-warning flow), `stats` (personal speed-to-lead, show rate, close rate, conversions).
- **Managers/admins** — all of the above plus `overview` (default: unassigned/SLA/no-show/task-load alert cards), `assign` (single + bulk assignment and rep-to-rep reassignment), `reports` (funnel, leaderboard, source ROI), `team` (rep/manager designation and branch scoping), `settings` (SLAs, cadence, lead sources, intake token — admin-only pieces gated by `is_admin`).

Rep components live in `components/sales/rep/`, manager components in `components/sales/manager/`; the shared lead-detail drawer (`rep/lead-detail.tsx`) is used by both. Client data flows through the catch-all proxy `app/api/sales/[...path]/route.ts`; shared types are in `lib/sales-types.ts`.

## 3. Data model

Migration: `clby-api/database/migrations/2026_07_15_100000_create_sales_pipeline_tables.php`. All tables are UUID-keyed and gym-scoped. FKs to legacy Supabase tables (`gyms`, `branches`, `profiles`, `membership_plans`, `gym_members`) are intentionally plain indexed uuid columns — the app layer owns referential checks.

| Table | Purpose / key columns |
|-------|----------------------|
| `sales_leads` | The lead. Identity (`name`, `phone` E.164, `email`), `branch_id`, `source_id`, qualification checklist (`interest_level`, `location_fit`, `fitness_goal`, `budget_range`, `join_timeframe`), `stage`, `score` (`hot/warm/cold`), `assigned_to` (profiles.id) + `claimed_at`, UTM fields, cadence counters (`contact_attempts`, `first_contacted_at`, `qualified_at`), terminal fields (`converted_at`, `lost_at`, `lost_reason`, `lost_notes`, `reengage_at`), conversion payload (`converted_member_id`, `accepted_offer_id`, `agreement_ref`, `payment_method`, `final_price`, `membership_start_date`). Soft deletes. Indexes on `(gym_id, stage/phone/email)`. |
| `sales_lead_stage_history` | Append-only stage log: `from_stage`, `to_stage`, `changed_by`, `reason`. |
| `sales_activities` | Contact log: `type` (`call/whatsapp/sms/email/note`), `outcome` (`answered/no_answer/callback_requested/not_interested`), `notes`. Notes don't count as contact attempts. |
| `sales_appointments` | `type` (`tour/trial/guest_pass/class_taster`), `scheduled_at`, `status` (`scheduled/showed/no_show/cancelled`), `host_id`, reminder flags `reminded_24h`/`reminded_2h`, `marked_at`. |
| `sales_offers` | `plan_id` (membership_plans), `quoted_price`, `discount_type` (`percent/fixed/waived_joining_fee/custom`), `discount_value`, `valid_until`, `incentive_notes`, `status` (`open/accepted/declined` — `accepted` only via convert). |
| `sales_objections` | `reason` (LostReason values minus `unreachable`), optional `offer_id`, `notes`. |
| `sales_tasks` | `type` (`follow_up/rebook/onboarding/other`), `title`, `due_at`, `status` (`open/done/cancelled`), `assigned_to`. |
| `sales_lead_sources` | Per-gym source catalog: `name` (unique per gym), `default_score`, `is_active`, `sort`. Defaults seeded on first use: Walk-in (hot), Website Form (warm), Social Media Ad (warm), Member Referral (hot), Corporate/Partner (warm), Day Pass (hot), Event (warm), Other (cold). |
| `sales_settings` | One row per gym (`SalesSetting::forGym` auto-creates with a random 48-char `intake_token`): `unassigned_sla_minutes` (60), `qualify_sla_hours` (24), `first_contact_minutes` (15), `max_contact_attempts` (5), `cadence_days` (null → `[1,3,7]`), `reminder_hours` (null → `[24,2]`). |
| `sales_outbound_messages` | Log of every outbound notification: `channel` (`whatsapp/sms`), `to`, `body`, `status` (`queued/sent/failed/stubbed`). |
| `staff_members` (columns added) | `sales_role` (`rep/manager`, null = module permission alone decides → rep), `branch_id` (rep home branch), `manager_branch_ids` (json). |

Enums live in `app/Enums/Sales/`. `LostReason` doubles as the objection taxonomy: objections use every value except `unreachable` (lost = objections + `unreachable`).

## 4. API reference

All routes below (except public intake) sit inside the authenticated gym group: Sanctum bearer token + gym scoping, plus the listed `permission:sales,*` action. Base URL examples use local dev (`http://localhost:8081`).

### Leads

| Method & path | Permission | Notes |
|---|---|---|
| `GET /api/sales/leads` | view | Filters: `stage, score, source_id, branch_id, assigned_to, unassigned=1, nurture=1, q` (name/phone/email), `sort` (`created_at/updated_at/name/score`), `dir`, `per_page` (≤100). Each row carries `flags` (`unassigned_sla_breach`, `uncontacted`, `unqualified_sla_breach`) and `speed_to_lead_minutes`. Paginated `{data, meta}`. |
| `POST /api/sales/leads` | create | Body: `name*, phone*` (normalized to E.164, Egyptian `01…` gets `+20`), `email, source_id, branch_id, interest, notes, utm_*, assign_to_me, force`. `201` with lead; score defaults from the source. |
| `GET /api/sales/leads/{id}` | view | Full detail: source, branch, stageHistory, activities, appointments, offers, objections, tasks. |
| `PATCH /api/sales/leads/{id}` | edit | Contact fields, `score`, and the qualification checklist (`interest_level: high/medium/low`, `location_fit: good/acceptable/poor`, `fitness_goal: weight_loss/muscle_gain/general_fitness/classes/pt/rehab`, `budget_range`, `join_timeframe: immediately/this_month/1_3_months/later`). |
| `POST /api/sales/leads/{id}/claim` | edit | Rep self-claims from the unassigned queue; atomic first-claim-wins. `409` if already assigned. |
| `POST /api/sales/leads/{id}/assign` | edit | Managers only (`403` otherwise). Body `{assigned_to}` (uuid or null to unassign); assignee must be active staff or a gym admin in the gym (`422`). |
| `POST /api/sales/leads/{id}/transition` | edit | Body `{to, reason?}`. One step forward only; `422` on any invalid transition. |
| `POST /api/sales/leads/{id}/lost` | edit | Body `{reason*: price/commitment_length/needs_to_think/comparing_competitors/timing/unreachable/other, notes?, reengage_at?}` (`reengage_at` must be a future date). |
| `POST /api/sales/leads/{id}/reopen` | edit | Lost → new (nurture re-engagement). `422` if the lead isn't lost. |
| `POST /api/sales/leads/{id}/convert` | edit | Body `{offer_id*, payment_method*: cash/card/instapay/bank_transfer/other, final_price*, start_date*, agreement_ref?, member_id?}`. `member_id` must be an existing `gym_members.id` in the gym. Response includes the onboarding tasks. |

**Create + duplicate flow.** Duplicate detection matches same phone *or* email in the gym, any stage (soft-deleted excluded), and returns `409` so the UI can offer view/merge; `force: true` creates anyway:

```bash
curl -s -X POST http://localhost:8081/api/sales/leads \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Mona Adel","phone":"01012345678","email":"mona@example.com","assign_to_me":true}'
# → 201 {"data":{...,"phone":"+201012345678","stage":"new"}}

# Same phone again:
# → 409 {"error":"duplicate","existing_lead":{"id":"...","name":"Mona Adel","stage":"new",...}}

# Create despite the warning:
curl -s -X POST http://localhost:8081/api/sales/leads \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Mona Adel","phone":"01012345678","force":true}'
```

**Transition (and a 422).**

```bash
curl -s -X POST http://localhost:8081/api/sales/leads/$LEAD/transition \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"to":"qualified"}'
# → 200 {"data":{"stage":"qualified",...}}

curl -s -X POST http://localhost:8081/api/sales/leads/$LEAD/transition \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"to":"offer_presented"}'
# → 422 {"error":"Invalid transition qualified → offer_presented; next stage is contacted."}
```

**Convert.**

```bash
curl -s -X POST http://localhost:8081/api/sales/leads/$LEAD/convert \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"offer_id":"'$OFFER'","payment_method":"card","final_price":1200,"start_date":"2026-08-01","member_id":"'$MEMBER'"}'
# → 200 lead at stage converted + 3 onboarding tasks
# From any stage other than offer_presented:
# → 422 {"error":"Leads convert from offer_presented only."}
```

### Activities

| Method & path | Permission | Notes |
|---|---|---|
| `POST /api/sales/leads/{id}/activities` | create | Body `{type*: call/whatsapp/sms/email/note, outcome?: answered/no_answer/callback_requested/not_interested, notes?}`. Runs `FollowUpCadence` side effects. |

```bash
curl -s -X POST http://localhost:8081/api/sales/leads/$LEAD/activities \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"call","outcome":"no_answer"}'
# → 201 {
#   "data": {...activity...},
#   "lead": {"id":"...","stage":"new","contact_attempts":1,"first_contacted_at":"..."},
#   "prompt_lost": false,            # true once contact_attempts >= max_contact_attempts (5)
#   "follow_up_tasks_created": 3     # Day 1/3/7 follow-up tasks (0 if a cadence is already open)
# }
```

### Appointments

| Method & path | Permission | Notes |
|---|---|---|
| `GET /api/sales/appointments` | view | Calendar feed; filters `from, to, branch_id, host_id, status`; max 500, ordered by `scheduled_at`; access-scoped via the lead. |
| `POST /api/sales/leads/{id}/appointments` | create | Body `{type*: tour/trial/guest_pass/class_taster, scheduled_at* (future), branch_id?, host_id?}` (defaults: lead's branch / assignee). Auto-advances `contacted → tour_booked`. `422` if the lead is closed. |
| `PATCH /api/sales/appointments/{id}/status` | edit | Body `{status*: showed/no_show/cancelled}`. `no_show` creates a next-day rebook task for the lead's rep. |

### Offers & objections

| Method & path | Permission | Notes |
|---|---|---|
| `POST /api/sales/leads/{id}/offers` | create | Body `{quoted_price*, plan_id?, discount_type?: percent/fixed/waived_joining_fee/custom, discount_value?, valid_until?, incentive_notes?}`. Plan must belong to the gym. First offer auto-advances `tour_booked → offer_presented`. |
| `PATCH /api/sales/leads/{id}/offers/{offerId}` | edit | Body `{status: open/declined}` only — `accepted` happens exclusively through convert. |
| `POST /api/sales/leads/{id}/objections` | create | Body `{reason*: any LostReason except unreachable, notes?, offer_id?}`. |

### Tasks

| Method & path | Permission | Notes |
|---|---|---|
| `GET /api/sales/tasks` | view | Default: caller's own open tasks due today or overdue (the "My Day" queue). `?scope=team` (managers) widens to their branch scope; `?due=all` lifts the date filter. Max 200. |
| `PATCH /api/sales/tasks/{id}` | edit | Body `{status: done/cancelled}`. Own task, or any task if manager. |

### Sources

| Method & path | Permission | Notes |
|---|---|---|
| `GET /api/sales/sources` | view | Seeds the per-gym defaults on first call. |
| `POST /api/sales/sources` | create | Gym admins only. `409` on duplicate name (case-insensitive). |
| `PATCH /api/sales/sources/{id}` | edit | Gym admins only. `name, default_score, is_active, sort`. |

### Settings & team

| Method & path | Permission | Notes |
|---|---|---|
| `GET /api/sales/settings` | view | Reps get operational knobs but the `intake_token` is stripped; resolved `cadence_days`/`reminder_hours` defaults included. |
| `PATCH /api/sales/settings` | edit | Managers only. SLA numbers, `max_contact_attempts`, `cadence_days[]` (1–10 items, 1–60), `reminder_hours[]` (1–5 items, 1–168). |
| `POST /api/sales/settings/rotate-intake-token` | edit | `gym_admin` role only; returns the new 48-char token. |
| `GET /api/sales/team` | view | Roster: active staff whose role grants the `sales` module, plus their `sales_role` (null reported as `rep`), `branch_id`, `manager_branch_ids`. |
| `PATCH /api/sales/team/{staffId}` | edit | Managers set `branch_id`/`manager_branch_ids`/`sales_role`; promoting to `manager` requires a gym admin. |

### Reports

| Method & path | Permission | Notes |
|---|---|---|
| `GET /api/sales/context` | view | Caller's sales identity: `{is_admin, is_manager, user_id, branch_ids, branches[]}`. |
| `GET /api/sales/reports/funnel` | view | `{stages[] , conversion[], showed_count, no_show_count}` — a lead counts toward every stage it ever *reached* (from stage history), so the funnel never inverts. Filters: `from, to, branch_id, source_id, rep_id`. |
| `GET /api/sales/reports/leaderboard?month=YYYY-MM` | view | Managers only. Per rep: `leads, avg_speed_to_lead_minutes, show_rate, close_rate, conversions`, sorted by conversions. |
| `GET /api/sales/reports/sources` | view | Volume + conversion rate per source. Same filters as funnel. |

All reports flow through `SalesAccess::scopeLeads`, so a rep's "stats" are automatically their own slice.

### Public intake

`POST /api/sales/intake` — unauthenticated, throttled 60/min, for website forms and ad platforms. Auth is the gym's intake token via `X-Intake-Token` header or a `token` body field.

```bash
curl -s -X POST https://api.clbyapp.com/api/sales/intake \
  -H "X-Intake-Token: $INTAKE_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Omar Said","phone":"+201098765432","email":"omar@example.com",
       "source":"Social Media Ad","interest":"PT","utm_source":"facebook","utm_campaign":"summer26"}'
# → 201 {"ok":true,"lead_id":"..."}
# Duplicate phone in the gym → 200 {"ok":true,"merged":true}
#   (a note activity is logged on the existing lead instead of forking it)
# Missing/invalid token → 401
```

Unknown `source` names are auto-created as sources (score `warm`); `branch_id` is silently dropped if it doesn't belong to the gym.

## 5. Automation

- **Follow-up cadence** (`app/Services/Sales/FollowUpCadence.php`, triggered by logging an activity): any non-`note` activity bumps `contact_attempts` and stamps `first_contacted_at` (speed-to-lead). A `no_answer` outcome schedules "Day N follow-up" tasks on the gym's `cadence_days` (default **1/3/7**) — only if the lead has no open follow-ups, so re-logging no-answers doesn't stack cadences.
- **Max-attempts prompt**: once `contact_attempts >= max_contact_attempts` (default **5**), the activity response returns `prompt_lost: true` — the UI should prompt marking the lead Lost (typically `unreachable`). The backend prompts; it never auto-loses.
- **SLA flags** (computed on `GET /sales/leads`, not stored): `unassigned_sla_breach` (unassigned > 60 min), `uncontacted` (no first contact > 15 min), `unqualified_sla_breach` (still `new` > 24 h). All three thresholds are per-gym in `sales_settings`.
- **Appointment reminders**: `php artisan sales:send-reminders` runs **every 15 minutes** (`routes/console.php`). For `scheduled` appointments within 48 h it sends a reminder at each configured offset (default **24 h and 2 h** before; per-gym `reminder_hours`), flipping `reminded_24h`/`reminded_2h` so each fires once. Delivery goes through the `NotificationChannel` abstraction — currently `StubWhatsAppChannel` (and a `StubSmsChannel`), which log to the Laravel log with status `stubbed` instead of sending. Every attempt, real or stubbed, is recorded in `sales_outbound_messages`.

## 6. Local dev

```bash
# API + admin (see CLAUDE.md)
cd clby-api && php artisan serve --host=0.0.0.0 --port=8081
cd gym-admin && npm run dev            # http://localhost:3001

# Migrate (creates the sales_ tables + staff_members sales columns)
cd clby-api && php artisan migrate

# Demo data: ~100 leads across stages/sources/branches for the first gym,
# or a specific gym via SEED_GYM_ID. Skips if the gym already has leads.
php artisan db:seed --class=SalesDemoSeeder
SEED_GYM_ID=<uuid> php artisan db:seed --class=SalesDemoSeeder

# Run the reminder command manually
php artisan sales:send-reminders

# Tests
php artisan test tests/Feature/Sales
```

**Why the tests build their own schema:** the suite runs on in-memory sqlite (`phpunit.xml`), but the core schema (profiles, staff_members, gyms, …) is legacy Supabase with no Laravel migrations, so `RefreshDatabase` can't rebuild it. `tests/Feature/Sales/SalesTestCase.php` instead hand-creates the minimal supporting tables and then runs the *real* sales migration on top — which doubles as a portability check for the migration itself. Test files: `PipelineTransitionTest`, `DuplicateDetectionTest`, `FollowUpCadenceTest`, `LeadScopingTest`.

## 7. Known gaps / next steps

- **Conversion links, it doesn't create.** `convert` accepts an optional `member_id` referencing an existing `gym_members` row; creating the member (profile, membership, payment) still happens through the existing Members flow. A follow-up could deep-link "create member from lead" and pass the accepted offer's plan/price.
- **Notification gateways are stubs.** WhatsApp/SMS channels log to the app log with status `stubbed`; wiring a real WhatsApp Business API / SMS provider means implementing `NotificationChannel` and swapping the binding in `SendSalesReminders`. `sales_outbound_messages` is already the audit trail.
- **UI localization pending.** The sales workspace ships with English-only strings for now (the rest of gym-admin is en+ar via next-intl); a localization pass should move its strings into `messages/{en,ar}/sales.json`.
- **Localization pending.** Sales UI strings are English-only for now; the gym-admin next-intl setup means Arabic strings need adding when the workspace lands.
- **Report shapes may evolve.** `funnel` / `leaderboard` / `sources` return the JSON documented above; treat them as v1 shapes for the manager Reports view (e.g. no time-bucketed trends yet).
- **Phone normalization is Egypt-biased.** `App\Support\Phone::toE164` defaults unprefixed local numbers to `+20`; multi-country tenants will need a per-gym default country.
