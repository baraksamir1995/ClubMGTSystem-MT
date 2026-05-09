'use client';

import { useState } from 'react';
import { LayoutTemplate, Handshake, Bell, Layers } from 'lucide-react';
import BannersTab from './banners-tab';
import PopupsTab from './popups-tab';
import PartnersTab, { type GymPartner } from './partners-tab';
import NotificationsPage from '@/components/notifications/notifications-page';
import type { GymBanner, GymPopup, GymNotification, PlanOption } from '@/app/dashboard/content/page';
import type { Permission } from '@/lib/get-permissions';

interface Props {
  initialBanners: GymBanner[];
  initialPopups: GymPopup[];
  initialPartners: GymPartner[];
  initialNotifications: GymNotification[];
  planOptions: PlanOption[];
  permissions: Permission[] | null;
  gymId: string;
}

type Tab = 'banners' | 'popups' | 'partners' | 'communications';

export default function ContentPage({
  initialBanners, initialPopups,
  initialPartners, initialNotifications, planOptions,
  permissions, gymId,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('banners');

  const tabCls = (t: Tab) =>
    `flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      activeTab === t ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
    }`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Content</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage everything members see in the app</p>
      </div>

      <div className="flex gap-1 bg-gray-800 border border-gray-700 rounded-xl p-1 flex-wrap">
        <button onClick={() => setActiveTab('banners')} className={tabCls('banners')}>
          <LayoutTemplate className="w-4 h-4" /> Banners
        </button>
        <button onClick={() => setActiveTab('popups')} className={tabCls('popups')}>
          <Layers className="w-4 h-4" /> Pop-ups
        </button>
        <button onClick={() => setActiveTab('partners')} className={tabCls('partners')}>
          <Handshake className="w-4 h-4" /> Partners
        </button>
        <button onClick={() => setActiveTab('communications')} className={tabCls('communications')}>
          <Bell className="w-4 h-4" /> Communications
        </button>
      </div>

      {activeTab === 'banners'        && <BannersTab        initialBanners={initialBanners} permissions={permissions} />}
      {activeTab === 'popups'         && <PopupsTab         initialPopups={initialPopups} permissions={permissions} />}
      {activeTab === 'partners'       && <PartnersTab       initialPartners={initialPartners} permissions={permissions} gymId={gymId} />}
      {activeTab === 'communications' && <NotificationsPage initialNotifications={initialNotifications} plans={planOptions} permissions={permissions} />}
    </div>
  );
}
