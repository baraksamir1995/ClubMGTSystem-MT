<?php

namespace App\Enums\Sales;

/**
 * Shared taxonomy for objections and lost reasons; `Unreachable` is
 * lost-only (per spec the lost taxonomy = objections + Unreachable).
 */
enum LostReason: string
{
    case Price                = 'price';
    case CommitmentLength     = 'commitment_length';
    case NeedsToThink         = 'needs_to_think';
    case ComparingCompetitors = 'comparing_competitors';
    case Timing               = 'timing';
    case Unreachable          = 'unreachable';
    case Other                = 'other';

    /** @return list<string> valid objection reasons (everything except unreachable) */
    public static function objectionValues(): array
    {
        return array_values(array_filter(
            array_map(fn (self $c) => $c->value, self::cases()),
            fn (string $v) => $v !== self::Unreachable->value,
        ));
    }
}
