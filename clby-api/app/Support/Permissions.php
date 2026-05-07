<?php

namespace App\Support;

/**
 * Server-side allowlist of (module, action) permission tuples.
 *
 * The set of permissions a staff role can hold is closed: every entry
 * here corresponds to at least one route or controller branch that
 * actually checks for it. Free-form strings would let an admin grant
 * `super_secret.delete` (which would never be checked but pollutes the
 * permission matrix), or worse, paste a typo'd permission that silently
 * never grants access.
 *
 * Keep in sync with:
 *   - routes/api.php  (->middleware('permission:module,action'))
 *   - any controller that resolves permissions for the UI
 *   - the gym-admin frontend's RoleEditor permission grid
 */
class Permissions
{
    /** @var array<string, list<string>> */
    public const ALLOWLIST = [
        'attendance'  => ['create'],
        'classes'     => ['create', 'edit', 'delete'],
        'content'     => ['create', 'edit', 'delete'],
        'invitations' => ['edit'],
        'members'     => ['view', 'create', 'edit', 'delete'],
        'payments'    => ['create', 'edit', 'delete'],
        'plans'       => ['create', 'edit', 'delete'],
        'promotions'  => ['create', 'edit', 'delete'],
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
