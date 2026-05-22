'use client';

import { useState } from 'react';
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

const tabs = ['Overview', 'Payments', 'Attendance', 'Transfers History'] as const;

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
  const [active, setActive] = useState<typeof tabs[number]>('Overview');

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <Tabs value={active} onValueChange={(v) => setActive(v as typeof tabs[number])}>
        <Tabs.List>
          {tabs.map(tab => (
            <Tabs.Trigger key={tab} value={tab}>
              {tab}
              {tab === 'Attendance' && (
                <Badge variant="neutral" size="sm" className="ml-1.5">{attendanceLogs.length}</Badge>
              )}
              {tab === 'Payments' && payments.length > 0 && (
                <Badge variant="neutral" size="sm" className="ml-1.5">{payments.length}</Badge>
              )}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs>

      {/* Content */}
      {active === 'Overview' && overviewContent}
      {active === 'Payments' && (
        <PaymentHistoryTab
          payments={payments}
          memberName={memberName}
          memberNumber={memberNumber}
        />
      )}
      {active === 'Attendance' && (
        <AttendanceTab
          logs={attendanceLogs}
          membershipStart={membershipStart}
          membershipEnd={membershipEnd}
          planName={planName}
        />
      )}
      {active === 'Transfers History' && (
        <SessionTransfersList gymMemberId={gymMemberId} />
      )}
    </div>
  );
}
