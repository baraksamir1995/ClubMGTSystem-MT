# `components/ui/` — design-system primitives

Single source of truth for **all** reusable UI in the gym-admin
dashboard. New screens import primitives from here; raw Tailwind
utilities for colours (`bg-purple-*`, `bg-gray-700+`) belong inside
this folder only, never in feature pages.

## Why this exists

- Before: 540+ `purple-*` and 414+ dark `gray-*` class references
  scattered across feature components. Rebranding required a Tailwind
  palette remap + a global `!important` CSS override + per-file hand
  edits. Modals re-implemented backdrops; every form re-defined an
  input class string.
- After: brand changes happen in `tailwind.config.ts`; new screens
  compose `<Button>`, `<Input>`, `<Modal>`, `<DataTable>`, etc., and
  inherit the brand for free.

## Guardrail + playground

- **ESLint rule** (`.eslintrc.json`, `no-restricted-syntax`): warns on
  `bg/text/border/hover:/focus:/ring-(purple-{300..950} | gray-{700..950})`
  in JSX/template strings — **everywhere except** `components/ui/`,
  `app/globals.css`, and `tailwind.config.ts`. New code that reaches for
  a legacy class gets flagged by `npm run lint`. As of Stage 5 there are
  ~310 pre-existing warnings — that's the sweep backlog, knocked down
  page-by-page.
- **Playground**: `/dashboard/dev/ui` renders every primitive in its key
  states. Use it to eyeball token / primitive changes without hunting
  through real screens. Not in the sidebar — reach it by URL.

## Token vocabulary

Defined in `tailwind.config.ts → theme.extend.colors`. Each role has
a short semantic name and is used as `bg-<role>`, `text-<role>`, or
`border-<role>` in Tailwind classes.

| Role | Class | Hex | When |
| --- | --- | --- | --- |
| Brand primary | `bg-brand`     | `#B8FF2E` | Filled CTAs, the active nav indicator |
| On-brand ink  | `text-brand-ink` | `#0A0A0A` | Text that sits **on** `bg-brand` |
| Brand dim     | `bg-brand-dim` | `#A1E125` | Hover / active state for brand-filled buttons |
| Accent        | `bg-accent` / `text-accent` | `#FF6B2B` | "Energy" highlights, sparingly |
| Surface (page) | `bg-surface`   | `#0A0A0A` | Page background |
| Surface 2     | `bg-surface-2` | `#161616` | Cards, modal fill, table chrome |
| Surface 3     | `bg-surface-3` | `#1F1F1F` | Hover / pressed strata |
| Surface 4     | `bg-surface-4` | `#272727` | Tertiary chips |
| Line          | `border-line`  | `rgba(255,255,255,0.08)` | Hairline borders, dividers |
| Line strong   | `border-line-strong` | `rgba(255,255,255,0.14)` | Heavier dividers, focus rings |
| FG            | `text-fg`      | `#F5F5F2` | Primary text |
| FG muted      | `text-fg-muted` | `#A3A39C` | Secondary text, helper copy |
| FG faint      | `text-fg-faint` | `#5E5E58` | Disabled / placeholder |
| Success       | `text-success` / `bg-success-soft` | `#6FD08C` | Success state |
| Warning       | `text-warning` / `bg-warning-soft` | `#E8AC4F` | Warning, low-balance |
| Danger        | `text-danger` / `bg-danger-soft` | `#E56A4A` | Errors, destructive actions |

### Legacy aliases — do **not** use in new code

`clby-*`, `purple-*`, `bg-gray-{700..950}` are kept in the config so
old components keep rendering. New code uses the semantic tokens above.
The eslint rule (Stage 5) will start flagging legacy usage outside
`components/ui/` once it lands.

## Primitives

### `<Field>` — label + hint + error wrapper

Wraps any form control with consistent label / helper / error layout.
Generates a stable id via `useId()` and clones the child to inject
`id`, `aria-describedby`, and `aria-invalid`.

```tsx
import { Field, Input, PasswordInput } from '@/components/ui';

<Field label="Email address" required>
  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
</Field>

<Field label="Password" hint="Leave blank to keep current.">
  <PasswordInput value={pw} onChange={e => setPw(e.target.value)} />
</Field>

<Field label="Mobile number" error={mobileError}>
  <Input inputMode="tel" value={phone} onChange={…} />
</Field>
```

| Prop | Type | Purpose |
| --- | --- | --- |
| `label` | `ReactNode` | The visible label. |
| `hint` | `ReactNode?` | Helper text shown below the input when no `error`. |
| `error` | `ReactNode?` | Inline error; flips the input into invalid state. |
| `required` | `boolean?` | Renders a red asterisk after the label. |

Only one direct child is supported. For multi-element rows (e.g.
input + side button), pass a wrapping `<div>`; the visible layout
still works but the label's `htmlFor` will point at the wrapper.

### `<Input>` / `<Textarea>` / `<Select>` / `<PasswordInput>`

Native form controls re-skinned to the design system. All forward
`ref`, accept a `className` for one-off tweaks, and play well with
`<Field>` (it injects `id`, `aria-*`, and `invalid` automatically).

