<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A platform-wide "What's New" product update, authored by a super-admin
 * and shown in the gym-admin dashboards it targets.
 */
class Announcement extends Model
{
    use HasUuids;

    protected $table = 'product_announcements';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'title', 'content',
        'media_type', 'media_url', 'media_path',
        'cta_label', 'cta_url',
        'status', 'audience',
        'published_at', 'expires_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function targets(): HasMany
    {
        return $this->hasMany(AnnouncementGym::class);
    }

    public function reads(): HasMany
    {
        return $this->hasMany(AnnouncementRead::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Live for tenants: published, past its publish date.
     *
     * Expiry is deliberately NOT part of this — an expired announcement
     * stops popping up but stays readable in the What's New history.
     * Callers that care about the popup add the expiry check themselves.
     */
    public function scopeVisible($query)
    {
        return $query->where('status', 'published')
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now());
    }

    /**
     * Restrict to announcements targeted at one gym.
     *
     * This is the tenant isolation boundary: every tenant-facing query
     * goes through here, so a gym can never read — or mark read — an
     * announcement aimed at a different gym.
     */
    public function scopeForGym($query, string $gymId)
    {
        return $query->where(function ($q) use ($gymId) {
            $q->where('audience', 'all')
                ->orWhereExists(function ($sub) use ($gymId) {
                    $sub->selectRaw('1')
                        ->from('product_announcement_gyms')
                        ->whereColumn('product_announcement_gyms.announcement_id', 'product_announcements.id')
                        ->where('product_announcement_gyms.gym_id', $gymId);
                });
        });
    }
}
