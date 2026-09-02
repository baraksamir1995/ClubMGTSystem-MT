'use client';

import { useRef, useState } from 'react';
import { Upload, Loader2, Trash2, Eye, Link as LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Field, Input, Select, RichTextEditor } from '@/components/ui';
import { apiErrorMessage, networkErrorMessage } from '@/lib/api-error';
import { cn } from '@/lib/cn';
import AnnouncementDialog from './announcement-dialog';
import AnnouncementMedia from './announcement-media';
import type {
  AdminAnnouncement, AnnouncementAudience, AnnouncementMediaType,
} from '@/lib/types/announcement';

/**
 * Create / edit form for a "What's New" announcement.
 *
 * Save always PATCHes or POSTs the whole draft; publishing is a separate
 * action so an admin can iterate on a draft without it going live by
 * accident, and so "Save" on a live announcement never silently
 * unpublishes it.
 */

export interface GymOption { id: string; name: string }

interface Props {
  /** Null when creating. */
  announcement: AdminAnnouncement | null;
  gyms: GymOption[];
  onSaved: (saved: AdminAnnouncement) => void;
  onCancel: () => void;
}

/** `datetime-local` needs `YYYY-MM-DDTHH:mm` in local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local input value → ISO, or null when the field is empty. */
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export default function AnnouncementForm({ announcement, gyms, onSaved, onCancel }: Props) {
  const isEdit = announcement !== null;

  const [title, setTitle] = useState(announcement?.title ?? '');
  const [content, setContent] = useState(announcement?.content ?? '');
  const [mediaType, setMediaType] = useState<AnnouncementMediaType | ''>(announcement?.media_type ?? '');
  const [mediaUrl, setMediaUrl] = useState(announcement?.media_url ?? '');
  const [mediaPath, setMediaPath] = useState<string | null>(announcement?.media_path ?? null);
  const [ctaLabel, setCtaLabel] = useState(announcement?.cta_label ?? '');
  const [ctaUrl, setCtaUrl] = useState(announcement?.cta_url ?? '');
  const [audience, setAudience] = useState<AnnouncementAudience>(announcement?.audience ?? 'all');
  const [gymIds, setGymIds] = useState<string[]>(announcement?.gym_ids ?? []);
  const [publishedAt, setPublishedAt] = useState(toLocalInput(announcement?.published_at ?? null));
  const [expiresAt, setExpiresAt] = useState(toLocalInput(announcement?.expires_at ?? null));

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleGym = (id: string) => {
    setGymIds(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/super-admin/announcements/upload', { method: 'POST', body: fd });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(`Couldn't upload media — ${apiErrorMessage(json, res.status)}`);
        return;
      }
      const data = json?.data;
      // A 200 with no usable URL would blank the preview and then trip the
      // save guard, which reads as the upload having silently done nothing.
      if (typeof data?.url !== 'string' || !data.url) {
        toast.error("Couldn't upload media — the server did not return a URL");
        return;
      }
      setMediaUrl(data.url);
      setMediaPath(typeof data.path === 'string' ? data.path : null);
      setMediaType(data.media_type === 'video' ? 'video' : 'image');
    } catch {
      toast.error(networkErrorMessage());
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const clearMedia = () => {
    setMediaType(''); setMediaUrl(''); setMediaPath(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  /** The payload both Save and Preview read from. */
  const buildPayload = () => ({
    title: title.trim(),
    content,
    media_type: mediaType || null,
    media_url: mediaType ? mediaUrl.trim() || null : null,
    media_path: mediaType === 'video_url' ? null : mediaPath,
    cta_label: ctaLabel.trim() || null,
    cta_url: ctaUrl.trim() || null,
    audience,
    gym_ids: audience === 'selected' ? gymIds : [],
    published_at: fromLocalInput(publishedAt),
    expires_at: fromLocalInput(expiresAt),
  });

  const validate = (): string | null => {
    if (!title.trim()) return 'Enter a title';
    // The editor leaves an empty <br> / <p></p> behind, so check text.
    if (!content.replace(/<[^>]*>/g, '').trim()) return 'Write the update body';
    if (mediaType && !mediaUrl.trim()) return 'Add the media, or clear the media type';
    if (ctaLabel.trim() && !ctaUrl.trim()) return 'A CTA label needs a destination URL';
    if (ctaUrl.trim() && !ctaLabel.trim()) return 'A CTA URL needs a button label';
    if (ctaUrl.trim() && !/^(https?:\/\/|\/)/i.test(ctaUrl.trim())) {
      return 'The CTA URL must start with http://, https:// or / for an internal route';
    }
    if (audience === 'selected' && gymIds.length === 0) return 'Select at least one gym';
    const pub = fromLocalInput(publishedAt);
    const exp = fromLocalInput(expiresAt);
    if (pub && exp && new Date(exp) <= new Date(pub)) return 'The expiry date must be after the publish date';
    return null;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) { toast.error(problem); return; }

    setSaving(true);
    try {
      const url = isEdit
        ? `/api/super-admin/announcements/${announcement!.id}`
        : '/api/super-admin/announcements';

      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(`Couldn't save the update — ${apiErrorMessage(json, res.status)}`);
        return;
      }
      toast.success(isEdit ? 'Update saved' : 'Draft created');
      onSaved(json.data);
    } catch {
      toast.error(networkErrorMessage());
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSave} className="space-y-5">
        <Field label="Title" required>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Introducing Smart Reports"
            maxLength={255}
          />
        </Field>

        <div>
          <label className="block text-sm font-medium text-fg mb-1.5">
            Body <span className="text-danger">*</span>
          </label>
          <RichTextEditor value={content} onChange={setContent} />
          <p className="text-xs text-fg-faint mt-1.5">
            Bold, italic, headings, lists and links. Everything else is stripped when saved.
          </p>
        </div>

        {/* ── Media ──────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-fg">Media</label>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={mediaType === 'image' || mediaType === 'video' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => fileRef.current?.click()}
              isLoading={uploading}
              leftIcon={<Upload className="w-4 h-4" aria-hidden />}
            >
              Upload file
            </Button>
            <Button
              type="button"
              variant={mediaType === 'video_url' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => { setMediaType('video_url'); setMediaPath(null); }}
              leftIcon={<LinkIcon className="w-4 h-4" aria-hidden />}
            >
              Video URL
            </Button>
            {mediaType && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearMedia}
                leftIcon={<Trash2 className="w-4 h-4" aria-hidden />}
              >
                Remove
              </Button>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
          />

          {mediaType === 'video_url' && (
            <Input
              value={mediaUrl}
              onChange={e => setMediaUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=… or a direct .mp4 link"
            />
          )}

          <p className="text-xs text-fg-faint">
            Images and short videos up to 10 MB. For anything longer, host it on
            YouTube or Vimeo and paste the link.
          </p>

          {mediaType && mediaUrl && (
            <div className="rounded-lg border border-line overflow-hidden max-w-sm">
              <AnnouncementMedia mediaType={mediaType} mediaUrl={mediaUrl} title={title || 'Preview'} />
            </div>
          )}
        </div>

        {/* ── CTA ────────────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="CTA button label" hint="Leave both blank for no button.">
            <Input
              value={ctaLabel}
              onChange={e => setCtaLabel(e.target.value)}
              placeholder="Learn More"
              maxLength={60}
            />
          </Field>
          <Field label="CTA destination" hint="A full URL, or /dashboard/… for an internal page.">
            <Input
              value={ctaUrl}
              onChange={e => setCtaUrl(e.target.value)}
              placeholder="https://clbyapp.com/whats-new"
            />
          </Field>
        </div>

        {/* ── Audience ───────────────────────────────────────────────── */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-fg">Audience</label>
          <Select value={audience} onChange={e => setAudience(e.target.value as AnnouncementAudience)}>
            <option value="all">All gyms</option>
            <option value="selected">Selected gyms</option>
          </Select>

          {audience === 'selected' && (
            <div className="rounded-lg border border-line-strong bg-surface-2 max-h-56 overflow-y-auto divide-y divide-line">
              {gyms.length === 0 && (
                <p className="px-3 py-4 text-sm text-fg-muted">No gyms found.</p>
              )}
              {gyms.map(gym => (
                <label
                  key={gym.id}
                  className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-3/60"
                >
                  <input
                    type="checkbox"
                    checked={gymIds.includes(gym.id)}
                    onChange={() => toggleGym(gym.id)}
                    className="w-4 h-4 accent-brand-fill flex-shrink-0"
                  />
                  <span className="text-sm text-fg truncate">{gym.name}</span>
                </label>
              ))}
            </div>
          )}
          {audience === 'selected' && (
            <p className="text-xs text-fg-faint">
              {gymIds.length} gym{gymIds.length === 1 ? '' : 's'} selected.
            </p>
          )}
        </div>

        {/* ── Scheduling ─────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Publish date" hint="Leave blank to go live the moment you publish.">
            <Input type="datetime-local" value={publishedAt} onChange={e => setPublishedAt(e.target.value)} />
          </Field>
          <Field label="Expiry date" hint="After this it stops popping up but stays in the history.">
            <Input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
          </Field>
        </div>

        {/* ── Actions ────────────────────────────────────────────────── */}
        <div className={cn('flex flex-wrap gap-2 pt-2 border-t border-line')}>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const problem = validate();
              if (problem) { toast.error(problem); return; }
              setPreviewing(true);
            }}
            leftIcon={<Eye className="w-4 h-4" aria-hidden />}
          >
            Preview
          </Button>
          <div className="flex-1" />
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button type="submit" variant="primary" isLoading={saving}>
            {isEdit ? 'Save changes' : 'Save draft'}
          </Button>
        </div>
      </form>

      {/* Preview renders the exact component tenants get, from the
          unsaved form state — so what the admin approves is what ships. */}
      {previewing && (
        <AnnouncementDialog
          preview
          onClose={() => setPreviewing(false)}
          announcement={{
            id: 'preview',
            title: title.trim(),
            content,
            excerpt: '',
            media_type: (mediaType || null) as AnnouncementMediaType | null,
            media_url: mediaUrl.trim() || null,
            cta_label: ctaLabel.trim() || null,
            cta_url: ctaUrl.trim() || null,
            published_at: fromLocalInput(publishedAt) ?? new Date().toISOString(),
            expires_at: fromLocalInput(expiresAt),
            is_expired: false,
            is_read: false,
            read_at: null,
            dismissed_at: null,
          }}
        />
      )}
    </>
  );
}
