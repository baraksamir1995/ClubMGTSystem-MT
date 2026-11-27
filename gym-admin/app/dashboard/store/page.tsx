import { redirect } from 'next/navigation';

// Store moved under Services as a sub-tab (Services → Store).
export default function StoreRedirect() {
  redirect('/dashboard/services?view=store');
}
