<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TrainerProfile extends Model
{
    use HasUuids;

    protected $table = 'trainer_profiles';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'profile_id', 'gym_id', 'name', 'bio', 'specialties',
        'certifications', 'photo_url', 'is_active',
        'trainer_type', 'branch_id',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    /**
     * PostgreSQL text[] columns need special handling — Laravel's 'array' cast
     * uses JSON which PG rejects. Convert manually.
     */
    public function setSpecialtiesAttribute($value): void
    {
        $this->attributes['specialties'] = is_array($value)
            ? '{' . implode(',', array_map(fn ($v) => '"' . addslashes($v) . '"', $value)) . '}'
            : $value;
    }

    public function getSpecialtiesAttribute($value): ?array
    {
        if ($value === null) return null;
        $trimmed = trim($value, '{}');
        if ($trimmed === '') return [];
        return array_map(fn ($v) => trim($v, '"'), explode(',', $trimmed));
    }

    public function setCertificationsAttribute($value): void
    {
        $this->attributes['certifications'] = is_array($value)
            ? '{' . implode(',', array_map(fn ($v) => '"' . addslashes($v) . '"', $value)) . '}'
            : $value;
    }

    public function getCertificationsAttribute($value): ?array
    {
        if ($value === null) return null;
        $trimmed = trim($value, '{}');
        if ($trimmed === '') return [];
        return array_map(fn ($v) => trim($v, '"'), explode(',', $trimmed));
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'profile_id');
    }

    public function gym(): BelongsTo
    {
        return $this->belongsTo(Gym::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
