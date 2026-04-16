<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ProgramController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $programs = DB::table('gym_programs')->where('gym_id', $gymId)->orderBy('created_at', 'desc')->get();

        // Convert PG text[] to JSON arrays for frontend
        $programs = $programs->map(fn ($p) => $this->parsePgArrays((array) $p, ['focus_areas']));

        return response()->json(['data' => $programs]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $program = DB::table('gym_programs')->where('id', $id)->where('gym_id', $gymId)->first();
        if (! $program) return response()->json(['error' => 'Not found'], 404);
        return response()->json($this->parsePgArrays((array) $program, ['focus_areas']));
    }

    public function store(Request $request): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $data = $request->only([
            'title', 'description', 'duration_weeks', 'price', 'status',
            'image_url', 'storage_path', 'category', 'difficulty',
            'trainer_name', 'level', 'focus_areas',
            'total_sessions', 'session_duration_minutes', 'schedule_text', 'display_order',
        ]);

        // Convert JSON array to PG text[] format
        if (isset($data['focus_areas']) && is_array($data['focus_areas'])) {
            $data['focus_areas'] = $this->toPgArray($data['focus_areas']);
        }

        $data['id'] = Str::uuid()->toString();
        $data['gym_id'] = $gymId;
        $data['created_at'] = now();
        $data['updated_at'] = now();
        DB::table('gym_programs')->insert($data);

        return response()->json($this->parsePgArrays($data, ['focus_areas']), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        $data = $request->only([
            'title', 'description', 'duration_weeks', 'price', 'status',
            'image_url', 'storage_path', 'category', 'difficulty',
            'trainer_name', 'level', 'focus_areas',
            'total_sessions', 'session_duration_minutes', 'schedule_text', 'display_order',
        ]);

        if (isset($data['focus_areas']) && is_array($data['focus_areas'])) {
            $data['focus_areas'] = $this->toPgArray($data['focus_areas']);
        }

        $data['updated_at'] = now();
        DB::table('gym_programs')->where('id', $id)->where('gym_id', $gymId)->update($data);

        $updated = DB::table('gym_programs')->where('id', $id)->first();
        return response()->json($updated ? $this->parsePgArrays((array) $updated, ['focus_areas']) : ['message' => 'Updated']);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $gymId = $request->user()->gym_id;
        DB::table('gym_programs')->where('id', $id)->where('gym_id', $gymId)->delete();
        return response()->json(['message' => 'Deleted']);
    }

    /**
     * Convert PHP array to PostgreSQL text[] literal: {"a","b","c"}
     */
    private function toPgArray(array $values): string
    {
        return '{' . implode(',', array_map(fn ($v) => '"' . addslashes($v) . '"', $values)) . '}';
    }

    /**
     * Convert PostgreSQL text[] string to PHP array on specified columns.
     */
    private function parsePgArrays(array $row, array $columns): array
    {
        foreach ($columns as $col) {
            if (isset($row[$col]) && is_string($row[$col])) {
                $trimmed = trim($row[$col], '{}');
                $row[$col] = $trimmed === '' ? [] : array_map(fn ($v) => trim($v, '"'), explode(',', $trimmed));
            } elseif (!isset($row[$col])) {
                $row[$col] = [];
            }
        }
        // Cast numeric string columns to floats for JSON serialization
        if (isset($row['price'])) {
            $row['price'] = (float) $row['price'];
        }
        return $row;
    }
}
