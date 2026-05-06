<?php

namespace App\Http\Controllers;

use App\Jobs\SendGymAnnouncementPush;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class NotificationController extends Controller
{
    /** Recipients per queued job — keeps each job small enough to retry cheaply. */
    private const PUSH_CHUNK_SIZE = 50;

    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $perPage = min(100, max(1, (int) $request->query('per_page', 50)));

        $paginator = DB::table('gym_notifications')
            ->where('gym_id', $gymId)
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);

        return response()->json([
            'data' => $paginator->items(),
            'pagination' => [
                'page'  => $paginator->currentPage(),
                'pages' => $paginator->lastPage(),
                'total' => $paginator->total(),
                'limit' => $paginator->perPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'body' => 'required|string',
            'target_audience' => 'nullable|string',
        ]);

        $gymId = $request->user()->gym_id;
        $data = $validated;
        $data['id'] = Str::uuid()->toString();
        $data['gym_id'] = $gymId;
        $data['created_at'] = now();
        $data['updated_at'] = now();

        DB::table('gym_notifications')->insert($data);

        // Fan out the push asynchronously — at 1k+ members the synchronous
        // FCM loop would block PHP-FPM workers for minutes. Each job
        // handles a chunk of recipients so a single Firebase blip only
        // costs us one chunk, not the whole announcement.
        $payload = [
            'type'            => 'gym_announcement',
            'gym_id'          => $gymId,
            'notification_id' => $data['id'],
        ];

        DB::table('profiles')
            ->where('gym_id', $gymId)
            ->where('role', 'member')
            ->whereNotNull('fcm_token')
            ->whereNull('deleted_at')
            ->where('is_active', true)
            ->orderBy('id')
            ->select('id')
            ->chunkById(self::PUSH_CHUNK_SIZE, function ($rows) use ($validated, $payload) {
                SendGymAnnouncementPush::dispatch(
                    $rows->pluck('id')->all(),
                    $validated['title'],
                    $validated['body'],
                    $payload,
                );
            });

        // Return the full row (includes DB defaults like status)
        $row = DB::table('gym_notifications')->where('id', $data['id'])->first();
        return response()->json(['data' => $row], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $data = $request->except(['id', 'gym_id', 'created_at']);
        $data['updated_at'] = now();
        DB::table('gym_notifications')->where('id', $id)->where('gym_id', $gymId)->update($data);
        return response()->json(['message' => 'Updated']);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        DB::table('gym_notifications')->where('id', $id)->where('gym_id', $gymId)->delete();
        return response()->json(['message' => 'Deleted']);
    }
}
