<?php

namespace App\Models;

use App\Casts\PostgresArray;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MembershipPlan extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'membership_plans';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'gym_id', 'name', 'plan_type', 'duration_days', 'max_visits',
        'price', 'is_active', 'invitations_enabled', 'invitations_per_cycle',
        'invitation_duration_type', 'invitation_duration_days', 'invitation_validity_days',
        'currency', 'session_count', 'description', 'billing_cycle',
        'facilities', 'visits_per_week', 'visits_per_month', 'add_ons',
        'trainer_type', 'freeze_enabled', 'freeze_max_days', 'freeze_max_count',
        'discount_pct', 'session_expiry_days', 'access_scope', 'allowed_branch_ids',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'invitations_enabled' => 'boolean',
            'freeze_enabled' => 'boolean',
            'price' => 'float',
            'discount_pct' => 'float',
            'facilities' => PostgresArray::class,
            'add_ons' => PostgresArray::class,
            'allowed_branch_ids' => PostgresArray::class,
        ];
    }

    public function gym(): BelongsTo
    {
        return $this->belongsTo(Gym::class);
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(MemberMembership::class, 'plan_id');
    }

    public function promotions(): HasMany
    {
        return $this->hasMany(PlanPromotion::class, 'plan_id');
    }
}
