'use client';

import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { AnnouncementMediaType } from '@/lib/types/announcement';

/**
 * The media strip at the top of an announcement.
 *
 * One component for all three media kinds so the popup, the detail view
 * and the super-admin preview can never drift apart in how they crop or
 * frame an image.
 *
 * Videos sit in a fixed 16:9 frame, which is what a player expects.
 * Images instead keep their own aspect ratio inside a height cap: a
 * product screenshot cropped to 16:9 loses its edges and dominates the
 * dialog, so `object-contain` plus a max-height is what actually reads
 * as "responsive and properly cropped" for this content.
 */

/** Turn a YouTube/Vimeo watch URL into its embeddable form. */
export function toEmbedUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = url.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}`;
      // Already an /embed/ or /shorts/ link.
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'embed') return raw;
      if (parts[0] === 'shorts' && parts[1]) return `https://www.youtube.com/embed/${parts[1]}`;
    }

    if (host === 'youtu.be') {
      const id = url.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }

    if (host === 'vimeo.com') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }

    if (host === 'player.vimeo.com') return raw;

    return null;
  } catch {
    return null;
  }
}

/** True when the URL points at a file a <video> tag can play directly. */
function isDirectVideoFile(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(url);
}

interface Props {
  mediaType: AnnouncementMediaType | null;
  mediaUrl: string | null;
  title: string;
  /** Tailwind aspect ratio. Defaults to the 16:9 popup banner. */
  aspect?: string;
  className?: string;
}

export default function AnnouncementMedia({
  mediaType,
  mediaUrl,
  title,
  aspect = 'aspect-video',
  className,
}: Props) {
  if (!mediaType || !mediaUrl) return null;

  const frame = cn('relative w-full overflow-hidden bg-surface-3', aspect, className);

  if (mediaType === 'image') {
    // Images size to their own aspect ratio inside a height cap, rather
    // than being cropped into a fixed 16:9 band. Announcement art is
    // usually a UI screenshot, and `object-cover` on a fixed frame both
    // cut off the sides and ate half the dialog before the reader
    // reached the text. `object-contain` keeps the whole image, and the
    // max-height stops a tall portrait shot from pushing the title off
    // screen. Padding the frame keeps the letterboxing deliberate
    // rather than looking like a broken fit.
    return (
      <div className={cn('w-full bg-surface-3 flex items-center justify-center p-3', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- media lives on S3, not the Next image loader */}
        <img
          src={mediaUrl}
          alt={title}
          className="max-w-full max-h-[min(38vh,20rem)] w-auto h-auto object-contain rounded-lg"
        />
      </div>
    );
  }

  // Uploaded file, or a URL that points straight at a video file.
  if (mediaType === 'video' || isDirectVideoFile(mediaUrl)) {
    return (
      <div className={frame}>
        <video
          src={mediaUrl}
          controls
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover bg-black"
        />
      </div>
    );
  }

  const embed = toEmbedUrl(mediaUrl);
  if (embed) {
    return (
      <div className={frame}>
        <iframe
          src={embed}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
        />
      </div>
    );
  }

  // A video URL we can't embed — a dead frame would look broken, so show
  // a placeholder that still links out.
  return (
    <div className={cn(frame, 'flex items-center justify-center')}>
      <a
        href={mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-sm text-fg-muted hover:text-fg"
      >
        <ImageIcon className="w-4 h-4" aria-hidden />
        Watch video
      </a>
    </div>
  );
}

/**
 * Small square thumbnail for What's New list rows.
 *
 * Videos get an icon rather than a live player — 20 autoplaying iframes
 * in a popover would be both slow and unreadable.
 */
export function AnnouncementThumb({
  mediaType,
  mediaUrl,
  title,
}: Pick<Props, 'mediaType' | 'mediaUrl' | 'title'>) {
  const base = 'w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-surface-3 flex items-center justify-center';

  if (mediaType === 'image' && mediaUrl) {
    return (
      <div className={base}>
        {/* eslint-disable-next-line @next/next/no-img-element -- media lives on S3 */}
        <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div className={base} aria-hidden>
      <ImageIcon className="w-5 h-5 text-fg-faint" />
    </div>
  );
}
