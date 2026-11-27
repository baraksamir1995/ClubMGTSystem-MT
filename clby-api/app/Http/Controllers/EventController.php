<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ResolvesMemberScope;
use App\Models\Payment;
use App\Services\StorageService;
use App\Support\EventConfigurations;
use App\Support\EventRegistrationRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Gym events (ported from the Ippon fork, adapted to CLBY).
 *
 *  - Admin: CRUD, cover image, plan targeting, pick-one options
 *    ("configurations"), roster, attendance, desk payment.
 *  - Member: browse published events, register self for FREE events,
 *    list / cancel own registrations. PAID events are registered through
 *    POST /paymob/intention (item_type=event); the Paymob webhook confirms.
 *
 * Unlike Ippon there is no client-side "confirm payment" endpoint — only the
 * HMAC-verified webhook (or staff at the desk) can mark a registration paid.
 */
class EventController extends Controller
{
    use ResolvesMemberScope;

    private const EVENT_COLUMNS = [
        'id', 'title', 'description', 'location', 'image_url', 'starts_at', 'ends_at',
        'registration_deadline', 'capacity', 'is_paid', 'price_cents', 'currency',
        'configuration_label',
    ];

    // ── Admin (permission:events,*) ───────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $rows = DB::table('events')->where('gym_id', $gymId)->orderByDesc('starts_at')->get();
        $ids = $rows->pluck('id')->all();

        $targets = $this->planTargetsFor($ids);
        $configs = EventConfigurations::forEvents($ids);
        $counts = DB::table('event_registrations')
            ->whereIn('event_id', $ids)
            ->selectRaw("event_id,
                SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
                SUM(CASE WHEN status = 'pending_payment' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN attended THEN 1 ELSE 0 END) AS attended")
            ->groupBy('event_id')->get()->keyBy('event_id');

        $data = $rows->map(function ($e) use ($targets, $configs, $counts) {
            $arr = (array) $e;
            $arr['is_paid'] = (bool) $e->is_paid;
            $arr['is_published'] = (bool) $e->is_published;
            $arr['plan_targets'] = $targets[$e->id] ?? [];
            $arr['configurations'] = $configs[$e->id] ?? [];
            $c = $counts[$e->id] ?? null;
            $arr['registrations_count'] = (int) ($c->confirmed ?? 0);
            $arr['pending_count'] = (int) ($c->pending ?? 0);
            $arr['attended_count'] = (int) ($c->attended ?? 0);
            return $arr;
        });

        return response()->json(['data' => $data]);
    }

