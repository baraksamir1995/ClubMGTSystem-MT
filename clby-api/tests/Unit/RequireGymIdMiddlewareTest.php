<?php

namespace Tests\Unit;

use App\Http\Middleware\RequireGymId;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Tests\TestCase;

class RequireGymIdMiddlewareTest extends TestCase
{
    public function test_blocks_user_without_gym_id()
    {
        $middleware = new RequireGymId();

        $user = new \stdClass();
        $user->gym_id = null;

        $request = Request::create('/test', 'GET');
        $request->setUserResolver(fn () => $user);

        $response = $middleware->handle($request, fn () => new JsonResponse(['ok' => true]));

        $this->assertEquals(403, $response->getStatusCode());
    }

    public function test_allows_user_with_gym_id()
    {
        $middleware = new RequireGymId();

        $user = new \stdClass();
        $user->gym_id = 'some-gym-id';

        $request = Request::create('/test', 'GET');
        $request->setUserResolver(fn () => $user);

        $response = $middleware->handle($request, fn () => new JsonResponse(['ok' => true]));

        $this->assertEquals(200, $response->getStatusCode());
    }

    public function test_blocks_null_user()
    {
        $middleware = new RequireGymId();

        $request = Request::create('/test', 'GET');
        $request->setUserResolver(fn () => null);

        $response = $middleware->handle($request, fn () => new JsonResponse(['ok' => true]));

        $this->assertEquals(403, $response->getStatusCode());
    }
}
