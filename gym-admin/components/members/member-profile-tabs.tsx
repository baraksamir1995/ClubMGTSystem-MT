'use client';

import { useState } from 'react';
import AttendanceTab from './attendance-tab';
import PaymentHistoryTab from './payment-history-tab';
import SessionTransfersList from './session-transfers-list';
import type { MemberPayment } from './payment-history-tab';

interface AttendanceLog {
  id: string;
  check_in_at: string;
  method: string | null;
  access_point: string | null;
  branch_id: string | null;
  branches: { name: string } | { name: string }[] | null;
}

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
      <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1 w-fit">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              active === tab
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab}
            {tab === 'Attendance' && (
              <span className="ml-1.5 text-xs bg-gray-600 text-gray-300 px-1.5 py-0.5 rounded-full">
                {attendanceLogs.length}
              </span>
            )}
            {tab === 'Payments' && payments.length > 0 && (
              <span className="ml-1.5 text-xs bg-gray-600 text-gray-300 px-1.5 py-0.5 rounded-full">
                {payments.length}
              </span>
            )}
          </button>
        ))}
      </div>

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
