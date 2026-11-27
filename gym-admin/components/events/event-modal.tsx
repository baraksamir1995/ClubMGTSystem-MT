'use client';

import { useRef, useState } from 'react';
import { Plus, Upload, Image as ImageIcon, ArrowUp, ArrowDown, X, CalendarDays } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Button, Field, Input, Modal, Textarea } from '@/components/ui';
import { ToggleRow } from '@/components/store/product-modal';
import { apiErrorMessage, networkErrorMessage } from '@/lib/api-error';
import { parsePgTimestamp } from '@/lib/time';
import { IMAGE_MIME_TO_EXT, MAX_IMAGE_BYTES } from '@/lib/upload-validation';
import type { GymEvent, PlanOption } from '@/lib/types/store-events';

interface ConfigRow { key: string; id: string | null; name: string }

const ALLOWED_IMAGE_TYPES = Object.keys(IMAGE_MIME_TO_EXT);

/** Timestamp → value for <input type="datetime-local"> in the browser's zone. */
function toLocalInput(ts: string | null | undefined): string {
  if (!ts) return '';
  const d = parsePgTimestamp(ts);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value → ISO string (or null when empty). */
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function EventModal({ event, plans, onClose, onSaved }: {
  event: GymEvent | null;
  plans: PlanOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t    = useTranslations('events.modal');
  const tc   = useTranslations('common');
  const tErr = useTranslations('common.errors');

  const [title, setTitle]             = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [location, setLocation]       = useState(event?.location ?? '');
  const [imageUrl, setImageUrl]       = useState(event?.image_url ?? '');
  const [startsAt, setStartsAt]       = useState(toLocalInput(event?.starts_at));
  const [endsAt, setEndsAt]           = useState(toLocalInput(event?.ends_at));
  const [deadline, setDeadline]       = useState(toLocalInput(event?.registration_deadline));
  const [capacity, setCapacity]       = useState(event?.capacity != null ? String(event.capacity) : '');
  const [isPaid, setIsPaid]           = useState(event?.is_paid ?? false);
  const [price, setPrice]             = useState(event?.price_cents != null ? String(event.price_cents / 100) : '');
  const [currency, setCurrency]       = useState(event?.currency ?? 'EGP');
  const [published, setPublished]     = useState(event?.is_published ?? false);
  const [planIds, setPlanIds]         = useState<string[]>((event?.plan_targets ?? []).map(p => p.id));
  const [configLabel, setConfigLabel] = useState(event?.configuration_label ?? '');
  const [configs, setConfigs]         = useState<ConfigRow[]>(
    (event?.configurations ?? []).map(c => ({ key: c.id, id: c.id, name: c.name })),
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Show active plans, plus any inactive plan the event already targets so
  // it can still be un-ticked.
  const visiblePlans = plans.filter(p => p.is_active || planIds.includes(p.id));

  const togglePlan = (id: string) =>
    setPlanIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const addConfig = () =>
    setConfigs(prev => [...prev, { key: `new-${Date.now()}-${prev.length}`, id: null, name: '' }]);
  const renameConfig = (key: string, name: string) =>
    setConfigs(prev => prev.map(c => (c.key === key ? { ...c, name } : c)));
  const removeConfig = (key: string) => setConfigs(prev => prev.filter(c => c.key !== key));
  const moveConfig = (key: string, dir: -1 | 1) => setConfigs(prev => {
    const i = prev.findIndex(c => c.key === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= prev.length) return prev;
    const next = [...prev];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { toast.error(t('imageBadType')); return; }
    if (file.size > MAX_IMAGE_BYTES) { toast.error(t('imageTooBig')); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/events/image', { method: 'POST', body: form });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) { toast.error(apiErrorMessage(json, res.status, tErr)); return; }
      setImageUrl(json.url);
    } catch {
      toast.error(networkErrorMessage(tErr));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!title.trim()) { toast.error(t('titleRequired')); return; }
    const startsIso = fromLocalInput(startsAt);
    if (!startsIso) { toast.error(t('startRequired')); return; }
    const endsIso = fromLocalInput(endsAt);
    if (endsIso && endsIso <= startsIso) { toast.error(t('endAfterStart')); return; }
    const deadlineIso = fromLocalInput(deadline);
    if (deadlineIso && deadlineIso > startsIso) { toast.error(t('deadlineBeforeStart')); return; }

    let capacityNum: number | null = null;
    if (capacity.trim()) {
      capacityNum = parseInt(capacity, 10);
      if (!Number.isFinite(capacityNum) || capacityNum < 1) { toast.error(t('capacityInvalid')); return; }
    }

    let priceCents: number | null = null;
    if (isPaid) {
      const p = parseFloat(price);
      if (!Number.isFinite(p) || p < 1) { toast.error(t('priceInvalid')); return; }
      priceCents = Math.round(p * 100);
    }

    const cleanConfigs = configs.map(c => ({ ...(c.id ? { id: c.id } : {}), name: c.name.trim() })).filter(c => c.name);
    const names = cleanConfigs.map(c => c.name.toLowerCase());
    if (new Set(names).size !== names.length) { toast.error(t('optionsUnique')); return; }

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      image_url: imageUrl || null,
      starts_at: startsIso,
      ends_at: endsIso,
      registration_deadline: deadlineIso,
      capacity: capacityNum,
      is_paid: isPaid,
      price_cents: priceCents,
      currency: currency.trim().toUpperCase() || 'EGP',
      is_published: published,
      configuration_label: cleanConfigs.length > 0 ? configLabel.trim() || null : null,
      configurations: cleanConfigs,
      plan_ids: planIds,
    };

    setSaving(true);
    try {
      const res = await fetch(event ? `/api/events/${event.id}` : '/api/events', {
        method: event ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) { toast.error(apiErrorMessage(json, res.status, tErr)); return; }
      toast.success(event ? t('updated') : t('created'));
      onSaved();
    } catch {
      toast.error(networkErrorMessage(tErr));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg">
      <Modal.Header>
        <span className="inline-flex items-center gap-3">
          <span className="w-8 h-8 bg-brand/15 rounded-lg flex items-center justify-center">
            <CalendarDays className="w-4 h-4 text-brand" aria-hidden />
          </span>
          {event ? t('editTitle') : t('newTitle')}
        </span>
      </Modal.Header>
      <Modal.Body>
        {/* Cover image — previewed at 16:9, the crop the member app's home
            carousel and event screen use. */}
        <div>
          <p className="text-xs font-medium text-fg-muted mb-1.5">{t('cover')}</p>
          <div className="flex items-start gap-4">
            <div
              className="relative aspect-video w-48 flex-shrink-0 overflow-hidden rounded-xl border border-line bg-surface-3"
              data-testid="event-cover-preview"
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- user-uploaded image on external host
                <img src={imageUrl} alt={t('coverAlt')} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-fg-faint">
                  <ImageIcon className="h-5 w-5" aria-hidden />
                  <span className="text-[11px]">{t('noImage')}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col items-start gap-2">
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" isLoading={uploading}
                  leftIcon={<Upload className="h-3.5 w-3.5" />} onClick={() => fileRef.current?.click()}>
                  {imageUrl ? t('replaceImage') : t('uploadImage')}
                </Button>
                {imageUrl && !uploading && (
                  <Button type="button" variant="ghost" size="sm"
                    leftIcon={<X className="h-3.5 w-3.5" />} onClick={() => setImageUrl('')}>
                    {t('removeImage')}
                  </Button>
                )}
              </div>
              <p className="text-xs text-fg-faint max-w-[16rem]">{t('coverHint')}</p>
              <input ref={fileRef} type="file" accept={ALLOWED_IMAGE_TYPES.join(',')} className="hidden"
                onChange={handleImage} data-testid="event-cover-input" />
            </div>
          </div>
        </div>

        <Field label={t('title')} required>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder={t('titlePlaceholder')} maxLength={255} />
        </Field>

        <Field label={tc('description')}>
          <Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder={t('descriptionPlaceholder')} />
        </Field>

        <Field label={t('location')}>
          <Input value={location} onChange={e => setLocation(e.target.value)} placeholder={t('locationPlaceholder')} maxLength={255} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t('startsAt')} required>
            <Input type="datetime-local" value={startsAt} onChange={e => setStartsAt(e.target.value)} />
          </Field>
          <Field label={t('endsAt')}>
            <Input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} />
          </Field>
          <Field label={t('deadline')} hint={t('deadlineHint')}>
            <Input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </Field>
          <Field label={t('capacity')} hint={t('capacityHint')}>
            <Input type="number" min={1} step={1} value={capacity} onChange={e => setCapacity(e.target.value)} placeholder={t('unlimited')} />
          </Field>
        </div>

        <div className="space-y-3">
          <ToggleRow label={t('paid')} hint={t('paidHint')} checked={isPaid} onChange={setIsPaid} />
          {isPaid && (
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('price')} required hint={t('priceHint')}>
                <Input type="number" min={1} step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" />
              </Field>
              <Field label={tc('currency')}>
                <Input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={5} />
              </Field>
            </div>
          )}
          <ToggleRow
            label={t('publishedLabel')}
            hint={published ? t('publishedHint') : t('draftHint')}
            checked={published}
            onChange={setPublished}
          />
        </div>

        {/* Plan targeting */}
        <div>
          <p className="text-xs font-medium text-fg-muted mb-1.5">{t('audience')}</p>
          <div className="flex flex-wrap gap-2">
            <Chip selected={planIds.length === 0} onClick={() => setPlanIds([])}>{t('allMembers')}</Chip>
            {visiblePlans.map(p => (
              <Chip key={p.id} selected={planIds.includes(p.id)} onClick={() => togglePlan(p.id)}>{p.name}</Chip>
            ))}
          </div>
          <p className="text-xs text-fg-faint mt-1.5">
            {planIds.length === 0 ? t('audienceAllHint') : t('audiencePlansHint', { count: planIds.length })}
          </p>
        </div>

        {/* Options (pick-one) */}
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium text-fg">{t('options')}</p>
            <p className="text-xs text-fg-muted">{configs.length === 0 ? t('optionsHintEmpty') : t('optionsHint')}</p>
          </div>
          {configs.length > 0 && (
            <Field label={t('optionLabel')}>
              <Input value={configLabel} onChange={e => setConfigLabel(e.target.value)} placeholder={t('optionLabelPlaceholder')} maxLength={100} />
            </Field>
          )}
          {configs.map((c, i) => (
            <div key={c.key} className="flex items-center gap-1.5">
              <span className="w-5 text-xs text-fg-faint text-end flex-shrink-0">{i + 1}.</span>
              <Input value={c.name} onChange={e => renameConfig(c.key, e.target.value)} placeholder={t('optionPlaceholder')} maxLength={255} aria-label={t('optionName', { n: i + 1 })} />
              <IconBtn label={t('moveUp')} disabled={i === 0} onClick={() => moveConfig(c.key, -1)}><ArrowUp className="w-4 h-4" aria-hidden /></IconBtn>
              <IconBtn label={t('moveDown')} disabled={i === configs.length - 1} onClick={() => moveConfig(c.key, 1)}><ArrowDown className="w-4 h-4" aria-hidden /></IconBtn>
              <IconBtn label={tc('remove')} danger onClick={() => removeConfig(c.key)}><X className="w-4 h-4" aria-hidden /></IconBtn>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={addConfig}>
            {t('addOption')}
          </Button>
          {event && configs.some(c => c.id) && (
            <p className="text-xs text-fg-faint">{t('optionsRemoveNote')}</p>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={saving}>{tc('cancel')}</Button>
        <Button onClick={save} isLoading={saving} disabled={uploading}>{event ? tc('saveChanges') : t('create')}</Button>
      </Modal.Footer>
    </Modal>
  );
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
        selected
          ? 'bg-brand text-brand-ink border-brand'
          : 'bg-surface border-line text-fg-muted hover:border-line-strong hover:text-fg'
      }`}
    >
      {children}
    </button>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: {
  label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`p-1.5 rounded-md text-fg-muted hover:bg-surface-3 disabled:opacity-30 ${danger ? 'hover:text-danger' : 'hover:text-fg'}`}
    >
      {children}
    </button>
  );
}
