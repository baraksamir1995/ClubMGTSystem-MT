'use client';

import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui';

/**
 * Avatar that only uses the photo once it has actually loaded — offline, a
 * cached photo URL may not be reachable and must fall back to initials
 * instead of a broken image (the staff confirm step relies on it).
 */
export function SafeAvatar({ name, src, size }: { name: string; src: string | null | undefined; size?: number }) {
  const [loaded, setLoaded] = useState<string | null>(null);
  useEffect(() => {
    if (!src) return;
    let alive = true;
    const img = new Image();
    img.onload = () => alive && setLoaded(src);
    img.onerror = () => alive && setLoaded(null);
    img.src = src;
    return () => {
      alive = false;
    };
  }, [src]);
  return <Avatar name={name} src={src && loaded === src ? src : null} size={size} />;
}
