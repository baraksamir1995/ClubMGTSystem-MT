<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProductVariant extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'product_variants';
    public $incrementing = false;
    protected $keyType = 'string';

    /** Mirror the DB defaults so fresh models serialize correctly. */
    protected $attributes = [
        'is_active' => true,
        'display_order' => 0,
    ];

    protected $fillable = [
        'product_id', 'gym_id', 'name', 'image_url',
        'before_price', 'price', 'stock',
        'is_active', 'display_order',
    ];

    protected function casts(): array
    {
        return [
            'before_price' => 'float',
            'price' => 'float',
            'stock' => 'integer',
            'is_active' => 'boolean',
            'display_order' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
