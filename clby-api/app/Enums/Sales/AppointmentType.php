<?php

namespace App\Enums\Sales;

enum AppointmentType: string
{
    case Tour        = 'tour';
    case Trial       = 'trial';
    case GuestPass   = 'guest_pass';
    case ClassTaster = 'class_taster';
}
