<?php

namespace App\Support;

/**
 * Server-side allowlist of (module, action) permission tuples.
 *
 * Access is MODULE-LEVEL: CheckPermission grants every action in a
 * module as soon as the role holds any row for it, and the gym-admin
 * role editor saves a single `view` row per granted module. The
 * per-action entries below remain only to keep legacy rows valid and to
 * bound what a tampered payload can insert.
 *
 * Keep the module list in sync with:
 *   - routes/api.php  (->middleware('permission:module,action'))
 *   - the gym-admin frontend's role editor module list
 *
 * `overview` has no gated route of its own — it only controls sidebar
 * visibility of the dashboard homepage in gym-admin.
 */
class Permissions
{
    /** @var array<string, list<string>> */
    public const ALLOWLIST = [
        'attendance'  => ['view', 'create'],
        'classes'     => ['view', 'create', 'edit', 'delete'],
        'content'     => ['view', 'create', 'edit', 'delete'],
        'invitations' => ['view', 'edit'],
        'members'     => ['view', 'create', 'edit', 'delete'],
        'overview'    => ['view'],
        'payments'    => ['view', 'create', 'edit', 'delete'],
        'plans'       => ['view', 'create', 'edit', 'delete'],
        'promotions'  => ['view', 'create', 'edit', 'delete'],
        'settings'    => ['view', 'create', 'edit', 'delete'],
        'staff'       => ['view', 'create', 'edit', 'delete'],
    ];

    /**
     * Whether (module, action) is a recognised permission tuple.
     */
    public static function isValid(string $module, string $action): bool
    {
        return in_array($action, self::ALLOWLIST[$module] ?? [], true);
    }

    /**
     * Flatten the allowlist into ['module:action', ...] for validation
     * rules that use Rule::in().
     *
     * @return list<string>
     */
    public static function flatList(): array
    {
        $out = [];
        foreach (self::ALLOWLIST as $module => $actions) {
            foreach ($actions as $action) {
                $out[] = "{$module}:{$action}";
            }
        }
        return $out;
    }
}
