<?php

namespace App\Models\Sales;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class SalesLeadSource extends Model
{
    use HasUuids;

    protected $table = 'sales_lead_sources';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = ['gym_id', 'name', 'default_score', 'is_active', 'sort'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'sort' => 'integer'];
    }

    /** name => default score suggestion, seeded per gym on first use. */
    public const DEFAULTS = [
        'Walk-in'           => 'hot',
        'Website Form'      => 'warm',
        'Social Media Ad'   => 'warm',
        'Member Referral'   => 'hot',
        'Corporate/Partner' => 'warm',
        'Day Pass'          => 'hot',
        'Event'             => 'warm',
        'Other'             => 'cold',
    ];

    public static function seedDefaults(string $gymId): void
    {
        $existing = static::where('gym_id', $gymId)->pluck('name')->all();
        $sort = 0;
        foreach (self::DEFAULTS as $name => $score) {
            $sort++;
            if (! in_array($name, $existing, true)) {
                static::create([
                    'gym_id' => $gymId, 'name' => $name,
                    'default_score' => $score, 'sort' => $sort,
                ]);
            }
        }
    }
}
