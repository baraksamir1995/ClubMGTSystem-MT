<?php

namespace Tests\Feature;

use Tests\TestCase;

class AuthMiddlewareTest extends TestCase
{
    public function test_protected_route_without_token_returns_401(): void
    {
        $response = $this->getJson('/api/branches');
        $response->assertStatus(401);
    }

    public function test_admin_route_without_token_returns_401(): void
    {
        $response = $this->getJson('/api/dashboard/stats');
        $response->assertStatus(401);
    }

    public function test_unauthenticated_response_body_is_correct(): void
    {
        $response = $this->getJson('/api/branches');
        $response->assertStatus(401);
        $response->assertJson(['message' => 'Unauthenticated.']);
    }
}
