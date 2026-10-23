export type GymRequestStatus = 'pending' | 'approved' | 'declined';

const STYLES: Record<GymRequestStatus, string> = {
  pending: 'bg-warning-soft text-warning',
  approved: 'bg-success-soft text-success',
  declined: 'bg-danger-soft text-danger',
};

export function RequestStatusBadge({ status }: { status: GymRequestStatus }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${STYLES[status] ?? 'bg-surface-3 text-fg-muted'}`}>
      {status}
    </span>
  );
}
