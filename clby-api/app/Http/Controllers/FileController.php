<?php

namespace App\Http\Controllers;

use App\Services\StorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FileController extends Controller
{
    public function __construct(
        private StorageService $storage,
    ) {}

    /**
     * Upload a file. Returns the stored path and public URL.
     */
    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|max:10240', // 10MB max
            'folder' => 'nullable|string|max:100',
        ]);

        $file = $request->file('file');
        $folder = $request->input('folder', 'uploads');
        $gymId = $request->user()->gym_id;

        $result = $this->storage->upload($file, $folder, $gymId);

        return response()->json([
            'url' => $result['url'],
            'path' => $result['path'],
            'data' => $result,
        ], 201);
    }

    /**
     * Get a signed/public URL for a file.
     */
    public function url(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'path' => 'required|string|max:500',
            'minutes' => 'nullable|integer|min:1|max:1440',
        ]);

        $url = $this->storage->getSignedUrl(
            $validated['path'],
            $validated['minutes'] ?? 60,
        );

        return response()->json(['data' => ['url' => $url]]);
    }

    /**
     * Delete a file from storage.
     */
    public function destroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'path' => 'required|string|max:500',
        ]);

        $deleted = $this->storage->delete($validated['path']);

        if (! $deleted) {
            return response()->json(['error' => 'File not found or could not be deleted'], 404);
        }

        return response()->json(['message' => 'File deleted successfully']);
    }
}
