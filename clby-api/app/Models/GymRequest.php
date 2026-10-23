<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * A self-onboarding submission from clbyapp.com/register.
 * See the create_gym_requests_table migration for the lifecycle.
 */
class GymRequest extends Model
{
    use HasUuids;

    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_DECLINED = 'declined';

    protected $table = 'gym_requests';
    public $incrementing = false;
    protected $keyType = 'string';

    /**
     * Status, review and outcome columns are deliberately NOT fillable: they
     * only change through the explicit transitions in GymRequestController,
     * so a public payload can never set them.
     */
    protected $fillable = [
        'submission_key',
        'gym_name', 'description', 'logo_url', 'address', 'city', 'country',
        'latitude', 'longitude', 'phone', 'business_email', 'category',
        'services', 'branches_count', 'timezone',
        'owner_name', 'owner_email', 'owner_phone',
        'submitted_ip', 'user_agent',
    ];

    protected $hidden = ['submitted_ip', 'user_agent'];

    protected function casts(): array
    {
        return [
            'services' => 'array',
            'latitude' => 'float',
            'longitude' => 'float',
            'branches_count' => 'integer',
            'share_decline_reason' => 'boolean',
            'provisioning_attempts' => 'integer',
            'reviewed_at' => 'datetime',
            'last_provisioning_failed_at' => 'datetime',
            'submitted_email_sent_at' => 'datetime',
            'decision_email_sent_at' => 'datetime',
            'last_email_failed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (GymRequest $r) {
            $r->reference ??= 'GR-' . strtoupper(Str::random(8));
            $r->status ??= self::STATUS_PENDING;
        });
    }

    /**
     * Append to the audit trail. Like LogsActivity, an audit failure must
     * never break the action being audited.
     */
    public function logEvent(string $event, ?string $actorId = null, array $details = []): void
    {
        try {
            DB::table('gym_request_events')->insert([
                'gym_request_id' => $this->id,
                'event' => $event,
                'actor_id' => $actorId,
                'details' => $details ? json_encode($details) : null,
                'ip_address' => request()?->ip(),
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Gym request event log failed: ' . $e->getMessage());
        }
    }
}
