<?php

namespace App\Http\Controllers\Sales;

use App\Enums\Sales\LeadStage;
use App\Http\Controllers\Controller;
use App\Models\Sales\SalesActivity;
use App\Models\Sales\SalesLead;
use App\Models\Sales\SalesLeadSource;
use App\Models\Sales\SalesLeadStageHistory;
use App\Models\Sales\SalesSetting;
use App\Support\Phone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Public lead intake for website forms and ad platforms.
 * Authenticated by the gym's intake token (X-Intake-Token header or
 * `token` field) — see SalesSettingsController::rotateIntakeToken.
 */
class SalesIntakeController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $token = $request->header('X-Intake-Token') ?: $request->input('token');
        if (! $token) {
            return response()->json(['error' => 'Missing intake token'], 401);
        }
        $settings = SalesSetting::where('intake_token', $token)->first();
        if (! $settings) {
            return response()->json(['error' => 'Invalid intake token'], 401);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'required|string|max:30',
            'email' => 'nullable|email|max:255',
            'source' => 'nullable|string|max:100',
            'interest' => 'nullable|string|max:255',
            'branch_id' => 'nullable|uuid',
            'notes' => 'nullable|string|max:5000',
            'utm_source' => 'nullable|string|max:255',
            'utm_medium' => 'nullable|string|max:255',
            'utm_campaign' => 'nullable|string|max:255',
        ]);

        $phone = Phone::toE164($validated['phone']);
        if (! $phone) {
            return response()->json(['errors' => ['phone' => ['Invalid phone number.']]], 422);
        }
        $gymId = $settings->gym_id;

        // Duplicate intake: log on the existing lead instead of forking it.
        $existing = SalesLead::where('gym_id', $gymId)->where('phone', $phone)->first();
        if ($existing) {
            SalesActivity::create([
                'gym_id' => $gymId,
                'lead_id' => $existing->id,
                'type' => 'note',
                'notes' => 'Duplicate web intake ('
                    . ($validated['source'] ?? 'unknown source') . ')'
                    . (! empty($validated['notes']) ? ': ' . $validated['notes'] : ''),
                'created_at' => now(),
            ]);
            return response()->json(['ok' => true, 'merged' => true], 200);
        }

        SalesLeadSource::seedDefaults($gymId);
        $source = $validated['source'] ?? 'Website Form';
        $sourceRow = SalesLeadSource::where('gym_id', $gymId)
            ->whereRaw('LOWER(name) = ?', [strtolower($source)])->first()
            ?? SalesLeadSource::firstOrCreate(
                ['gym_id' => $gymId, 'name' => $source],
                ['default_score' => 'warm', 'sort' => 100],
            );

        $branchOk = ! empty($validated['branch_id']) && DB::table('branches')
            ->where('id', $validated['branch_id'])->where('gym_id', $gymId)->exists();

        $lead = DB::transaction(function () use ($gymId, $validated, $phone, $sourceRow, $branchOk) {
            $lead = SalesLead::create([
                'gym_id' => $gymId,
                'branch_id' => $branchOk ? $validated['branch_id'] : null,
                'source_id' => $sourceRow->id,
                'name' => $validated['name'],
                'phone' => $phone,
                'email' => $validated['email'] ?? null,
                'interest' => $validated['interest'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'utm_source' => $validated['utm_source'] ?? null,
                'utm_medium' => $validated['utm_medium'] ?? null,
                'utm_campaign' => $validated['utm_campaign'] ?? null,
                'stage' => LeadStage::NewLead,
                'score' => $sourceRow->default_score,
            ]);
            SalesLeadStageHistory::create([
                'lead_id' => $lead->id, 'from_stage' => null,
                'to_stage' => LeadStage::NewLead->value,
                'reason' => 'web intake', 'created_at' => now(),
            ]);
            return $lead;
        });

        return response()->json(['ok' => true, 'lead_id' => $lead->id], 201);
    }
}
