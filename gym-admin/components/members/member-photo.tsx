'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Camera, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/ui';

/**
 * Member photo — the avatar in the member-detail header, made editable.
 * Click (or keyboard-activate) to pick a file; the upload writes
 * profiles.photo_url through /api/members/{id}/photo, so the same value
 * feeds the admin tables and the mobile app. The X button clears it and
 * the initials avatar comes back.
 *
 * Kept client-side-validated as well as server-validated: the API is the
 * authority, this just gives immediate feedback on the two easy cases.
 */

const ACCEPTED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024; // matches the API's `max:5120`

interface Props {
  memberId: string;
  memberName: string;
  photoUrl: string | null;
  size?: number;
}

export default function MemberPhoto({ memberId, memberName, photoUrl, size = 56 }: Props) {
  const t = useTranslations('members.detail');
  const tc = useTranslations('common');
  const router = useRouter();

  const fileRef = useRef<HTMLInputElement>(null);
  // `preview` holds the committed URL (or a local data: URL while the
  // upload is in flight) so the header updates before router.refresh().
  const [preview, setPreview] = useState<string | null>(photoUrl);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  const busy = uploading || removing;

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so re-picking the same file still fires onChange.
    e.target.value = '';
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      toast.error(t('photoInvalidType'));
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(t('photoTooLarge'));
      return;
    }

    // Snapshot so a failed upload restores exactly what was showing.
    const previous = preview;

    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/members/${memberId}/photo`, { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok) {
        setPreview(previous);
        toast.error(data.error ?? t('photoUploadFailed'));
        return;
      }

      setPreview(data.url ?? previous);
      toast.success(t('photoUpdated'));
      router.refresh();
    } catch {
      setPreview(previous);
      toast.error(tc('networkError'));
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm(t('photoRemoveConfirm'))) return;

    const previous = preview;
    setRemoving(true);
    try {
      const res = await fetch(`/api/members/${memberId}/photo`, { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? t('photoRemoveFailed'));
        return;
      }

      setPreview(null);
      toast.success(t('photoRemoved'));
      router.refresh();
    } catch {
      setPreview(previous);
      toast.error(tc('networkError'));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        title={preview ? t('photoChange') : t('photoUpload')}
        aria-label={preview ? t('photoChange') : t('photoUpload')}
        className="group relative block rounded-full overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface-2 disabled:cursor-not-allowed"
        style={{ width: size, height: size }}
      >
        <Avatar name={memberName} src={preview} size={size} />
        <span className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
          <Camera className="w-5 h-5 text-white" aria-hidden />
        </span>
        {busy && (
          <span className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin" aria-hidden />
          </span>
        )}
      </button>

      {preview && !busy && (
        <button
          type="button"
          onClick={handleRemove}
          title={t('photoRemove')}
          aria-label={t('photoRemove')}
          className="absolute -top-1 -end-1 p-1 rounded-full bg-surface-2 border border-line text-fg-faint hover:text-danger hover:border-danger transition-colors"
        >
          <X className="w-3 h-3" aria-hidden />
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED.join(',')}
        className="hidden"
        onChange={handleChange}
      />
      <span className="sr-only">{t('photoHint')}</span>
    </div>
  );
}
