<?php

namespace App\Services\Sales;

use App\Enums\Sales\ActivityOutcome;
use App\Enums\Sales\ActivityType;
use App\Enums\Sales\TaskType;
use App\Models\Sales\SalesActivity;
use App\Models\Sales\SalesLead;
use App\Models\Sales\SalesSetting;
use App\Models\Sales\SalesTask;
use App\Models\User;

/**
 * Applies the side effects of a logged contact attempt:
 *  - stamps first_contacted_at (speed-to-lead) and bumps contact_attempts
 *  - on no-answer, schedules the Day-1/3/7 (configurable) follow-up tasks
 *  - reports whether the rep should be prompted to mark the lead Lost
 *    (max attempts reached, configurable).
 */
class FollowUpCadence
{
    /** @return array{prompt_lost: bool, tasks_created: int} */
    public function apply(SalesLead $lead, SalesActivity $activity, User $by): array
    {
        $type = ActivityType::from($activity->type);
        if (! $type->isContactAttempt()) {
            return ['prompt_lost' => false, 'tasks_created' => 0];
        }

        $lead->contact_attempts += 1;
        $lead->first_contacted_at ??= $activity->created_at ?? now();
        $lead->save();

        $settings = SalesSetting::forGym($lead->gym_id);
        $created = 0;

        if ($activity->outcome === ActivityOutcome::NoAnswer->value) {
            // One open cadence per lead: skip days that already have an
            // open follow-up so re-logging no-answers doesn't stack tasks.
            $openFollowUps = SalesTask::where('lead_id', $lead->id)
                ->where('type', TaskType::FollowUp->value)
                ->where('status', 'open')
                ->count();

            if ($openFollowUps === 0) {
                foreach ($settings->cadenceDays() as $day) {
                    SalesTask::create([
                        'gym_id' => $lead->gym_id,
                        'lead_id' => $lead->id,
                        'assigned_to' => $lead->assigned_to ?? $by->id,
                        'type' => TaskType::FollowUp->value,
                        'title' => "Day {$day} follow-up — {$lead->name}",
                        'due_at' => now()->addDays($day),
                        'created_by' => $by->id,
                    ]);
                    $created++;
                }
            }
        }

        return [
            'prompt_lost' => $lead->contact_attempts >= $settings->max_contact_attempts,
            'tasks_created' => $created,
        ];
    }
}
