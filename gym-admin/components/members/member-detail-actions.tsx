'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CreditCard, ArrowLeftRight, CalendarPlus, Plus, Snowflake, Play, Unlink } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import AssignPlanModal from './assign-plan-modal';
import TransferModal from './transfer-modal';
import ExtendMembershipModal from './extend-membership-modal';
import AddSessionsModal from './add-sessions-modal';
import FreezeMembershipModal from './freeze-membership-modal';
import { Button } from '@/components/ui';

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
  const t = useTranslations('members.actions');
  const tc = useTranslations('common');
  const router = useRouter();
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
        throw new Error(body.error ?? t('toast.detachFailed'));
      }
      toast.success(t('toast.planDetached'));
      router.refresh();
    } catch (err: any) {
      toast.error(err.message ?? tc('somethingWrong'));
      setDetachConfirm(false);
    } finally {
      setDetaching(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {hasSessions && (
          <Button variant="secondary" onClick={() => setAddModal(true)} leftIcon={<Plus className="w-4 h-4" />}>
            {t('addSessions')}
          </Button>
        )}
        {hasDuration && (
          <Button variant="secondary" onClick={() => setExtendModal(true)} leftIcon={<CalendarPlus className="w-4 h-4" />}>
            {t('extend')}
          </Button>
        )}
        {freezeEnabled && isFrozen && (
          <button
            onClick={() => setFreezeModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-sm font-medium rounded-lg transition-colors"
          >
            <Play className="w-4 h-4" />
            {t('unfreeze')}
          </button>
        )}
        {freezeEnabled && !isFrozen && (
          <button
            onClick={() => !quotaExhausted && setFreezeModal(true)}
            disabled={quotaExhausted}
            title={quotaExhausted ? (daysExhausted ? t('allFreezeDaysUsed') : t('maxFreezeCountReached')) : undefined}
            className={`flex items-center gap-2 px-4 py-2 border text-sm font-medium rounded-lg transition-colors ${
              quotaExhausted
                ? 'bg-blue-600/5 text-blue-400/40 border-blue-500/15 cursor-not-allowed'
                : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border-blue-500/30'
            }`}
          >
            <Snowflake className="w-4 h-4" />
            {t('freeze')}
          </button>
        )}
        <Button variant="secondary" onClick={() => setTransferModal(true)} leftIcon={<ArrowLeftRight className="w-4 h-4" />}>
          {t('transfer')}
        </Button>
        {activeMembership && (
          detachConfirm ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-danger font-medium">{t('removePlan')}</span>
              <Button variant="danger" size="sm" onClick={detachPlan} isLoading={detaching}>
                {tc('confirm')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setDetachConfirm(false)} disabled={detaching}>
                {tc('cancel')}
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setDetachConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-danger-soft hover:bg-danger/25 text-danger border border-danger/30 text-sm font-medium rounded-lg transition-colors"
            >
              <Unlink className="w-4 h-4" />
              {t('detachPlan')}
            </button>
          )
        )}
        <Button variant="primary" onClick={() => setplanModal(true)} leftIcon={<CreditCard className="w-4 h-4" />}>
          {currentPlanId ? t('changePlan') : t('assignPlan')}
        </Button>
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
