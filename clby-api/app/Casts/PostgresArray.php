<?php

namespace App\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

class PostgresArray implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): ?array
    {
        if ($value === null) {
            return null;
        }

        // Parse PostgreSQL array literal: {val1,val2,"val with spaces"}
        $value = trim($value, '{}');

        if ($value === '') {
            return [];
        }

        // Handle quoted and unquoted elements
        preg_match_all('/"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"|([^,]+)/', $value, $matches);

        $result = [];
        foreach ($matches[0] as $i => $match) {
            if ($matches[1][$i] !== '') {
                $result[] = str_replace('\\"', '"', $matches[1][$i]);
            } else {
                $result[] = $matches[2][$i];
            }
        }

        return $result;
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null) {
            return null;
        }

        if (is_string($value)) {
            // Already a Postgres array literal or JSON — try to decode JSON
            $decoded = json_decode($value, true);
            if (is_array($decoded)) {
                $value = $decoded;
            } else {
                return $value;
            }
        }

        if (!is_array($value)) {
            return null;
        }

        // Convert PHP array to PostgreSQL array literal
        $escaped = array_map(function ($item) {
            $item = str_replace('"', '\\"', (string) $item);
            return '"' . $item . '"';
        }, $value);

        return '{' . implode(',', $escaped) . '}';
    }
}
