<?php

namespace Tests\Feature\Sales;

class DuplicateDetectionTest extends SalesTestCase
{
    public function test_same_phone_returns_409_with_existing_lead(): void
    {
        $gym = $this->makeGym();
        $this->actingAsUser($this->makeAdmin($gym));

        $this->postJson('/api/sales/leads', ['name' => 'First', 'phone' => '01011112222'])
            ->assertStatus(201);

        // Different formatting, same normalized E.164 number.
        $res = $this->postJson('/api/sales/leads', ['name' => 'Second', 'phone' => '+20 101 111 2222']);
        $res->assertStatus(409)
            ->assertJsonPath('error', 'duplicate')
            ->assertJsonPath('existing_lead.name', 'First');

        $this->assertDatabaseCount('sales_leads', 1);
    }

    public function test_same_email_returns_409(): void
    {
        $gym = $this->makeGym();
        $this->actingAsUser($this->makeAdmin($gym));

        $this->postJson('/api/sales/leads', [
            'name' => 'First', 'phone' => '01011112222', 'email' => 'Dupe@Example.com',
        ])->assertStatus(201);

        $this->postJson('/api/sales/leads', [
            'name' => 'Second', 'phone' => '01099998888', 'email' => 'dupe@example.com',
        ])->assertStatus(409);
    }

    public function test_force_creates_despite_duplicate(): void
    {
        $gym = $this->makeGym();
        $this->actingAsUser($this->makeAdmin($gym));

        $this->postJson('/api/sales/leads', ['name' => 'First', 'phone' => '01011112222'])->assertStatus(201);
        $this->postJson('/api/sales/leads', ['name' => 'Second', 'phone' => '01011112222', 'force' => true])
            ->assertStatus(201);

        $this->assertDatabaseCount('sales_leads', 2);
    }

    public function test_duplicate_check_is_scoped_to_the_gym(): void
    {
        $gymA = $this->makeGym();
        $gymB = $this->makeGym();

        $this->actingAsUser($this->makeAdmin($gymA));
        $this->postJson('/api/sales/leads', ['name' => 'A', 'phone' => '01011112222'])->assertStatus(201);

        $this->actingAsUser($this->makeAdmin($gymB));
        $this->postJson('/api/sales/leads', ['name' => 'B', 'phone' => '01011112222'])->assertStatus(201);
    }

    public function test_phone_is_stored_in_e164(): void
    {
        $gym = $this->makeGym();
        $this->actingAsUser($this->makeAdmin($gym));

        $res = $this->postJson('/api/sales/leads', ['name' => 'X', 'phone' => '010 1111-2222']);
        $res->assertStatus(201)->assertJsonPath('data.phone', '+201011112222');
    }
}
