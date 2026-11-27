import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import KioskScreen from '@/components/attendance/kiosk/kiosk-screen';
import { kioskAccess, loadBranches } from '../load-branches';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Rotating-QR kiosk for one branch (PHASE3-CONTRACT §5). Server part runs on
 * first load only (layout guard + attendance view + branch belongs to the gym);
 * the client screen then works from IndexedDB, offline until the batch ends.
 */
export default async function KioskRoute({ params }: { params: { branchId: string } }) {
  if (!UUID.test(params.branchId)) notFound();
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');
  const access = await kioskAccess(token);
  if (!access) redirect('/dashboard/attendance');

  const branch = (await loadBranches(token)).find((b) => b.id.toLowerCase() === params.branchId.toLowerCase());
  if (!branch) notFound();

  return (
    <KioskScreen
      userId={access.userId}
      gymId={access.gymId}
      role={access.role}
      branchId={branch.id}
      branchName={branch.name}
    />
  );
}
