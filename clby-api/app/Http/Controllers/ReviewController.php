<?php

namespace App\Http\Controllers;

use App\Models\SessionRating;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $reviews = SessionRating::where('gym_id', $gymId)
            ->with([
                'session:id,session_date,start_time,end_time,class_id,instructor',
                'session.classModel:id,name,class_type,color,instructor',
                'gymMember:id,user_id,member_number',
                'gymMember.user:id,full_name,photo_url',
            ])
            ->orderBy('created_at', 'desc')
            ->paginate($request->query('per_page', 25));

        return response()->json($reviews);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'session_id' => 'required|uuid',
            'booking_id' => 'required|uuid',
            'gym_member_id' => 'required|uuid',
            'session_rating' => 'required|integer|min:1|max:5',
            'trainer_rating' => 'nullable|integer|min:1|max:5',
            'review' => 'nullable|string|max:1000',
        ]);

        // Verify the gym_member belongs to the authenticated user
        $gymMember = DB::table('gym_members')->where('id', $validated['gym_member_id'])->first();
        if (! $gymMember || $gymMember->user_id !== $request->user()->id) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validated['gym_id'] = $request->user()->gym_id;

        $rating = SessionRating::create($validated);

        return response()->json(['data' => $rating], 201);
    }
}
