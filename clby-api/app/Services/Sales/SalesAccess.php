<?php

namespace App\Services\Sales;

use App\Models\Sales\SalesLead;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Resolves the caller's sales scope. Role mapping onto the existing
 * auth system (see CLAUDE.md):
 *
 *   Admin   → profiles.role = gym_admin (or super_admin): whole gym.
 *   Manager → staff_members.sales_role = 'manager': their branches
 *             (manager_branch_ids json, empty/null = whole gym).
 *   Rep     → any other staff/trainer holding the `sales` module: own
 *             leads + the unassigned queue of their branch.
 *
 * Route-level module access is already enforced by permission:sales,*;
 * this class only decides WHICH rows inside the module a user sees.
 */
class SalesAccess
{
    public readonly bool $isAdmin;
    public readonly bool $isManager;
    /** @var list<string>|null null = all branches in the gym */
    public readonly ?array $branchIds;
    public readonly ?string $repBranchId;

    public function __construct(public readonly User $user)
    {
        $this->isAdmin = in_array($user->role, ['gym_admin', 'super_admin'], true);

        $staff = $this->isAdmin ? null : DB::table('staff_members')
            ->where('user_id', $user->id)
            ->where('gym_id', $user->gym_id)
            ->whereNull('deleted_at')
            ->first();

        $this->isManager = $this->isAdmin
            || ($staff && $staff->sales_role === 'manager');

        if ($this->isAdmin) {
            $this->branchIds = null;
            $this->repBranchId = null;
        } elseif ($this->isManager) {
            $ids = $staff->manager_branch_ids ? json_decode($staff->manager_branch_ids, true) : null;
            $this->branchIds = $ids ?: null;
            $this->repBranchId = $staff->branch_id ?? null;
        } else {
            $this->repBranchId = $staff->branch_id ?? null;
            $this->branchIds = $this->repBranchId ? [$this->repBranchId] : null;
        }
    }

    /** Scope a sales_leads query to what the caller may see. */
    public function scopeLeads(Builder $query): Builder
    {
        $query->where('gym_id', $this->user->gym_id);

        if ($this->isManager) {
            if ($this->branchIds !== null) {
                // Branch-scoped manager: their branches + branchless leads.
                $query->where(function ($q) {
                    $q->whereIn('branch_id', $this->branchIds)->orWhereNull('branch_id');
                });
            }
            return $query;
        }

        // Rep: own leads + the unassigned queue of their branch.
        return $query->where(function ($q) {
            $q->where('assigned_to', $this->user->id)
              ->orWhere(function ($unassigned) {
                  $unassigned->whereNull('assigned_to');
                  if ($this->repBranchId) {
                      $unassigned->where(function ($b) {
                          $b->where('branch_id', $this->repBranchId)->orWhereNull('branch_id');
                      });
                  }
              });
        });
    }

    /** May the caller read this lead at all? */
    public function canView(SalesLead $lead): bool
    {
        return $this->scopeLeads(SalesLead::query())->whereKey($lead->id)->exists();
    }

    /** May the caller mutate this lead (log activity, edit, transition…)? */
    public function canWork(SalesLead $lead): bool
    {
        if ($lead->gym_id !== $this->user->gym_id) {
            return false;
        }
        if ($this->isManager) {
            return $this->branchIds === null
                || $lead->branch_id === null
                || in_array($lead->branch_id, $this->branchIds, true);
        }
        return $lead->assigned_to === $this->user->id;
    }
}
