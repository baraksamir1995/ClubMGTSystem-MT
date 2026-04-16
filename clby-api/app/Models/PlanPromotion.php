<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlanPromotion extends Model
{
    use HasUuids;

    protected $table = 'plan_promotions';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    protected $fillable = [
        'gym_id', 'plan_id', 'promo_price', 'valid_from', 'valid_until',
    ];

    protected function casts(): array
    {
        return [
            'promo_price' => 'float',
            'valid_from' => 'date',
            'valid_until' => 'date',
            'created_at' => 'datetime',
        ];
    }

    public function gym(): BelongsTo
    {
        return $this->belongsTo(Gym::class);
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(MembershipPlan::class, 'plan_id');
    }
}
