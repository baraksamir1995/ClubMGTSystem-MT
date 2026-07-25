<?php

namespace App\Models\Sales;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class SalesSetting extends Model
{
    use HasUuids;

    protected $table = 'sales_settings';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'gym_id', 'unassigned_sla_minutes', 'qualify_sla_hours',
        'first_contact_minutes', 'max_contact_attempts',
        'cadence_days', 'reminder_hours', 'intake_token',
    ];

    protected function casts(): array
    {
        return [
            'unassigned_sla_minutes' => 'integer',
            'qualify_sla_hours' => 'integer',
            'first_contact_minutes' => 'integer',
            'max_contact_attempts' => 'integer',
            'cadence_days' => 'array',
            'reminder_hours' => 'array',
        ];
    }

    public static function forGym(string $gymId): self
    {
        return static::firstOrCreate(
            ['gym_id' => $gymId],
            ['intake_token' => Str::random(48)],
        );
    }

    /** @return list<int> */
    public function cadenceDays(): array
    {
        return $this->cadence_days ?: [1, 3, 7];
    }

    /** @return list<int> */
    public function reminderHours(): array
    {
        return $this->reminder_hours ?: [24, 2];
    }
}
