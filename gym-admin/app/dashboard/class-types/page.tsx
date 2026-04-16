import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import ClassTypesManager from '@/components/classes/class-types-manager';

export const dynamic = 'force-dynamic';

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
export default async function ClassTypesPage() {
  const cookieStore = await cookies();
  const token = decodeURIComponent(cookieStore.get('auth_token')?.value ?? '');
  if (!token) redirect('/login');

  // Class types come from the classes endpoint or a dedicated content endpoint
  const classesData = await fetchApi('/classes', token);
  const rawClasses = classesData?.data ?? classesData ?? [];

  // Extract unique class types
  const typeMap = new Map<string, { id: string; name: string }>();
  for (const c of rawClasses) {
    if (c.class_type && !typeMap.has(c.class_type)) {
      typeMap.set(c.class_type, { id: c.class_type, name: c.class_type });
    }
  }

  // Also try dedicated class-types endpoint if available
  const classTypesData = await fetchApi('/content/class-types', token);
  if (classTypesData) {
    const types = classTypesData?.data ?? classTypesData ?? [];
    for (const t of types) {
      if (t.id && t.name) typeMap.set(t.id, { id: t.id, name: t.name });
    }
  }

  return <ClassTypesManager initial={[...typeMap.values()]} />;
}
