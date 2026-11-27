'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { QrCode, Download, Printer, RefreshCw, AlertTriangle, Loader2, MonitorPlay, ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { useFormatter, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { StaticBranchQr } from '@/lib/offline/types';
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
  const format = useFormatter();
  const router = useRouter();
  const qrRef = useRef<HTMLDivElement>(null);

  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    branches.length >= 1 ? branches[0].id : ''
  );
  const [qrToken,      setQrToken]      = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  /** PHASE3: signed v2 static QR; null while loading or when it failed (→ v1 fallback) */
  const [signed, setSigned] = useState<StaticBranchQr | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  const selectedBranch = branches.find(b => b.id === selectedBranchId);

  const fetchToken = useCallback(async (branchId: string) => {
    if (!branchId) return;
    try {
      const res = await fetch(`/api/branches/${branchId}/qr-token`);
      const data = await res.json();
      if (res.ok) setQrToken(data.qr_token ?? null);
      // If column doesn't exist yet, fall through silently (qrToken stays null)
    } catch {
      // Network error — fall through, QR renders without token
    }
  }, []);

  /** v2 static QR first; the v1 (unsigned, online-only) QR only if that fails. */
  const loadQr = useCallback(async (branchId: string) => {
    if (!branchId) return;
    setTokenLoading(true);
    setSigned(null);
    setUsingFallback(false);
    try {
      const res = await fetch(`/api/branches/${branchId}/qr?mode=static`, { cache: 'no-store' });
      const data = (await res.json().catch(() => null)) as StaticBranchQr | null;
      if (res.ok && data && typeof data.qr === 'string') {
        setSigned(data);
        return;
      }
    } catch {
      // fall back below
    } finally {
      setTokenLoading(false);
    }
    setUsingFallback(true);
    setTokenLoading(true);
    await fetchToken(branchId);
    setTokenLoading(false);
  }, [fetchToken]);

  useEffect(() => {
    if (selectedBranchId) loadQr(selectedBranchId);
  }, [selectedBranchId, loadQr]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/branches/${selectedBranchId}/qr-token`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setQrToken(data.qr_token);
        toast.success(t('qrModal.regeneratedSuccess'));
        // the signed poster embeds the branch token: fetch a fresh one
        void loadQr(selectedBranchId);
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

  const v1Payload = qrToken
    ? JSON.stringify({ type: 'gym_access', gym_id: gymId, branch_id: selectedBranchId || null, token: qrToken })
    : JSON.stringify({ type: 'gym_access', gym_id: gymId, branch_id: selectedBranchId || null });
  const checkinUrl = signed?.qr ?? v1Payload;
  const branchLabel = selectedBranch ? selectedBranch.name : t('qrModal.gymMainEntrance');
  const validUntil = signed?.expires_at
    ? t('qrModal.validUntil', { date: format.dateTime(new Date(signed.expires_at), { dateStyle: 'long' }) })
    : null;

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
      // QR + branch name + "valid until" under it (the poster must say when it expires)
      const footer = validUntil ? 64 : 40;
      canvas.width = 400;
      canvas.height = 400 + footer;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, 400, 400);
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.direction = document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText(branchLabel, 200, 400 + 26);
      if (validUntil) {
        ctx.font = '14px system-ui, sans-serif';
        ctx.fillText(validUntil, 200, 400 + 50);
      }
      URL.revokeObjectURL(url);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      const suffix = selectedBranch ? `-${selectedBranch.name.toLowerCase().replace(/\s+/g, '-')}` : '';
      a.download = `gym-checkin-qr${suffix}.png`;
      a.click();
    };
    img.src = url;
  };

  /** Print just the poster: QR + branch name + valid until (not the whole dashboard). */
  const printQR = () => {
    const svg = qrRef.current?.querySelector('svg')?.outerHTML;
    if (!svg) return;
    const w = window.open('', '_blank', 'width=520,height=680');
    if (!w) return;
    const esc = (x: string) => x.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
    const dir = document.documentElement.dir || 'ltr';
    w.document.write(
      `<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><title>${esc(branchLabel)}</title>` +
        `<style>body{font-family:system-ui,sans-serif;text-align:center;padding:32px;color:#000;background:#fff}` +
        `svg{width:340px;height:340px}h1{font-size:22px;margin:16px 0 6px}p{margin:4px 0;font-size:14px}</style></head><body>` +
        `${svg}<h1>${esc(branchLabel)}</h1><p>${esc(t('qrModal.membersInstruction'))}</p>` +
        (validUntil ? `<p>${esc(validUntil)}</p>` : '') +
        `</body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <>
      <Modal open onClose={onClose} size="sm">
        <Modal.Header>
          <span className="inline-flex items-center gap-2"><QrCode className="w-4 h-4 text-brand" aria-hidden /> {t('qrModal.title')}</span>
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
                level={signed ? 'M' : 'H'}
                includeMargin={false}
              />
            </div>
          )}

          <div className="text-center">
            <p className="text-sm font-medium text-fg">{branchLabel}</p>
            <p className="text-xs text-fg-faint mt-0.5">{t('qrModal.membersInstruction')}</p>
            {validUntil && <p className="text-xs text-fg-muted mt-0.5">{validUntil}</p>}
          </div>

          {!tokenLoading && signed && (
            <p className="w-full flex items-start gap-2 text-xs text-success" role="note">
              <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden /> {t('qrModal.signedNote')}
            </p>
          )}
          {!tokenLoading && usingFallback && (
            <p className="w-full rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning" role="note">
              {t('qrModal.fallbackNote')}
            </p>
          )}

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

          {selectedBranchId && (
            <Button
              variant="secondary"
              fullWidth
              onClick={() => router.push(`/dashboard/attendance/kiosk/${selectedBranchId}`)}
              leftIcon={<MonitorPlay className="w-4 h-4" />}
            >
              {t('qrModal.openKiosk')}
            </Button>
          )}

          {/* Regenerate */}
          {selectedBranchId && (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={tokenLoading || regenerating}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-warning/40 text-warning text-sm hover:bg-warning-soft transition-colors disabled:opacity-40"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden /> {t('qrModal.regenerateQr')}
            </button>
          )}
        </Modal.Body>
      </Modal>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-overlay/70 backdrop-blur-sm">
          <div className="bg-surface-2 border border-warning/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-warning-soft flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4 text-warning" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-fg">{t('qrModal.regenerateTitle')}</p>
                <p className="text-xs text-fg-muted mt-1 leading-relaxed">
                  {t('qrModal.regenerateBody', { branchName: selectedBranch?.name ?? t('qrModal.thisBranch') })}
                </p>
                <p className="text-xs text-warning mt-2 leading-relaxed">{t('qrModal.regenerateNote')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" fullWidth onClick={() => setShowConfirm(false)} disabled={regenerating}>
                {tc('cancel')}
              </Button>
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex-1 py-2 rounded-lg bg-warning hover:bg-warning/90 text-on-status text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
