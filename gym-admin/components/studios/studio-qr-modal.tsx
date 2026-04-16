'use client';

import { useRef } from 'react';
import { X, Printer, QrCode, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { GymStudio } from '@/app/dashboard/classes/page';

interface Props {
  studio: GymStudio;
  gymId: string;
  onClose: () => void;
}

export default function StudioQRModal({ studio, gymId, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  // Static payload — permanently tied to the studio, never contains session data
  const qrValue = JSON.stringify({
    type:      'studio',
    studio_id: studio.id,
  });

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank', 'width=500,height=700');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html><html><head><title>QR – ${studio.name}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#fff; display:flex; align-items:center; justify-content:center; min-height:100vh; }
        .card { text-align:center; padding:48px 40px; border:2px solid #e5e7eb; border-radius:16px; max-width:360px; width:100%; }
        h1 { font-size:28px; font-weight:800; color:#111; margin-bottom:6px; }
        .sub { font-size:13px; color:#9ca3af; margin-bottom:28px; }
        .qr { display:inline-block; padding:16px; border:1px solid #f3f4f6; border-radius:12px; margin-bottom:24px; }
        .info { font-size:13px; color:#6b7280; }
        .footer { margin-top:24px; font-size:11px; color:#d1d5db; }
      </style></head>
      <body><div class="card">
        <h1>${studio.name}</h1>
        <div class="sub">Studio Access QR</div>
        <div class="qr">${printRef.current?.querySelector('svg')?.outerHTML ?? ''}</div>
        ${studio.capacity ? `<div class="info">Capacity: ${studio.capacity}</div>` : ''}
        <div class="footer">Scan with the gym app to access this studio</div>
      </div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-purple-400" />
            <h2 className="text-base font-semibold text-white">Studio QR Code</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {/* Studio info */}
          <div className="mb-5">
            <p className="text-white font-semibold text-lg">{studio.name}</p>
            {studio.capacity && (
              <p className="text-sm text-gray-400 mt-1 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Capacity: {studio.capacity}
              </p>
            )}
          </div>

          {/* QR Code */}
          <div ref={printRef} className="flex items-center justify-center bg-white rounded-2xl p-5 mb-5">
            <QRCodeSVG
              value={qrValue}
              size={220}
              level="H"
              includeMargin={false}
            />
          </div>

          {/* Info */}
          <div className="bg-gray-700/40 rounded-xl px-4 py-3 mb-5">
            <p className="text-xs text-gray-400 text-center leading-relaxed">
              This is a <span className="text-white font-medium">permanent</span> studio QR code. Members scan it to be
              validated against their booked session for this studio. Print and mount it at the studio entrance.
            </p>
          </div>

          <button onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors">
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>
    </div>
  );
}
