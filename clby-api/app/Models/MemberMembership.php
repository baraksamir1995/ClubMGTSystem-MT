<?php

namespace App\Models;

use App\Casts\PostgresArray;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MemberMembership extends Model
{
    use HasUuids;

    protected $table = 'member_memberships';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'gym_member_id', 'plan_id', 'status', 'start_date', 'end_date',
        'max_visits', 'visits_used', 'notes', 'gym_id',
        'invitations_remaining', 'invitations_used',
        'payment_status', 'sessions_total', 'sessions_used', 'sessions_remaining',
        'original_price', 'discount_amount', 'final_price',
        'promo_code_id', 'plan_promotion_id',
        'cancelled_at', 'cancellation_reason',
        'transferred_from', 'transferred_to',
        'freeze_status', 'freeze_days_used', 'freeze_count',
        'frozen_at', 'frozen_until', 'branch_id', 'allowed_branch_ids',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'datetime',
            'end_date' => 'datetime',
            'cancelled_at' => 'datetime',
            'frozen_at' => 'datetime',
            'frozen_until' => 'datetime',
            'original_price' => 'float',
            'discount_amount' => 'float',
            'final_price' => 'float',
            'allowed_branch_ids' => PostgresArray::class,
        ];
    }

    public function gymMember(): BelongsTo
    {
        return $this->belongsTo(GymMember::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(MembershipPlan::class, 'plan_id');
    }

    public function promoCode(): BelongsTo
    {
        return $this->belongsTo(PromoCode::class);
    }

    public function planPromotion(): BelongsTo
    {
        return $this->belongsTo(PlanPromotion::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
