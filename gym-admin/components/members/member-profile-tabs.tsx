'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import AttendanceTab from './attendance-tab';
import PaymentHistoryTab from './payment-history-tab';
import SessionTransfersList from './session-transfers-list';
import type { MemberPayment } from './payment-history-tab';
import type { AttendanceLog } from '@/lib/types/attendance-log';
import { Badge, Tabs } from '@/components/ui';

interface Props {
  attendanceLogs: AttendanceLog[];
  membershipStart: string | null;
  membershipEnd: string | null;
  planName: string | null;
  overviewContent: React.ReactNode;
  payments: MemberPayment[];
  memberName: string;
  memberNumber: string;
  gymMemberId: string;
}

type TabId = 'overview' | 'payments' | 'attendance' | 'transfers';

export default function MemberProfileTabs({
  attendanceLogs,
  membershipStart,
  membershipEnd,
  planName,
  overviewContent,
  payments,
  memberName,
  memberNumber,
  gymMemberId,
}: Props) {
  const t = useTranslations('members.tabs');
  const [active, setActive] = useState<TabId>('overview');

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview',   label: t('overview') },
    { id: 'payments',   label: t('payments') },
    { id: 'attendance', label: t('attendance') },
    { id: 'transfers',  label: t('transfers') },
  ];

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <Tabs value={active} onValueChange={(v) => setActive(v as TabId)}>
        <Tabs.List>
          {tabs.map(tab => (
            <Tabs.Trigger key={tab.id} value={tab.id}>
              {tab.label}
              {tab.id === 'attendance' && (
                <Badge variant="neutral" size="sm" className="ms-1.5">{attendanceLogs.length}</Badge>
              )}
              {tab.id === 'payments' && payments.length > 0 && (
                <Badge variant="neutral" size="sm" className="ms-1.5">{payments.length}</Badge>
              )}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs>

      {/* Content */}
      {active === 'overview' && overviewContent}
      {active === 'payments' && (
        <PaymentHistoryTab
          payments={payments}
          memberName={memberName}
          memberNumber={memberNumber}
        />
      )}
      {active === 'attendance' && (
        <AttendanceTab
          logs={attendanceLogs}
          membershipStart={membershipStart}
          membershipEnd={membershipEnd}
          planName={planName}
        />
      )}
      {active === 'transfers' && (
        <SessionTransfersList gymMemberId={gymMemberId} />
      )}
    </div>
  );
}
