<?php

namespace App\Enums\Sales;

enum AppointmentStatus: string
{
    case Scheduled = 'scheduled';
    case Showed    = 'showed';
    case NoShow    = 'no_show';
    case Cancelled = 'cancelled';
}
