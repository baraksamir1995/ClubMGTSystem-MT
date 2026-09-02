import type { HelpArticle, HelpCategory } from './types';

/**
 * Deterministic ranked search over the authored help articles.
 *
 * No index, no embeddings, no network — the corpus is ~40 short
 * articles, so scoring every one on every keystroke is far cheaper than
 * the machinery needed to avoid doing so.
 */

/**
 * Fold away the differences between what a user types and what the
 * article says, in both languages:
 *
 *  - Arabic diacritics (tashkeel) are usually omitted when typing.
 *  - أ/إ/آ → ا and ى → ي and ة → ه: routinely typed interchangeably,
 *    so "اعضاء" must match "أعضاء".
 *  - Arabic-Indic digits → ASCII, so "٥" matches "5".
 *  - Tatweel (ـ) is decorative.
 */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    // Decompose so Latin accents can be stripped, then RE-compose to
    // NFC. The round trip matters for Arabic: leaving it decomposed
    // splits 'أ' into alef + a hamza mark, and the punctuation rule
    // below would turn that mark into a space, so 'أعضاء' would stop
    // matching 'اعضاء' — the exact thing this function exists to fix.
    .normalize('NFD')
    // Latin combining accents (U+0300-U+036F) and Arabic tashkeel.
    .replace(/[\u0300-\u036F\u064B-\u0652\u0670]/g, '')
    .normalize('NFC')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    // Arabic-Indic (٠-٩) and extended Arabic-Indic (۰-۹) digits.
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06f0))
    // Collapse punctuation to spaces so "member's" ~ "members".
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Words too common to carry signal; dropped from multi-word queries. */
const STOP_WORDS = new Set([
  'how', 'do', 'i', 'to', 'a', 'an', 'the', 'in', 'on', 'for', 'of', 'is',
  'can', 'what', 'where', 'my', 'me', 'and', 'with', 'add',
  // Arabic equivalents.
  'كيف', 'في', 'من', 'الى', 'على', 'ما', 'هل', 'و', 'مع',
]);

function tokenize(query: string): string[] {
  const all = normalize(query).split(' ').filter(Boolean);
  const meaningful = all.filter(t => !STOP_WORDS.has(t));
  // A query made entirely of stop words ("how do I") still deserves
  // results, so fall back to the raw tokens rather than returning none.
  return meaningful.length > 0 ? meaningful : all;
}

/** Field weights — a title hit means far more than a hit deep in a step. */
const WEIGHTS = { title: 10, keywords: 6, summary: 3, steps: 1 } as const;

interface Haystack {
  title: string;
  keywords: string;
  summary: string;
  steps: string;
}

/** Normalizing every article on every keystroke is wasteful; cache it. */
const haystackCache = new WeakMap<HelpArticle, Haystack>();

function haystack(article: HelpArticle): Haystack {
  const cached = haystackCache.get(article);
  if (cached) return cached;
  const built: Haystack = {
    title: normalize(article.title),
    keywords: normalize(article.keywords.join(' ')),
    summary: normalize(article.summary),
    steps: normalize([...article.steps, ...(article.notes ?? [])].join(' ')),
  };
  haystackCache.set(article, built);
  return built;
}

/**
 * Score one article against one token. Word-boundary-prefix matches
 * score full weight so "pay" ranks "Record a payment" highly; a match
 * mid-word ("repayment") scores a third — enough to surface, not enough
 * to outrank a real prefix hit.
 */
function scoreToken(hay: Haystack, token: string): number {
  let score = 0;
  for (const field of ['title', 'keywords', 'summary', 'steps'] as const) {
    const text = hay[field];
    const at = text.indexOf(token);
    if (at === -1) continue;
    const isBoundary = at === 0 || text[at - 1] === ' ';
    score += WEIGHTS[field] * (isBoundary ? 1 : 0.34);
  }
  return score;
}

export interface HelpSearchResult {
  article: HelpArticle;
  score: number;
}

/**
 * Rank articles for `query`. Requires EVERY token to hit somewhere (AND
 * semantics) — with a corpus this small, OR semantics returns half the
 * library for a two-word query and feels broken.
 */
export function searchHelp(articles: HelpArticle[], query: string, limit = 8): HelpSearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const results: HelpSearchResult[] = [];

  for (const article of articles) {
    const hay = haystack(article);
    let total = 0;
    let matchedAll = true;

    for (const token of tokens) {
      const s = scoreToken(hay, token);
      if (s === 0) { matchedAll = false; break; }
      total += s;
    }

    if (!matchedAll) continue;

    // Nudge whole-phrase title matches to the top: "record a payment"
    // typed verbatim should beat an article that merely mentions both
    // words apart from each other.
    if (hay.title.includes(normalize(query))) total += 15;

    results.push({ article, score: total });
  }

  return results
    .sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title))
    .slice(0, limit);
}

/**
 * What to show when a search finds nothing.
 *
 * A bare "no results" is a dead end, so infer the topic the user was
 * probably after from any category word in their query and offer that
 * category's articles. Falls back to the getting-started set.
 */
export function suggestFallback(articles: HelpArticle[], query: string, limit = 4): HelpArticle[] {
  const q = normalize(query);

  // Cheap topic sniff — the words users type when they mean a module,
  // in both languages. First hit wins, so order by specificity.
  const HINTS: Array<[HelpCategory, string[]]> = [
    ['payments',   ['pay', 'money', 'cash', 'invoice', 'refund', 'price', 'دفع', 'فلوس', 'مال', 'فاتوره', 'سعر']],
    ['members',    ['member', 'client', 'customer', 'subscriber', 'عضو', 'اعضاء', 'عميل', 'مشترك']],
    ['plans',      ['plan', 'package', 'subscription', 'خطه', 'خطط', 'باكدج', 'اشتراك']],
    ['classes',    ['class', 'schedule', 'session', 'trainer', 'coach', 'حصه', 'حصص', 'جدول', 'مدرب']],
    ['attendance', ['attend', 'checkin', 'check', 'scan', 'gate', 'حضور', 'دخول']],
    ['staff',      ['staff', 'employee', 'role', 'permission', 'موظف', 'صلاحيه', 'دور']],
    ['content',    ['banner', 'notification', 'push', 'announce', 'بانر', 'اشعار', 'اعلان']],
    ['settings',   ['setting', 'logo', 'timezone', 'branch', 'اعداد', 'شعار', 'فرع']],
  ];

  for (const [category, words] of HINTS) {
    if (words.some(w => q.includes(w))) {
      const inCategory = articles.filter(a => a.category === category);
      if (inCategory.length > 0) return inCategory.slice(0, limit);
    }
  }

  const start = articles.filter(a => a.category === 'getting-started');
  return (start.length > 0 ? start : articles).slice(0, limit);
}

/** Resolve `related` ids to articles, dropping any that no longer exist. */
export function relatedArticles(articles: HelpArticle[], article: HelpArticle): HelpArticle[] {
  if (!article.related?.length) return [];
  const byId = new Map(articles.map(a => [a.id, a]));
  return article.related
    .map(id => byId.get(id))
    .filter((a): a is HelpArticle => a !== undefined && a.id !== article.id);
}
