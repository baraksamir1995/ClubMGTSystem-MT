<?php

namespace App\Enums\Sales;

enum TaskType: string
{
    case FollowUp   = 'follow_up';
    case Rebook     = 'rebook';
    case Onboarding = 'onboarding';
    case Other      = 'other';
}
