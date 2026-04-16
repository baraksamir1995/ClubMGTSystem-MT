<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScheduleSetting extends Model
{
    use HasUuids;

    protected $table = 'schedule_settings';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'gym_id', 'is_published', 'published_at', 'last_updated_at',
    ];

    protected function casts(): array
    {
        return [
            'is_published' => 'boolean',
            'published_at' => 'datetime',
            'last_updated_at' => 'datetime',
        ];
    }

    public function gym(): BelongsTo
    {
        return $this->belongsTo(Gym::class);
    }
}
