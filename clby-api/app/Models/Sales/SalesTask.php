<?php

namespace App\Models\Sales;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalesTask extends Model
{
    use HasUuids;

    protected $table = 'sales_tasks';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'gym_id', 'lead_id', 'assigned_to', 'type', 'title', 'due_at',
        'status', 'completed_at', 'created_by',
    ];

    protected function casts(): array
    {
        return ['due_at' => 'datetime', 'completed_at' => 'datetime'];
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(SalesLead::class, 'lead_id');
    }
}
