/**
 * Member-scoped attendance log row, as eager-loaded from Laravel under
 * `member.attendance_logs`. Both `branch` (Eloquent) and `branches` (legacy
 * Supabase nested shape) are accepted — consumers fall back between them.
 *
 * Distinct from the gym-wide log shape in
 * `app/dashboard/attendance/page.tsx`, which has flat `branch_name` etc.
 */
export interface AttendanceLog {
  id: string;
  check_in_at: string;
  method: string | null;
  access_point: string | null;
  branch_id: string | null;
  branch?: { name: string } | null;
  branches?: { name: string } | { name: string }[] | null;
}
