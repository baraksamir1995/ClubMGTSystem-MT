<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    use HasUuids;

    protected $table = 'payments';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'membership_id', 'service_assignment_id', 'member_id', 'gym_id', 'gym_member_id',
        'amount', 'currency', 'method', 'payment_method', 'status',
        'invoice_number', 'notes',
        'refund_reason',
        'transaction_id', 'metadata', 'paid_at', 'source',
        'service_type', 'service_name', 'original_amount', 'discount_amount',
        'promo_code_id', 'plan_promotion_id', 'specialist_name',
        'payment_link_url', 'branch_id',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'original_amount' => 'float',
            'discount_amount' => 'float',
            'refund_amount' => 'float',
            'refunded_amount' => 'float',
            'metadata' => 'array',
            'paid_at' => 'datetime',
            'refunded_at' => 'datetime',
            'receipt_email_sent_at' => 'datetime',
        ];
    }

    public function gym(): BelongsTo
    {
        return $this->belongsTo(Gym::class);
    }

    public function gymMember(): BelongsTo
    {
        return $this->belongsTo(GymMember::class);
    }

    public function membership(): BelongsTo
    {
        return $this->belongsTo(MemberMembership::class, 'membership_id');
    }

    public function promoCode(): BelongsTo
    {
        return $this->belongsTo(PromoCode::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
