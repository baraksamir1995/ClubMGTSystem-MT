<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class StorageService
{
    private string $disk;

    public function __construct()
    {
        $this->disk = config('filesystems.default', 'local');
    }

    /**
     * Upload a file to storage.
     *
     * @return array{path: string, url: string}
     */
    public function upload(UploadedFile $file, string $folder, ?string $gymId = null): array
    {
        $prefix = $gymId ? "{$gymId}/{$folder}" : $folder;
        $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
        $path = "{$prefix}/{$filename}";

        Storage::disk($this->disk)->put($path, $file->getContent(), 'public');

        return [
            'path' => $path,
            'url' => $this->getPublicUrl($path),
        ];
    }

    /**
     * Get the public URL for a stored file.
     */
    public function getPublicUrl(string $path): string
    {
        if ($this->disk === 's3') {
            return Storage::disk('s3')->url($path);
        }

        // For local disk, serve via the /storage route
        return url("storage/{$path}");
    }

    /**
     * Generate a temporary signed URL (S3 only, falls back to public URL for local).
     */
    public function getSignedUrl(string $path, int $minutes = 60): string
    {
        if ($this->disk === 's3') {
            return Storage::disk('s3')->temporaryUrl($path, now()->addMinutes($minutes));
        }

        return $this->getPublicUrl($path);
    }

    /**
     * Delete a file from storage.
     */
    public function delete(string $path): bool
    {
        return Storage::disk($this->disk)->delete($path);
    }

    /**
     * Check if a file exists.
     */
    public function exists(string $path): bool
    {
        return Storage::disk($this->disk)->exists($path);
    }

    /**
     * Map storage buckets to local folder names.
     */
    public static function mapBucket(string $bucket): string
    {
        return match ($bucket) {
            'avatars' => 'avatars',
            'gym-content' => 'content',
            'gym-assets' => 'assets',
            'trainer-photos' => 'trainers',
            'partner-logos' => 'partners',
            'program-images' => 'programs',
            default => $bucket,
        };
    }
}
