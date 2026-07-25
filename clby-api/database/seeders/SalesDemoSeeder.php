<?php

namespace Database\Seeders;

use App\Enums\Sales\LeadStage;
use App\Models\Sales\SalesActivity;
use App\Models\Sales\SalesLead;
use App\Models\Sales\SalesLeadSource;
use App\Models\Sales\SalesLeadStageHistory;
use App\Models\Sales\SalesSetting;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Demo sales pipeline data for local/dev gyms.
 *
 *   php artisan db:seed --class=SalesDemoSeeder
 *
 * Targets the first gym (or SEED_GYM_ID env). Creates default sources,
 * settings, and ~100 leads spread across stages/sources/branches using
 * the gym's existing branches and staff. Idempotent-ish: skips if the
 * gym already has sales leads.
 */
class SalesDemoSeeder extends Seeder
{
    private const FIRST_NAMES = ['Ahmed', 'Mona', 'Omar', 'Sara', 'Youssef', 'Nour', 'Karim', 'Laila', 'Hassan', 'Dina', 'Tarek', 'Rana', 'Amr', 'Heba', 'Khaled', 'Salma', 'Mostafa', 'Yasmin', 'Ali', 'Farida'];
    private const LAST_NAMES = ['Hassan', 'Ibrahim', 'Mahmoud', 'Said', 'Fathy', 'Adel', 'Samir', 'Kamal', 'Ezz', 'Sherif'];
    private const GOALS = ['weight_loss', 'muscle_gain', 'general_fitness', 'classes', 'pt', 'rehab'];
    private const STAGE_WEIGHTS = [
        'new' => 25, 'qualified' => 15, 'contacted' => 20,
        'tour_booked' => 12, 'offer_presented' => 8,
        'converted' => 10, 'lost' => 10,
    ];

    public function run(): void
    {
        $gymId = env('SEED_GYM_ID') ?: DB::table('gyms')->orderBy('created_at')->value('id');
        if (! $gymId) {
            $this->command->warn('No gym found — skipping.');
            return;
        }
        if (SalesLead::where('gym_id', $gymId)->exists()) {
            $this->command->warn("Gym {$gymId} already has sales leads — skipping.");
            return;
        }

        SalesLeadSource::seedDefaults($gymId);
        SalesSetting::forGym($gymId);

        $sources = SalesLeadSource::where('gym_id', $gymId)->get();
        $branchIds = DB::table('branches')->where('gym_id', $gymId)->pluck('id')->all();
        $staffUserIds = DB::table('staff_members')
            ->where('gym_id', $gymId)->where('status', 'active')
            ->whereNull('deleted_at')->whereNotNull('user_id')
            ->pluck('user_id')->all();
        $adminId = DB::table('profiles')->where('gym_id', $gymId)->where('role', 'gym_admin')->value('id');
        $assignees = $staffUserIds ?: array_filter([$adminId]);

        // Build a weighted stage list of exactly 100 entries.
        $stages = [];
        foreach (self::STAGE_WEIGHTS as $stage => $count) {
            $stages = [...$stages, ...array_fill(0, $count, $stage)];
        }

        foreach ($stages as $i => $stageValue) {
            $stage = LeadStage::from($stageValue);
            $source = $sources[$i % $sources->count()];
            $createdAt = now()->subDays(rand(0, 60))->subMinutes(rand(0, 1400));
            $assigned = ($stage === LeadStage::NewLead && $i % 3 === 0) || ! $assignees
                ? null
                : $assignees[array_rand($assignees)];

            $name = self::FIRST_NAMES[$i % 20] . ' ' . self::LAST_NAMES[$i % 10];
            $lead = SalesLead::create([
                'gym_id' => $gymId,
                'branch_id' => $branchIds ? $branchIds[$i % count($branchIds)] : null,
                'source_id' => $source->id,
                'name' => $name,
                'phone' => '+2010' . str_pad((string) (10000000 + $i), 8, '0', STR_PAD_LEFT),
                'email' => 'lead' . $i . '@example.com',
                'fitness_goal' => self::GOALS[$i % 6],
                'stage' => $stage,
                'score' => $source->default_score,
                'assigned_to' => $assigned,
                'claimed_at' => $assigned ? $createdAt->copy()->addMinutes(rand(5, 120)) : null,
                'contact_attempts' => in_array($stageValue, ['new', 'qualified'], true) ? 0 : rand(1, 4),
                'first_contacted_at' => in_array($stageValue, ['new', 'qualified'], true)
                    ? null : $createdAt->copy()->addMinutes(rand(5, 300)),
                'qualified_at' => $stageValue === 'new' ? null : $createdAt->copy()->addHours(rand(1, 20)),
                'converted_at' => $stageValue === 'converted' ? $createdAt->copy()->addDays(rand(2, 12)) : null,
                'lost_at' => $stageValue === 'lost' ? $createdAt->copy()->addDays(rand(1, 10)) : null,
                'lost_reason' => $stageValue === 'lost'
                    ? ['price', 'timing', 'unreachable', 'comparing_competitors'][$i % 4] : null,
                'reengage_at' => $stageValue === 'lost' ? now()->addDays(rand(30, 120))->toDateString() : null,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);

            // Stage history walk: created → each stage up to the current one.
            $walk = [LeadStage::NewLead];
            foreach (LeadStage::ORDER as $s) {
                if ($s === LeadStage::NewLead) {
                    continue;
                }
                if (array_search($stage, LeadStage::ORDER, true) >= array_search($s, LeadStage::ORDER, true)) {
                    $walk[] = $s;
                }
            }
            if ($stage === LeadStage::Lost) {
                $walk[] = LeadStage::Lost;
            }
            $prev = null;
            $t = $createdAt->copy();
            foreach ($walk as $s) {
                SalesLeadStageHistory::create([
                    'lead_id' => $lead->id,
                    'from_stage' => $prev?->value,
                    'to_stage' => $s->value,
                    'changed_by' => $assigned,
                    'reason' => $prev === null ? 'created' : null,
                    'created_at' => $t,
                ]);
                $prev = $s;
                $t = $t->copy()->addHours(rand(4, 48));
            }

            if ($lead->first_contacted_at) {
                SalesActivity::create([
                    'gym_id' => $gymId,
                    'lead_id' => $lead->id,
                    'user_id' => $assigned,
                    'type' => ['call', 'whatsapp'][$i % 2],
                    'outcome' => ['answered', 'no_answer', 'callback_requested'][$i % 3],
                    'created_at' => $lead->first_contacted_at,
                ]);
            }
        }

        $this->command->info('Seeded ' . count($stages) . " sales leads for gym {$gymId}.");
    }
}
