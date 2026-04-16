<?php

namespace Tests\Unit;

use App\Http\Middleware\SecurityHeaders;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Tests\TestCase;

class SecurityHeadersTest extends TestCase
{
    public function test_removes_x_powered_by_header()
    {
        $middleware = new SecurityHeaders();
        $request = Request::create('/test', 'GET');

        $response = $middleware->handle($request, fn () => new JsonResponse(['ok' => true]));

        $this->assertNull($response->headers->get('X-Powered-By'));
    }

    public function test_sets_content_security_policy()
    {
        $middleware = new SecurityHeaders();
        $request = Request::create('/test', 'GET');

        $response = $middleware->handle($request, fn () => new JsonResponse(['ok' => true]));

        $csp = $response->headers->get('Content-Security-Policy');
        $this->assertNotNull($csp);
        $this->assertStringContainsString("default-src 'none'", $csp);
        $this->assertStringContainsString("frame-ancestors 'none'", $csp);
    }

    public function test_sets_hsts_header()
    {
        $middleware = new SecurityHeaders();
        $request = Request::create('/test', 'GET');

        $response = $middleware->handle($request, fn () => new JsonResponse(['ok' => true]));

        $hsts = $response->headers->get('Strict-Transport-Security');
        $this->assertNotNull($hsts);
        $this->assertStringContainsString('max-age=', $hsts);
        $this->assertStringContainsString('includeSubDomains', $hsts);
    }

    public function test_sets_x_frame_options_deny()
    {
        $middleware = new SecurityHeaders();
        $request = Request::create('/test', 'GET');

        $response = $middleware->handle($request, fn () => new JsonResponse(['ok' => true]));

        $this->assertEquals('DENY', $response->headers->get('X-Frame-Options'));
    }

    public function test_sets_x_content_type_options()
    {
        $middleware = new SecurityHeaders();
        $request = Request::create('/test', 'GET');

        $response = $middleware->handle($request, fn () => new JsonResponse(['ok' => true]));

        $this->assertEquals('nosniff', $response->headers->get('X-Content-Type-Options'));
    }
}
