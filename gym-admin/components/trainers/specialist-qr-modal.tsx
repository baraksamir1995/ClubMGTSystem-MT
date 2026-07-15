'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { QrCode, Download, Printer } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button, Modal } from '@/components/ui';

interface Props {
  gymId: string;
  trainerId: string;
  trainerName: string;
  trainerType: 'personal_trainer' | 'nutritionist' | 'physiotherapist';
  onClose: () => void;
}

/**
 * Per-specialist session QR. The code is STATIC — it encodes the
 * specialist's id directly, so it never rotates and the same printout keeps
 * working. A member scans it in the app to decrement their own session pack
 * with this specialist (see clby-api SpecialistScanController). No token /
 * regenerate, unlike the gym-entrance QR.
 */
export default function SpecialistQRModal({ gymId, trainerId, trainerName, trainerType, onClose }: Props) {
  const t = useTranslations('services');
  const qrRef = useRef<HTMLDivElement>(null);

  const payload = JSON.stringify({ type: 'specialist_session', gym_id: gymId, trainer_id: trainerId });

  const typeLabel = (): string => {
    switch (trainerType) {
      case 'personal_trainer': return t('trainerModal.typePT');
      case 'nutritionist':     return t('trainerModal.typeNutritionist');
      case 'physiotherapist':  return t('trainerModal.typePhysio');
      default: return trainerType;
    }
  };

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const canvas = document.createElement('canvas');
    const img = new Image();
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 400, 400);
      ctx.drawImage(img, 0, 0, 400, 400);
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `specialist-qr-${trainerName.toLowerCase().replace(/\s+/g, '-')}.png`;
      a.click();
    };
    img.src = url;
  };

  const printQR = () => window.print();

  return (
    <Modal open onClose={onClose} size="sm">
      <Modal.Header>
        <span className="inline-flex items-center gap-2"><QrCode className="w-4 h-4 text-brand" aria-hidden /> {t('qr.modalTitle')}</span>
      </Modal.Header>

      <Modal.Body className="flex flex-col items-center gap-5">
        <div ref={qrRef} className="bg-white p-5 rounded-2xl shadow-lg print:shadow-none">
          <QRCodeSVG
            value={payload}
            size={220}
            bgColor="#ffffff"
            fgColor="#000000"
            level="H"
            includeMargin={false}
          />
        </div>

        <div className="text-center">
          <p className="text-sm font-medium text-fg">{trainerName}</p>
          <p className="text-xs text-fg-faint mt-0.5">
            {typeLabel()} · {t('qr.modalSubtitle')}
          </p>
        </div>

        <div className="flex gap-2 w-full">
          <Button variant="secondary" fullWidth onClick={downloadQR}
            leftIcon={<Download className="w-4 h-4" />}>
            {t('qr.downloadPng')}
          </Button>
          <Button variant="primary" fullWidth onClick={printQR}
            leftIcon={<Printer className="w-4 h-4" />}>
            {t('qr.print')}
          </Button>
        </div>
      </Modal.Body>
    </Modal>
  );
}
