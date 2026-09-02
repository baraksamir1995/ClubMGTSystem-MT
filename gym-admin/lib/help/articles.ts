import {
  Rocket, Users, CreditCard, Package, CalendarDays,
  ScanLine, ShieldCheck, Megaphone, Settings2, type LucideIcon,
} from 'lucide-react';
import type { HelpArticle, HelpCategory } from './types';
import { ARTICLES_EN } from './articles.en';
import { ARTICLES_AR } from './articles.ar';

/**
 * Article registry.
 *
 * Content is authored per locale (articles.en.ts / articles.ar.ts) so a
 * translator can work in one file without touching the other. Both must
 * cover the same `id` set — enforced by tests/lib/help-articles.test.ts,
 * which also catches steps that quote a UI label the other locale
 * forgot to translate.
 */

/** Display order of the category groups in the browse list. */
export const CATEGORY_ORDER: readonly HelpCategory[] = [
  'getting-started',
  'members',
  'payments',
  'plans',
  'classes',
  'attendance',
  'staff',
  'content',
  'settings',
];

export const CATEGORY_ICONS: Record<HelpCategory, LucideIcon> = {
  'getting-started': Rocket,
  members: Users,
  payments: CreditCard,
  plans: Package,
  classes: CalendarDays,
  attendance: ScanLine,
  staff: ShieldCheck,
  content: Megaphone,
  settings: Settings2,
};

/**
 * Articles for `locale`, in browse order (category, then authored
 * order within it). Unknown locales fall back to English rather than
 * rendering an empty help centre.
 */
export function getArticles(locale: string): HelpArticle[] {
  const source = locale === 'ar' ? ARTICLES_AR : ARTICLES_EN;
  const rank = new Map(CATEGORY_ORDER.map((c, i) => [c, i]));
  // Stable sort by category only, so the authored order inside each
  // category is preserved (it goes simple → advanced deliberately).
  return [...source].sort(
    (a, b) => (rank.get(a.category) ?? 99) - (rank.get(b.category) ?? 99),
  );
}

/** All article ids, for tests and deep-link validation. */
export function articleIds(): string[] {
  return ARTICLES_EN.map(a => a.id);
}