    public function store(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $v = $this->validatePayload($request);
        $planIds = $this->validatedPlanIds($request, $gymId);
        $configurations = $this->validatedConfigurations($request);

        $id = (string) Str::uuid();
        DB::transaction(function () use ($v, $id, $request, $gymId, $planIds, $configurations) {
            DB::table('events')->insert(array_merge($v, [
                'id' => $id,
                'gym_id' => $gymId,
                'created_by' => $request->user()->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]));
            $this->syncPlanTargets($id, $planIds);
            EventConfigurations::sync($id, $configurations);
        });

        return response()->json(['data' => ['id' => $id]], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $current = DB::table('events')->where('id', $id)->where('gym_id', $gymId)->first();
        if (! $current) {
            return response()->json(['error' => 'Event not found.'], 404);
        }

        $v = $this->validatePayload($request, partial: true);
        // Check the price rule against the event as it will be saved, so a
        // partial update can't leave a paid event below the minimum.
        $isPaid = (bool) ($v['is_paid'] ?? $current->is_paid);
        $price = array_key_exists('price_cents', $v) ? $v['price_cents'] : $current->price_cents;
        if ($isPaid && (int) $price < 100) {
            return response()->json([
                'message' => 'Paid events need a price of at least 1.00.',
                'errors' => ['price_cents' => ['Paid events need a price of at least 1.00.']],
            ], 422);
        }
        $v['updated_at'] = now();

        DB::transaction(function () use ($id, $v, $request, $gymId) {
            DB::table('events')->where('id', $id)->update($v);
            // Omitted = untouched; [] = clear.
            if ($request->has('plan_ids')) {
                $this->syncPlanTargets($id, $this->validatedPlanIds($request, $gymId));
            }
            if (is_array($request->input('configurations'))) {
                EventConfigurations::sync($id, $this->validatedConfigurations($request));
            }
        });

        return response()->json(['message' => 'Event updated.']);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        // Paid registrations hold money — refuse so staff refund first.
        $paid = DB::table('event_registrations')
            ->where('event_id', $id)->where('gym_id', $gymId)->where('payment_status', 'paid')->exists();
        if ($paid) {
            return response()->json([
                'error' => 'This event has paid registrations. Refund them or unpublish the event instead.',
                'code' => 'has_paid_registrations',
            ], 422);
        }
        $deleted = DB::table('events')->where('id', $id)->where('gym_id', $gymId)->delete();
        return $deleted
            ? response()->json(['message' => 'Event deleted.'])
            : response()->json(['error' => 'Event not found.'], 404);
    }

    /** Roster: every registration for an event. */
    public function registrations(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        if (! DB::table('events')->where('id', $id)->where('gym_id', $gymId)->exists()) {
            return response()->json(['error' => 'Event not found.'], 404);
        }
        $rows = DB::table('event_registrations as er')
            ->join('gym_members as gm', 'gm.id', '=', 'er.gym_member_id')
            ->leftJoin('profiles as p', 'p.id', '=', 'gm.user_id')
            ->where('er.event_id', $id)
            ->where('er.gym_id', $gymId)
            ->orderByRaw("CASE er.status WHEN 'confirmed' THEN 0 WHEN 'pending_payment' THEN 1 ELSE 2 END")
            ->orderBy('p.full_name')
            ->get([
                'er.id', 'er.gym_member_id', 'er.status', 'er.payment_status', 'er.attended',
                'er.configuration_name', 'er.created_at',
                'p.full_name as member_name', 'p.photo_url as member_photo_url',
                'p.phone as member_phone', 'gm.member_number',
            ]);
        return response()->json(['data' => $rows]);
    }

    public function markAttended(Request $request, string $registrationId): JsonResponse
    {
        $v = $request->validate(['attended' => 'required|boolean']);
        $updated = DB::table('event_registrations')
            ->where('id', $registrationId)->where('gym_id', $request->user()->gym_id)
            ->update(['attended' => $v['attended'], 'updated_at' => now()]);
        return $updated
            ? response()->json(['message' => 'Updated.'])
            : response()->json(['error' => 'Registration not found.'], 404);
    }

    /**
     * Staff take payment at the desk for a pending registration: records a
     * paid payment (so it shows in revenue) and confirms the registration.
     */
    public function markRegistrationPaid(Request $request, string $registrationId): JsonResponse
    {
        $v = $request->validate([
            'payment_method' => 'nullable|string|in:cash,card,bank_transfer,instapay,wallet,other',
            'branch_id' => 'nullable|uuid',
        ]);
        $gymId = $request->user()->gym_id;

        $result = DB::transaction(function () use ($registrationId, $gymId, $v, $request) {
            $reg = DB::table('event_registrations')
                ->where('id', $registrationId)->where('gym_id', $gymId)->lockForUpdate()->first();
            if (! $reg) return ['error' => 'Registration not found.', 'status' => 404];
            if ($reg->status !== 'pending_payment') {
                return ['error' => 'This registration is not awaiting payment.', 'status' => 422];
            }
            $event = DB::table('events')->where('id', $reg->event_id)->where('gym_id', $gymId)->first();
            if (! $event) return ['error' => 'Event not found.', 'status' => 404];

            $amount = number_format(((int) $event->price_cents) / 100, 2, '.', '');
            Payment::create([
                'gym_id' => $gymId,
                'gym_member_id' => $reg->gym_member_id,
                'branch_id' => $v['branch_id'] ?? null,
                'event_registration_id' => $reg->id,
                'amount' => $amount,
                'original_amount' => $amount,
                'currency' => $event->currency ?? 'EGP',
                'payment_method' => $v['payment_method'] ?? 'cash',
                'status' => 'paid',
                'paid_at' => now(),
                'source' => 'admin',
                'service_type' => 'event',
                'service_name' => $reg->configuration_name
                    ? "{$event->title} — {$reg->configuration_name}" : $event->title,
                'metadata' => ['event_id' => $event->id, 'recorded_by' => $request->user()->id],
            ]);
            DB::table('event_registrations')->where('id', $reg->id)
                ->update(['status' => 'confirmed', 'payment_status' => 'paid', 'updated_at' => now()]);
            return ['ok' => true];
        });

        if (isset($result['error'])) {
            return response()->json(['error' => $result['error']], $result['status']);
        }
        return response()->json(['message' => 'Confirmed.']);
    }

    public function uploadImage(Request $request, StorageService $storage): JsonResponse
    {
        // Raster images only (no SVG: it can carry script), 5 MB max. Stored
        // under the caller's gym prefix, same as product images.
        $request->validate(['file' => 'required|file|image|mimes:jpg,jpeg,png,webp,gif|max:5120']);
        $result = $storage->upload($request->file('file'), 'events', $request->user()->gym_id);
        return response()->json(['url' => $result['url']]);
    }

    // ── Member (verified) ─────────────────────────────────────────────────────

    /**
     * Published, not-yet-finished events the caller can see (plan targeting
     * applied), each with seats left and the caller's own registration.
     */
    public function published(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $memberId = $this->callerOwnMemberId($request);
        $admin = $this->callerIsAdmin($request);

        $rows = DB::table('events')
            ->where('gym_id', $gymId)
            ->where('is_published', true)
            ->where(function ($q) {
                $q->where('ends_at', '>=', now())
                  ->orWhere(fn ($q2) => $q2->whereNull('ends_at')->where('starts_at', '>=', now()->subHours(12)));
            })
            ->orderBy('starts_at')
            ->get(self::EVENT_COLUMNS);

        $ids = $rows->pluck('id')->all();
        $targets = $this->planTargetsFor($ids);
        $configs = EventConfigurations::forEvents($ids);

        // Plans the member currently holds (for targeting).
        $myPlanIds = $memberId
            ? DB::table('member_memberships')->where('gym_member_id', $memberId)
                ->where('status', 'active')->pluck('plan_id')->all()
            : [];
        $mine = $memberId
            ? DB::table('event_registrations')->where('gym_member_id', $memberId)
                ->whereIn('event_id', $ids)->get()->keyBy('event_id')
            : collect();

        $data = [];
        foreach ($rows as $e) {
            $planIds = array_column($targets[$e->id] ?? [], 'id');
            if (! $admin && ! empty($planIds) && empty(array_intersect($planIds, $myPlanIds))) {
                continue; // targeted at plans this member doesn't hold
            }
            $arr = (array) $e;
            $arr['is_paid'] = (bool) $e->is_paid;
            $arr['configurations'] = array_map(
                fn ($c) => ['id' => $c['id'], 'name' => $c['name']],
                $configs[$e->id] ?? []
            );
            $arr['seats_left'] = $e->capacity === null
                ? null
                : max(0, (int) $e->capacity - EventRegistrationRules::seatsTaken($e->id, $memberId));
            $reg = $mine[$e->id] ?? null;
            $arr['my_registration'] = $reg && $reg->status !== 'cancelled' ? [
                'id' => $reg->id,
                'status' => $reg->status,
                'payment_status' => $reg->payment_status,
                'configuration_name' => $reg->configuration_name,
            ] : null;
            $data[] = $arr;
        }

        return response()->json(['data' => $data]);
    }

    /** Register self for a FREE event. Paid events go through Paymob. */
    public function register(Request $request, string $eventId): JsonResponse
    {
        $v = $request->validate(['event_configuration_id' => 'nullable|uuid']);
        $gymId = $request->user()->gym_id;
        $memberId = $this->callerOwnMemberId($request);
        if (! $memberId) {
            return response()->json(['error' => 'Only members can register for events.'], 403);
        }

        $result = DB::transaction(function () use ($eventId, $gymId, $memberId, $v, $request) {
            // Lock the event row so concurrent registrations can't overfill it.
            $event = DB::table('events')
                ->where('id', $eventId)->where('gym_id', $gymId)->where('is_published', true)
                ->lockForUpdate()->first();
            if (! $event) return ['error' => 'Event not found.', 'code' => 'not_found', 'status' => 404];
            if ($event->is_paid) {
                return ['error' => 'This event requires payment.', 'code' => 'payment_required', 'status' => 422];
            }
            if ($err = EventRegistrationRules::check($event, $memberId)) return $err;

            $config = EventConfigurations::resolveSelection($eventId, $v['event_configuration_id'] ?? null);
            if (isset($config['error'])) return $config + ['status' => 422];

            $id = EventRegistrationRules::upsert($event, $memberId, $request->user()->id, 'confirmed', 'na', $config);
            return ['data' => ['id' => $id, 'status' => 'confirmed', 'configuration_name' => $config['name']]];
        });

        if (isset($result['error'])) {
            return response()->json(['error' => $result['error'], 'code' => $result['code']], $result['status']);
        }
        return response()->json($result, 201);
    }

    /** The caller's own registrations (most recent event first). */
    public function myRegistrations(Request $request): JsonResponse
    {
        $memberId = $this->callerOwnMemberId($request);
        if (! $memberId) return response()->json(['data' => []]);

        $rows = DB::table('event_registrations as er')
            ->join('events as e', 'e.id', '=', 'er.event_id')
            ->where('er.gym_member_id', $memberId)
            ->where('er.gym_id', $request->user()->gym_id)
            ->where('er.status', '!=', 'cancelled')
            ->orderByDesc('e.starts_at')
            ->get(['er.id', 'er.event_id', 'er.status', 'er.payment_status', 'er.attended',
                   'er.configuration_name', 'e.title', 'e.starts_at', 'e.ends_at',
                   'e.location', 'e.image_url']);
        return response()->json(['data' => $rows]);
    }

    /** Cancel own registration. Paid registrations must be refunded by staff. */
    public function cancelRegistration(Request $request, string $registrationId): JsonResponse
    {
        $memberId = $this->callerOwnMemberId($request);
        $reg = $memberId ? DB::table('event_registrations')
            ->where('id', $registrationId)->where('gym_member_id', $memberId)->first() : null;
        if (! $reg) return response()->json(['error' => 'Registration not found.'], 404);
        if ($reg->status === 'cancelled') {
            return response()->json(['error' => 'Already cancelled.'], 422);
        }
        if ($reg->payment_status === 'paid') {
            return response()->json([
                'error' => 'This registration is paid. Please contact the gym to cancel and get a refund.',
                'code' => 'paid_registration',
            ], 422);
        }
        DB::table('event_registrations')->where('id', $reg->id)
            ->update(['status' => 'cancelled', 'updated_at' => now()]);
        return response()->json(['message' => 'Registration cancelled.']);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function validatePayload(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';
        $v = $request->validate([
            'title' => "$req|string|max:255",
            'description' => 'nullable|string|max:10000',
            'location' => 'nullable|string|max:255',
            // null clears the cover; otherwise an http(s) URL (normally the
            // one POST /admin/events/image returned).
            'image_url' => 'nullable|string|max:1024|url:http,https',
            'starts_at' => "$req|date",
            'ends_at' => 'nullable|date|after:starts_at',
            'registration_deadline' => 'nullable|date',
            'capacity' => 'nullable|integer|min:1',
            'is_paid' => 'sometimes|boolean',
            'price_cents' => 'nullable|integer|min:0',
            'currency' => 'nullable|string|max:5',
            'is_published' => 'sometimes|boolean',
            'configuration_label' => 'nullable|string|max:100',
        ]);
        if (array_key_exists('currency', $v) && $v['currency'] === null) unset($v['currency']);
        // A paid event must carry a chargeable price (Paymob minimum is 1.00).
        // Create path only; update() checks against the merged row.
        if (! $partial && ($v['is_paid'] ?? false) && (int) ($v['price_cents'] ?? 0) < 100) {
            abort(response()->json([
                'message' => 'Paid events need a price of at least 1.00.',
                'errors' => ['price_cents' => ['Paid events need a price of at least 1.00.']],
            ], 422));
        }
        return $v;
    }

    private function validatedConfigurations(Request $request): array
    {
        $request->validate([
            'configurations' => 'nullable|array|max:100',
            'configurations.*.id' => 'nullable|uuid',
            'configurations.*.name' => 'required|string|max:255',
        ]);
        return array_values((array) ($request->input('configurations') ?? []));
    }

    /** plan_ids from the request, filtered to plans in the caller's gym. */
    private function validatedPlanIds(Request $request, string $gymId): array
    {
        $request->validate(['plan_ids' => 'nullable|array', 'plan_ids.*' => 'uuid']);
        $ids = array_values(array_unique((array) ($request->input('plan_ids') ?? [])));
        if (empty($ids)) return [];
        return DB::table('membership_plans')->where('gym_id', $gymId)->whereIn('id', $ids)->pluck('id')->all();
    }

    private function syncPlanTargets(string $eventId, array $planIds): void
    {
        DB::table('event_plan_targets')->where('event_id', $eventId)->delete();
        if (! empty($planIds)) {
            DB::table('event_plan_targets')->insert(
                array_map(fn ($p) => ['event_id' => $eventId, 'plan_id' => $p], $planIds)
            );
        }
    }

    /** [event_id => [['id' => plan_id, 'name' => plan_name], …]] */
    private function planTargetsFor(array $eventIds): array
    {
        if (empty($eventIds)) return [];
        $rows = DB::table('event_plan_targets as t')
            ->join('membership_plans as mp', 'mp.id', '=', 't.plan_id')
            ->whereIn('t.event_id', $eventIds)
            ->get(['t.event_id', 'mp.id', 'mp.name']);
        $out = [];
        foreach ($rows as $r) $out[$r->event_id][] = ['id' => $r->id, 'name' => $r->name];
        return $out;
    }
}
