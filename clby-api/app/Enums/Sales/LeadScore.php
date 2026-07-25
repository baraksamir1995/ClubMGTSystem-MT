<?php

namespace App\Enums\Sales;

enum LeadScore: string
{
    case Hot  = 'hot';
    case Warm = 'warm';
    case Cold = 'cold';
}
