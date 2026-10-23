<?php

namespace App\Http\Controllers;

use App\Jobs\SendGymRequestEmail;
use App\Models\GymRequest;
use App\Services\GymProvisioningService;
use App\Services\StorageService;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Gym self-onboarding: public submission from clbyapp.com/register and the
 * super-admin review queue.
 *
 *   pending ──approve──▶ approved   (gym + owner provisioned in the same tx)
 *      │  ▲
 *  decline └──reopen── declined     (reopen is the only way back)
 *      ▼
 *   declined
 *
 * Every transition locks the request row, so a double-click or two
 * super-admins acting at once resolve to exactly one outcome. Emails are
 * queued (SendGymRequestEmail) after the decision is committed.
 */
class GymRequestController extends Controller
{
    /** Values accepted for gyms.category (default 'gym'). */
    public const CATEGORIES = ['gym', 'crossfit', 'martial_arts', 'yoga_pilates', 'boxing', 'dance', 'swimming', 'sports_club', 'other'];

    /**
     * The applicant's IP. Submissions arrive via the landing site's
     * server-side proxy, so $request->ip() is that server for everyone. The
     * proxy forwards the real client IP alongside a shared secret
     * (LANDING_PROXY_SECRET); the forwarded value is only believed when the
     * secret matches. Returns null when the request isn't a trusted proxy hop.
     */
    public static function trustedClientIp(Request $request): ?string
    {
        $secret = (string) config('services.landing.proxy_secret');
        $ip = (string) $request->header('X-CLBY-Client-IP');

        if ($secret === '' || $ip === '' || ! hash_equals($secret, (string) $request->header('X-CLBY-Proxy-Secret'))) {
            return null;
        }
        return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : null;
    }

    /**
     * Gym + owner field rules shared by the public submit and the
     * super-admin edit. Limits mirror SuperAdminController::store /
     * GymController::update so an approved request always fits the gyms +
     * profiles columns.
     */
    private function fieldRules(): array
    {
        return [
            'gym_name' => 'required|string|min:2|max:255',
            'description' => 'nullable|string|max:2000',
            'address' => 'nullable|string|max:500',
            'city' => 'required|string|max:100',
            'country' => 'required|string|max:100',
            'latitude' => 'nullable|numeric|between:-90,90',
            'longitude' => 'nullable|numeric|between:-180,180',
            'phone' => 'required|string|max:20',
            'business_email' => 'required|email|max:255',
            'category' => 'nullable|string|in:' . implode(',', self::CATEGORIES),
            'services' => 'nullable|array|max:20',
            'services.*' => 'string|max:50',
            'branches_count' => 'nullable|integer|min:1|max:100',
            'timezone' => 'nullable|timezone',
            'owner_name' => 'required|string|min:2|max:255',
            'owner_email' => 'required|email|max:255',
            'owner_phone' => 'required|string|max:20',
        ];
    }

    /**
     * The gym logo becomes gyms.logo_url, which the mobile app shows on the
     * splash screen — so every request must carry one.
     */
    private const LOGO_RULE = 'image|mimes:jpg,jpeg,png,webp|max:2048';

    /**
     * Owner details that would collide with an existing account on approval
     * (profiles.email is unique case-insensitively in practice, and
     * profiles.phone has a unique constraint). Field => message.
     *
     * @return array<string, string>
     */
    private function ownerConflicts(?string $email, ?string $phone): array
    {
        $conflicts = [];
        if ($email !== null && DB::table('profiles')->whereRaw('LOWER(email) = ?', [Str::lower($email)])->exists()) {
            $conflicts['owner_email'] = 'An account with this email already exists. Use a different email, or contact the CLBY team to add another gym.';
        }
        if ($phone !== null && $phone !== '' && DB::table('profiles')->where('phone', $phone)->exists()) {
            $conflicts['owner_phone'] = 'An account with this mobile number already exists. Use a different number.';
        }
        return $conflicts;
    }

    /* ───────────────────────── public ───────────────────────── */

