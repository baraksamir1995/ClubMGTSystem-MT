<?php

namespace App\Enums\Sales;

enum ActivityType: string
{
    case Call     = 'call';
    case WhatsApp = 'whatsapp';
    case Sms      = 'sms';
    case Email    = 'email';
    case Note     = 'note';

    /** Types that count as a contact attempt (notes don't). */
    public function isContactAttempt(): bool
    {
        return $this !== self::Note;
    }
}
