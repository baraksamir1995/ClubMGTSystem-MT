'use client';

/**
 * Design-system playground — every `components/ui/` primitive in its
 * key states, on one page. Cheaper than Storybook; use it to eyeball
 * changes to the tokens / primitives without hunting through real
 * screens.
 *
 * Route: /dashboard/dev/ui  (under the dashboard layout, so it's
 * already gated to authenticated admin/staff/trainer roles). Not in
 * the sidebar nav — reach it by URL.
 */

import { useState } from 'react';
import { Plus, Mail, Trash2, Dumbbell, PersonStanding, Users, Calendar } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  DataTable,
  type DataTableColumn,
  EmptyState,
  Field,
  FilterDropdown,
  Input,
  Modal,
  Pagination,
  PasswordInput,
  SearchInput,
  Select,
  Tabs,
  Textarea,
} from '@/components/ui';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs uppercase tracking-wide text-fg-faint">{title}</h2>
      <Card>{children}</Card>
    </section>
  );
}

interface DemoRow { id: string; name: string; email: string; sessions: number; }
const DEMO_ROWS: DemoRow[] = [
  { id: '1', name: 'Barak Samir',  email: 'barak@swap.com', sessions: 12 },
  { id: '2', name: 'Recv Tester',  email: 'recv@swap.com',  sessions: 4 },
  { id: '3', name: 'Salma Ahmed',  email: 'salma@gym.com',  sessions: 0 },
];

export default function UiPlayground() {
  const [tab, setTab]       = useState('buttons');
  const [modal, setModal]   = useState(false);
  const [filter, setFilter] = useState('');
  const [offset, setOffset] = useState(0);

  const cols: DataTableColumn<DemoRow>[] = [
    { key: 'member', header: 'Member', cell: (r) => (
      <div className="flex items-center gap-3">
        <Avatar name={r.name} size={32} />
        <div>
          <div className="text-fg">{r.name}</div>
          <div className="text-[11px] text-fg-muted">{r.email}</div>
        </div>
      </div>
    ) },
    { key: 'sessions', header: 'Sessions', align: 'right', cell: (r) => (
      <Badge variant={r.sessions === 0 ? 'danger' : r.sessions < 5 ? 'warning' : 'success'}>
        {r.sessions} left
      </Badge>
    ) },
  ];

  return (
    <div className="max-w-3xl space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-fg">UI Playground</h1>
        <p className="text-sm text-fg-muted mt-0.5">
          Every <code className="text-brand">components/ui</code> primitive in its key states.
        </p>
      </div>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-3 items-center">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger" leftIcon={<Trash2 className="w-4 h-4" />}>Danger</Button>
          <Button variant="primary" isLoading>Saving…</Button>
          <Button variant="primary" disabled>Disabled</Button>
          <Button variant="secondary" leftIcon={<Plus className="w-4 h-4" />}>With icon</Button>
        </div>
        <div className="flex flex-wrap gap-3 items-center mt-3">
          <Button size="sm">sm</Button>
          <Button size="md">md</Button>
          <Button size="lg">lg</Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge variant="neutral">Neutral</Badge>
          <Badge variant="brand">Brand</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="danger">Danger</Badge>
          <Badge variant="brand" size="sm">sm</Badge>
        </div>
      </Section>

      <Section title="Avatars">
        <div className="flex items-center gap-3">
          <Avatar name="Barak Samir" size={28} />
          <Avatar name="Salma Ahmed" size={40} />
          <Avatar name="Coach PT" size={56} />
          <Avatar name="Ring" size={40} ring="#B8FF2E" />
        </div>
      </Section>

      <Section title="Form controls">
        <div className="space-y-4 max-w-sm">
          <Field label="Email" required hint="We never share this.">
            <Input type="email" leftIcon={<Mail className="w-4 h-4" />} placeholder="you@gym.com" />
          </Field>
          <Field label="Password">
            <PasswordInput placeholder="••••••••" />
          </Field>
          <Field label="With error" error="This field is required.">
            <Input placeholder="Invalid state" />
          </Field>
          <Field label="Specialist type">
            <Select defaultValue="">
              <option value="">Choose…</option>
              <option value="pt">Personal Trainer</option>
              <option value="physio">Physiotherapist</option>
            </Select>
          </Field>
          <Field label="Bio">
            <Textarea rows={3} placeholder="Short bio…" />
          </Field>
        </div>
      </Section>

      <Section title="Filter bar + Search">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            className="flex-1 min-w-[200px]"
            onSearch={setFilter}
            placeholder="Debounced search…"
          />
          <FilterDropdown
            label="Type"
            value={filter}
            onChange={setFilter}
            options={[
              { value: '', label: 'All' },
              { value: 'pt', label: 'Personal Trainer' },
              { value: 'physio', label: 'Physiotherapist' },
            ]}
          />
        </div>
        <p className="text-[11px] text-fg-faint mt-2">Last value: <code>{filter || '∅'}</code></p>
      </Section>

      <Section title="Tabs">
        <Tabs value={tab} onValueChange={setTab}>
          <Tabs.List>
            <Tabs.Trigger value="buttons" icon={Dumbbell}>Buttons</Tabs.Trigger>
            <Tabs.Trigger value="forms"   icon={PersonStanding}>Forms</Tabs.Trigger>
            <Tabs.Divider />
            <Tabs.Trigger value="data"    icon={Calendar}>Data</Tabs.Trigger>
          </Tabs.List>
          <div className="mt-3 text-sm text-fg-muted">Active tab: <code className="text-brand">{tab}</code></div>
        </Tabs>
      </Section>

      <Section title="DataTable + Pagination">
        <DataTable
          columns={cols}
          rows={DEMO_ROWS}
          rowKey={(r) => r.id}
          empty={<EmptyState icon={Users} title="No rows" />}
        />
        <div className="mt-3">
          <Pagination total={35} limit={10} offset={offset} onChange={setOffset} />
        </div>
      </Section>

      <Section title="EmptyState">
        <EmptyState
          icon={Calendar}
          title="Nothing logged yet"
          description="Sessions will appear here once members are scanned in."
          action={<Button variant="primary" size="sm">Take action</Button>}
        />
      </Section>

      <Section title="Modal">
        <Button onClick={() => setModal(true)}>Open modal</Button>
        <Modal open={modal} onClose={() => setModal(false)} size="md">
          <Modal.Header>Example modal</Modal.Header>
          <Modal.Body>
            <Field label="Name" required>
              <Input placeholder="Type something…" />
            </Field>
            <p className="text-sm text-fg-muted">
              ESC closes this, the backdrop closes it, background scroll is locked.
            </p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" fullWidth onClick={() => setModal(false)}>Cancel</Button>
            <Button variant="primary"   fullWidth onClick={() => setModal(false)}>Confirm</Button>
          </Modal.Footer>
        </Modal>
      </Section>
    </div>
  );
}