    public function store(Request $request, StorageService $storage): JsonResponse
    {
        $request->merge([
            'owner_email' => Str::lower(trim((string) $request->input('owner_email'))),
            'business_email' => Str::lower(trim((string) $request->input('business_email'))),
        ]);

        $validated = $request->validate([
            'submission_key' => 'nullable|uuid',
            ...$this->fieldRules(),
            'logo' => 'required|' . self::LOGO_RULE,
            // Honeypot — hidden on the form, so only bots fill it.
            'company_website' => 'prohibited',
        ], [
            'logo.required' => 'Please upload your gym logo — it is shown on your members\' app splash screen.',
        ]);

        // Idempotent retry: same key → same request, no second row or email.
        if (! empty($validated['submission_key'])) {
            $existing = GymRequest::where('submission_key', $validated['submission_key'])->first();
            if ($existing) {
                return response()->json(['data' => $this->publicSummary($existing)]);
            }
        }

        $ownerEmail = $validated['owner_email'];

        if ($conflicts = $this->ownerConflicts($ownerEmail, $validated['owner_phone'])) {
            return response()->json(['message' => reset($conflicts), 'errors' => array_map(fn ($m) => [$m], $conflicts)], 422);
        }

        if (GymRequest::whereRaw('LOWER(owner_email) = ?', [$ownerEmail])->where('status', GymRequest::STATUS_PENDING)->exists()) {
            return response()->json([
                'message' => 'A request for this email is already awaiting review. We will email you once it has been reviewed.',
            ], 409);
        }

        // A declined applicant may simply submit again: it becomes a new
        // pending request (the declined one stays as history). Only one
        // *pending* request per email is enforced.

        // Uploaded only after every pre-check, and removed again below if
        // the insert loses a race, so a rejected submission leaves no file.
        $logo = $storage->upload($request->file('logo'), 'gym-requests');

        try {
            $gymRequest = GymRequest::create([
                ...collect($validated)->except(['logo', 'company_website'])->all(),
                'owner_email' => $ownerEmail,
                'logo_url' => $logo['url'] ?? null,
                'branches_count' => $validated['branches_count'] ?? 1,
                'timezone' => $validated['timezone'] ?? 'Africa/Cairo',
                'submitted_ip' => self::trustedClientIp($request) ?? $request->ip(),
                'user_agent' => Str::limit((string) $request->userAgent(), 500, ''),
            ]);
        } catch (\Throwable $e) {
            if ($logo) {
                try { $storage->delete($logo['path']); } catch (\Throwable) {}
            }
            // Lost a race with a concurrent submit: either the same
            // submission_key or a second pending request for this email.
            if ($e instanceof QueryException && $this->isUniqueViolation($e)) {
                $existing = ! empty($validated['submission_key'])
                    ? GymRequest::where('submission_key', $validated['submission_key'])->first()
                    : null;
                return $existing
                    ? response()->json(['data' => $this->publicSummary($existing)])
                    : response()->json(['message' => 'A request for this email is already awaiting review.'], 409);
            }
            throw $e;
        }

        $gymRequest->logEvent('submitted', null, ['reference' => $gymRequest->reference]);
        SendGymRequestEmail::dispatch($gymRequest->id, SendGymRequestEmail::TYPE_RECEIVED);

        return response()->json(['data' => $this->publicSummary($gymRequest)], 201);
    }

    /* ─────────────────────── super-admin ────────────────────── */

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => 'nullable|string|max:255',
            'status' => 'nullable|in:pending,approved,declined',
            'from' => 'nullable|date',
            'to' => 'nullable|date',
            'sort' => 'nullable|in:created_at,gym_name,owner_name,status,city',
            'dir' => 'nullable|in:asc,desc',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $query = GymRequest::query();

        if (! empty($validated['search'])) {
            $s = '%' . addcslashes($validated['search'], '%_\\') . '%';
            $op = DB::getDriverName() === 'pgsql' ? 'ilike' : 'like';
            $query->where(function ($q) use ($s, $op) {
                $q->where('gym_name', $op, $s)
                    ->orWhere('owner_name', $op, $s)
                    ->orWhere('owner_email', $op, $s)
                    ->orWhere('reference', $op, $s);
            });
        }
        if (! empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }
        if (! empty($validated['from'])) {
            $query->where('created_at', '>=', \Carbon\Carbon::parse($validated['from'])->startOfDay());
        }
        if (! empty($validated['to'])) {
            $query->where('created_at', '<=', \Carbon\Carbon::parse($validated['to'])->endOfDay());
        }