```tsx
import { Input, Textarea, Select, PasswordInput } from '@/components/ui';

<Input
  type="email"
  value={email}
  onChange={e => setEmail(e.target.value)}
  leftIcon={<Mail className="w-4 h-4" />}
  placeholder="you@gym.com"
/>

<Textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} />

<Select value={trainerId} onChange={e => setTrainerId(e.target.value)}>
  <option value="">All specialists</option>
  {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
</Select>

{/* Uncontrolled visibility (most common). */}
<PasswordInput value={pw} onChange={e => setPw(e.target.value)} />

{/* Controlled — e.g. so the "Generate" button can reveal the new value. */}
const [show, setShow] = useState(false);
<PasswordInput value={pw} onChange={…} visible={show} onVisibleChange={setShow} />
```

Common props across the inputs:

| Prop | Notes |
| --- | --- |
| `invalid` | Red border + focus ring. `<Field>` flips this on `error`. |
| `leftIcon` / `rightIcon` (Input + PasswordInput) | Inline adornments; `PasswordInput`'s eye toggle owns the right slot. |
| `leftAdornment` (Select) | Leading icon inside the select pill. |

### `<Modal>` — backdrop + slots, portal-rendered

Pulls the hand-rolled `fixed inset-0 z-50 bg-black/60 backdrop-blur-sm` /
`max-h-[90vh]` / "× close" boilerplate every old modal duplicated into
a single primitive with explicit Header / Body / Footer slots.

```tsx
import { Modal, Button, Field, Input } from '@/components/ui';

<Modal open={open} onClose={close} size="md">
  <Modal.Header>New specialist</Modal.Header>
  <Modal.Body>
    <Field label="Name" required>
      <Input value={name} onChange={e => setName(e.target.value)} />
    </Field>
  </Modal.Body>
  <Modal.Footer>
    <Button variant="secondary" fullWidth onClick={close}>Cancel</Button>
    <Button variant="primary"   fullWidth onClick={save}>Save</Button>
  </Modal.Footer>
</Modal>
```

Built-in: ESC to close, background scroll-lock, `createPortal` to
`document.body` (no clipping by ancestor `overflow`), `role="dialog"`
+ `aria-modal` + `aria-labelledby` linked to `<Modal.Header>`.

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `open` | `boolean` | — | Required. Mount/unmount toggle. |
| `onClose` | `() => void` | — | Required. Fired by ESC, backdrop, or the × in `Modal.Header`. |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | `max-w-*` preset on the panel. |
| `closeOnBackdrop` | `boolean` | `true` | Set false for destructive confirmations. |

### `<Card>` — surface tile

```tsx
<Card>Default md padding</Card>
<Card padding="lg">Bigger inset</Card>
<Card padding="none">
  <Card.Header>Title</Card.Header>
  <Card.Body>…content…</Card.Body>
  <Card.Footer>…actions…</Card.Footer>
</Card>
<Card variant="hoverable" onClick={open}>Clickable tile</Card>
```

`padding`: `none | sm | md | lg`. `variant`: `default | hoverable | muted`.
For multi-section cards set `padding="none"` and use the slots —
they bring consistent internal padding + dividers.

### `<EmptyState>` — "nothing here yet" with optional CTA

```tsx
import { EmptyState, Card } from '@/components/ui';
import { Users } from 'lucide-react';

<Card padding="none">
  <EmptyState
    icon={Users}
    title="No specialists yet"
    description="Add your first specialist to assign session packages."
    action={<Button onClick={open}>Add specialist</Button>}
  />
</Card>
```

`size="sm"` for inline rows, `'md'` (default) for full-section
placeholders. Drops in cleanly inside `<Card padding="none">`.

### `<Tabs>` — controlled chip-style tab bar

```tsx
import { Tabs } from '@/components/ui';

<Tabs value={tab} onValueChange={setTab}>
  <Tabs.List>
    <Tabs.Trigger value="pt"     icon={Dumbbell}>Personal Training</Tabs.Trigger>
    <Tabs.Trigger value="physio" icon={PersonStanding}>Physiotherapy</Tabs.Trigger>
    <Tabs.Divider />
    <Tabs.Trigger value="log"    icon={ClipboardList}>Services Log</Tabs.Trigger>
  </Tabs.List>

  {/* Either render bodies declaratively… */}
  <Tabs.Content value="pt">…</Tabs.Content>
  {/* …or switch outside on the same `tab` state. Tabs.Content is optional. */}
</Tabs>
```

Compound component; the triggers / contents share state via context.
`Tabs.Divider` renders a hairline separator between trigger groups.

### `<Badge>` — small status / category pill

```tsx
<Badge variant="success">Active</Badge>
<Badge variant="warning">Low balance</Badge>
<Badge variant="danger">Expired</Badge>
<Badge variant="brand">Coach</Badge>
<Badge variant="neutral" size="sm">Internal</Badge>
```

`variant: neutral | brand | success | warning | danger`,
`size: sm | md`.

### `<Avatar>` — hashed-initial badge

