<?php

namespace App\Services;

/**
 * A recurring-expense action that isn't valid for the schedule's current
 * state (e.g. resuming an active schedule). Rendered as a 422 by the
 * controller; the message is safe to show to the admin.
 */
class LifecycleException extends \RuntimeException
{
}
