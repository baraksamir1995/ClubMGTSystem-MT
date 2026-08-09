<?php

namespace Tests\Unit;

use App\Http\Controllers\ContentController;
use Tests\TestCase;

/**
 * Tests for ContentController input handling.
 */
class ContentControllerTest extends TestCase
{
    public function test_to_snake_case_converts_camel_case()
    {
        $controller = new ContentController(
            new \App\Services\StorageService()
        );

        $reflection = new \ReflectionClass($controller);
        $method = $reflection->getMethod('toSnakeCase');
        $method->setAccessible(true);

        $input = ['tagColor' => '#FF0000', 'actionType' => 'link', 'sortOrder' => 1];
        $result = $method->invoke($controller, $input);

        $this->assertEquals('#FF0000', $result['tag_color']);
        $this->assertEquals('link', $result['action_type']);
        $this->assertEquals(1, $result['sort_order']);
    }

    public function test_to_snake_case_preserves_already_snake_case()
    {
        $controller = new ContentController(
            new \App\Services\StorageService()
        );

        $reflection = new \ReflectionClass($controller);
        $method = $reflection->getMethod('toSnakeCase');
        $method->setAccessible(true);

        $input = ['gym_id' => 'test', 'created_at' => 'now'];
        $result = $method->invoke($controller, $input);

        $this->assertEquals('test', $result['gym_id']);
        $this->assertEquals('now', $result['created_at']);
    }

    public function test_content_tables_map_correctly()
    {
        $reflection = new \ReflectionClass(ContentController::class);
        $prop = $reflection->getConstant('TABLES');

        $this->assertEquals(
            [
                'banners' => 'gym_banners',
                'partners' => 'gym_partners',
                'popups' => 'gym_popups',
            ],
            $prop,
        );
    }
}
