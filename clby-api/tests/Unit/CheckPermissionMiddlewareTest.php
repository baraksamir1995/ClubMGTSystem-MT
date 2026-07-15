<?php

namespace Tests\Unit;

use App\Http\Middleware\CheckPermission;
use App\Http\Middleware\RequireAdminRole;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Tests\TestCase;

class CheckPermissionMiddlewareTest extends TestCase
{
    public function test_gym_admin_bypasses_all_permission_checks()
    {
        $middleware = new CheckPermission();

        $user = new \stdClass();
        $user->role = 'gym_admin';
        $user->id = 'test-id';
        $user->gym_id = 'gym-id';
        $user->is_active = true;

        $request = Request::create('/test', 'POST');
        $request->setUserResolver(fn () => $user);

        $response = $middleware->handle($request, fn ($r) => new JsonResponse(['ok' => true]), 'members', 'create');

        $this->assertEquals(200, $response->getStatusCode());
        $this->assertEquals(['ok' => true], $response->getData(true));
    }

    public function test_require_admin_role_blocks_member_role()
    {
        $middleware = new RequireAdminRole();

        $user = new \stdClass();
        $user->role = 'member';

        $request = Request::create('/test', 'GET');
        $request->setUserResolver(fn () => $user);

        $response = $middleware->handle($request, fn ($r) => new JsonResponse(['ok' => true]));

        $this->assertEquals(403, $response->getStatusCode());
    }

    public function test_require_admin_role_allows_gym_admin()
    {
        $middleware = new RequireAdminRole();

        $user = new \stdClass();
        $user->role = 'gym_admin';

        $request = Request::create('/test', 'GET');
        $request->setUserResolver(fn () => $user);

        $response = $middleware->handle($request, fn ($r) => new JsonResponse(['ok' => true]));

        $this->assertEquals(200, $response->getStatusCode());
    }

    public function test_require_admin_role_allows_staff()
    {
        $middleware = new RequireAdminRole();

        $user = new \stdClass();
        $user->role = 'staff';

        $request = Request::create('/test', 'GET');
        $request->setUserResolver(fn () => $user);

        $response = $middleware->handle($request, fn ($r) => new JsonResponse(['ok' => true]));

        $this->assertEquals(200, $response->getStatusCode());
    }

    public function test_require_admin_role_allows_trainer()
    {
        $middleware = new RequireAdminRole();

        $user = new \stdClass();
        $user->role = 'trainer';

        $request = Request::create('/test', 'GET');
        $request->setUserResolver(fn () => $user);

        $response = $middleware->handle($request, fn ($r) => new JsonResponse(['ok' => true]));

        $this->assertEquals(200, $response->getStatusCode());
    }

    public function test_require_admin_role_blocks_null_user()
    {
        $middleware = new RequireAdminRole();

        $request = Request::create('/test', 'GET');
        $request->setUserResolver(fn () => null);

        $response = $middleware->handle($request, fn ($r) => new JsonResponse(['ok' => true]));

        $this->assertEquals(403, $response->getStatusCode());
    }
}
