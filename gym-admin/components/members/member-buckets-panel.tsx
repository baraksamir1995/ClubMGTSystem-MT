import { CreditCard, ArrowDownLeft } from 'lucide-react';

interface Membership {
  id: string;
  source_type?: 'subscription' | 'transfer' | null;
  transferred_from?: string | null;
  status?: string;
  payment_status?: string;
  start_date?: string | null;
  end_date?: string | null;
  sessions_total?: number | null;
  sessions_remaining?: number | null;
  sessions_used?: number | null;
  branch_id?: string | null;
  allowed_branch_ids?: string[] | null;
  plan?: { name?: string; plan_type?: string } | null;
  membership_plans?: { name?: string; plan_type?: string } | null;
}

interface Props {
  memberships: Membership[];
}

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB') : '—';

const isActive = (m: Membership) => {
  if (m.status !== 'active' || m.payment_status !== 'paid') return false;
  if (!m.end_date) return true;
  return new Date(m.end_date).getTime() >= Date.now() - 86_400_000;
};

const sourceOf = (m: Membership): 'subscription' | 'transfer' => {
  if (m.source_type === 'transfer' || m.source_type === 'subscription') return m.source_type;
  return m.transferred_from ? 'transfer' : 'subscription';
};

function BucketRow({ m }: { m: Membership }) {
  const plan = m.plan ?? m.membership_plans ?? null;
  const remaining = m.sessions_total === null
    ? '∞'
    : m.sessions_remaining ?? 0;
  return (
    <div className="flex items-start justify-between py-3 border-b border-gray-700/50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white truncate">{plan?.name ?? '—'}</p>
        <p className="text-xs text-gray-500 capitalize mt-0.5">{plan?.plan_type ?? ''}</p>
      </div>
      <div className="text-right ml-4 shrink-0">
        <p className="text-sm font-semibold text-white">
          {remaining} <span className="text-xs font-normal text-gray-500">remaining</span>
        </p>
        <p className="text-xs text-gray-500 mt-0.5">Expires {fmtDate(m.end_date)}</p>
      </div>
    </div>
  );
}

export default function MemberBucketsPanel({ memberships }: Props) {
  const active = memberships.filter(isActive);
  if (active.length === 0) return null;

  const original = active.filter(m => sourceOf(m) === 'subscription');
  const transferred = active.filter(m => sourceOf(m) === 'transfer');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <CreditCard className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-white">Original Sessions</h2>
          {original.length > 0 && (
            <span className="ml-auto text-xs text-gray-500">
              {original.length} bucket{original.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {original.length === 0 ? (
          <p className="text-sm text-gray-500">No active subscription.</p>
        ) : (
          <div>{original.map(m => <BucketRow key={m.id} m={m} />)}</div>
        )}
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">Transferred Sessions</h2>
          {transferred.length > 0 && (
            <span className="ml-auto text-xs text-gray-500">
              {transferred.length} bucket{transferred.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {transferred.length === 0 ? (
          <p className="text-sm text-gray-500">No transferred sessions.</p>
        ) : (
          <div>{transferred.map(m => <BucketRow key={m.id} m={m} />)}</div>
        )}
      </div>
    </div>
  );
}
