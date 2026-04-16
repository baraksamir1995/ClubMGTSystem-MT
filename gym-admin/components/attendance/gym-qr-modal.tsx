'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { X, QrCode, Download, Printer, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import type { GymBranch } from '@/app/dashboard/branches/page';

interface Props {
  gymId: string;
  branches: GymBranch[];
  onClose: () => void;
}

export default function GymQRModal({ gymId, branches, onClose }: Props) {
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
        toast.success('QR code regenerated — the old QR is now invalid');
      } else {
        toast.error(data.error ?? 'Failed to regenerate');
      }
    } catch {
      toast.error('Network error');
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-purple-400" />
              <h2 className="text-base font-semibold text-white">Gym Check-in QR Code</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 flex flex-col items-center gap-5">
            {/* Branch selector */}
            {branches.length > 1 && (
              <div className="w-full">
                <label className="block text-xs text-gray-400 mb-1.5">Branch</label>
                <select
                  value={selectedBranchId}
                  onChange={e => setSelectedBranchId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* QR — only shown after token finishes loading so the image never changes on open */}
            {tokenLoading ? (
              <div className="w-[260px] h-[260px] bg-gray-700/40 rounded-2xl flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-gray-500 animate-spin" />
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
              <p className="text-sm font-medium text-white">
                {selectedBranch ? selectedBranch.name : 'Gym Main Entrance'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Members scan this to check in at the gym</p>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 w-full">
              <button onClick={downloadQR} disabled={tokenLoading || regenerating}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                <Download className="w-4 h-4" /> Download PNG
              </button>
              <button onClick={printQR} disabled={tokenLoading || regenerating}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-40">
                <Printer className="w-4 h-4" /> Print
              </button>
            </div>

            {/* Regenerate */}
            {selectedBranchId && (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={tokenLoading || regenerating}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-amber-500/40 text-amber-400 text-sm hover:bg-amber-500/10 transition-colors disabled:opacity-40"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Regenerate QR
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-800 border border-amber-500/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Regenerate QR Code?</p>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  This will create a new QR code for <span className="text-white">{selectedBranch?.name ?? 'this branch'}</span>.
                  Any previously printed or saved QR will stop working immediately.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={regenerating}
                className="flex-1 py-2 rounded-lg border border-gray-600 text-gray-300 text-sm hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {regenerating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Regenerating…</> : 'Yes, Regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
