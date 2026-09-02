import { describe, it, expect } from 'vitest';
import { normalize, searchHelp, suggestFallback, relatedArticles } from '@/lib/help/search';
import type { HelpArticle } from '@/lib/help/types';

/** Minimal fixtures — the real corpus is exercised by its own test. */
const article = (over: Partial<HelpArticle> & { id: string }): HelpArticle => ({
  category: 'members',
  title: 'Untitled',
  summary: '',
  steps: [],
  keywords: [],
  ...over,
});

const CORPUS: HelpArticle[] = [
  article({
    id: 'record-payment',
    category: 'payments',
    title: 'How do I record a payment?',
    summary: 'Log a cash or card payment against a member.',
    steps: ['Open Payments', 'Click "Record Payment"'],
    keywords: ['cash', 'invoice', 'collect'],
    related: ['add-member', 'ghost'],
  }),
  article({
    id: 'add-member',
    title: 'How do I add a member?',
    summary: 'Create a new member record.',
    steps: ['Open Members', 'Click "Add Member"'],
    keywords: ['signup', 'register', 'اعضاء'],
  }),
  article({
    id: 'refund',
    category: 'payments',
    title: 'How do I refund a payment?',
    summary: 'Reverse a payment already recorded.',
    steps: ['Find the payment row', 'Choose "Refund"'],
    keywords: ['reverse', 'money back'],
  }),
  article({
    id: 'first-steps',
    category: 'getting-started',
    title: 'Setting up your gym',
    summary: 'The order to configure things in.',
    steps: ['Add branches', 'Add plans'],
    keywords: ['onboarding'],
  }),
];

describe('normalize', () => {
  it('folds Arabic hamza forms so أعضاء matches اعضاء', () => {
    // Regression: an NFKD pass split the hamza into its own mark, which
    // the punctuation rule turned into a space ("ا عضاء").
    expect(normalize('أعضاء')).toBe(normalize('اعضاء'));
    expect(normalize('أعضاء')).not.toContain(' ');
  });

  it('folds alef maqsura and taa marbuta', () => {
    expect(normalize('علي')).toBe(normalize('على'));
    expect(normalize('حصة')).toBe(normalize('حصه'));
  });

  it('strips tashkeel and tatweel', () => {
    expect(normalize('مُدَرِّب')).toBe('مدرب');
    expect(normalize('مــدرب')).toBe('مدرب');
  });

  it('maps Arabic-Indic digits to ASCII', () => {
    expect(normalize('٥ و ۹')).toBe('5 و 9');
  });

  it('collapses punctuation and case', () => {
    expect(normalize("How do I record a MEMBER's payment?")).toBe(
      'how do i record a member s payment',
    );
  });

  it('folds Latin accents', () => {
    expect(normalize('séance')).toBe('seance');
  });
});

describe('searchHelp', () => {
  it('returns nothing for an empty query', () => {
    expect(searchHelp(CORPUS, '')).toEqual([]);
    expect(searchHelp(CORPUS, '   ')).toEqual([]);
  });

  it('ranks the exact-title article first', () => {
    const [top] = searchHelp(CORPUS, 'how do i record a payment');
    expect(top.article.id).toBe('record-payment');
  });

  it('finds an article by keyword synonym not present in the title', () => {
    const ids = searchHelp(CORPUS, 'cash').map(r => r.article.id);
    expect(ids).toContain('record-payment');
  });

  it('requires every token to match (AND semantics)', () => {
    // "payment" hits two articles; adding "refund" must narrow to one.
    expect(searchHelp(CORPUS, 'payment').length).toBeGreaterThan(1);
    const ids = searchHelp(CORPUS, 'refund payment').map(r => r.article.id);
    expect(ids).toEqual(['refund']);
  });

  it('returns nothing when one token matches nothing at all', () => {
    expect(searchHelp(CORPUS, 'payment zzzznope')).toEqual([]);
  });

  it('matches on a prefix so partial typing works', () => {
    const ids = searchHelp(CORPUS, 'pay').map(r => r.article.id);
    expect(ids).toContain('record-payment');
  });

  it('still returns results for an all-stop-word query', () => {
    expect(searchHelp(CORPUS, 'how do i').length).toBeGreaterThan(0);
  });

  it('searches Arabic keywords', () => {
    const ids = searchHelp(CORPUS, 'أعضاء').map(r => r.article.id);
    expect(ids).toContain('add-member');
  });

  it('respects the limit', () => {
    expect(searchHelp(CORPUS, 'how', 2).length).toBeLessThanOrEqual(2);
  });

  it('scores a title hit above a steps-only hit', () => {
    const results = searchHelp(CORPUS, 'members');
    // "add-member" has it in the title; "first-steps" only in a step.
    expect(results[0].article.id).toBe('add-member');
  });
});

describe('suggestFallback', () => {
  it('infers the payments topic from a money word', () => {
    const ids = suggestFallback(CORPUS, 'how do i take money from someone').map(a => a.id);
    expect(ids).toContain('record-payment');
    expect(ids.every(id => ['record-payment', 'refund'].includes(id))).toBe(true);
  });

  it('infers a topic from an Arabic word', () => {
    const ids = suggestFallback(CORPUS, 'دفع').map(a => a.id);
    expect(ids).toContain('record-payment');
  });

  it('falls back to getting-started when no topic is detectable', () => {
    const ids = suggestFallback(CORPUS, 'qqqq').map(a => a.id);
    expect(ids).toEqual(['first-steps']);
  });

  it('never returns an empty list', () => {
    expect(suggestFallback(CORPUS, '').length).toBeGreaterThan(0);
  });
});

describe('relatedArticles', () => {
  it('resolves ids and drops ones that no longer exist', () => {
    const source = CORPUS.find(a => a.id === 'record-payment')!;
    const ids = relatedArticles(CORPUS, source).map(a => a.id);
    // 'ghost' is a dangling id and must be silently dropped, not crash.
    expect(ids).toEqual(['add-member']);
  });

  it('returns an empty list when there are no related ids', () => {
    const source = CORPUS.find(a => a.id === 'refund')!;
    expect(relatedArticles(CORPUS, source)).toEqual([]);
  });
});
