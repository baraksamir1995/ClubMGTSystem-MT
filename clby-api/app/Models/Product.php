<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'products';
    public $incrementing = false;
    protected $keyType = 'string';

    /** Mirror the DB defaults so fresh models serialize correctly. */
    protected $attributes = [
        'currency' => 'EGP',
        'is_active' => true,
        'display_order' => 0,
    ];

    protected $fillable = [
        'gym_id', 'name', 'description', 'image_url',
        'before_price', 'price', 'currency', 'stock',
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

    public function gym(): BelongsTo
    {
        return $this->belongsTo(Gym::class);
    }

    public function variants(): HasMany
    {
        return $this->hasMany(ProductVariant::class)
            ->orderBy('display_order')
            ->orderBy('created_at');
    }
}
