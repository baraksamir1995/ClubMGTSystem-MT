'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Sun,
  Columns3,
  List,
  BarChart3,
  LayoutDashboard,
  UserPlus,
  LineChart,
  Users,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { SalesContext, TeamMember } from '@/lib/sales-types';

// View components — owned by the rep/manager agents (see components/sales/rep
// and components/sales/manager). Import paths are the integration contract.
import MyDay from '@/components/sales/rep/my-day';
import PipelineBoard from '@/components/sales/rep/pipeline-board';
import LeadsList from '@/components/sales/rep/leads-list';
import MyStats from '@/components/sales/rep/my-stats';
import BranchOverview from '@/components/sales/manager/branch-overview';
import AssignmentQueue from '@/components/sales/manager/assignment-queue';
import Reports from '@/components/sales/manager/reports';
import TeamManagement from '@/components/sales/manager/team-management';
import SettingsPanel from '@/components/sales/manager/settings-panel';

/// Workspace shell for the Sales & Leads module.
/// Sub-tab state is held in the `?view=` query so links stay shareable
/// (same convention as components/members/members-module-tabs.tsx).
/// Reps see their working views; managers/admins get the branch-level
/// views on top, defaulting to the overview.

type ViewId =
  | 'overview'
  | 'assign'
  | 'myday'
  | 'pipeline'
  | 'leads'
  | 'stats'
  | 'reports'
  | 'team'
  | 'settings';

interface Props {
  context: SalesContext;
  team: TeamMember[];
}

const REP_TABS: { id: ViewId; label: string; icon: LucideIcon }[] = [
  { id: 'myday', label: 'My Day', icon: Sun },
  { id: 'pipeline', label: 'Pipeline', icon: Columns3 },
  { id: 'leads', label: 'Leads', icon: List },
  { id: 'stats', label: 'My Stats', icon: BarChart3 },
];

const MANAGER_TABS: { id: ViewId; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'assign', label: 'Assign', icon: UserPlus },
  ...REP_TABS,
  { id: 'reports', label: 'Reports', icon: LineChart },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function SalesWorkspace({ context, team }: Props) {
  const pathname = usePathname();
  const params = useSearchParams();

  const isManager = context.is_manager || context.is_admin;
  const tabs = isManager ? MANAGER_TABS : REP_TABS;
  const defaultView: ViewId = isManager ? 'overview' : 'myday';

  const requested = params.get('view');
  const view: ViewId = tabs.some((t) => t.id === requested)
    ? (requested as ViewId)
    : defaultView;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fg">Sales &amp; Leads</h1>
        <p className="text-sm text-fg-muted mt-1">
          Track leads from first contact to signed membership.
        </p>
      </div>

      <div className="flex gap-1 bg-surface-2 border border-line rounded-xl p-1 w-fit max-w-full overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = view === tab.id;
          // Preserve other query params when switching tabs, but drop
          // view-local state (pagination, search, filters) — it doesn't
          // carry semantic meaning across views.
          const next = new URLSearchParams(params.toString());
          if (tab.id === defaultView) next.delete('view');
          else next.set('view', tab.id);
          next.delete('page');
          next.delete('search');
          const href = `${pathname}${next.toString() ? `?${next}` : ''}`;
          return (
            <Link
              key={tab.id}
              href={href}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                active ? 'bg-surface-3 text-fg' : 'text-fg-muted hover:text-fg'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {view === 'myday' && <MyDay context={context} team={team} />}
      {view === 'pipeline' && (
        <PipelineBoard context={context} team={team} scope={isManager ? 'team' : 'own'} />
      )}
      {view === 'leads' && <LeadsList context={context} team={team} />}
      {view === 'stats' && <MyStats context={context} />}
      {isManager && view === 'overview' && <BranchOverview context={context} team={team} />}
      {isManager && view === 'assign' && <AssignmentQueue context={context} team={team} />}
      {isManager && view === 'reports' && <Reports context={context} />}
      {isManager && view === 'team' && <TeamManagement context={context} team={team} />}
      {isManager && view === 'settings' && <SettingsPanel context={context} />}
    </div>
  );
}

export default function SalesPage({ context, team }: Props) {
  // useSearchParams requires a Suspense boundary in App Router pages.
  return (
    <Suspense>
      <SalesWorkspace context={context} team={team} />
    </Suspense>
  );
}
