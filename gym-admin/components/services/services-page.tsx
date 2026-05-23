'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('services');
  const [activeTab, setActiveTab] = useState<Tab>('pt');

  type ServiceTabDef = {
    id: Tab;
    label: string;
    icon: React.ElementType;
    serviceType: 'personal_trainer' | 'physiotherapist' | 'nutritionist';
    serviceName: string;
  };

  const SERVICE_TABS: ServiceTabDef[] = [
    { id: 'pt',        label: t('tabs.personalTraining'), icon: Dumbbell,        serviceType: 'personal_trainer', serviceName: t('tabs.personalTraining') },
    { id: 'physio',    label: t('tabs.physiotherapy'),    icon: PersonStanding,  serviceType: 'physiotherapist',  serviceName: t('tabs.physiotherapy')    },
    { id: 'nutrition', label: t('tabs.nutrition'),        icon: Leaf,            serviceType: 'nutritionist',     serviceName: t('tabs.nutrition')        },
  ];

  // Separate trainers and packages by service type
  const trainersByType = (type: string) =>
    initialTrainers.filter(tr => tr.trainer_type === type);

  const packagesByType = (type: string) =>
    initialPackages.filter(p => p.trainer_type === type || p.trainer_type === null);

  const activeServiceTab = SERVICE_TABS.find(tab => tab.id === activeTab);

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-fg">{t('title')}</h1>
          <p className="text-sm text-fg-muted mt-0.5">{t('subtitle')}</p>
        </div>

        {/* Tab bar */}
        <Tabs.List>
          {SERVICE_TABS.map(tab => (
            <Tabs.Trigger key={tab.id} value={tab.id} icon={tab.icon}>{tab.label}</Tabs.Trigger>
          ))}
          <Tabs.Divider />
          <Tabs.Trigger value="programs" icon={Layers}>{t('tabs.programs')}</Tabs.Trigger>
          <Tabs.Trigger value="offers"   icon={Percent}>{t('tabs.offers')}</Tabs.Trigger>
          <Tabs.Divider />
          <Tabs.Trigger value="log"      icon={ClipboardList}>{t('tabs.log')}</Tabs.Trigger>
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
