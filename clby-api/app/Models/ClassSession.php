<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ClassSession extends Model
{
    use HasUuids;

    protected $table = 'class_sessions';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'gym_id', 'class_id', 'recurring_template_id',
        'session_date', 'start_time', 'end_time',
        'capacity', 'booked_count', 'instructor', 'location',
        'session_type', 'status', 'is_published',
        'cancel_reason', 'cancelled_at', 'cancellation_reason',
        'branch_id', 'studio_id', 'walk_in_allowed',
    ];

    protected function casts(): array
    {
        return [
            'session_date' => 'date',
            'is_published' => 'boolean',
            'walk_in_allowed' => 'boolean',
            'cancelled_at' => 'datetime',
        ];
    }

    public function classModel(): BelongsTo
    {
        return $this->belongsTo(ClassModel::class, 'class_id');
    }

    public function gym(): BelongsTo
    {
        return $this->belongsTo(Gym::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function studio(): BelongsTo
    {
        return $this->belongsTo(Studio::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(SessionBooking::class, 'session_id');
    }

    public function ratings(): HasMany
    {
        return $this->hasMany(SessionRating::class, 'session_id');
    }
}