        $page = $query
            ->orderBy($validated['sort'] ?? 'created_at', $validated['dir'] ?? 'desc')
            ->orderBy('id')
            ->paginate($validated['per_page'] ?? 25, [
                'id', 'reference', 'status', 'gym_name', 'logo_url', 'city', 'country',
                'phone', 'owner_name', 'owner_email', 'owner_phone', 'created_at', 'reviewed_at',
                'last_provisioning_error', 'last_email_error',
            ]);

        $counts = GymRequest::query()
            ->select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');

        return response()->json([
            'data' => $page->items(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ],
            'counts' => [
                'pending' => (int) ($counts['pending'] ?? 0),
                'approved' => (int) ($counts['approved'] ?? 0),
                'declined' => (int) ($counts['declined'] ?? 0),
            ],
        ]);
    }

    public function show(string $id): JsonResponse
    {
        $gymRequest = $this->findOr404($id);
        if ($gymRequest instanceof JsonResponse) return $gymRequest;

        $events = DB::table('gym_request_events as e')
            ->leftJoin('profiles as p', 'p.id', '=', 'e.actor_id')
            ->where('e.gym_request_id', $gymRequest->id)
            ->orderBy('e.id')
            ->get(['e.id', 'e.event', 'e.details', 'e.created_at', 'p.full_name as actor_name'])
            ->map(fn ($e) => [...(array) $e, 'details' => $e->details ? json_decode($e->details, true) : null]);

        return response()->json([
            'data' => [
                ...$gymRequest->toArray(),
                'reviewer_name' => $gymRequest->reviewed_by
                    ? DB::table('profiles')->where('id', $gymRequest->reviewed_by)->value('full_name')
                    : null,
                // Owner has set their password — a resend would only mint a
                // reset link for an account in use, so the UI hides it.
                'owner_setup_complete' => $gymRequest->owner_profile_id
                    && DB::table('profiles')->where('id', $gymRequest->owner_profile_id)->where('must_reset_password', false)->exists(),
                'provisioned_gym_exists' => $gymRequest->provisioned_gym_id
                    && DB::table('gyms')->where('id', $gymRequest->provisioned_gym_id)->exists(),
            ],
            'events' => $events,
        ]);
    }

    public function approve(Request $request, string $id, GymProvisioningService $provisioning): JsonResponse
    {
        $validated = $request->validate([
            'max_branches' => 'nullable|integer|min:1|max:100',
        ]);
        if (! Str::isUuid($id)) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $actorId = $request->user()->id;

        try {
            [$outcome, $gymRequest] = DB::transaction(function () use ($id, $validated, $provisioning, $actorId) {
                $gymRequest = GymRequest::whereKey($id)->lockForUpdate()->first();
                if (! $gymRequest) return ['missing', null];
                if ($gymRequest->status === GymRequest::STATUS_APPROVED) return ['already', $gymRequest];
                if ($gymRequest->status !== GymRequest::STATUS_PENDING) return ['not_pending', $gymRequest];

                // Re-checked under the lock: the email or phone may have been
                // taken (member signup, manual gym) since the request came in.
                if ($conflicts = $this->ownerConflicts($gymRequest->owner_email, $gymRequest->owner_phone)) {
                    throw new \DomainException(implode(' ', $conflicts) . ' Edit the owner details on this request, then approve again.');
                }
                if (! $gymRequest->logo_url) {
                    throw new \DomainException('This request has no gym logo. Upload one (it is the app splash logo), then approve again.');
                }

                $result = $provisioning->provision([
                    'name' => $gymRequest->gym_name,
                    'description' => $gymRequest->description,
                    'address' => $gymRequest->address,
                    'city' => $gymRequest->city,
                    'country' => $gymRequest->country,
                    'phone' => $gymRequest->phone,
                    'email' => $gymRequest->business_email,
                    'logo_url' => $gymRequest->logo_url,
                    'category' => $gymRequest->category,
                    'latitude' => $gymRequest->latitude,
                    'longitude' => $gymRequest->longitude,
                    'services' => $gymRequest->services,
                    'timezone' => $gymRequest->timezone,
                    'max_branches' => $validated['max_branches'] ?? max(10, $gymRequest->branches_count),
                    'admin_email' => $gymRequest->owner_email,
                    'admin_name' => $gymRequest->owner_name,
                    'admin_phone' => $gymRequest->owner_phone,
                    'admin_password' => null,
                    'must_reset_password' => true,
                ]);

                $gymRequest->forceFill([
                    'status' => GymRequest::STATUS_APPROVED,
                    'reviewed_by' => $actorId,
                    'reviewed_at' => now(),
                    'provisioned_gym_id' => $result['gym']->id,
                    'owner_profile_id' => $result['admin_id'],
                    'provisioning_attempts' => $gymRequest->provisioning_attempts + 1,
                    'last_provisioning_error' => null,
                    'last_provisioning_failed_at' => null,
                ])->save();

                return ['approved', $gymRequest];
            });
        } catch (\Throwable $e) {
            // The transaction rolled back: no gym, no owner, request still
            // pending. Record why so the super-admin can fix and re-approve.
            // Shown in the dashboard and stored on the request: never the raw
            // SQL (it carries host/database names). Full detail goes to the log.
            $message = match (true) {
                $e instanceof \DomainException => $e->getMessage(),
                $e instanceof QueryException && $this->isUniqueViolation($e) => sprintf(
                    'Provisioning failed: a record with the same value already exists%s. Edit the request and approve again.',
                    preg_match('/unique constraint "([^"]+)"/', $e->getMessage(), $m) ? " ({$m[1]})" : '',
                ),
                default => 'Provisioning failed because of a server error. The details are in the API log.',
            };
            DB::table('gym_requests')->where('id', $id)->update([
                'provisioning_attempts' => DB::raw('provisioning_attempts + 1'),
                'last_provisioning_error' => $message,
                'last_provisioning_failed_at' => now(),
                'updated_at' => now(),
            ]);
            GymRequest::find($id)?->logEvent('provisioning_failed', $actorId, ['error' => $message]);
            if (! $e instanceof \DomainException) {
                Log::error('Gym request provisioning failed', ['gym_request_id' => $id, 'error' => $e->getMessage()]);
            }
            return response()->json(['message' => $message], $e instanceof \DomainException ? 422 : 500);
        }

        return match ($outcome) {
            'missing' => response()->json(['error' => 'Not found'], 404),
            'not_pending' => response()->json([
                'message' => 'Only pending requests can be approved. Reopen this declined request first.',
            ], 409),
            'already' => response()->json(['data' => $gymRequest, 'already_approved' => true]),
            'approved' => $this->afterApproved($gymRequest, $actorId),
        };
    }

    public function decline(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => 'nullable|string|max:1000',
            'share_reason' => 'sometimes|boolean',
        ]);
        if (! Str::isUuid($id)) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $actorId = $request->user()->id;
        $reason = isset($validated['reason']) && trim($validated['reason']) !== '' ? trim($validated['reason']) : null;

        [$outcome, $gymRequest] = DB::transaction(function () use ($id, $reason, $validated, $actorId) {
            $gymRequest = GymRequest::whereKey($id)->lockForUpdate()->first();
            if (! $gymRequest) return ['missing', null];
            if ($gymRequest->status === GymRequest::STATUS_DECLINED) return ['already', $gymRequest];
            if ($gymRequest->status !== GymRequest::STATUS_PENDING) return ['not_pending', $gymRequest];

            $gymRequest->forceFill([
                'status' => GymRequest::STATUS_DECLINED,
                'reviewed_by' => $actorId,
                'reviewed_at' => now(),
                'decline_reason' => $reason,
                'share_decline_reason' => $reason !== null && ($validated['share_reason'] ?? false),
            ])->save();

            return ['declined', $gymRequest];
        });

        if ($outcome === 'missing') return response()->json(['error' => 'Not found'], 404);
        if ($outcome === 'not_pending') {
            return response()->json(['message' => 'Only pending requests can be declined.'], 409);
        }
        if ($outcome === 'already') {
            return response()->json(['data' => $gymRequest, 'already_declined' => true]);
        }

        $gymRequest->logEvent('declined', $actorId, [
            'reason' => $reason,
            'shared' => $gymRequest->share_decline_reason,
        ]);
        SendGymRequestEmail::dispatch($gymRequest->id, SendGymRequestEmail::TYPE_DECLINED);

        return response()->json(['data' => $gymRequest->fresh()]);
    }

    /**
     * Explicit reconsideration: declined → pending. The only path back from
     * a decline, so a declined request can never be approved by accident.
     */
    public function reopen(Request $request, string $id): JsonResponse
    {
        if (! Str::isUuid($id)) {
            return response()->json(['error' => 'Not found'], 404);
        }
        $actorId = $request->user()->id;

        try {
            [$outcome, $gymRequest, $previous] = DB::transaction(function () use ($id) {
                $gymRequest = GymRequest::whereKey($id)->lockForUpdate()->first();
                if (! $gymRequest) return ['missing', null, null];
                if ($gymRequest->status !== GymRequest::STATUS_DECLINED) return ['not_declined', $gymRequest, null];

                $previous = [
                    'reviewed_by' => $gymRequest->reviewed_by,
                    'reviewed_at' => $gymRequest->reviewed_at?->toIso8601String(),
                    'decline_reason' => $gymRequest->decline_reason,
                ];
                $gymRequest->forceFill([
                    'status' => GymRequest::STATUS_PENDING,
                    'reviewed_by' => null,
                    'reviewed_at' => null,
                    'decline_reason' => null,
                    'share_decline_reason' => false,
                    // The next decision gets its own email.
                    'decision_email_sent_at' => null,
                ])->save();

                return ['reopened', $gymRequest, $previous];
            });
        } catch (QueryException $e) {
            if ($this->isUniqueViolation($e)) {
                return response()->json(['message' => 'Another request for this owner email is already pending.'], 409);
            }
            throw $e;
        }

        if ($outcome === 'missing') return response()->json(['error' => 'Not found'], 404);
        if ($outcome === 'not_declined') {
            return response()->json(['message' => 'Only declined requests can be reopened.'], 409);
        }

        $gymRequest->logEvent('reopened', $actorId, ['previous' => $previous]);

        return response()->json(['data' => $gymRequest->fresh()]);
    }

    /**
     * Correct a pending request before approving it (e.g. the owner's phone
     * already belongs to another account). Only pending requests: decided
     * ones are history — reopen a declined request first.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        if (! Str::isUuid($id)) {
            return response()->json(['error' => 'Not found'], 404);
        }
        foreach (['owner_email', 'business_email'] as $f) {
            if ($request->has($f)) {
                $request->merge([$f => Str::lower(trim((string) $request->input($f)))]);
            }
        }
        $rules = array_map(fn ($r) => "sometimes|{$r}", $this->fieldRules());
        $rules['services.*'] = 'string|max:50';
        $validated = $request->validate($rules);
        $actorId = $request->user()->id;

        try {
            $result = DB::transaction(function () use ($id, $validated) {
                $gymRequest = GymRequest::whereKey($id)->lockForUpdate()->first();
                if (! $gymRequest) return ['missing'];
                if ($gymRequest->status !== GymRequest::STATUS_PENDING) return ['not_pending'];

                $gymRequest->fill($validated);
                $dirty = $gymRequest->getDirty();
                if (! $dirty) return ['unchanged', $gymRequest, []];

                $conflicts = $this->ownerConflicts(
                    array_key_exists('owner_email', $dirty) ? $gymRequest->owner_email : null,
                    array_key_exists('owner_phone', $dirty) ? $gymRequest->owner_phone : null,
                );
                if ($conflicts) return ['conflict', $conflicts];

                $changes = [];
                foreach (array_keys($dirty) as $field) {
                    $changes[$field] = ['from' => $gymRequest->getOriginal($field), 'to' => $gymRequest->{$field}];
                }
                $gymRequest->save();

                return ['updated', $gymRequest, $changes];
            });
        } catch (QueryException $e) {
            if ($this->isUniqueViolation($e)) {
                return response()->json(['message' => 'Another request for this owner email is already pending.'], 409);
            }
            throw $e;
        }

        return match ($result[0]) {
            'missing' => response()->json(['error' => 'Not found'], 404),
            'not_pending' => response()->json(['message' => 'Only pending requests can be edited. Reopen a declined request first.'], 409),
            'conflict' => response()->json(['message' => reset($result[1]), 'errors' => array_map(fn ($m) => [$m], $result[1])], 422),
            'unchanged' => response()->json(['data' => $result[1]]),
            'updated' => (function () use ($result, $actorId) {
                $result[1]->logEvent('edited', $actorId, ['changes' => $result[2]]);
                return response()->json(['data' => $result[1]->fresh()]);
            })(),
        };
    }

    /**
     * Replace (or add) the logo on a pending request.
     */
    public function uploadLogo(Request $request, string $id, StorageService $storage): JsonResponse
    {
        $request->validate(['logo' => 'required|' . self::LOGO_RULE]);
        $gymRequest = $this->findOr404($id);
        if ($gymRequest instanceof JsonResponse) return $gymRequest;
        if ($gymRequest->status !== GymRequest::STATUS_PENDING) {
            return response()->json(['message' => 'Only pending requests can be edited.'], 409);
        }

        $previous = $gymRequest->logo_url;
        $upload = $storage->upload($request->file('logo'), 'gym-requests');
        DB::table('gym_requests')->where('id', $gymRequest->id)->update(['logo_url' => $upload['url'], 'updated_at' => now()]);
        $gymRequest->logEvent('edited', $request->user()->id, ['changes' => ['logo_url' => ['from' => $previous, 'to' => $upload['url']]]]);

        return response()->json(['data' => $gymRequest->fresh()]);
    }

    /**
     * Re-send the notification for the request's current state. For an
     * approved request this issues a fresh setup link (replacing the old one
     * once delivered) while the owner hasn't set a password yet — never
     * re-provisions anything.
     */
    public function resendEmail(Request $request, string $id): JsonResponse
    {
        $gymRequest = $this->findOr404($id);
        if ($gymRequest instanceof JsonResponse) return $gymRequest;

        $type = match ($gymRequest->status) {
            GymRequest::STATUS_APPROVED => SendGymRequestEmail::TYPE_APPROVED,
            GymRequest::STATUS_DECLINED => SendGymRequestEmail::TYPE_DECLINED,
            default => SendGymRequestEmail::TYPE_RECEIVED,
        };

        if ($type === SendGymRequestEmail::TYPE_APPROVED
            && DB::table('profiles')->where('id', $gymRequest->owner_profile_id)->where('must_reset_password', false)->exists()) {
            return response()->json([
                'message' => 'The owner has already set their password, so no setup link was sent.',
            ], 409);
        }

        $gymRequest->logEvent('email_resend_requested', $request->user()->id, ['type' => $type]);
        SendGymRequestEmail::dispatch($gymRequest->id, $type, force: true);

        return response()->json(['message' => 'Email queued', 'type' => $type]);
    }

    /* ───────────────────────── helpers ──────────────────────── */

    private function afterApproved(GymRequest $gymRequest, string $actorId): JsonResponse
    {
        $gymRequest->logEvent('approved', $actorId, [
            'gym_id' => $gymRequest->provisioned_gym_id,
            'owner_profile_id' => $gymRequest->owner_profile_id,
        ]);
        SendGymRequestEmail::dispatch($gymRequest->id, SendGymRequestEmail::TYPE_APPROVED);

        return response()->json(['data' => $gymRequest->fresh()]);
    }

    private function publicSummary(GymRequest $r): array
    {
        return [
            'id' => $r->id,
            'reference' => $r->reference,
            'status' => $r->status,
            'submitted_at' => $r->created_at,
        ];
    }

    private function findOr404(string $id): GymRequest|JsonResponse
    {
        $gymRequest = Str::isUuid($id) ? GymRequest::find($id) : null;
        return $gymRequest ?? response()->json(['error' => 'Not found'], 404);
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        // 23505 = Postgres unique_violation; SQLite reports 23000.
        return in_array($e->getCode(), ['23505', '23000'], true)
            || str_contains($e->getMessage(), 'UNIQUE constraint failed');
    }
}
