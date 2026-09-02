<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One dashboard user's interaction with one announcement.
 *
 * `read_at` = opened it (panel or popup). `dismissed_at` = closed the
 * popup. Both are set independently: dismissing marks it read too, but
 * reading from the panel does not need to imply a popup dismissal —
 * though in practice both suppress the popup, since the popup only
 * targets rows with no interaction at all.
 */
class AnnouncementRead extends Model
{
    use HasUuids;

    protected $table = 'product_announcement_reads';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'announcement_id', 'user_id', 'gym_id', 'read_at', 'dismissed_at',
    ];

    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
            'dismissed_at' => 'datetime',
        ];
    }

    public function announcement(): BelongsTo
    {
        return $this->belongsTo(Announcement::class);
    }
}
