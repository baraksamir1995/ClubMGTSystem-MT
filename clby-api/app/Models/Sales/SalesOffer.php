<?php

namespace App\Models\Sales;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SalesOffer extends Model
{
    use HasUuids;

    protected $table = 'sales_offers';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'gym_id', 'lead_id', 'plan_id', 'discount_type', 'discount_value',
        'quoted_price', 'valid_until', 'incentive_notes', 'status', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'discount_value' => 'decimal:2',
            'quoted_price' => 'decimal:2',
            'valid_until' => 'date',
        ];
    }
}
