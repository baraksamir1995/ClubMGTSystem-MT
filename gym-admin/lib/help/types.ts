/**
 * Help-centre article model.
 *
 * Deliberately NOT AI-backed: the set of questions a gym admin asks is
 * small and knowable, so the answers are authored, reviewed, and
 * versioned with the code that implements them. Deterministic search
 * over authored steps beats a model guessing at UI labels — a help
 * article that names a button that doesn't exist is worse than no
 * article at all.
 *
 * Content lives in ./articles.<locale>.ts, one file per locale.
 */

/** Sidebar module an article belongs to. Drives grouping + the icon. */
export type HelpCategory =
  | 'members'
  | 'payments'
  | 'plans'
  | 'classes'
  | 'attendance'
  | 'staff'
  | 'content'
  | 'settings'
  | 'getting-started';

export interface HelpArticle {
  /** Stable across locales and never reused — deep links depend on it. */
  id: string;
  category: HelpCategory;
  /** Phrased as the question an admin would actually ask. */
  title: string;
  /** One line shown under the title in results. */
  summary: string;
  /**
   * Ordered click path. Each entry is one action. Keep the literal UI
   * label in "quotes" so it's greppable when a label changes.
   */
  steps: string[];
  /** Caveats, validation rules, ordering dependencies. Optional. */
  notes?: string[];
  /** Article ids surfaced as "related" and as no-match fallbacks. */
  related?: string[];
  /**
   * Extra search terms that don't appear in the title/summary/steps —
   * synonyms and the words users actually type ("cash", "invoice",
   * "sign up"). This is what makes plain-substring search feel smart.
   */
  keywords: string[];
  /** Optional in-app destination, e.g. "/dashboard/payments". */
  href?: string;
}
