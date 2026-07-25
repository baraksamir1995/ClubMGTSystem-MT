<?php

namespace App\Models\Sales;

use App\Enums\Sales\LeadStage;
use App\Models\Branch;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalesLead extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'sales_leads';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'gym_id', 'branch_id', 'source_id', 'name', 'phone', 'email',
        'interest', 'notes',
        'interest_level', 'location_fit', 'fitness_goal', 'budget_range', 'join_timeframe',
        'stage', 'score', 'assigned_to', 'claimed_at',
        'utm_source', 'utm_medium', 'utm_campaign',
        'contact_attempts', 'first_contacted_at', 'qualified_at',
        'converted_at', 'lost_at', 'lost_reason', 'lost_notes', 'reengage_at',
        'converted_member_id', 'accepted_offer_id', 'agreement_ref',
        'payment_method', 'final_price', 'membership_start_date',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'stage' => LeadStage::class,
            'claimed_at' => 'datetime',
            'first_contacted_at' => 'datetime',
            'qualified_at' => 'datetime',
            'converted_at' => 'datetime',
            'lost_at' => 'datetime',
            'reengage_at' => 'date',
            'membership_start_date' => 'date',
            'final_price' => 'decimal:2',
            'contact_attempts' => 'integer',
        ];
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(SalesLeadSource::class, 'source_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    public function stageHistory(): HasMany
    {
        return $this->hasMany(SalesLeadStageHistory::class, 'lead_id')->orderBy('created_at');
    }

    public function activities(): HasMany
    {
        return $this->hasMany(SalesActivity::class, 'lead_id')->orderByDesc('created_at');
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(SalesAppointment::class, 'lead_id')->orderByDesc('scheduled_at');
    }

    public function offers(): HasMany
    {
        return $this->hasMany(SalesOffer::class, 'lead_id')->orderByDesc('created_at');
    }

    public function objections(): HasMany
    {
        return $this->hasMany(SalesObjection::class, 'lead_id')->orderByDesc('created_at');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(SalesTask::class, 'lead_id');
    }

    /** Converted leads are read-only in the pipeline. */
    public function isLocked(): bool
    {
        return $this->stage === LeadStage::Converted;
    }
}
