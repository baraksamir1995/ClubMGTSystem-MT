/**
 * Automated accessibility audit (axe-core) over a representative
 * composition of the design-system primitives, run once per theme.
 *
 * Scope note: axe's color-contrast rule needs a real layout engine and
 * reports "incomplete" under happy-dom, so contrast is NOT covered
 * here — it is guaranteed deterministically by
 * scripts/contrast-audit.mjs, which verifies every token pairing in
 * both palettes at WCAG AAA thresholds. This suite covers the
 * structural rules: names/roles/values, landmarks, labels, ARIA
 * validity, keyboard-reachable controls.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useState } from 'react';
import axe from 'axe-core';
import { NextIntlClientProvider } from 'next-intl';
import layout from '@/messages/en/layout.json';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { SearchInput } from '@/components/ui/search-input';
import { Tabs } from '@/components/ui/tabs';
import { DataTable } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '@/components/ui/avatar';
import { FilterDropdown } from '@/components/ui/filter-dropdown';
import { Modal } from '@/components/ui/modal';
import ThemeToggle from '@/components/theme/theme-toggle';

type Row = { id: number; name: string; status: string };
const rows: Row[] = [
  { id: 1, name: 'Barak Samir', status: 'active' },
  { id: 2, name: 'Salma Ahmed', status: 'expired' },
];

function Fixture() {
  const [tab, setTab] = useState('members');
  return (
    <NextIntlClientProvider locale="en" messages={{ layout }}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header>
        <ThemeToggle />
      </header>
      <nav aria-label="Main">
        <a href="/dashboard" aria-current="page">Overview</a>
      </nav>
      <main id="main-content">
        <h1>Members</h1>

        <Tabs value={tab} onValueChange={setTab}>
          <Tabs.List>
            <Tabs.Trigger value="members">Members</Tabs.Trigger>
            <Tabs.Trigger value="memberships">Memberships</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="members">
            <SearchInput placeholder="Search members…" aria-label="Search members" />
            <FilterDropdown
              label="Status"
              value=""
              onChange={() => {}}
              options={[{ value: '', label: 'All' }, { value: 'active', label: 'Active' }]}
            />
            <DataTable<Row>
              columns={[
                { key: 'name', header: 'Name', cell: (r) => r.name },
                {
                  key: 'status',
                  header: 'Status',
                  cell: (r) => (
                    <Badge variant={r.status === 'active' ? 'success' : 'danger'}>
                      {r.status}
                    </Badge>
                  ),
                },
              ]}
              rows={rows}
              rowKey={(r) => r.id}
              onRowClick={() => {}}
            />
            <Pagination total={100} limit={20} offset={20} onChange={() => {}} />
          </Tabs.Content>
        </Tabs>

        <Card>
          <form>
            <Field label="Full name" required>
              <Input placeholder="Member name" />
            </Field>
            <Field label="Email" hint="Used for the member app login." error="Email is taken">
              <Input type="email" />
            </Field>
            <Field label="Password">
              <PasswordInput />
            </Field>
            <Field label="Plan">
              <Select>
                <option value="">Choose a plan</option>
                <option value="1">Monthly</option>
              </Select>
            </Field>
            <Field label="Notes">
              <Textarea />
            </Field>
            <Button variant="primary">Save</Button>
            <Button variant="secondary">Cancel</Button>
            <Button variant="ghost" size="sm">More</Button>
            <Button variant="danger" isLoading>Deleting…</Button>
          </form>
        </Card>

        <Avatar name="Barak Samir" />
        <EmptyState title="No sessions yet" description="Book the first one." />
      </main>
    </NextIntlClientProvider>
  );
}

function ModalFixture() {
  return (
    <NextIntlClientProvider locale="en" messages={{ layout }}>
      <main>
        <h1>Page</h1>
        <Modal open onClose={() => {}}>
          <Modal.Header>Assign plan</Modal.Header>
          <Modal.Body>
            <Field label="Plan">
              <Select>
                <option value="1">Monthly</option>
              </Select>
            </Field>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" fullWidth>Cancel</Button>
            <Button variant="primary" fullWidth>Assign</Button>
          </Modal.Footer>
        </Modal>
      </main>
    </NextIntlClientProvider>
  );
}

async function runAxe(): Promise<axe.AxeResults> {
  return axe.run(document.body, {
    // Contrast needs a real layout engine (see header comment) —
    // covered by scripts/contrast-audit.mjs instead.
    rules: { 'color-contrast': { enabled: false }, 'color-contrast-enhanced': { enabled: false } },
  });
}

function formatViolations(v: axe.Result[]): string {
  return v
    .map((r) => `${r.id}: ${r.help}\n  ${r.nodes.map((n) => n.html).join('\n  ')}`)
    .join('\n');
}

describe.each(['light', 'dark'] as const)('axe audit (%s theme)', (theme) => {
  afterEach(cleanup);

  it('page composition has no violations', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    render(<Fixture />);
    const results = await runAxe();
    expect(formatViolations(results.violations)).toBe('');
  });

  it('open modal has no violations', async () => {
    document.documentElement.setAttribute('data-theme', theme);
    render(<ModalFixture />);
    const results = await runAxe();
    expect(formatViolations(results.violations)).toBe('');
  });
});
