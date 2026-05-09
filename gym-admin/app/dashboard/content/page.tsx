import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ContentPage from '@/components/content/content-page';
import type { GymPartner } from '@/components/content/partners-tab';

export const dynamic = 'force-dynamic';

export interface GymFaq {
  id: string; question: string; answer: string; is_visible: boolean;
  display_order: number; created_at: string;
}
export interface GymAnnouncement {
  id: string; title: string; body: string; is_visible: boolean;
  visible_from: string | null; visible_until: string | null; created_at: string;
}
export interface GymBanner {
  id: string; image_url: string; storage_path: string | null; caption: string | null;
  description: string | null; tag: string | null; tag_color: string | null;
  action_type: string; action_value: string | null; sort_order: number;
  is_active: boolean; is_featured: boolean; created_at: string;
  // Sponsor variant: populated when action_type === 'sponsor'.
  sponsor_promo_code: string | null;
  sponsor_external_url: string | null;
  sponsor_terms: string | null;
}
export interface GymOffer {
  id: string; title: string; short_description: string | null; full_description: string | null;
  tag_label: string | null; tag_color: string | null; hero_image_url: string | null;
  expires_at: string; cta_label: string | null; cta_action: string | null;
  terms: string[]; status: 'draft' | 'active' | 'expired'; created_at: string;
  offer_price: number | null; original_price: number | null; session_count: number | null;
  linked_plan_id: string | null; linked_package_id: string | null;
}
export interface GymPopup {
  id: string; title: string; subtitle: string | null; image_url: string | null;
  storage_path: string | null; cta_label: string | null;
  cta_action_type: string; cta_action_value: string | null;
  is_active: boolean; priority: number; created_at: string;
}
export interface GymNotification {
  id: string; title: string; body: string; recipient_type: string;
  recipient_filter: { plan_ids?: string[]; statuses?: string[] } | null;
  scheduled_at: string | null; sent_at: string | null;
  status: 'sent' | 'scheduled' | 'cancelled'; recipient_count: number | null; created_at: string;
}
export interface GymPhoto {
  id: string;
  url: string;
  storage_path: string | null;
  caption: string | null;
  is_visible: boolean;
  created_at: string;
}
export interface PlanOption { id: string; name: string; }

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

async function fetchApi(path: string, token: string) {
  try {
    const res = await fetch(`${BACKEND_URL}/api${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
export default async function ContentRoute() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  const { getMe } = await import('@/lib/get-permissions');
  const me = await getMe(token);
  
  const gymId = me?.gym_id;

  const { getStaffPermissions } = await import('@/lib/get-permissions');
  const permissions = await getStaffPermissions(token);

  const [faqsData, announcementsData, bannersData, popupsData, partnersData, notifData, plansData] =
    await Promise.all([
      fetchApi('/content/faqs', token),
      fetchApi('/content/announcements', token),
      fetchApi('/content/banners', token),
      fetchApi('/content/popups', token),
      fetchApi('/content/partners', token),
      fetchApi('/notifications', token),
      fetchApi('/plans', token),
    ]);

  return (
    <ContentPage
      initialFaqs={(faqsData?.data ?? faqsData ?? []) as GymFaq[]}
      initialAnnouncements={(announcementsData?.data ?? announcementsData ?? []) as GymAnnouncement[]}
      initialBanners={(bannersData?.data ?? bannersData ?? []) as GymBanner[]}
      initialPopups={(popupsData?.data ?? popupsData ?? []) as GymPopup[]}
      initialPartners={(partnersData?.data ?? partnersData ?? []) as GymPartner[]}
      initialNotifications={(notifData?.data ?? notifData ?? []) as GymNotification[]}
      planOptions={(plansData?.data ?? plansData ?? []).map((p: any) => ({ id: p.id, name: p.name })) as PlanOption[]}
      permissions={permissions}
      gymId={gymId}
    />
  );
}
