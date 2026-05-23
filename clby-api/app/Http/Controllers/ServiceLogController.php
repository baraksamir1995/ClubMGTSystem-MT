<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Read-only listing of every coach-logged session for the gym, used by
 * the admin's Services → Services Log tab.
 *
 * Each row is a `service_session_logs` entry joined to the assignment
 * (package name / sessions_total), the package definition (price /
 * currency → per-session price), the trainer (name + branch), and the
 * member (name + email + member_number).
 *
 * Filters: q (search across member name / email / member_number /
 * gym_member uuid), trainer_id, branch_id. Pagination: limit/offset.
 */
class ServiceLogController extends Controller
{
    /**
     * Shared query builder for both `index` (paginated JSON) and
     * `export` (CSV stream). Returns the base join + filters applied;
     * the caller adds the column projection, ordering, and pagination
     * (or a chunked stream for export).
     */
    private function buildQuery(Request $request, array $validated): \Illuminate\Database\Query\Builder
    {
        $gymId = $request->user()->gym_id;
        $base = DB::table('service_session_logs AS l')
            ->where('l.gym_id', $gymId)
            ->leftJoin('member_service_assignments AS a', 'a.id', '=', 'l.assignment_id')
            ->leftJoin('service_session_packages   AS p', 'p.id', '=', 'a.service_package_id')
            ->leftJoin('trainer_profiles           AS tp', 'tp.id', '=', 'l.trainer_id')
            ->leftJoin('gym_members                AS gm', 'gm.id', '=', 'l.gym_member_id')
            ->leftJoin('profiles                   AS pr', 'pr.id', '=', 'gm.user_id');

        if (! empty($validated['trainer_id'])) {
            $base->where('l.trainer_id', $validated['trainer_id']);
        }
        if (! empty($validated['branch_id'])) {
            $base->where('tp.branch_id', $validated['branch_id']);
        }
        if (! empty($validated['q'])) {
            $q   = strtolower(trim($validated['q']));
            $num = ctype_digit($q) ? (int) $q : null;
            $base->where(function ($w) use ($q, $num) {
                $w->whereRaw('LOWER(pr.full_name) LIKE ?', ['%'.$q.'%'])
                  ->orWhereRaw('LOWER(pr.email) LIKE ?',     ['%'.$q.'%']);
                if ($num !== null) {
                    $w->orWhere('gm.member_number', $num);
                }
                // Allow searching by the gym_members UUID prefix too —
                // admins often paste an id directly from a URL.
                $w->orWhereRaw("CAST(gm.id AS TEXT) LIKE ?", [$q.'%']);
            });
        }

        return $base;
    }

