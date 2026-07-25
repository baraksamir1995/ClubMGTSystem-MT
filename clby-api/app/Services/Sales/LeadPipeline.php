<?php

namespace App\Services\Sales;

use App\Enums\Sales\LeadStage;
use App\Enums\Sales\TaskType;
use App\Models\Sales\SalesLead;
use App\Models\Sales\SalesLeadStageHistory;
use App\Models\Sales\SalesTask;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * The single writer of `sales_leads.stage`. Nothing else may update the
 * column — every transition is validated here and recorded in
 * sales_lead_stage_history.
 *
 * Rules:
 *  - Forward moves go exactly one stage at a time (new → qualified → … ).
 *  - `converted` is only reachable through convert(), never advance().
 *  - Lost is reachable from any non-terminal stage and requires a reason.
 *  - Lost leads sit in the nurture pool and can be reopened (→ new).
 *  - Converted leads are terminal and read-only.
 */
class LeadPipeline
{
    public function advance(SalesLead $lead, LeadStage $to, User $by, ?string $reason = null): SalesLead
    {
        $from = $lead->stage;

        if ($from->isTerminal()) {
            throw new InvalidTransition("Lead is {$from->value} and can no longer move.");
        }
        if ($to === LeadStage::Converted) {
            throw new InvalidTransition('Use the convert action to close a lead.');
        }
        if ($to === LeadStage::Lost) {
            throw new InvalidTransition('Use the mark-lost action (a reason is required).');
        }
        if ($from->next() !== $to) {
            throw new InvalidTransition(
                "Invalid transition {$from->value} → {$to->value}; next stage is {$from->next()?->value}."
            );
        }

        return DB::transaction(function () use ($lead, $from, $to, $by, $reason) {
            $lead->stage = $to;
            if ($to === LeadStage::Qualified) {
                $lead->qualified_at ??= now();
            }
            if ($to === LeadStage::Contacted) {
                $lead->first_contacted_at ??= now();
            }
            $lead->save();
            $this->record($lead, $from, $to, $by, $reason);
            return $lead;
        });
    }

    public function markLost(SalesLead $lead, string $reason, User $by, ?string $notes = null, ?string $reengageAt = null): SalesLead
    {
        if ($lead->stage->isTerminal()) {
            throw new InvalidTransition("Lead is {$lead->stage->value} and can no longer move.");
        }

        return DB::transaction(function () use ($lead, $reason, $by, $notes, $reengageAt) {
            $from = $lead->stage;
            $lead->fill([
                'stage' => LeadStage::Lost,
                'lost_at' => now(),
                'lost_reason' => $reason,
                'lost_notes' => $notes,
                // Nurture pool: default re-engagement 90 days out.
                'reengage_at' => $reengageAt ?? now()->addDays(90)->toDateString(),
            ])->save();

            // Lost leads leave every task queue.
            SalesTask::where('lead_id', $lead->id)->where('status', 'open')
                ->update(['status' => 'cancelled']);

            $this->record($lead, $from, LeadStage::Lost, $by, $reason);
            return $lead;
        });
    }

    /** Nurture-pool re-engagement: lost → new, history preserved. */
    public function reopen(SalesLead $lead, User $by, ?string $reason = null): SalesLead
    {
        if ($lead->stage !== LeadStage::Lost) {
            throw new InvalidTransition('Only lost leads can be reopened.');
        }

        return DB::transaction(function () use ($lead, $by, $reason) {
            $lead->fill([
                'stage' => LeadStage::NewLead,
                'lost_at' => null, 'lost_reason' => null,
                'lost_notes' => null, 'reengage_at' => null,
            ])->save();
            $this->record($lead, LeadStage::Lost, LeadStage::NewLead, $by, $reason ?? 're-engaged from nurture pool');
            return $lead;
        });
    }

    /**
     * Close the deal. Requires the lead to be at offer_presented with an
     * accepted offer. Creates the onboarding task checklist.
     *
     * @param array{offer_id:string, payment_method:string, final_price:numeric,
     *              start_date:string, agreement_ref:?string, member_id:?string} $payload
     */
    public function convert(SalesLead $lead, array $payload, User $by): SalesLead
    {
        if ($lead->stage !== LeadStage::OfferPresented) {
            throw new InvalidTransition('Leads convert from offer_presented only.');
        }

        return DB::transaction(function () use ($lead, $payload, $by) {
            $offer = $lead->offers()->where('id', $payload['offer_id'])->first();
            if (! $offer) {
                throw new InvalidTransition('Offer not found on this lead.');
            }
            // Only a live offer can close the deal — a declined or expired
            // one must not be silently resurrected to 'accepted'.
            if ($offer->status === 'declined') {
                throw new InvalidTransition('That offer was declined — present a new offer before converting.');
            }
            if ($offer->valid_until !== null && $offer->valid_until->isBefore(now()->startOfDay())) {
                throw new InvalidTransition('That offer has expired — present a new offer before converting.');
            }
            $offer->update(['status' => 'accepted']);

            $lead->fill([
                'stage' => LeadStage::Converted,
                'converted_at' => now(),
                'accepted_offer_id' => $offer->id,
                'payment_method' => $payload['payment_method'],
                'final_price' => $payload['final_price'],
                'membership_start_date' => $payload['start_date'],
                'agreement_ref' => $payload['agreement_ref'] ?? null,
                'converted_member_id' => $payload['member_id'] ?? null,
            ])->save();

            // Open follow-ups are obsolete; replace with onboarding checklist.
            SalesTask::where('lead_id', $lead->id)->where('status', 'open')
                ->update(['status' => 'cancelled']);

            $onboarding = [
                'App / QR access setup',
                'Book welcome session / PT assessment',
                'First-visit follow-up',
            ];
            foreach ($onboarding as $i => $title) {
                SalesTask::create([
                    'gym_id' => $lead->gym_id,
                    'lead_id' => $lead->id,
                    'assigned_to' => $lead->assigned_to ?? $by->id,
                    'type' => TaskType::Onboarding->value,
                    'title' => $title,
                    'due_at' => now()->addDays($i + 1),
                    'created_by' => $by->id,
                ]);
            }

            $this->record($lead, LeadStage::OfferPresented, LeadStage::Converted, $by, 'converted');
            return $lead;
        });
    }

    private function record(SalesLead $lead, LeadStage $from, LeadStage $to, User $by, ?string $reason): void
    {
        SalesLeadStageHistory::create([
            'lead_id' => $lead->id,
            'from_stage' => $from->value,
            'to_stage' => $to->value,
            'changed_by' => $by->id,
            'reason' => $reason,
            'created_at' => now(),
        ]);
    }
}
