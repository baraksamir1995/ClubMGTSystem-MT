<?php

namespace App\Http\Controllers;

use App\Models\SessionBooking;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

use \App\Traits\LogsActivity;

class BookingController extends Controller
{
    use LogsActivity;
    /**
     * List bookings for a specific session (admin view).
     */
    public function index(Request $request, string $sessionId): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        // Verify session belongs to user's gym
        $session = DB::table('class_sessions')->where('id', $sessionId)->where('gym_id', $gymId)->first();
        if (! $session) {
            return response()->json(['error' => 'Session not found'], 404);
        }

        $bookings = SessionBooking::where('session_id', $sessionId)
            ->with('gymMember.user:id,full_name,email,phone,photo_url')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['data' => $bookings]);
    }

    /**
     * List bookings for the authenticated member (mobile app).
     * Supports query params: gym_member_id, status, unrated, rated, limit
     */
    public function myBookings(Request $request): JsonResponse
    {
        $gymMemberId = $request->query('gym_member_id');
        if (! $gymMemberId) {
            return response()->json(['data' => []]);
        }

        // Verify the gym_member belongs to the authenticated user
        $gymMember = DB::table('gym_members')->where('id', $gymMemberId)->first();
        if (! $gymMember || $gymMember->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $query = SessionBooking::where('gym_member_id', $gymMemberId)
            ->with([
                'session:id,class_id,session_date,start_time,end_time,instructor,status',
                'session.classModel:id,name,class_type,color,instructor',
                'rating:id,booking_id',
            ])
            ->orderBy('created_at', 'desc');

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        // Filter to only unrated bookings
        if ($request->query('unrated') === 'true') {
            $query->whereDoesntHave('rating');
        }

        // Filter to only rated bookings
        if ($request->query('rated') === 'true') {
            $query->whereHas('rating');
        }

        if ($limit = $request->query('limit')) {
            $query->limit((int) $limit);
        }

        $bookings = $query->get()->map(function ($booking) {
            $data = $booking->toArray();
            // Nest session as "class_sessions" with "classes" inside to match Flutter model
            if ($booking->session) {
                $session = $booking->session->toArray();
                $session['classes'] = $session['class_model'] ?? null;
                unset($session['class_model']);
                $data['class_sessions'] = $session;
            }
            unset($data['session'], $data['rating']);
            return $data;
        });

        return response()->json(['data' => $bookings]);
    }

    public function detail(Request $request, string $sessionId): JsonResponse
    {
        $results = DB::select('SELECT * FROM get_session_bookings_detail(?)', [$sessionId]);

        return response()->json(['data' => $results]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'session_id' => 'required|uuid',
            'gym_member_id' => 'required|uuid',
        ]);

        $result = DB::select('SELECT add_booking(?, ?) AS id', [
            $validated['session_id'],
            $validated['gym_member_id'],
        ]);

        // Increment booked_count on the session
        $this->recalculateBookedCount($validated['session_id']);

        return response()->json(['data' => ['id' => $result[0]->id]], 201);
    }

    /**
     * Update booking status (booked/attended/absent/cancelled etc).
     *
     * - booked_count is only recalculated when crossing the cancelled boundary.
     * - Transitioning into 'attended' blocks (HTTP 422) if the member's
     *   sessions plan is exhausted, then bumps sessions_used and writes an
     *   attendance_logs row matching the QR-scan path.
     * - Reverting out of 'attended' undoes both effects so toggling stays
     *   accurate.
     *
     * The exhaustion check, increment, and revert all use the same
     * deterministic picker (start_date DESC) under SELECT FOR UPDATE so two
     * concurrent admin marks on the same member can't bypass the cap.
     * consume_class_session is intentionally NOT reused — its picker has no
     * ORDER BY, so on members with multiple active sessions plans it could
     * mutate a different row than our checks targeted.
     */
    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|string|in:confirmed,booked,cancelled,attended,absent,no_show,waitlisted',
        ]);

        $gymId = $request->user()->gym_id;
        $newStatus = $validated['status'];

        $booking = SessionBooking::whereHas('session', fn ($q) => $q->where('gym_id', $gymId))
            ->findOrFail($id);
        $oldStatus = $booking->status;

        $isAttending = $oldStatus !== 'attended' && $newStatus === 'attended';
        $isReverting = $oldStatus === 'attended' && $newStatus !== 'attended';

        // Resolve the session row up-front so the attendance-log insert
        // can't half-succeed (would otherwise decrement without logging).
        $session = ($isAttending || $isReverting)
            ? DB::selectOne(
                "SELECT cs.id, cs.gym_id, cs.branch_id, cs.studio_id,
                        COALESCE(cs.instructor, c.instructor) AS instructor,
                        c.name AS class_name
                 FROM class_sessions cs JOIN classes c ON c.id = cs.class_id
                 WHERE cs.id = ?",
                [$booking->session_id]
            )
            : null;

        return DB::transaction(function () use ($booking, $oldStatus, $newStatus, $isAttending, $isReverting, $session) {
            if ($isAttending) {
                // Lock the canonical membership row first so the cap can't
                // move under us between the check and the increment.
                $membership = DB::selectOne(
                    "SELECT mm.id, mm.sessions_used, mm.sessions_total, mp.session_count
                     FROM member_memberships mm
                     JOIN membership_plans mp ON mp.id = mm.plan_id
                     WHERE mm.gym_member_id = ?
                       AND mm.status = 'active'
                       AND mp.plan_type IN ('sessions','duration_session')
                     ORDER BY mm.start_date DESC LIMIT 1
                     FOR UPDATE OF mm",
                    [$booking->gym_member_id]
                );

                if ($membership) {
                    $cap = $membership->sessions_total ?? $membership->session_count;
                    if ($cap !== null && (int) $membership->sessions_used >= (int) $cap) {
                        return response()->json([
                            'error' => 'Member has no remaining sessions on their plan',
                        ], 422);
                    }
                    DB::statement(
                        "UPDATE member_memberships
                         SET sessions_used = COALESCE(sessions_used, 0) + 1
                         WHERE id = ?",
                        [$membership->id]
                    );
                }
                // No sessions plan → mark attended without decrement, mirrors
                // validate_studio_access semantics for unlimited / non-session
                // plans.

                $booking->update(['status' => $newStatus]);

                if ($session) {
                    DB::insert(
                        "INSERT INTO attendance_logs
                         (gym_member_id, gym_id, branch_id, check_in_at, method,
                          access_point, class_session_id, studio_id, specialist_name)
                         VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'admin', ?, ?, ?, ?)",
                        [
                            $booking->gym_member_id, $session->gym_id, $session->branch_id,
                            $session->class_name, $session->id, $session->studio_id,
                            $session->instructor,
                        ]
                    );
                }
            } elseif ($isReverting) {
                // Same locked picker, reverse the increment.
                $membership = DB::selectOne(
                    "SELECT mm.id FROM member_memberships mm
                     JOIN membership_plans mp ON mp.id = mm.plan_id
                     WHERE mm.gym_member_id = ?
                       AND mm.status = 'active'
                       AND mp.plan_type IN ('sessions','duration_session')
                     ORDER BY mm.start_date DESC LIMIT 1
                     FOR UPDATE OF mm",
                    [$booking->gym_member_id]
                );

                if ($membership) {
                    DB::statement(
                        "UPDATE member_memberships
                         SET sessions_used = GREATEST(0, COALESCE(sessions_used, 0) - 1)
                         WHERE id = ?",
                        [$membership->id]
                    );
                }

                $booking->update(['status' => $newStatus]);

                // Drop the admin-marked log so member history matches the
                // current attendance state. QR-path logs are left alone.
                if ($session) {
                    DB::delete(
                        "DELETE FROM attendance_logs
                         WHERE gym_member_id = ? AND class_session_id = ? AND method = 'admin'",
                        [$booking->gym_member_id, $session->id]
                    );
                }
            } else {
                $booking->update(['status' => $newStatus]);
            }

            if ($oldStatus === 'cancelled' || $newStatus === 'cancelled') {
                $this->recalculateBookedCount($booking->session_id);
            }

            return response()->json(['data' => $booking]);
        });
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        // Scope to user's gym via session
        $booking = SessionBooking::whereHas('session', fn ($q) => $q->where('gym_id', $gymId))
            ->findOrFail($id);
        $sessionId = $booking->session_id;

        DB::select('SELECT remove_booking(?)', [$id]);

        // Decrement booked_count
        $this->recalculateBookedCount($sessionId);

        return response()->json(['message' => 'Booking removed successfully']);
    }

    /**
     * Recalculate booked_count = total non-cancelled bookings.
     * This counts booked + attended + absent — all count as "booked".
     *
     * Single atomic statement: the read and write happen in one query so
     * two parallel bookings can't both observe the same stale count and
     * race the write. (The previous read-then-write version could
     * underflow at peak booking concurrency.)
     */
    private function recalculateBookedCount(string $sessionId): void
    {
        DB::statement(
            'UPDATE class_sessions
             SET booked_count = (
               SELECT COUNT(*) FROM session_bookings
               WHERE session_id = ? AND status <> ?
             )
             WHERE id = ?',
            [$sessionId, 'cancelled', $sessionId]
        );
    }
}
