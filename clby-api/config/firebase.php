<?php

/*
 * Firebase Cloud Messaging credentials.
 *
 * FCM tokens are bound to the Firebase project of the app install that
 * produced them. The CLBY marketplace app and the Shift white-label app
 * both live in the default project; The Barn and AlfaG ship as separate
 * Firebase projects, so pushes to their installs must be sent with that
 * project's service account.
 *
 * Each value is an absolute path to a Google service-account JSON file.
 * Missing/unset paths simply disable that project's sends (PushService
 * falls back to the default project, or no-ops entirely).
 */
return [

    // CLBY marketplace + Shift (Firebase project club-management-system-e2de0)
    'default' => env('FIREBASE_CREDENTIALS'),

    // Per-gym white-label Firebase projects, keyed by gym_id.
    'brands' => [
        // The Barn (Firebase project the-barn-62e5e)
        '288c4496-8538-4539-94ec-7d0619f6a644' => env('FIREBASE_CREDENTIALS_THE_BARN'),

        // AlfaG (Firebase project alfag-clby)
        '0d214067-cba7-4979-b54e-46404ad3233f' => env('FIREBASE_CREDENTIALS_ALFAG'),
    ],

];
