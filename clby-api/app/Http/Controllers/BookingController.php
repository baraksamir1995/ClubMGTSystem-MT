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
     * Does NOT change booked_count — only add/remove affects the count.
     */
    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => 'required|string|in:confirmed,booked,cancelled,attended,absent,no_show,waitlisted',
        ]);

        $booking = SessionBooking::findOrFail($id);
        $oldStatus = $booking->status;
        $booking->update(['status' => $validated['status']]);

        // Only recalculate if moving to/from cancelled (that affects the count)
        if ($oldStatus === 'cancelled' || $validated['status'] === 'cancelled') {
            $this->recalculateBookedCount($booking->session_id);
        }

        return response()->json(['data' => $booking]);
    }

    public function destroy(string $id): JsonResponse
    {
        $booking = SessionBooking::findOrFail($id);
        $sessionId = $booking->session_id;

        DB::select('SELECT remove_booking(?)', [$id]);

        // Decrement booked_count
        $this->recalculateBookedCount($sessionId);

        return response()->json(['message' => 'Booking removed successfully']);
    }

    /**
     * Recalculate booked_count = total non-cancelled bookings.
     * This counts booked + attended + absent — all count as "booked".
     */
    private function recalculateBookedCount(string $sessionId): void
    {
        $count = SessionBooking::where('session_id', $sessionId)
            ->where('status', '!=', 'cancelled')
            ->count();

        DB::table('class_sessions')
            ->where('id', $sessionId)
            ->update(['booked_count' => $count]);
    }
}
