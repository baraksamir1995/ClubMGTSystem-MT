'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { QrCode, Download, Printer, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import type { GymBranch } from '@/app/dashboard/branches/page';
import { Button, Modal, Select } from '@/components/ui';

interface Props {
  gymId: string;
  branches: GymBranch[];
  onClose: () => void;
}

export default function GymQRModal({ gymId, branches, onClose }: Props) {
  const t = useTranslations('attendance');
  const tc = useTranslations('common');
  const qrRef = useRef<HTMLDivElement>(null);

  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    branches.length >= 1 ? branches[0].id : ''
  );
  const [qrToken,      setQrToken]      = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const selectedBranch = branches.find(b => b.id === selectedBranchId);

  const fetchToken = useCallback(async (branchId: string) => {
    if (!branchId) return;
    setTokenLoading(true);
    try {
      const res = await fetch(`/api/branches/${branchId}/qr-token`);
      const data = await res.json();
      if (res.ok) setQrToken(data.qr_token ?? null);
      // If column doesn't exist yet, fall through silently (qrToken stays null)
    } catch {
      // Network error — fall through, QR renders without token
    } finally {
      setTokenLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedBranchId) fetchToken(selectedBranchId);
  }, [selectedBranchId, fetchToken]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/branches/${selectedBranchId}/qr-token`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setQrToken(data.qr_token);
        toast.success(t('qrModal.regeneratedSuccess'));
      } else {
        toast.error(data.error ?? t('qrModal.regenerateFailed'));
      }
    } catch {
      toast.error(t('qrModal.networkError'));
    } finally {
      setRegenerating(false);
      setShowConfirm(false);
    }
  };

  const checkinUrl = qrToken
    ? JSON.stringify({ type: 'gym_access', gym_id: gymId, branch_id: selectedBranchId || null, token: qrToken })
    : JSON.stringify({ type: 'gym_access', gym_id: gymId, branch_id: selectedBranchId || null });

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
      const suffix = selectedBranch ? `-${selectedBranch.name.toLowerCase().replace(/\s+/g, '-')}` : '';
      a.download = `gym-checkin-qr${suffix}.png`;
      a.click();
    };
    img.src = url;
  };

  const printQR = () => window.print();

  return (
    <>
      <Modal open onClose={onClose} size="sm">
        <Modal.Header>
          <span className="inline-flex items-center gap-2"><QrCode className="w-4 h-4 text-brand" /> {t('qrModal.title')}</span>
        </Modal.Header>

        <Modal.Body className="flex flex-col items-center gap-5">
          {/* Branch selector */}
          {branches.length > 1 && (
            <div className="w-full">
              <label className="block text-xs text-fg-muted mb-1.5">{tc('branch')}</label>
              <Select value={selectedBranchId} onChange={e => setSelectedBranchId(e.target.value)}>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
            </div>
          )}

          {/* QR — only shown after token finishes loading so the image never changes on open */}
          {tokenLoading ? (
            <div className="w-[260px] h-[260px] bg-surface-3/40 rounded-2xl flex items-center justify-center">
              <Loader2 className="w-7 h-7 text-fg-faint animate-spin" />
            </div>
          ) : (
            <div ref={qrRef} className="bg-white p-5 rounded-2xl shadow-lg print:shadow-none">
              <QRCodeSVG
                value={checkinUrl}
                size={220}
                bgColor="#ffffff"
                fgColor="#000000"
                level="H"
                includeMargin={false}
              />
            </div>
          )}

          <div className="text-center">
            <p className="text-sm font-medium text-fg">
              {selectedBranch ? selectedBranch.name : t('qrModal.gymMainEntrance')}
            </p>
            <p className="text-xs text-fg-faint mt-0.5">{t('qrModal.membersInstruction')}</p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 w-full">
            <Button variant="secondary" fullWidth onClick={downloadQR} disabled={tokenLoading || regenerating}
              leftIcon={<Download className="w-4 h-4" />}>
              {t('qrModal.downloadPng')}
            </Button>
            <Button variant="primary" fullWidth onClick={printQR} disabled={tokenLoading || regenerating}
              leftIcon={<Printer className="w-4 h-4" />}>
              {t('qrModal.print')}
            </Button>
          </div>

          {/* Regenerate */}
          {selectedBranchId && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={tokenLoading || regenerating}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-warning/40 text-warning text-sm hover:bg-warning-soft transition-colors disabled:opacity-40"
            >
              <RefreshCw className="w-3.5 h-3.5" /> {t('qrModal.regenerateQr')}
            </button>
          )}
        </Modal.Body>
      </Modal>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-surface-2 border border-warning/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-warning-soft flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4 text-warning" />
              </div>
              <div>
                <p className="text-sm font-semibold text-fg">{t('qrModal.regenerateTitle')}</p>
                <p className="text-xs text-fg-muted mt-1 leading-relaxed">
                  {t('qrModal.regenerateBody', { branchName: selectedBranch?.name ?? t('qrModal.thisBranch') })}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" fullWidth onClick={() => setShowConfirm(false)} disabled={regenerating}>
                {tc('cancel')}
              </Button>
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex-1 py-2 rounded-lg bg-warning hover:bg-warning/90 text-brand-ink text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {regenerating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('qrModal.regenerating')}</> : t('qrModal.yesRegenerate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
