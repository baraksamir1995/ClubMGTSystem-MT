<?php

namespace App\Http\Controllers;

use App\Models\TrainerProfile;
use App\Services\StorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

use \App\Traits\LogsActivity;

class TrainerController extends Controller
{
    use LogsActivity;
    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        $query = TrainerProfile::where('gym_id', $gymId)
            ->with('user:id,full_name,email,phone');

        if ($request->query('active') === 'true') {
            $query->where('is_active', true);
        }
        if ($trainerType = $request->query('trainer_type')) {
            $query->where('trainer_type', $trainerType);
        }

        $trainers = $query->orderBy('created_at', 'desc')->get();

        return response()->json(['data' => $trainers]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'bio' => 'nullable|string',
            'specialties' => 'nullable|array',
            'certifications' => 'nullable|array',
            'photo_url' => 'nullable|string',
            'trainer_type' => 'nullable|string|max:50',
            'branch_id' => 'nullable|uuid',
            'profile_id' => 'nullable|uuid',
        ]);

        $validated['gym_id'] = $request->user()->gym_id;
        $trainer = TrainerProfile::create($validated);

        return response()->json(['data' => $trainer], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $trainer = TrainerProfile::where('gym_id', $gymId)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'bio' => 'nullable|string',
            'specialties' => 'nullable|array',
            'certifications' => 'nullable|array',
            'photo_url' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
            'trainer_type' => 'nullable|string|max:50',
            'branch_id' => 'nullable|uuid',
        ]);

        $trainer->update($validated);

        return response()->json(['data' => $trainer]);
    }

    public function sessions(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        // Check trainer exists
        TrainerProfile::where('gym_id', $gymId)->findOrFail($id);

        $trainer = DB::table('trainer_profiles')->where('id', $id)->first();
        $trainerName = $trainer->name ?? '';

        $sessions = DB::table('class_sessions')
            ->join('classes', 'classes.id', '=', 'class_sessions.class_id')
            ->where('class_sessions.gym_id', $gymId)
            ->where(function ($q) use ($id, $trainerName) {
                $q->where('classes.trainer_id', $id)
                  ->orWhere('class_sessions.instructor', $trainerName);
            })
            ->select('class_sessions.*', 'classes.name as class_name', 'classes.class_type', 'classes.color')
            ->orderBy('class_sessions.session_date', 'desc')
            ->get();

        return response()->json(['data' => $sessions]);
    }

    public function reviews(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        // Get sessions taught by this trainer
        $trainer = TrainerProfile::where('gym_id', $gymId)->findOrFail($id);

        $ratings = DB::table('session_ratings')
            ->join('class_sessions', 'class_sessions.id', '=', 'session_ratings.session_id')
            ->join('classes', 'classes.id', '=', 'class_sessions.class_id')
            ->leftJoin('gym_members', 'gym_members.id', '=', 'session_ratings.gym_member_id')
            ->leftJoin('profiles', 'profiles.id', '=', 'gym_members.user_id')
            ->where('session_ratings.gym_id', $gymId)
            ->where(function ($q) use ($id, $trainer) {
                $q->where('classes.trainer_id', $id)
                  ->orWhere('class_sessions.instructor', $trainer->name);
            })
            ->select(
                'session_ratings.*',
                'classes.name as class_name',
                'profiles.full_name as member_name',
                'profiles.photo_url as member_photo_url',
            )
            ->orderBy('session_ratings.created_at', 'desc')
            ->get();

        return response()->json(['data' => $ratings]);
    }

    public function uploadPhoto(Request $request, StorageService $storage): JsonResponse
    {
        $request->validate(['file' => 'required|image|max:5120']);

        $gymId = $request->user()->gym_id;
        $result = $storage->upload($request->file('file'), 'trainers', $gymId);

        return response()->json(['data' => $result]);
    }
}
