<?php

namespace App\Http\Controllers\Sales;

use App\Enums\Sales\AppointmentStatus;
use App\Enums\Sales\AppointmentType;
use App\Enums\Sales\LeadStage;
use App\Enums\Sales\TaskType;
use App\Http\Controllers\Controller;
use App\Models\Sales\SalesAppointment;
use App\Models\Sales\SalesLead;
use App\Models\Sales\SalesTask;
use App\Services\Sales\InvalidTransition;
use App\Services\Sales\LeadPipeline;
use App\Services\Sales\SalesAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SalesAppointmentController extends Controller
{
    public function __construct(private readonly LeadPipeline $pipeline)
    {
    }

    /** Calendar feed: ?from=&to=&branch_id=&host_id= */
    public function index(Request $request): JsonResponse
    {
        $access = new SalesAccess($request->user());

        $query = SalesAppointment::where('sales_appointments.gym_id', $request->user()->gym_id)
            ->whereIn('lead_id', $access->scopeLeads(SalesLead::query())->select('id'))
            ->with('lead:id,name,phone,stage,assigned_to');

        if ($request->filled('from')) {
            $query->where('scheduled_at', '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->where('scheduled_at', '<=', $request->query('to'));
        }
        foreach (['branch_id', 'host_id', 'status'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
        }

        return response()->json(['data' => $query->orderBy('scheduled_at')->limit(500)->get()]);
    }

    public function store(Request $request, string $leadId): JsonResponse
    {
        $access = new SalesAccess($request->user());
        $lead = $access->scopeLeads(SalesLead::query())->find($leadId);
        if (! $lead) {
            return response()->json(['error' => 'Not found'], 404);
        }
        if (! $access->canWork($lead)) {
            return response()->json(['error' => 'Claim or get assigned this lead to work it.'], 403);
        }
        if ($lead->stage->isTerminal()) {
            return response()->json(['error' => 'Lead is closed.'], 422);
        }

        $validated = $request->validate([
            'type' => ['required', Rule::enum(AppointmentType::class)],
            'scheduled_at' => 'required|date|after:now',
            'branch_id' => 'nullable|uuid',
            'host_id' => 'nullable|uuid',
        ]);

        $appointment = SalesAppointment::create([
            ...$validated,
            'gym_id' => $lead->gym_id,
            'lead_id' => $lead->id,
            'branch_id' => $validated['branch_id'] ?? $lead->branch_id,
            'host_id' => $validated['host_id'] ?? $lead->assigned_to,
            'created_by' => $request->user()->id,
        ]);

        // Booking a visit is what moves contacted → tour_booked.
        if ($lead->stage === LeadStage::Contacted) {
            try {
                $this->pipeline->advance($lead, LeadStage::TourBooked, $request->user(), 'appointment booked');
            } catch (InvalidTransition) {
                // Stage race — keep the appointment, leave the stage alone.
            }
        }

        return response()->json(['data' => $appointment, 'lead_stage' => $lead->fresh()->stage], 201);
    }

    /** Mark Showed / No-show / Cancelled after the visit time. */
    public function updateStatus(Request $request, string $id): JsonResponse
    {
        $access = new SalesAccess($request->user());
        $appointment = SalesAppointment::where('gym_id', $request->user()->gym_id)
            ->whereIn('lead_id', $access->scopeLeads(SalesLead::query())->select('id'))
            ->find($id);
        if (! $appointment) {
            return response()->json(['error' => 'Not found'], 404);
        }

        $validated = $request->validate([
            'status' => ['required', Rule::in([
                AppointmentStatus::Showed->value,
                AppointmentStatus::NoShow->value,
                AppointmentStatus::Cancelled->value,
            ])],
        ]);

        $appointment->update(['status' => $validated['status'], 'marked_at' => now()]);

        // No-show → rebooking task for the lead's rep.
        if ($validated['status'] === AppointmentStatus::NoShow->value) {
            $lead = $appointment->lead;
            SalesTask::create([
                'gym_id' => $appointment->gym_id,
                'lead_id' => $appointment->lead_id,
                'assigned_to' => $lead?->assigned_to ?? $request->user()->id,
                'type' => TaskType::Rebook->value,
                'title' => 'Rebook after no-show — ' . ($lead?->name ?? 'lead'),
                'due_at' => now()->addDay(),
                'created_by' => $request->user()->id,
            ]);
        }

        return response()->json(['data' => $appointment->fresh()]);
    }
}
