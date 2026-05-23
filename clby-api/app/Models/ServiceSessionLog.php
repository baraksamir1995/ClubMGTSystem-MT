<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One coach-delivered session. Inserted by `CoachController::decrement`
 * when a coach confirms a scan / manual log. The 30-minute double-
 * decrement guard reads recent rows from this table for the same
 * (assignment_id, trainer_id).
 */
class ServiceSessionLog extends Model
{
    use HasUuids;

    protected $table = 'service_session_logs';

    protected $fillable = [
        'gym_id',
        'assignment_id',
        'trainer_id',
        'gym_member_id',
        'delivered_at',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'delivered_at' => 'datetime',
        ];
    }

    public function trainer(): BelongsTo
    {
        return $this->belongsTo(TrainerProfile::class, 'trainer_id');
    }

    public function gymMember(): BelongsTo
    {
        return $this->belongsTo(GymMember::class, 'gym_member_id');
    }
}
