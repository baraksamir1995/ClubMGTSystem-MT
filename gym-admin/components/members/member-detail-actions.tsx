'use client';

import { useState } from 'react';
import { CreditCard, ArrowLeftRight, CalendarPlus, Plus, Snowflake, Play, Unlink } from 'lucide-react';
import toast from 'react-hot-toast';
import AssignPlanModal from './assign-plan-modal';
import TransferModal from './transfer-modal';
import ExtendMembershipModal from './extend-membership-modal';
import AddSessionsModal from './add-sessions-modal';
import FreezeMembershipModal from './freeze-membership-modal';

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  plan_type: string;
  duration_days: number | null;
  session_count: number | null;
}

interface GymMember {
  id: string;
  member_number: string;
  full_name: string | null;
  email: string | null;
}

interface ActiveMembership {
  id: string;
  plan_name: string;
  plan_type: string;
  end_date: string | null;
  sessions_used: number;
  sessions_total: number | null;
  sessions_remaining: number | null;
  freeze_enabled: boolean;
  freeze_status: string | null;
  freeze_days_used: number;
  freeze_max_days: number | null;
  freeze_count: number;
  freeze_max_count: number | null;
  frozen_until: string | null;
}

interface Props {
  memberId: string;
  memberName: string;
  plans: Plan[];
  currentPlanId?: string | null;
  activeMembership: ActiveMembership | null;
  gymMembers: GymMember[];
}

export default function MemberDetailActions({
  memberId,
  memberName,
  plans,
  currentPlanId,
  activeMembership,
  gymMembers,
}: Props) {
  const [planModal, setplanModal]         = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [extendModal, setExtendModal]     = useState(false);
  const [addModal, setAddModal]           = useState(false);
  const [freezeModal, setFreezeModal]     = useState(false);
  const [detachConfirm, setDetachConfirm] = useState(false);
  const [detaching, setDetaching]         = useState(false);

  const hasDuration = activeMembership &&
    ['monthly', 'annual', 'duration', 'duration_session'].includes(activeMembership.plan_type);
  const hasSessions = activeMembership &&
    ['sessions', 'duration_session'].includes(activeMembership.plan_type);
  const isFrozen = activeMembership?.freeze_status === 'frozen';

  const freezeEnabled = !!(activeMembership?.freeze_enabled && hasDuration);
  const daysExhausted  = activeMembership?.freeze_max_days  != null && activeMembership.freeze_days_used >= activeMembership.freeze_max_days;
  const countExhausted = activeMembership?.freeze_max_count != null && activeMembership.freeze_count    >= activeMembership.freeze_max_count;
  const quotaExhausted = daysExhausted || countExhausted;

  async function detachPlan() {
    setDetaching(true);
    try {
      const res = await fetch(`/api/members/${memberId}/membership/detach`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Failed to detach plan');
      }
      toast.success('Plan detached. Member set to inactive.');
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message ?? 'Something went wrong');
      setDetachConfirm(false);
    } finally {
      setDetaching(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {hasSessions && (
          <button
            onClick={() => setAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Sessions
          </button>
        )}
        {hasDuration && (
          <button
            onClick={() => setExtendModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <CalendarPlus className="w-4 h-4" />
            Extend
          </button>
        )}
        {freezeEnabled && isFrozen && (
          <button
            onClick={() => setFreezeModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-sm font-medium rounded-lg transition-colors"
          >
            <Play className="w-4 h-4" />
            Unfreeze
          </button>
        )}
        {freezeEnabled && !isFrozen && (
          <button
            onClick={() => !quotaExhausted && setFreezeModal(true)}
            disabled={quotaExhausted}
            title={quotaExhausted ? (daysExhausted ? 'All freeze days used' : 'Max freeze count reached') : undefined}
            className={`flex items-center gap-2 px-4 py-2 border text-sm font-medium rounded-lg transition-colors ${
              quotaExhausted
                ? 'bg-blue-600/5 text-blue-400/40 border-blue-500/15 cursor-not-allowed'
                : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border-blue-500/30'
            }`}
          >
            <Snowflake className="w-4 h-4" />
            Freeze
          </button>
        )}
        <button
          onClick={() => setTransferModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <ArrowLeftRight className="w-4 h-4" />
          Transfer
        </button>
        {activeMembership && (
          detachConfirm ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-red-400 font-medium">Remove plan?</span>
              <button
                onClick={detachPlan}
                disabled={detaching}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                {detaching ? 'Removing…' : 'Confirm'}
              </button>
              <button
                onClick={() => setDetachConfirm(false)}
                disabled={detaching}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDetachConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600/15 hover:bg-red-600/25 text-red-400 border border-red-500/30 text-sm font-medium rounded-lg transition-colors"
            >
              <Unlink className="w-4 h-4" />
              Detach Plan
            </button>
          )
        )}
        <button
          onClick={() => setplanModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <CreditCard className="w-4 h-4" />
          {currentPlanId ? 'Change Plan' : 'Assign Plan'}
        </button>
      </div>

      {planModal && (
        <AssignPlanModal
          memberId={memberId}
          plans={plans}
          currentPlanId={currentPlanId}
          onClose={() => setplanModal(false)}
        />
      )}
      {transferModal && (
        <TransferModal
          sourceMemberId={memberId}
          sourceMemberName={memberName}
          activeMembership={activeMembership ? {
            plan_name: activeMembership.plan_name,
            end_date: activeMembership.end_date,
            sessions_remaining: activeMembership.sessions_remaining,
          } : null}
          gymMembers={gymMembers}
          onClose={() => setTransferModal(false)}
        />
      )}
      {extendModal && activeMembership && (
        <ExtendMembershipModal
          membershipId={activeMembership.id}
          memberName={memberName}
          currentExpiry={activeMembership.end_date}
          onClose={() => setExtendModal(false)}
        />
      )}
      {addModal && activeMembership && (
        <AddSessionsModal
          membershipId={activeMembership.id}
          memberName={memberName}
          sessionsUsed={activeMembership.sessions_used}
          sessionsTotal={activeMembership.sessions_total}
          onClose={() => setAddModal(false)}
        />
      )}
      {freezeModal && activeMembership && (
        <FreezeMembershipModal
          membership={activeMembership}
          memberName={memberName}
          onClose={() => setFreezeModal(false)}
        />
      )}
    </>
  );
}
