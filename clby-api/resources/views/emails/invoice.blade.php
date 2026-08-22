{{--
  Invoice / receipt email. Mirrors the admin on-screen invoice
  (gym-admin/components/payments/invoice-modal.tsx), including the
  membership Start/End dates.

  Table-based layout with inline styles on purpose: email clients strip
  <style> blocks and don't support flex/grid. Colors are the same fixed
  dark-on-white literals the printable invoice uses.
--}}
@php
    $fmtDate = fn (?string $d) => $d ? \Illuminate\Support\Carbon::parse($d)->format('d F Y') : null;
    $fmtMoney = fn ($amount) => number_format((float) $amount, 2) . ' ' . ($payment['currency'] ?? 'EGP');

    $issueDate   = $fmtDate($payment['created_at'] ?? null);
    $paidDate    = $fmtDate($payment['paid_at'] ?? null);
    $startDate   = $fmtDate($payment['period_start'] ?? null);
    $endDate     = $fmtDate($payment['period_end'] ?? null);
    $hasPeriod   = $startDate !== null || $endDate !== null;

    $hasDiscount = ($payment['discount_amount'] ?? 0) > 0;
    $originalAmt = $payment['original_amount'] ?? $payment['amount'];
    $isReceipt   = ($payment['status'] ?? null) === 'paid';
@endphp
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;">

    {{-- Header --}}
    <tr>
      <td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:top;">
              @if (!empty($gym['logo_url']))
                <img src="{{ $gym['logo_url'] }}" alt="{{ $gym['name'] }}" width="48" height="48" style="border-radius:10px;display:block;margin-bottom:8px;">
              @endif
              <div style="font-size:18px;font-weight:700;color:#111;">{{ $gym['name'] }}</div>
            </td>
            <td style="vertical-align:top;text-align:right;">
              <div style="font-size:22px;font-weight:800;letter-spacing:2px;color:{{ $isReceipt ? '#065f46' : '#7c2d12' }};">{{ $docType }}</div>
              <div style="font-size:13px;color:#555;margin-top:4px;">{{ $docNumber }}</div>
            </td>
          </tr>
        </table>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
      </td>
    </tr>

    {{-- Bill to + dates --}}
    <tr>
      <td>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:top;width:50%;">
              <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Bill To</div>
              <div style="font-size:14px;font-weight:600;color:#111;">{{ $payment['full_name'] }}</div>
              @if (!empty($payment['email']))
                <div style="font-size:13px;color:#555;margin-top:2px;">{{ $payment['email'] }}</div>
              @endif
              @if (!empty($payment['member_number']))
                <div style="font-size:12px;color:#555;margin-top:2px;">{{ $payment['member_number'] }}</div>
              @endif
            </td>
            <td style="vertical-align:top;width:50%;text-align:right;">
              <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Issue Date</div>
              <div style="font-size:14px;color:#111;">{{ $issueDate }}</div>

              @if ($paidDate)
                <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;margin:12px 0 4px;">Paid Date</div>
                <div style="font-size:14px;color:#065f46;font-weight:600;">{{ $paidDate }}</div>
              @endif

              {{-- Membership period covered — omitted when not applicable. --}}
              @if ($hasPeriod)
                <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;margin:12px 0 4px;">Start Date</div>
                <div style="font-size:14px;color:#111;">{{ $startDate ?? '—' }}</div>
                <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;margin:12px 0 4px;">End Date</div>
                <div style="font-size:14px;color:#111;">{{ $endDate ?? '—' }}</div>
              @endif
            </td>
          </tr>
        </table>
      </td>
    </tr>

    {{-- Line items --}}
    <tr>
      <td style="padding-top:24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <th align="left" style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#555;padding:10px 0;border-bottom:1px solid #e5e7eb;">Description</th>
            <th align="right" style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#555;padding:10px 0;border-bottom:1px solid #e5e7eb;">Amount</th>
          </tr>
          <tr>
            <td style="padding:14px 0;border-bottom:1px solid #f3f4f6;">
              <div style="font-size:14px;font-weight:500;color:#111;">{{ $payment['service_name'] ?? 'Payment' }}</div>
              @if (!empty($payment['service_type']))
                <div style="font-size:12px;color:#555;margin-top:2px;">{{ ucwords(str_replace('_', ' ', $payment['service_type'])) }}</div>
              @endif
              @if (!empty($payment['specialist_name']))
                <div style="font-size:12px;color:#555;margin-top:2px;">Specialist: {{ $payment['specialist_name'] }}</div>
              @endif
            </td>
            <td align="right" style="padding:14px 0;border-bottom:1px solid #f3f4f6;font-size:14px;font-weight:600;color:#111;">
              @if ($hasDiscount)
                <span style="text-decoration:line-through;color:#555;">{{ $fmtMoney($originalAmt) }}</span>
              @else
                {{ $fmtMoney($payment['amount']) }}
              @endif
            </td>
          </tr>
          @if ($hasDiscount)
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#065f46;font-weight:500;">Offer discount applied</td>
              <td align="right" style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:13px;color:#065f46;font-weight:600;">− {{ $fmtMoney($payment['discount_amount']) }}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:14px;font-weight:600;color:#111;">Offer price</td>
              <td align="right" style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-size:14px;font-weight:700;color:#111;">{{ $fmtMoney($payment['amount']) }}</td>
            </tr>
          @endif
        </table>
      </td>
    </tr>

    {{-- Total --}}
    <tr>
      <td style="padding-top:20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #e5e7eb;">
          <tr>
            <td style="padding-top:16px;font-size:13px;color:#555;">Status: <strong style="color:#111;">{{ ucfirst($payment['status'] ?? '') }}</strong></td>
            <td align="right" style="padding-top:16px;">
              <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;">Total {{ $isReceipt ? 'Paid' : 'Due' }}</div>
              <div style="font-size:22px;font-weight:800;color:#111;margin-top:2px;">{{ $fmtMoney($payment['amount']) }}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    @if (!empty($payment['notes']))
      <tr>
        <td style="padding-top:20px;border-top:1px solid #f3f4f6;">
          <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Notes</div>
          <div style="font-size:13px;color:#555;">{{ $payment['notes'] }}</div>
        </td>
      </tr>
    @endif

    {{-- Footer --}}
    <tr>
      <td style="padding-top:32px;text-align:center;">
        <div style="font-size:12px;color:#555;">Thank you for choosing {{ $gym['name'] }}!</div>
        @if (!empty($gym['email']) || !empty($gym['phone']))
          <div style="font-size:11px;color:#777;margin-top:6px;">
            {{ collect([$gym['email'] ?? null, $gym['phone'] ?? null])->filter()->implode(' · ') }}
          </div>
        @endif
      </td>
    </tr>

  </table>
</body>
</html>
