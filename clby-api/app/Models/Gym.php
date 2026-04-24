<?php

namespace App\Models;

use App\Casts\PostgresArray;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Gym extends Model
{
    use HasUuids;

    protected $table = 'gyms';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'name', 'description', 'address', 'city', 'country',
        'phone', 'email', 'website', 'logo_url', 'timezone', 'language',
        'owner_id', 'saas_tier', 'branding_config',
        'mobile_payments_enabled', 'operating_hours', 'max_branches',
        'price_per_branch', 'capacity_feature_enabled', 'max_capacity',
        'category', 'latitude', 'longitude', 'services', 'is_listed',
        'cover_image_url',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'mobile_payments_enabled' => 'boolean',
            'capacity_feature_enabled' => 'boolean',
            'is_listed' => 'boolean',
            'branding_config' => 'array',
            'operating_hours' => 'array',
            'services' => PostgresArray::class,
            'latitude' => 'float',
            'longitude' => 'float',
            'avg_rating' => 'float',
            'price_per_branch' => 'float',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(GymMember::class);
    }

    public function classes(): HasMany
    {
        return $this->hasMany(ClassModel::class);
    }

    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class);
    }

    public function membershipPlans(): HasMany
    {
        return $this->hasMany(MembershipPlan::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function promoCodes(): HasMany
    {
        return $this->hasMany(PromoCode::class);
    }
}
