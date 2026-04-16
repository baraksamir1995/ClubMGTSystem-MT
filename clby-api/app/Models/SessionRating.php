<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SessionRating extends Model
{
    use HasUuids;

    protected $table = 'session_ratings';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'session_id', 'booking_id', 'gym_member_id', 'gym_id',
        'session_rating', 'trainer_rating', 'review',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(ClassSession::class, 'session_id');
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(SessionBooking::class, 'booking_id');
    }

    public function gymMember(): BelongsTo
    {
        return $this->belongsTo(GymMember::class);
    }
}
