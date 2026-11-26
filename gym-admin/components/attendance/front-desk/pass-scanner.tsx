'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, CameraOff } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { createQrDecoder, type QrDecoder } from '@/lib/offline/qr-decoder';

interface Props {
  /** called once per decoded code; scanning stops until restarted */
  onDecoded: (raw: string) => void;
  disabled?: boolean;
  /** shown under the viewfinder (e.g. last scan error) */
  message?: React.ReactNode;
}

/** Camera viewfinder + decode loop for member passes. */
export function PassScanner({ onDecoded, disabled, message }: Props) {
  const t = useTranslations('attendance.frontDesk.scan');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<'unavailable' | 'denied' | null>(null);
  const [decoderName, setDecoderName] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  useEffect(() => stop, [stop]);

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('unavailable');
      return;
    }
    let decoder: QrDecoder;
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      decoder = await createQrDecoder();
    } catch (err) {
      stop();
      setError(err instanceof DOMException && err.name === 'NotAllowedError' ? 'denied' : 'unavailable');
      return;
    }
    setDecoderName(decoder.name);
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = streamRef.current;
    await video.play().catch(() => undefined);
    setActive(true);
    let busy = false;
    timerRef.current = setInterval(async () => {
      if (busy) return;
      busy = true;
      try {
        const raw = await decoder.decode(video);
        if (raw) {
          stop();
          onDecoded(raw);
        }
      } catch {
        // transient decode errors: keep scanning
      } finally {
        busy = false;
      }
    }, 200);
  };

  return (
    <Card padding="lg" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-fg">{t('title')}</h2>
        {active ? (
          <Button variant="secondary" size="sm" onClick={stop} leftIcon={<CameraOff className="w-4 h-4" />}>
            {t('stop')}
          </Button>
        ) : (
          <Button size="sm" onClick={start} disabled={disabled} leftIcon={<Camera className="w-4 h-4" />}>
            {t('start')}
          </Button>
        )}
      </div>
      <div className={`relative overflow-hidden rounded-lg bg-surface-3 aspect-video ${active ? '' : 'hidden'}`}>
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted aria-label={t('pointAt')} />
        <div className="pointer-events-none absolute inset-[15%] rounded-lg border-2 border-brand/80" aria-hidden />
      </div>
      <p className="text-sm text-fg-muted">{t('pointAt')}</p>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error === 'denied' ? t('cameraDenied') : t('cameraUnavailable')}
        </p>
      )}
      {message}
      {decoderName && <p className="text-xs text-fg-faint">{t('decoder', { name: decoderName })}</p>}
    </Card>
  );
}
