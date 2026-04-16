<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class SessionBooking extends Model
{
    use HasUuids;

    protected $table = 'session_bookings';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'session_id', 'gym_member_id', 'status',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(ClassSession::class, 'session_id');
    }

    public function gymMember(): BelongsTo
    {
        return $this->belongsTo(GymMember::class);
    }

    public function rating(): HasOne
    {
        return $this->hasOne(SessionRating::class, 'booking_id');
    }
}
