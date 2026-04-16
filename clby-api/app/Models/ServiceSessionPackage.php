<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class ServiceSessionPackage extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'service_session_packages';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'gym_id', 'name', 'trainer_type', 'session_count',
        'price', 'currency', 'is_active', 'description',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'price' => 'float',
        ];
    }

    public function gym(): BelongsTo
    {
        return $this->belongsTo(Gym::class);
    }
}
