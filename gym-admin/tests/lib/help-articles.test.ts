import { describe, it, expect } from 'vitest';
import { ARTICLES_EN } from '@/lib/help/articles.en';
import { ARTICLES_AR } from '@/lib/help/articles.ar';
import { getArticles, CATEGORY_ORDER, CATEGORY_ICONS } from '@/lib/help/articles';
import { searchHelp } from '@/lib/help/search';
import enMessages from '@/messages/en/help.json';
import arMessages from '@/messages/ar/help.json';

const LOCALES = [
  ['en', ARTICLES_EN],
  ['ar', ARTICLES_AR],
] as const;

describe('help article corpus', () => {
  it('has articles in both locales', () => {
    expect(ARTICLES_EN.length).toBeGreaterThan(0);
    expect(ARTICLES_AR.length).toBe(ARTICLES_EN.length);
  });

  it('covers the same ids in both locales', () => {
    const en = new Set(ARTICLES_EN.map(a => a.id));
    const ar = new Set(ARTICLES_AR.map(a => a.id));
    expect([...en].filter(id => !ar.has(id))).toEqual([]);
    expect([...ar].filter(id => !en.has(id))).toEqual([]);
  });

  it('agrees on each article\'s category across locales', () => {
    const arById = new Map(ARTICLES_AR.map(a => [a.id, a]));
    for (const a of ARTICLES_EN) {
      expect(arById.get(a.id)!.category, `category drift on "${a.id}"`).toBe(a.category);
    }
  });

  for (const [locale, articles] of LOCALES) {
    describe(locale, () => {
      it('has unique ids', () => {
        const ids = articles.map(a => a.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it('has a title, summary and at least one step everywhere', () => {
        for (const a of articles) {
          expect(a.title.trim(), `${a.id} title`).not.toBe('');
          expect(a.summary.trim(), `${a.id} summary`).not.toBe('');
          expect(a.steps.length, `${a.id} steps`).toBeGreaterThan(0);
          for (const s of a.steps) {
            expect(s.trim(), `${a.id} has a blank step`).not.toBe('');
          }
        }
      });

      it('has searchable keywords on every article', () => {
        for (const a of articles) {
          expect(a.keywords.length, `${a.id} keywords`).toBeGreaterThan(0);
        }
      });

      it('only uses categories that have an icon and an ordering slot', () => {
        for (const a of articles) {
          expect(CATEGORY_ORDER, `${a.id} category`).toContain(a.category);
          expect(CATEGORY_ICONS[a.category]).toBeDefined();
        }
      });

      it('only points `related` at ids that exist', () => {
        const ids = new Set(articles.map(a => a.id));
        for (const a of articles) {
          for (const r of a.related ?? []) {
            expect(ids.has(r), `${a.id} → unknown related id "${r}"`).toBe(true);
          }
        }
      });

      it('never lists itself as related', () => {
        for (const a of articles) {
          expect(a.related ?? [], `${a.id} relates to itself`).not.toContain(a.id);
        }
      });

      it('uses in-app absolute paths for href', () => {
        for (const a of articles) {
          if (a.href) expect(a.href, `${a.id} href`).toMatch(/^\/dashboard/);
        }
      });

      it('has a category label for every category used', () => {
        const messages = locale === 'ar' ? arMessages : enMessages;
        for (const a of articles) {
          expect(
            (messages.categories as Record<string, string>)[a.category],
            `missing ${locale} label for category "${a.category}"`,
          ).toBeTruthy();
        }
      });
    });
  }

  it('is actually translated — Arabic titles differ from English', () => {
    const arById = new Map(ARTICLES_AR.map(a => [a.id, a]));
    for (const a of ARTICLES_EN) {
      const ar = arById.get(a.id)!;
      // A copy-pasted English title is the most likely translation slip.
      expect(ar.title, `"${a.id}" Arabic title is untranslated`).not.toBe(a.title);
      expect(/[؀-ۿ]/.test(ar.title), `"${a.id}" Arabic title has no Arabic`).toBe(true);
    }
  });
});

describe('getArticles', () => {
  it('groups by the declared category order', () => {
    const cats = getArticles('en').map(a => CATEGORY_ORDER.indexOf(a.category));
    expect(cats).toEqual([...cats].sort((x, y) => x - y));
  });

  it('falls back to English for an unknown locale', () => {
    expect(getArticles('fr').length).toBe(ARTICLES_EN.length);
  });

  it('returns the Arabic corpus for ar', () => {
    expect(getArticles('ar')[0].title).toMatch(/[؀-ۿ]/);
  });
});

/**
 * The questions admins actually ask. Each must surface its expected
 * article — this is the real acceptance test for the widget, and it
 * fails loudly if an article is renamed without updating keywords.
 */
describe('real-world queries resolve', () => {
  const CASES: Array<[string, string]> = [
    ['how do i create a payment', 'record-payment'],
    ['how do i record a payment', 'record-payment'],
    ['collect cash from a member', 'record-payment'],
    ['how do i create a member', 'add-member'],
    ['how do i add a new member', 'add-member'],
    ['sign up a new client', 'add-member'],
    ['renew a membership', 'renew-membership'],
    ['freeze a membership', 'freeze-membership'],
    ['pause a membership', 'freeze-membership'],
    ['create a plan', 'create-plan'],
    ['refund', 'refund-payment'],
    ['money back', 'refund-payment'],
    ['schedule a class', 'schedule-class'],
    ['members cant see the schedule', 'publish-schedule'],
    ['check in a member', 'check-in-member'],
    ['add a staff member', 'add-staff'],
    ['send a notification', 'send-notification'],
    ['promo code', 'create-promo-code'],
    ['add a trainer', 'add-trainer'],
    ['change the logo', 'gym-settings'],
    ['export members', 'export-members'],
    ['who is expiring soon', 'memberships-view'],
    ['add a branch', 'add-branch'],
    ['print the qr code', 'gym-qr-code'],
    ['reset a staff password', 'reset-staff-password'],
  ];

  for (const [query, expectedId] of CASES) {
    it(`"${query}" → ${expectedId}`, () => {
      const ids = searchHelp(ARTICLES_EN, query).map(r => r.article.id);
      expect(ids, `got: ${ids.join(', ') || '(none)'}`).toContain(expectedId);
    });
  }

  it('ranks the intended article first for the two headline questions', () => {
    expect(searchHelp(ARTICLES_EN, 'how do i create a payment')[0].article.id).toBe('record-payment');
    expect(searchHelp(ARTICLES_EN, 'how do i create a member')[0].article.id).toBe('add-member');
  });
});
