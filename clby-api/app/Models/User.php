<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasUuids, Notifiable;

    protected $table = 'profiles';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'email',
        'password',
        'must_reset_password',
        'full_name',
        'phone',
        'date_of_birth',
        'gender',
        'address',
        'emergency_contact_name',
        'emergency_contact_phone',
        'photo_url',
        'fcm_token',
        'gym_id',
        'preferred_language',
        'notification_preferences',
    ];

    protected $hidden = [
        'password',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
            'email_verified' => 'boolean',
            'must_reset_password' => 'boolean',
            'notification_preferences' => 'array',
            'date_of_birth' => 'date',
            'deleted_at' => 'datetime',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }

    // Relationships
    public function gym()
    {
        return $this->belongsTo(Gym::class);
    }

    public function gymMember()
    {
        return $this->hasOne(GymMember::class, 'user_id');
    }

    public function staffUser()
    {
        return $this->hasOne(StaffUser::class, 'profile_id');
    }

    public function staffMember()
    {
        return $this->hasOne(StaffMember::class, 'user_id');
    }

    public function trainerProfile()
    {
        return $this->hasOne(TrainerProfile::class, 'profile_id');
    }
}
