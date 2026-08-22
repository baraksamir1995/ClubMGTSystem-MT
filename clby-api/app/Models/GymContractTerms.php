<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One published version of a gym's Contract Terms & Conditions.
 *
 * Append-only: saving new terms inserts a new row with the next
 * per-gym terms_version rather than mutating the previous one, so
 * invoices pinned to an older version keep resolving to the text
 * that was in force when they were issued.
 */
class GymContractTerms extends Model
{
    use HasUuids;

    protected $table = 'gym_contract_terms';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'gym_id', 'contract_terms_conditions', 'terms_version', 'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'terms_version' => 'integer',
        ];
    }

    public function gym(): BelongsTo
    {
        return $this->belongsTo(Gym::class);
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * The version currently in force for a gym, or null when the gym
     * has never published terms.
     */
    public static function currentFor(string $gymId): ?self
    {
        return static::where('gym_id', $gymId)
            ->orderByDesc('terms_version')
            ->first();
    }
}
