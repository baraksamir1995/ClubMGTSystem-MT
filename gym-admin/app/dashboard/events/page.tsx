import { redirect } from 'next/navigation';

// Events moved under Services as a sub-tab (Services → Events).
export default function EventsRedirect() {
  redirect('/dashboard/services?view=events');
}
