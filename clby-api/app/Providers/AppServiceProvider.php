<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('auth', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });

        RateLimiter::for('contact', function (Request $request) {
            return Limit::perMinute(10)->by($request->ip());
        });

        // Public gym self-onboarding. Submissions arrive through the landing
        // site's server-side proxy, so $request->ip() is the same for every
        // applicant. When the proxy proves itself (LANDING_PROXY_SECRET) the
        // forwarded client IP is used; otherwise fall back to a broad cap so
        // one shared IP can't be throttled to a standstill by a few requests.
        RateLimiter::for('gym-requests', function (Request $request) {
            $clientIp = \App\Http\Controllers\GymRequestController::trustedClientIp($request);
            return [
                Limit::perHour(5)->by('gym-req-email:' . strtolower(trim((string) $request->input('owner_email')))),
                $clientIp
                    ? Limit::perHour(10)->by('gym-req-client:' . $clientIp)
                    : Limit::perHour(30)->by('gym-req-ip:' . $request->ip()),
            ];
        });
    }
}
