'use client';

import { useRef, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Printer } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { apiErrorMessage, networkErrorMessage } from '@/lib/api-error';

interface Pass {
  qr: string;
  expires_at: string | null;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * "Print member pass": fetches a server-signed pass (PHASE2-CONTRACT,
 * `GET /api/members/{id}/member-pass`) and renders it as a QR the front desk
 * can scan offline. The pass carries no secrets (signature only).
 */
export default function PrintMemberPassButton({
  memberId,
  memberName,
  memberNumber,
}: {
  memberId: string;
  memberName: string;
  memberNumber: string | number | null;
}) {
  const t = useTranslations('members.memberPass');
  const tErr = useTranslations('common.errors');
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const [pass, setPass] = useState<Pass | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/members/${memberId}/member-pass`, { cache: 'no-store' });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.qr) {
        setError(apiErrorMessage(json, res.ok ? 500 : res.status, tErr));
        return;
      }
      setPass({ qr: json.qr, expires_at: json.expires_at ?? null });
    } catch {
      setError(networkErrorMessage(tErr));
    } finally {
      setLoading(false);
    }
  };

  const expires = pass?.expires_at
    ? format.dateTime(new Date(pass.expires_at), { dateStyle: 'medium' })
    : null;

  const print = () => {
    const svg = qrRef.current?.querySelector('svg')?.outerHTML;
    if (!svg) return;
    const w = window.open('', '_blank', 'width=420,height=560');
    if (!w) return;
    const dir = document.documentElement.dir || 'ltr';
    w.document.write(
      `<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><title>${escapeHtml(memberName)}</title>` +
        `<style>body{font-family:system-ui,sans-serif;text-align:center;padding:24px;color:#000;background:#fff}` +
        `svg{width:260px;height:260px}h1{font-size:18px;margin:12px 0 4px}p{margin:2px 0;font-size:13px}</style></head><body>` +
        `${svg}<h1>${escapeHtml(memberName)}</h1>` +
        (memberNumber != null ? `<p>${escapeHtml(t('number', { number: String(memberNumber) }))}</p>` : '') +
        (expires ? `<p>${escapeHtml(t('validUntil', { date: expires }))}</p>` : '') +
        `</body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={load} leftIcon={<QrCode className="w-4 h-4" />}>
        {t('button')}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} size="sm">
        <Modal.Header>{t('title')}</Modal.Header>
        <Modal.Body>
          {loading && <p className="text-sm text-fg-muted">{t('loading')}</p>}
          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
          {pass && (
            <div className="flex flex-col items-center gap-3">
              <div ref={qrRef} className="rounded-lg bg-white p-3">
                <QRCodeSVG value={pass.qr} size={220} level="M" includeMargin={false} />
              </div>
              <p className="text-base font-semibold text-fg">{memberName}</p>
              {memberNumber != null && <p className="text-sm text-fg-muted">{t('number', { number: String(memberNumber) })}</p>}
              {expires && <p className="text-xs text-fg-muted">{t('validUntil', { date: expires })}</p>}
              <p className="text-xs text-fg-faint text-center">{t('hint')}</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" fullWidth onClick={() => setOpen(false)}>
            {t('close')}
          </Button>
          <Button fullWidth onClick={print} disabled={!pass} leftIcon={<Printer className="w-4 h-4" />}>
            {t('print')}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
