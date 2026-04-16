'use client';

import { useState } from 'react';
import { Layers, Percent, Dumbbell, PersonStanding, Leaf } from 'lucide-react';
import ProgramsPage from '@/components/programs/programs-page';
import OffersPage from '@/components/offers/offers-page';
import SessionServiceTab, { type SessionPackage } from './session-service-tab';
import type { GymProgram } from '@/app/dashboard/services/page';
import type { GymOffer } from '@/app/dashboard/content/page';
import type { TrainerProfile } from '@/components/trainers/trainer-modal';
import type { Permission } from '@/lib/get-permissions';
import type { GymBranch } from '@/app/dashboard/branches/page';

type Tab = 'pt' | 'physio' | 'nutrition' | 'programs' | 'offers';

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

  const tabCls = (t: Tab) =>
    `flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      activeTab === t ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
    }`;

  // Separate trainers and packages by service type
  const trainersByType = (type: string) =>
    initialTrainers.filter(t => t.trainer_type === type);

  const packagesByType = (type: string) =>
    initialPackages.filter(p => p.trainer_type === type || p.trainer_type === null);

  const activeServiceTab = SERVICE_TABS.find(t => t.id === activeTab);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Services</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage session services, programs, and offers</p>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1 w-fit">
        {/* Session service tabs */}
        {SERVICE_TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={tabCls(tab.id)}>
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
        {/* Divider */}
        <div className="w-px bg-gray-700 mx-1 self-stretch" />
        {/* Catalog tabs */}
        <button onClick={() => setActiveTab('programs')} className={tabCls('programs')}>
          <Layers className="w-4 h-4" /> Programs
        </button>
        <button onClick={() => setActiveTab('offers')} className={tabCls('offers')}>
          <Percent className="w-4 h-4" /> Offers
        </button>
      </div>

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
    </div>
  );
}
