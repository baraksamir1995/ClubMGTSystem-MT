/**
 * Reusable helper to insert a staff_activity_logs row.
 * Best-effort — never throws, never blocks the response.
 */
export async function logActivity(opts: {
  admin: any;
  gymId: string;
  userId: string;
  action_type: 'create' | 'update' | 'delete' | 'deactivate' | 'reactivate' | string;
  module: string;
  description: string;
}) {
  try {
    const { data: profile } = await opts.admin
      .from('profiles')
      .select('full_name')
      .eq('id', opts.userId)
      .maybeSingle();

    await opts.admin.from('staff_activity_logs').insert({
      gym_id: opts.gymId,
      staff_name: profile?.full_name ?? 'Admin',
      action_type: opts.action_type,
      module: opts.module,
      description: opts.description,
    });
  } catch {
    // best-effort — never fail the parent request
  }
}
