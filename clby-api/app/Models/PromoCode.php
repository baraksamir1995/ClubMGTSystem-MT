<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PromoCode extends Model
{
    use HasUuids;

    protected $table = 'promo_codes';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'gym_id', 'code', 'name', 'discount_type', 'discount_value',
        'max_uses', 'uses_count', 'per_member_limit',
        'valid_from', 'valid_until', 'is_active', 'usage_count',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'discount_value' => 'float',
            'valid_from' => 'datetime',
            'valid_until' => 'datetime',
        ];
    }

    public function gym(): BelongsTo
    {
        return $this->belongsTo(Gym::class);
    }
}
