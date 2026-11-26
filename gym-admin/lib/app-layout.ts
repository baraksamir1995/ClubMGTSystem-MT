// Mobile app Home / Explore section layout (gyms.app_layout).
//
// Keys MUST match clby-api `App\Support\AppLayout::SCREENS` and the Flutter
// app's `lib/models/app_layout.dart`. Adding a section = add it in all three.

export const APP_LAYOUT_SCREENS = {
  home: ['banners', 'membership', 'todays_classes', 'activity', 'quick_access', 'events', 'locations'],
  explore: ['memberships', 'offers', 'trainers', 'services', 'programs', 'session_packages', 'store', 'events', 'partners'],
} as const;

export type AppLayoutScreen = keyof typeof APP_LAYOUT_SCREENS;
export interface AppLayoutItem { key: string; visible: boolean }
export type AppLayout = Record<AppLayoutScreen, AppLayoutItem[]>;

export function defaultAppLayout(): AppLayout {
  return {
    home: APP_LAYOUT_SCREENS.home.map(key => ({ key, visible: true })),
    explore: APP_LAYOUT_SCREENS.explore.map(key => ({ key, visible: true })),
  };
}

/** Same rules as the API normaliser: drop unknown/duplicate keys, append missing ones. */
export function normalizeAppLayout(raw: unknown): AppLayout {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = {} as AppLayout;
  (Object.keys(APP_LAYOUT_SCREENS) as AppLayoutScreen[]).forEach(screen => {
    const allowed: readonly string[] = APP_LAYOUT_SCREENS[screen];
    const items = Array.isArray(src[screen]) ? (src[screen] as unknown[]) : [];
    const seen = new Set<string>();
    const rows: AppLayoutItem[] = [];
    for (const it of items) {
      const key = (it as { key?: unknown })?.key;
      if (typeof key !== 'string' || !allowed.includes(key) || seen.has(key)) continue;
      seen.add(key);
      rows.push({ key, visible: (it as { visible?: unknown }).visible !== false });
    }
    for (const key of allowed) if (!seen.has(key)) rows.push({ key, visible: true });
    out[screen] = rows;
  });
  return out;
}
