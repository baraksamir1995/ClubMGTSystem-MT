<?php

namespace App\Http\Controllers\Sales;

use App\Http\Controllers\Controller;
use App\Models\Sales\SalesLead;
use App\Models\Sales\SalesTask;
use App\Services\Sales\SalesAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SalesTaskController extends Controller
{
    /**
     * Task queue. Default: caller's own open tasks due today or overdue
     * (the rep "Today" queue). ?scope=team gives managers the whole
     * branch; ?due=all lifts the date filter.
     */
    public function index(Request $request): JsonResponse
    {
        $access = new SalesAccess($request->user());
        $query = SalesTask::where('sales_tasks.gym_id', $request->user()->gym_id)
            ->with('lead:id,name,phone,stage,branch_id,assigned_to')
            ->where('status', 'open');

        if ($request->query('scope') === 'team' && $access->isManager) {
            $query->whereIn('lead_id', $access->scopeLeads(SalesLead::query())->select('id'));
        } else {
            $query->where('assigned_to', $request->user()->id);
        }

        if ($request->query('due') !== 'all') {
            $query->where('due_at', '<=', now()->endOfDay());
        }

        return response()->json(['data' => $query->orderBy('due_at')->limit(200)->get()]);
    }

    public function complete(Request $request, string $id): JsonResponse
    {
        $access = new SalesAccess($request->user());
        $task = SalesTask::where('gym_id', $request->user()->gym_id)->find($id);
        if (! $task) {
            return response()->json(['error' => 'Not found'], 404);
        }
        if ($task->assigned_to !== $request->user()->id && ! $access->isManager) {
            return response()->json(['error' => 'Not your task.'], 403);
        }

        $validated = $request->validate(['status' => 'required|string|in:done,cancelled']);
        $task->update([
            'status' => $validated['status'],
            'completed_at' => $validated['status'] === 'done' ? now() : null,
        ]);

        return response()->json(['data' => $task->fresh()]);
    }
}
