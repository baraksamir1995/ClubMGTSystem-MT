<?php

namespace App\Models\Sales;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalesAppointment extends Model
{
    use HasUuids;

    protected $table = 'sales_appointments';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'gym_id', 'lead_id', 'branch_id', 'host_id', 'type', 'scheduled_at',
        'status', 'reminders_sent', 'marked_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'marked_at' => 'datetime',
            'reminders_sent' => 'array',
        ];
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(SalesLead::class, 'lead_id');
    }
}
