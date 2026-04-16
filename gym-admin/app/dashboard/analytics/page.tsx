import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import AnalyticsPage from '@/components/analytics/analytics-page';

export const dynamic = 'force-dynamic';

export default async function AnalyticsRoute() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  return <AnalyticsPage />;
}
