'use client';

import { useEffect } from 'react';
import { setGymTimezone } from '@/lib/time';

/**
 * Sets the gym timezone for all time formatting functions.
 * Rendered once in the dashboard layout.
 */
export default function GymTimezoneProvider({ timezone }: { timezone: string }) {
  useEffect(() => {
    setGymTimezone(timezone);
  }, [timezone]);
  return null;
}
