# Recurring expenses (Payments → Financial Overview)

Status: implemented on `feat/recurring-expenses`; not deployed.

## 1. Audit: what existed before

**Schema.** `expenses` (migration `2026_10_21_100000`) has `id, gym_id, title, amount numeric(12,2) > 0, expense_date DATE, category, vendor, payment_method, description, created_by, timestamps`. It is indexed on `(gym_id, expense_date)` and has RLS policies like the other tenant tables. It has no currency column. Category and payment-method vocabularies live in `App\Models\Expense`.

**Endpoints.** `ExpenseController` behind `RequireGymId` + `RequireAdminRole` + `LogActivityMiddleware`. Permissions are `payments,{view,create,edit,delete}`, and `CheckPermission` checks at module level.

| Route | Purpose |
|---|---|
| `GET /expenses` | Paged list for the period: search (title/vendor), category, sort |
| `GET /expenses/summary` | Overview cards |
| `GET /expenses/export` | Full period plus summary, for the CSV |
| `GET/PUT/DELETE /expenses/{id}` | View, edit, delete. Delete is a hard delete. |
| `POST /expenses` | Create |

**Overview math.** The period is a pair of gym-local dates and defaults to the current calendar month in the gym's timezone.
- Revenue = `App\Support\Revenue::between` (payments collected minus refunds, in the gym's currency only).
- Expenses = `sum(amount)` of rows whose `expense_date` falls in the period.
- Net = revenue − expenses.

The gym's currency is derived from its latest payment (default EGP).

**Scheduler.** `routes/console.php` registered `sales:send-reminders` every 15 minutes. **Nothing in the production image ran the scheduler:**
- `docker/supervisor/supervisord.conf` started only php-fpm, nginx and `queue:work`;
- there is no cron.

So scheduled commands never ran on prod. This branch adds a `[program:scheduler]` (`php artisan schedule:work`, as www-data). Side effect: **`sales:send-reminders` will start running on prod too.** Its channels are stubs that only log and write `sales_outbound_messages`.

**Audit trail.** `LogActivityMiddleware` writes a `staff_activity_logs` row for every successful write. `/expenses/*` maps to module `payments`.

## 2. Data model

**`recurring_expenses`** is the definition. It never counts in any total.

| Column(s) | Meaning |
|---|---|
| `id, gym_id` | Identity and tenant |
| `title, amount, currency, category, payment_method, vendor, description` | What gets recorded. `currency` is the gym currency at creation. |
| `frequency` | `weekly`, `monthly`, `quarterly` or `yearly` |
| `interval` | Repeat every N; ≥ 1 |
| `start_date`, `end_date` | `end_date` NULL = ongoing |
| `recurrence_day` | ISO weekday 1–7 for weekly; day of month 1–31 otherwise |
| `recurrence_month` | 1–12; yearly only |
| `status` | `active`, `paused` or `ended` |
| `generated_through` | Generator cursor (see §5) |
| `previous_id` | Link for "edit this and future" splits |
| `created_by, updated_by, paused_at/by, resumed_at/by, ended_at/by` | Audit columns |

**Occurrences are rows in the existing `expenses` table** (no second financial table). New nullable or defaulted columns:
- `recurring_expense_id`: NULL for a one-off.
- `scheduled_date`: the schedule's date. It stays fixed even if the occurrence is later edited.
- `status`, default `recorded`:
  - `recorded`: an actual expense. Every one-off row is recorded.
  - `scheduled`: an upcoming occurrence edited ahead of time ("Upcoming" in the UI).
  - `skipped`: an upcoming occurrence the admin skipped.
  - `cancelled`: a recorded occurrence the admin voided, or an edited-ahead one made moot by a split or end.
- `currency`: NULL on legacy rows, meaning the gym currency.
- `recorded_at`: when the occurrence became actual.
- `updated_by`.

Constraints:
- Unique index `(recurring_expense_id, scheduled_date)`. NULLs are distinct in Postgres, so all one-off rows are unaffected and the index cannot break on existing data.
- The FK from `expenses.recurring_expense_id` is `ON DELETE SET NULL`. Nothing deletes schedules, and if something ever did, history would survive.

**`recurring_expense_events`** is the lifecycle audit: `(gym_id, recurring_expense_id, expense_id?, action, actor_id, actor_name, details json, created_at)`. Actions:
- `created`, `updated`, `split`;
- `paused`, `resumed`, `ended`, `auto_ended`;
- `occurrence_edited`, `occurrence_skipped`, `occurrence_cancelled`.

The migration `2026_11_27_100000_create_recurring_expenses.php` is fully guarded: `hasTable`, `hasColumn`, `IF NOT EXISTS`, and a `DO $$` check for the FK. Prod migrates on boot, so it is safe to re-run. The test suite runs it twice.

### Accounting rule

Overview, list and export count only `status = 'recorded'` rows, and only in the gym's currency (other currencies are reported in `excluded_expense_currencies`, never summed).
- Every existing row is `recorded` with NULL currency, so one-off totals are byte-for-byte what they were.
- Occurrence rows only become `recorded` on or after their date (§5), so a 1 Dec occurrence can never appear in November, nor in December before 1 Dec arrives in the gym's timezone.

## 3. Recurrence rules and month-end fallback

The rules live in `App\Support\Recurrence`, which is pure (no DB, no clock).

- **Weekly:** the first matching weekday on or after `start_date`, then every `7 × interval` days.
- **Monthly:** every `interval` months on `recurrence_day`.
- **Quarterly:** every `3 × interval` months on `recurrence_day`.
- **Yearly:** every `interval` years on `recurrence_month`/`recurrence_day`.
- **Anchoring:** month-based periods are anchored on `start_date`'s month (yearly on its year). A candidate before `start_date` is dropped, so the first occurrence is the first scheduled day on or after the start date.
- **Month-end fallback: clamp to the last day of the month.**
  - The 31st falls on 30 Apr and on 28/29 Feb.
  - A yearly 29 Feb falls on 28 Feb in non-leap years.
  - Every date is computed from the anchor, never from the previous occurrence, so there is no drift: 31 Jan → 28 Feb → **31** Mar.
  - The UI explains this next to the day picker.
  - Impossible fixed dates (yearly 30 Feb) are rejected by validation.
- **Validation:**
  - `start_date` at most one year in the past;
  - `end_date ≥ start_date`;
  - at least one occurrence between start and end;
  - `interval` 1–99.

## 4. Lifecycle

**Create** (`POST /expenses/recurring`) inserts the definition and immediately runs the generator for it. A start date in the past therefore records the already-due dates right away. The UI says so, and this is capped at one year back.

**Pause** first catches the schedule up to today, so anything already due is recorded. It then sets `paused`. While paused the generator skips the schedule. Configuration and history are untouched.

**Resume** sets `active` and moves the cursor to yesterday when it is behind.
- Dates that passed during the pause are marked processed, not backfilled; the `resumed` event records the gap.
- Today's date, if it is an occurrence, is still recorded.
- Edited-ahead occurrences whose date passed during the pause become `skipped`.
- Pause and resume on the same day cannot duplicate anything (cursor plus unique index).

**End** catches up to today, sets `ended` and `end_date = min(end_date, today)`, and cancels edited-ahead future occurrences. Recorded rows are never touched. A schedule also auto-ends (`auto_ended` event, actor = system) once no scheduled date is left before its end date.

**Edit this occurrence only.**
- **Recorded occurrence:** `PUT /expenses/{id}`, the same endpoint as one-off edit. It cannot change the schedule link, the scheduled date or the status, and it logs `occurrence_edited` with before and after values.
- **Upcoming occurrence:** `PUT /expenses/recurring/{id}/occurrences/{date}`. This stores a `scheduled` row with the overrides (title, amount, category, vendor, method, notes; the date is fixed). The generator promotes it to `recorded` on its date, and the unique index means the normal insert can't duplicate it.

**Skip an upcoming occurrence:** `POST …/occurrences/{date}/skip` stores a `skipped` marker. The date is never recorded, and Next Occurrence moves past it.

**Delete or cancel.** `DELETE /expenses/{id}` on an occurrence **cancels** it: the row is kept, status becomes `cancelled`, it is excluded from totals, listed in the schedule history, and its slot blocks regeneration. On a one-off it is still a hard delete, exactly as before. "End the recurring schedule" is the other delete option in the UI. Every destructive action has a confirmation dialog.

**Edit this and future** (`PUT /expenses/recurring/{id}`) takes the full new definition. Its `start_date` is the effective date E, which must be today or later; recorded history is never rewritten.
- If nothing has been recorded yet and E ≤ the current `start_date`, the schedule is updated in place. Edited-ahead or skip markers on dates the new schedule no longer hits are cancelled.
- Otherwise the schedule is **split**:
  - The old schedule gets `end_date = E − 1` and ends as soon as it has no dates left.
  - A new schedule starts on E with `previous_id = old.id` and the same status (paused stays paused).
  - The new schedule inherits the cursor when E is today, so today's occurrence, already recorded by the old schedule, is not recorded again.
  - Edited-ahead occurrences on or after E are cancelled.
  - The details view links both versions ("replaced by" / "continues").
- The UI defaults E to the next not-yet-recorded occurrence (or today) to keep the phase of every-N-weeks or every-N-months schedules.

## 5. Generation, horizon and scheduler

**Horizon = today (gym-local); upcoming dates are computed on the fly.** No future `expenses` rows are created, except the explicit edited-ahead and skip markers, which are not `recorded` and so never count. This keeps the table bounded and makes "future occurrences never inflate totals" true by construction. `GET /expenses/upcoming?days=30` and the schedule details compute upcoming dates from the definition plus those markers.

**Command:** `php artisan expenses:generate-recurring [--gym=]` (`App\Services\RecurringExpenses::generateAll`). For each active schedule:
1. Open a transaction and `SELECT … FOR UPDATE` the schedule row. Concurrent runs serialise per schedule.
2. Insert every schedule date in `(generated_through, min(today, end_date)]` with `INSERT … ON CONFLICT DO NOTHING` on the unique index.
3. Promote due `scheduled` rows.
4. Advance `generated_through`.
5. Auto-end if finished.

What this guarantees:
- **Missed runs:** the next run catches up every date since the cursor, each dated on its own scheduled date, so each lands in its correct reporting period.
- **Retries and crashes:** a run that dies after inserting but before moving the cursor re-walks the same dates on retry, and the unique index absorbs them.
- **Failures:** one bad schedule is logged and does not block the others. The command exits non-zero if any schedule failed.
- **Safety valve:** at most 500 occurrences per schedule per run. The cursor only advances as far as the run actually got.

**Registration:** `routes/console.php` runs `expenses:generate-recurring` with `->hourly()->withoutOverlapping(30)`. Hourly because gyms have their own timezones; each gym's occurrence is recorded within the hour after its local midnight. Pause, resume, end, edit and create also run generation for that schedule synchronously, so nothing depends on the scheduler for user-visible correctness of "today".

**Prod runner:** the new `[program:scheduler]` in `docker/supervisor/supervisord.conf` runs `php /app/artisan schedule:work` as www-data. Check it after deploy with `docker exec <api> supervisorctl status scheduler`, and run the command by hand at any time; it is idempotent.

## 6. Permissions and audit

Same module as the rest of the overview: `payments`.

| Permission | Endpoints |
|---|---|
| `view` | List, details, upcoming |
| `create` | Create a schedule |
| `edit` | Edit this and future, pause, resume, edit an upcoming occurrence |
| `delete` | End a schedule, skip an upcoming occurrence, cancel an occurrence |

Members are blocked by `RequireAdminRole`. Every lookup is pinned to the caller's gym (a foreign id returns 404), and `gym_id` in a body is ignored.

The audit trail has three layers:
1. The `recurring_expense_events` table (full history, shown in the details view).
2. Who and when columns on the schedule.
3. The existing `staff_activity_logs`, via the middleware. It now gives specific descriptions: "paused a recurring expense", "updated recurring expense 'X' (this and future occurrences)", and so on.

Generated occurrences have `created_by = NULL` (system) and a `recorded_at`.

## 7. Dashboard

- **Add Expense modal:** a required One-off / Recurring selector (selectable cards, default One-off) at the top.
  - One-off keeps the original fields and payload exactly.
  - Recurring shows a Schedule block: frequency, repeat-every, weekday / day-of-month / month (defaulted from the start date), start date and optional end date, each with a description.
  - Switching back to One-off never submits recurrence fields.
- **Expenses table:**
  - New Type column ("One-off" / "Recurring · Monthly").
  - The date column becomes Date / Schedule, adding the next occurrence for recurring rows.
  - New Status column, and a Type filter: All types, One-off, Recurring, Active, Paused, Ended (the last three filter by the parent schedule's status).
  - Search, category, sort and pagination are unchanged.
  - The CSV gains a trailing Type column; existing columns are unchanged.
  - Edit and delete on a recurring row ask which variant you mean.
- **Tabs:** Expenses, Recurring schedules (all definitions, filterable by status), Upcoming (next 30 days).
- **Upcoming strip:** a compact strip under the KPI cards shows the next few occurrences with a per-currency total. It is explicitly not counted in the totals.
- **Schedule details modal:** definition, status, the pause/resume/end and edit-schedule actions, next occurrences (edit only this one / skip), occurrence history (scheduled date, amount, status, recorded on) and activity.
