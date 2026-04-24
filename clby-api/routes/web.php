<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'service' => 'CLBY API',
        'status' => 'ok',
        'version' => '1.0.0',
    ]);
});

// Email verification link handler (from Resend emails)
Route::get('/auth/verify', function (\Illuminate\Http\Request $request) {
    $token = $request->query('token', '');
    $type = $request->query('type', 'signup');
    $redirectTo = $request->query('redirect_to', 'gymapp://email-confirmed');

    if (empty($token)) {
        return response('Invalid verification link.', 400);
    }

    $tokenHash = hash('sha256', $token);

    if ($type === 'signup') {
        $record = DB::table('email_verification_tokens')
            ->where('token', $tokenHash)
            ->where('expires_at', '>', now())
            ->first();

        if (! $record) {
            return response('Verification link is invalid or expired.', 422);
        }

        DB::table('profiles')
            ->where('id', $record->user_id)
            ->update(['email_verified' => true, 'updated_at' => now()]);

        DB::table('email_verification_tokens')->where('user_id', $record->user_id)->delete();

        return redirect()->away($redirectTo);
    }

    // Password reset link — just redirect to app with token in URL
    if ($type === 'recovery') {
        return redirect()->away($redirectTo . '?token=' . urlencode($token));
    }

    return response('Unknown verification type.', 400);
});
