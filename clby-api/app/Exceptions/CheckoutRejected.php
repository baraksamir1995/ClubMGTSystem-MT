<?php

namespace App\Exceptions;

/** Thrown inside a checkout transaction to roll it back with a user-facing reason. */
class CheckoutRejected extends \RuntimeException
{
    public function __construct(string $message, public readonly string $errorCode)
    {
        parent::__construct($message);
    }
}