    private const SELECT_COLUMNS = [
        'l.id AS log_id',
        'l.delivered_at',
        'l.note',
        'a.id AS assignment_id',
        'a.package_name',
        'a.sessions_total',
        'p.price AS package_price',
        'p.currency AS package_currency',
        'p.session_count AS package_session_count',
        'tp.id AS trainer_id',
        'tp.name AS trainer_name',
        'tp.trainer_type',
        'tp.branch_id',
        'gm.id AS gym_member_id',
        'gm.member_number',
        'pr.full_name AS member_name',
        'pr.email AS member_email',
    ];

    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q'          => 'nullable|string|max:128',
            'trainer_id' => 'nullable|uuid',
            'branch_id'  => 'nullable|uuid',
            'limit'      => 'nullable|integer|min:1|max:200',
            'offset'     => 'nullable|integer|min:0',
        ]);
        $limit  = (int) ($validated['limit']  ?? 10);
        $offset = (int) ($validated['offset'] ?? 0);

        $base   = $this->buildQuery($request, $validated);
        $total  = (clone $base)->count('l.id');

        $rows = $base
            ->orderByDesc('l.delivered_at')
            ->limit($limit)
            ->offset($offset)
            ->get(self::SELECT_COLUMNS);

        // Compute per-session price: prefer the package definition
        // (price ÷ session_count), fall back to assignment.sessions_total
        // when the package has been edited since the assignment was made.
        $data = $rows->map(function ($r) {
            $pkgCount = (int) ($r->package_session_count ?? $r->sessions_total ?? 0);
            $perSession = ($pkgCount > 0 && $r->package_price !== null)
                ? round((float) $r->package_price / $pkgCount, 2)
                : null;
            return [
                'log_id'        => $r->log_id,
                'delivered_at'  => $r->delivered_at,
                'note'          => $r->note,
                'member' => [
                    'id'            => $r->gym_member_id,
                    'name'          => $r->member_name,
                    'email'         => $r->member_email,
                    'member_number' => $r->member_number,
                ],
                'specialist' => [
                    'id'           => $r->trainer_id,
                    'name'         => $r->trainer_name,
                    'trainer_type' => $r->trainer_type,
                    'branch_id'    => $r->branch_id,
                ],
                'package' => [
                    'assignment_id'    => $r->assignment_id,
                    'name'             => $r->package_name,
                    'sessions_total'   => (int) ($r->sessions_total ?? 0),
                    'price'            => $r->package_price !== null ? (float) $r->package_price : null,
                    'currency'         => $r->package_currency,
                    'price_per_session'=> $perSession,
                ],
            ];
        });

        return response()->json([
            'data'  => $data,
            'total' => $total,
            'limit' => $limit,
            'offset' => $offset,
        ]);
    }

    /**
     * CSV export honoring the same filter set as `index`. Streamed in
     * 500-row chunks via Symfony's StreamedResponse so a busy gym can
     * pull months of history without blowing the request memory limit.
     * Capped at 10k rows defensively.
     */
    public function export(Request $request): StreamedResponse
    {
        $validated = $request->validate([
            'q'          => 'nullable|string|max:128',
            'trainer_id' => 'nullable|uuid',
            'branch_id'  => 'nullable|uuid',
        ]);

        $base = $this->buildQuery($request, $validated)
            ->select(self::SELECT_COLUMNS)
            ->orderBy('l.delivered_at', 'desc')
            // chunk() needs a stable secondary order so the cursor is
            // deterministic across batches when several logs share a
            // timestamp.
            ->orderBy('l.id', 'desc');

        $filename = 'services-log-'.date('Y-m-d-Hi').'.csv';

        return new StreamedResponse(function () use ($base) {
            $out = fopen('php://output', 'w');
            // Excel-compatible header so non-ASCII member names render
            // correctly when the file is opened on Windows.
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, [
                'Date',
                'Time',
                'Member name',
                'Member email',
                'Member number',
                'Specialist name',
                'Specialist type',
                'Package name',
                'Sessions in package',
                'Package price',
                'Price per session',
                'Currency',
                'Note',
            ]);

            $emitted = 0;
            $chunk   = 500;
            $cap     = 10000;
            $base->chunk($chunk, function ($rows) use ($out, &$emitted, $cap) {
                foreach ($rows as $r) {
                    if ($emitted >= $cap) return false; // stop chunking
                    $pkgCount = (int) ($r->package_session_count ?? $r->sessions_total ?? 0);
                    $perSession = ($pkgCount > 0 && $r->package_price !== null)
                        ? round((float) $r->package_price / $pkgCount, 2)
                        : null;
                    $dt = $r->delivered_at;
                    // delivered_at comes back as either "Y-m-d H:i:sP" or
                    // a Carbon instance depending on driver; normalise.
                    if (! ($dt instanceof \DateTimeInterface)) {
                        $dt = new \DateTimeImmutable($dt);
                    }
                    fputcsv($out, [
                        $dt->format('Y-m-d'),
                        $dt->format('H:i'),
                        $r->member_name,
                        $r->member_email,
                        $r->member_number,
                        $r->trainer_name,
                        $r->trainer_type,
                        $r->package_name,
                        $r->sessions_total,
                        $r->package_price,
                        $perSession,
                        $r->package_currency,
                        $r->note,
                    ]);
                    $emitted++;
                }
                return null;
            });

            fclose($out);
        }, 200, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"$filename\"",
            'Cache-Control'       => 'no-store',
        ]);
    }
}
