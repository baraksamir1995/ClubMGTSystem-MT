<?php

namespace App\Http\Controllers\Sales;

use App\Http\Controllers\Controller;
use App\Models\Sales\SalesSetting;
use App\Services\Sales\SalesAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SalesSettingsController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $access = new SalesAccess($request->user());
        $settings = SalesSetting::forGym($request->user()->gym_id);

        // Reps get the operational knobs but not the intake token.
        $data = $settings->toArray();
        if (! $access->isManager) {
            unset($data['intake_token']);
        }
        $data['cadence_days'] = $settings->cadenceDays();
        $data['reminder_hours'] = $settings->reminderHours();

        return response()->json(['data' => $data]);
    }

    public function update(Request $request): JsonResponse
    {
        $access = new SalesAccess($request->user());
        if (! $access->isManager) {
            return response()->json(['error' => 'Managers only.'], 403);
        }

        $validated = $request->validate([
            'unassigned_sla_minutes' => 'sometimes|integer|min:5|max:1440',
            'qualify_sla_hours' => 'sometimes|integer|min:1|max:168',
            'first_contact_minutes' => 'sometimes|integer|min:1|max:1440',
            'max_contact_attempts' => 'sometimes|integer|min:1|max:20',
            'cadence_days' => 'sometimes|array|min:1|max:10',
            'cadence_days.*' => 'integer|min:1|max:60',
            'reminder_hours' => 'sometimes|array|min:1|max:5',
            'reminder_hours.*' => 'integer|min:1|max:168',
        ]);

        $settings = SalesSetting::forGym($request->user()->gym_id);
        $settings->update($validated);

        return response()->json(['data' => $settings->fresh()]);
    }

    public function rotateIntakeToken(Request $request): JsonResponse
    {
        if ($request->user()->role !== 'gym_admin') {
            return response()->json(['error' => 'Only gym admins rotate the intake token.'], 403);
        }

        $settings = SalesSetting::forGym($request->user()->gym_id);
        $settings->update(['intake_token' => Str::random(48)]);

        return response()->json(['data' => ['intake_token' => $settings->fresh()->intake_token]]);
    }

    /**
     * Sales team roster: active staff holding the `sales` module, plus
     * gym admins. Used for assignment dropdowns + team management.
     */
    public function team(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;

        // A staff member can hold the sales module through more than one
        // role, so the join fans out. We can't SELECT DISTINCT here because
        // manager_branch_ids is json (Postgres has no json equality operator);
        // instead select the sales staff_member ids, then load+dedup by id.
        $salesStaffIds = DB::table('staff_members')
            ->join('staff_member_roles', 'staff_member_roles.staff_id', '=', 'staff_members.id')
            ->join('staff_role_permissions', 'staff_role_permissions.role_id', '=', 'staff_member_roles.role_id')
            ->where('staff_members.gym_id', $gymId)
            ->where('staff_members.status', 'active')
            ->whereNull('staff_members.deleted_at')
            ->where('staff_role_permissions.module', 'sales')
            ->distinct()
            ->pluck('staff_members.id');

        $staff = DB::table('staff_members')
            ->whereIn('id', $salesStaffIds)
            ->select('id as staff_id', 'user_id', 'full_name', 'email', 'sales_role', 'branch_id', 'manager_branch_ids')
            ->get()
            ->map(function ($row) {
                $row = (array) $row;
                $row['sales_role'] = $row['sales_role'] ?? 'rep';
                $row['manager_branch_ids'] = $row['manager_branch_ids']
                    ? json_decode($row['manager_branch_ids'], true) : null;
                return $row;
            });

        // Gym admins have full sales access without a staff_members row, and
        // leads can be assigned to them (SalesLeadController::assign), so they
        // must appear in the roster or those leads render as "Unknown" and
        // can't be reassigned from the UI. Exclude any already listed as staff.
        $staffUserIds = $staff->pluck('user_id')->filter()->all();
        $admins = DB::table('profiles')
            ->where('gym_id', $gymId)
            ->where('role', 'gym_admin')
            ->when($staffUserIds, fn ($q) => $q->whereNotIn('id', $staffUserIds))
            ->select('id as user_id', 'full_name', 'email')
            ->get()
            ->map(fn ($row) => [
                'staff_id' => null,
                'user_id' => $row->user_id,
                'full_name' => $row->full_name,
                'email' => $row->email,
                'sales_role' => 'admin',
                'branch_id' => null,
                'manager_branch_ids' => null,
            ]);

        return response()->json(['data' => $staff->concat($admins)->values()]);
    }

    /** Designate a staff member as sales rep or manager, and set branches. */
    public function updateTeamMember(Request $request, string $staffId): JsonResponse
    {
        $access = new SalesAccess($request->user());
        if (! $access->isManager) {
            return response()->json(['error' => 'Managers only.'], 403);
        }

        $validated = $request->validate([
            'sales_role' => 'sometimes|nullable|string|in:rep,manager',
            'branch_id' => 'sometimes|nullable|uuid',
            'manager_branch_ids' => 'sometimes|nullable|array',
            'manager_branch_ids.*' => 'uuid',
        ]);

        // Only full admins may promote to manager.
        if (($validated['sales_role'] ?? null) === 'manager' && ! $access->isAdmin) {
            return response()->json(['error' => 'Only gym admins designate sales managers.'], 403);
        }

        $updates = [];
        foreach (['sales_role', 'branch_id'] as $col) {
            if (array_key_exists($col, $validated)) {
                $updates[$col] = $validated[$col];
            }
        }
        if (array_key_exists('manager_branch_ids', $validated)) {
            $updates['manager_branch_ids'] = $validated['manager_branch_ids']
                ? json_encode($validated['manager_branch_ids']) : null;
        }
        if (! $updates) {
            return response()->json(['error' => 'Nothing to update.'], 422);
        }

        $updated = DB::table('staff_members')
            ->where('id', $staffId)
            ->where('gym_id', $request->user()->gym_id)
            ->whereNull('deleted_at')
            ->update($updates);

        if (! $updated) {
            return response()->json(['error' => 'Not found'], 404);
        }
        return response()->json(['data' => DB::table('staff_members')->where('id', $staffId)->first()]);
    }
}
