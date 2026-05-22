'use client';

import { useState } from 'react';
import { Layers, Percent, Dumbbell, PersonStanding, Leaf, ClipboardList } from 'lucide-react';
import ProgramsPage from '@/components/programs/programs-page';
import OffersPage from '@/components/offers/offers-page';
import SessionServiceTab, { type SessionPackage } from './session-service-tab';
import ServicesLogTab from './services-log-tab';
import { Tabs } from '@/components/ui';
import type { GymProgram } from '@/app/dashboard/services/page';
import type { GymOffer } from '@/app/dashboard/content/page';
import type { TrainerProfile } from '@/components/trainers/trainer-modal';
import type { Permission } from '@/lib/get-permissions';
import type { GymBranch } from '@/app/dashboard/branches/page';

type Tab = 'pt' | 'physio' | 'nutrition' | 'programs' | 'offers' | 'log';

const SERVICE_TABS: { id: Tab; label: string; icon: React.ElementType; serviceType: 'personal_trainer' | 'physiotherapist' | 'nutritionist'; serviceName: string }[] = [
  { id: 'pt',        label: 'Personal Training', icon: Dumbbell,        serviceType: 'personal_trainer', serviceName: 'Personal Training' },
  { id: 'physio',    label: 'Physiotherapy',     icon: PersonStanding,  serviceType: 'physiotherapist',  serviceName: 'Physiotherapy'     },
  { id: 'nutrition', label: 'Nutrition',          icon: Leaf,            serviceType: 'nutritionist',     serviceName: 'Nutrition'         },
];

interface Props {
  initialPrograms: GymProgram[];
  initialOffers: GymOffer[];
  initialTrainers: TrainerProfile[];
  initialPackages: SessionPackage[];
  permissions: Permission[] | null;
  gymId: string;
  branches?: GymBranch[];
}

export default function ServicesPage({
  initialPrograms, initialOffers, initialTrainers, initialPackages,
  permissions, gymId, branches = [],
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('pt');

  // Separate trainers and packages by service type
  const trainersByType = (type: string) =>
    initialTrainers.filter(t => t.trainer_type === type);

  const packagesByType = (type: string) =>
    initialPackages.filter(p => p.trainer_type === type || p.trainer_type === null);

  const activeServiceTab = SERVICE_TABS.find(t => t.id === activeTab);

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-fg">Services</h1>
          <p className="text-sm text-fg-muted mt-0.5">Manage session services, programs, and offers</p>
        </div>

        {/* Tab bar */}
        <Tabs.List>
          {SERVICE_TABS.map(tab => (
            <Tabs.Trigger key={tab.id} value={tab.id} icon={tab.icon}>{tab.label}</Tabs.Trigger>
          ))}
          <Tabs.Divider />
          <Tabs.Trigger value="programs" icon={Layers}>Programs</Tabs.Trigger>
          <Tabs.Trigger value="offers"   icon={Percent}>Offers</Tabs.Trigger>
          <Tabs.Divider />
          <Tabs.Trigger value="log"      icon={ClipboardList}>Services Log</Tabs.Trigger>
        </Tabs.List>

      {/* Service sub-tabs */}
      {activeServiceTab && (
        <SessionServiceTab
          key={activeTab}
          serviceType={activeServiceTab.serviceType}
          serviceName={activeServiceTab.serviceName}
          trainers={trainersByType(activeServiceTab.serviceType)}
          packages={packagesByType(activeServiceTab.serviceType)}
          gymId={gymId}
          permissions={permissions}
          branches={branches}
        />
      )}

      {activeTab === 'programs' && (
        <ProgramsPage initialPrograms={initialPrograms} permissions={permissions} gymId={gymId} />
      )}
      {activeTab === 'offers' && (
        <OffersPage initialOffers={initialOffers as any} permissions={permissions} gymId={gymId} />
      )}
      {activeTab === 'log' && (
        <ServicesLogTab trainers={initialTrainers} branches={branches} />
      )}
      </div>
    </Tabs>
  );
}