```tsx
<Avatar name="Barak Samir" />                    // 40×40 initials
<Avatar name="Salma Ahmed" size={56} />          // bigger
<Avatar name="Coach PT" src={profile.photoUrl} /> // image w/ initials fallback
```

Same hash algorithm as the Coachesapp Flutter `Avatar`, so the same
name maps to the same colour on both surfaces.

### `<SearchInput>` — debounced search box

Two usage modes — pick the one that matches the caller's state:

```tsx
{/* Uncontrolled — caller only sees the *debounced* result */}
<SearchInput
  defaultValue=""
  onSearch={(q) => fetchRows(0, q)}
  debounceMs={400}
  placeholder="Search members…"
/>

{/* Controlled — caller owns `value`; debounce is up to you */}
<SearchInput value={q} onValueChange={setQ} />
```

Comes with the leading magnifier and a clear-on-X icon when there's
input. Clearing fires `onSearch('')` immediately (no debounce delay).

### `<FilterDropdown>` — labelled native select for filter bars

```tsx
<FilterDropdown
  label="Specialist"
  value={trainerId}
  onChange={setTrainerId}
  options={[
    { value: '', label: 'All specialists' },
    ...trainers.map(t => ({ value: t.id, label: t.name })),
  ]}
/>
```

Compact pill chrome so it sits inline next to a `<SearchInput>` in
a filter bar. `icon` defaults to `Filter`; pass any lucide component
to override.

### `<Pagination>` — server-side prev / page-x-of-y / next

```tsx
<Pagination
  total={total}
  limit={PAGE_SIZE}
  offset={offset}
  onChange={(o) => fetchRows(o)}
  loading={loading}
/>
```

Renders **nothing** when `total <= limit` — no UI noise on small
datasets. The caller still owns the fetcher; the component just
emits new offsets.

### `<DataTable>` — column config + rows + loading/empty

```tsx
<DataTable
  columns={[
    { key: 'date',   header: 'Date',   cell: (r) => <DateCell r={r}/> },
    { key: 'member', header: 'Member', cell: (r) => <MemberCell r={r}/> },
    { key: 'price',  header: 'Price',  cell: (r) => fmtMoney(r.price), align: 'right' },
  ]}
  rows={data}
  rowKey={(r) => r.id}
  loading={loading}
  empty={<EmptyState icon={Calendar} title="Nothing yet" />}
  onRowClick={(r) => router.push(`/x/${r.id}`)}
/>
```

| Column field | Notes |
| --- | --- |
| `key` | React key + column id; stable across renders. |
| `header` / `cell` | Plain ReactNode; cell receives the typed row. |
| `align` | `left \| center \| right`; applied to header + cells. |
| `width` | Number → `${n}px`, or pass a CSS length string. |
| `hideOnMobile` | Hides on screens below `sm`. |

States baked in:
- **Initial load** (no rows yet) — full-table spinner.
- **Refresh** (rows present + loading) — small spinner overlay; body stays readable.
- **Empty** — renders the `empty` slot. Pair with `<EmptyState>`.
- **Clickable rows** — pass `onRowClick`; hover + cursor styles applied.

### `<Button>`

```tsx
import { Button } from '@/components/ui';

<Button variant="primary"   onClick={save}>Save</Button>
<Button variant="secondary" leftIcon={<Plus className="w-4 h-4"/>}>Add specialist</Button>
<Button variant="ghost"     size="sm">Cancel</Button>
<Button variant="danger"    isLoading>Deleting…</Button>
<Button fullWidth>Sign in</Button>
```

| Prop | Type | Default | Purpose |
| --- | --- | --- | --- |
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'primary'` | Visual role |
| `size`    | `'sm' \| 'md' \| 'lg'` | `'md'` | Compact rows / standard / hero |
| `fullWidth` | `boolean` | `false` | Stretch to container width |
| `isLoading` | `boolean` | `false` | Spinner + disabled + `aria-busy` |
| `leftIcon`, `rightIcon` | `ReactNode` | — | Adornments (hidden while loading) |

Forwarded ref + `aria-busy` + keyboard focus ring + correct
text-on-bg contrast are all baked in. Don't add `text-white` /
`bg-purple-600` manually — the variant handles it.

## Migration roadmap

| Stage | Adds | Status |
| --- | --- | --- |
| 1 | Tokens + `<Button>`; login Sign-in migrated as the reference | **done** |
| 2 | `<Field>`, `<Input>`, `<Textarea>`, `<Select>`, `<PasswordInput>`; login + trainer-modal forms migrated | **done** |
| 3 | `<Modal>`, `<Card>`, `<EmptyState>`, `<Tabs>`; trainer-modal layout + Services tab bar + Specialists/Packages empty states migrated | **done** |
| 4 | `<DataTable>`, `<Pagination>`, `<SearchInput>`, `<FilterDropdown>`, `<Badge>`, `<Avatar>`; Services Log migrated end-to-end | **done** |
| 5 | ESLint guardrail (`.eslintrc.json`) + `/dashboard/dev/ui` playground; login fully de-legacied | **done** (sweep of remaining pages is ongoing) |

Each stage ships independently; the dashboard never regresses during
the migration.
