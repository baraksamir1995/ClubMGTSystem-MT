<?php

namespace App\Enums\Sales;

enum LeadStage: string
{
    case NewLead        = 'new';
    case Qualified      = 'qualified';
    case Contacted      = 'contacted';
    case TourBooked     = 'tour_booked';
    case OfferPresented = 'offer_presented';
    case Converted      = 'converted';
    case Lost           = 'lost';

    /** Ordered pipeline (terminal stages excluded). */
    public const ORDER = [
        self::NewLead,
        self::Qualified,
        self::Contacted,
        self::TourBooked,
        self::OfferPresented,
        self::Converted,
    ];

    public function isTerminal(): bool
    {
        return $this === self::Converted || $this === self::Lost;
    }

    /** The only stage a forward transition may target, or null at pipeline end. */
    public function next(): ?self
    {
        $idx = array_search($this, self::ORDER, true);
        if ($idx === false || $idx === count(self::ORDER) - 1) {
            return null;
        }
        return self::ORDER[$idx + 1];
    }
}
