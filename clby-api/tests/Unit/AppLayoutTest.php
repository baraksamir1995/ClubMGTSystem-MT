<?php

namespace Tests\Unit;

use App\Support\AppLayout;
use PHPUnit\Framework\TestCase;

class AppLayoutTest extends TestCase
{
    public function test_null_means_app_default(): void
    {
        $this->assertNull(AppLayout::normalize(null));
        $this->assertNull(AppLayout::normalize('x'));
        $this->assertNull(AppLayout::normalize(42));
    }

    public function test_keeps_order_and_visibility_of_known_keys(): void
    {
        $out = AppLayout::normalize(['home' => [
            ['key' => 'locations', 'visible' => false],
            ['key' => 'banners', 'visible' => true],
        ]]);

        $this->assertSame(['key' => 'locations', 'visible' => false], $out['home'][0]);
        $this->assertSame('banners', $out['home'][1]['key']);
    }

    public function test_drops_unknown_and_duplicate_keys_and_screens(): void
    {
        $out = AppLayout::normalize([
            'home' => [['key' => 'evil'], ['key' => 'activity', 'visible' => false], ['key' => 'activity', 'visible' => true]],
            'settings' => [['key' => 'x']],
        ]);

        $this->assertSame(['home', 'explore'], array_keys($out));
        $keys = array_column($out['home'], 'key');
        $this->assertNotContains('evil', $keys);
        $this->assertSame(1, count(array_keys($keys, 'activity')));
        $this->assertFalse($out['home'][0]['visible']);
    }

    public function test_appends_missing_keys_visible_in_default_order(): void
    {
        $out = AppLayout::normalize(['explore' => [['key' => 'partners', 'visible' => false]]]);

        $this->assertSame(
            ['partners', 'memberships', 'offers', 'trainers', 'services', 'programs', 'session_packages'],
            array_column($out['explore'], 'key'),
        );
        $this->assertTrue($out['explore'][1]['visible']);
        $this->assertSame(AppLayout::SCREENS['home'], array_column($out['home'], 'key'));
    }
}
