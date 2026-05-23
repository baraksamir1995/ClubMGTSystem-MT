'use client';

import { useState } from 'react';
import { LayoutTemplate, Handshake, Bell, Layers } from 'lucide-react';
import { useTranslations } from 'next-intl';
import BannersTab from './banners-tab';
import PopupsTab from './popups-tab';
import PartnersTab, { type GymPartner } from './partners-tab';
import NotificationsPage from '@/components/notifications/notifications-page';
import type { GymBanner, GymPopup, PlanOption } from '@/app/dashboard/content/page';
import type { Permission } from '@/lib/get-permissions';
import { Tabs } from '@/components/ui';

interface Props {
  initialBanners: GymBanner[];
  initialPopups: GymPopup[];
  initialPartners: GymPartner[];
  planOptions: PlanOption[];
  permissions: Permission[] | null;
  gymId: string;
}

type Tab = 'banners' | 'popups' | 'partners' | 'communications';

export default function ContentPage({
  initialBanners, initialPopups,
  initialPartners, planOptions,
  permissions, gymId,
}: Props) {
  const t = useTranslations('content');
  const [activeTab, setActiveTab] = useState<Tab>('banners');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-fg">{t('title')}</h1>
        <p className="text-sm text-fg-muted mt-0.5">{t('subtitle')}</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
        <Tabs.List className="flex-wrap">
          <Tabs.Trigger value="banners" icon={LayoutTemplate}>{t('tabs.banners')}</Tabs.Trigger>
          <Tabs.Trigger value="popups" icon={Layers}>{t('tabs.popups')}</Tabs.Trigger>
          <Tabs.Trigger value="partners" icon={Handshake}>{t('tabs.partners')}</Tabs.Trigger>
          <Tabs.Trigger value="communications" icon={Bell}>{t('tabs.communications')}</Tabs.Trigger>
        </Tabs.List>
      </Tabs>

      {activeTab === 'banners'        && <BannersTab        initialBanners={initialBanners} permissions={permissions} />}
      {activeTab === 'popups'         && <PopupsTab         initialPopups={initialPopups} permissions={permissions} />}
      {activeTab === 'partners'       && <PartnersTab       initialPartners={initialPartners} permissions={permissions} gymId={gymId} />}
      {activeTab === 'communications' && <NotificationsPage plans={planOptions} permissions={permissions} />}
    </div>
  );
}
