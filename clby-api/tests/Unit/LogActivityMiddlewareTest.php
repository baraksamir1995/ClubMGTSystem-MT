<?php

namespace Tests\Unit;

use App\Http\Middleware\LogActivityMiddleware;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Tests\TestCase;

class LogActivityMiddlewareTest extends TestCase
{
    private LogActivityMiddleware $middleware;

    protected function setUp(): void
    {
        parent::setUp();
        $this->middleware = new LogActivityMiddleware();
    }

    public function test_skips_logging_for_get_requests()
    {
        $request = Request::create('/api/members', 'GET');
        $request->setUserResolver(fn () => null);

        $called = false;
        $response = $this->middleware->handle($request, function ($r) use (&$called) {
            $called = true;
            return new JsonResponse(['data' => []], 200);
        });

        $this->assertTrue($called);
        $this->assertEquals(200, $response->getStatusCode());
    }

    public function test_skips_logging_for_failed_responses()
    {
        $user = new \stdClass();
        $user->gym_id = 'gym-id';

        $request = Request::create('/api/members', 'POST');
        $request->setUserResolver(fn () => $user);

        $response = $this->middleware->handle($request, function ($r) {
            return new JsonResponse(['error' => 'bad'], 422);
        });

        $this->assertEquals(422, $response->getStatusCode());
    }

    public function test_detects_module_from_path()
    {
        $middleware = new LogActivityMiddleware();
        $reflection = new \ReflectionClass($middleware);
        $method = $reflection->getMethod('detectModule');
        $method->setAccessible(true);

        $this->assertEquals('members', $method->invoke($middleware, 'api/members'));
        $this->assertEquals('members', $method->invoke($middleware, 'api/memberships'));
        $this->assertEquals('payments', $method->invoke($middleware, 'api/payments'));
        $this->assertEquals('classes', $method->invoke($middleware, 'api/classes'));
        $this->assertEquals('classes', $method->invoke($middleware, 'api/sessions'));
        $this->assertEquals('classes', $method->invoke($middleware, 'api/bookings'));
        $this->assertEquals('promotions', $method->invoke($middleware, 'api/promo-codes'));
        $this->assertEquals('attendance', $method->invoke($middleware, 'api/attendance'));
        $this->assertEquals('settings', $method->invoke($middleware, 'api/branches'));
        $this->assertEquals('settings', $method->invoke($middleware, 'api/studios'));
        $this->assertEquals('content', $method->invoke($middleware, 'api/content'));
        $this->assertEquals('staff', $method->invoke($middleware, 'api/staff'));
    }

    public function test_detects_action_from_method()
    {
        $middleware = new LogActivityMiddleware();
        $reflection = new \ReflectionClass($middleware);
        $method = $reflection->getMethod('detectAction');
        $method->setAccessible(true);

        $this->assertEquals('create', $method->invoke($middleware, 'POST', 'api/members'));
        $this->assertEquals('update', $method->invoke($middleware, 'PUT', 'api/members/123'));
        $this->assertEquals('update', $method->invoke($middleware, 'PATCH', 'api/members/123'));
        $this->assertEquals('delete', $method->invoke($middleware, 'DELETE', 'api/members/123'));
    }

    public function test_detects_special_actions_from_path()
    {
        $middleware = new LogActivityMiddleware();
        $reflection = new \ReflectionClass($middleware);
        $method = $reflection->getMethod('detectAction');
        $method->setAccessible(true);

        $this->assertEquals('cancel', $method->invoke($middleware, 'POST', 'api/sessions/123/cancel'));
        $this->assertEquals('checkin', $method->invoke($middleware, 'POST', 'api/sessions/123/checkin'));
        $this->assertEquals('freeze', $method->invoke($middleware, 'POST', 'api/memberships/123/freeze'));
        $this->assertEquals('reset_password', $method->invoke($middleware, 'POST', 'api/staff/123/reset-password'));
        $this->assertEquals('publish', $method->invoke($middleware, 'POST', 'api/schedule/publish'));
    }

    public function test_extracts_uuid_from_path()
    {
        $middleware = new LogActivityMiddleware();
        $reflection = new \ReflectionClass($middleware);
        $method = $reflection->getMethod('extractEntityId');
        $method->setAccessible(true);

        $uuid = '550e8400-e29b-41d4-a716-446655440000';
        $this->assertEquals($uuid, $method->invoke($middleware, "api/members/{$uuid}"));
        $this->assertNull($method->invoke($middleware, 'api/members'));
    }
}
