'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Home, Compass, RotateCcw, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { Button, Tabs } from '@/components/ui';
import { apiErrorMessage, networkErrorMessage } from '@/lib/api-error';
import { defaultAppLayout, normalizeAppLayout, type AppLayout, type AppLayoutScreen } from '@/lib/app-layout';

interface Props {
  initialLayout: unknown;
  canEdit: boolean;
}

/**
 * Settings → App Layout. Reorder (drag or arrows) and show/hide the
 * sections of the member app's Home and Explore screens.
 */
export default function AppLayoutSection({ initialLayout, canEdit }: Props) {
  const t = useTranslations('settings.layout');
  const tc = useTranslations('common');
  const tErr = useTranslations('common.errors');

  const [layout, setLayout] = useState<AppLayout>(() => normalizeAppLayout(initialLayout));
  const [screen, setScreen] = useState<AppLayoutScreen>('home');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const items = layout[screen];

  const update = (next: AppLayout) => { setLayout(next); setDirty(true); };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const rows = [...items];
    const [row] = rows.splice(from, 1);
    rows.splice(to, 0, row);
    update({ ...layout, [screen]: rows });
  };

  const toggle = (index: number) => {
    const rows = items.map((r, i) => (i === index ? { ...r, visible: !r.visible } : r));
    update({ ...layout, [screen]: rows });
  };

  // Resets only the tab being viewed.
  const reset = () => update({ ...layout, [screen]: defaultAppLayout()[screen] });

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_layout: layout }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(apiErrorMessage(data, res.status, tErr)); return; }
      if (data?.app_layout) setLayout(normalizeAppLayout(data.app_layout));
      setDirty(false);
      toast.success(t('saved'));
    } catch {
      toast.error(networkErrorMessage(tErr));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 mt-5">
      <p className="text-xs text-fg-muted">{t('description')}</p>

      <Tabs value={screen} onValueChange={v => { setScreen(v as AppLayoutScreen); setDragIndex(null); }}>
        <Tabs.List>
          <Tabs.Trigger value="home" icon={Home}>{t('home')}</Tabs.Trigger>
          <Tabs.Trigger value="explore" icon={Compass}>{t('explore')}</Tabs.Trigger>
        </Tabs.List>
      </Tabs>

      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={item.key}
            draggable={canEdit}
            onDragStart={e => {
              // Firefox won't start a drag without dataTransfer payload.
              e.dataTransfer.setData('text/plain', String(i));
              e.dataTransfer.effectAllowed = 'move';
              setDragIndex(i);
            }}
            onDragOver={e => { if (dragIndex !== null) e.preventDefault(); }}
            onDrop={e => { e.preventDefault(); if (dragIndex !== null) move(dragIndex, i); setDragIndex(null); }}
            onDragEnd={() => setDragIndex(null)}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
              dragIndex === i ? 'border-brand-edge bg-surface-3' : 'border-line bg-surface'
            } ${item.visible ? '' : 'opacity-50'}`}
          >
            {canEdit && <GripVertical className="w-4 h-4 text-fg-faint cursor-grab flex-shrink-0" aria-hidden />}
            <span className="w-5 text-xs text-fg-faint tabular-nums">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-fg">{t(`sections.${screen}.${item.key}.title`)}</p>
              <p className="text-xs text-fg-muted truncate">{t(`sections.${screen}.${item.key}.hint`)}</p>
            </div>
            {canEdit && (
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0}
                  className="p-1.5 rounded-md text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label={t('moveUp')}>
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => move(i, i + 1)} disabled={i === items.length - 1}
                  className="p-1.5 rounded-md text-fg-muted hover:text-fg hover:bg-surface-3 disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label={t('moveDown')}>
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => toggle(i)}
                  className={`p-1.5 rounded-md hover:bg-surface-3 ${item.visible ? 'text-brand' : 'text-fg-faint'}`}
                  aria-pressed={item.visible}
                  aria-label={item.visible ? t('hide') : t('show')}
                  title={item.visible ? t('hide') : t('show')}>
                  {item.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {screen === 'home' && items.some(i => i.key === 'membership' && !i.visible) && (
        <p className="text-xs text-warning">{t('membershipHiddenWarning')}</p>
      )}

      <p className="text-xs text-fg-faint">{t('emptyNote')}</p>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" onClick={save} isLoading={saving} disabled={!dirty}
            leftIcon={<Check className="w-4 h-4" />}>
            {saving ? tc('saving') : t('save')}
          </Button>
          <Button variant="ghost" onClick={reset} leftIcon={<RotateCcw className="w-4 h-4" />}>
            {t('reset')}
          </Button>
        </div>
      )}
    </div>
  );
}
