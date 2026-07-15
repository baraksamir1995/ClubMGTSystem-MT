'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * Avatar — initials badge with a deterministic colour derived from the
 * name. If a `src` URL is provided, renders that instead. Same hash
 * algorithm as the Coachesapp Flutter `Avatar`, so the same name maps
 * to the same colour on both surfaces.
 *
 *   <Avatar name="Barak Samir" />
 *   <Avatar name="Salma Ahmed" size={56} />
 *   <Avatar name="Coach PT" src={profile.photo_url} />
 */
export interface AvatarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  name: string;
  /** Optional image; falls back to initials. */
  src?: string | null;
  /** Pixel diameter. Defaults to 40. */
  size?: number;
  /** Optional ring colour around the avatar. */
  ring?: string;
}

// Fixed (theme-invariant) avatar fill tokens. Each shade keeps the
// white initials text at ≥7:1 (WCAG AAA) — verified alongside the
// theme palettes in scripts/contrast-audit.mjs. Darkened from the
// original Flutter-matching set for contrast; the hash (slot per name)
// is unchanged, only the shade differs cross-platform.
const PALETTE = [
  '#8C2B1A', // red
  '#7A4A0E', // orange
  '#155E5E', // teal
  '#563397', // purple
  '#8A2F68', // magenta
  '#1F5E3A', // green
  '#2A4A8C', // blue
  '#5C5813', // olive
];

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xff;
  return PALETTE[h % PALETTE.length];
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(function Avatar(
  { name, src, size = 40, ring, className, style, ...rest },
  ref,
) {
  const dim = `${size}px`;
  const inlineStyle = {
    width: dim,
    height: dim,
    fontSize: `${Math.round(size * 0.36)}px`,
    background: src ? undefined : colorFor(name),
    boxShadow: ring ? `0 0 0 2px ${ring} inset` : undefined,
    ...style,
  };
  return (
    <div
      ref={ref}
      title={name}
      role="img"
      aria-label={name}
      className={cn(
        'flex-shrink-0 rounded-full inline-flex items-center justify-center',
        'text-white font-semibold leading-none overflow-hidden',
        className,
      )}
      style={inlineStyle}
      {...rest}
    >
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        initialsOf(name)
      )}
    </div>
  );
});
