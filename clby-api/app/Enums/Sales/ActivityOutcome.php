<?php

namespace App\Enums\Sales;

enum ActivityOutcome: string
{
    case Answered          = 'answered';
    case NoAnswer          = 'no_answer';
    case CallbackRequested = 'callback_requested';
    case NotInterested     = 'not_interested';
}
