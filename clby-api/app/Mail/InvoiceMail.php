<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * The invoice / receipt email sent from the admin Payments → Invoices modal.
 *
 * Mirrors the on-screen invoice (components/payments/invoice-modal.tsx),
 * including the membership Start/End dates. Everything here is resolved
 * server-side by PaymentController::sendInvoice — the client's posted
 * docType/docNumber are only display hints and are never trusted for
 * amounts, dates, or recipient.
 */
class InvoiceMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public array $payment,
        public array $gym,
        public string $docType,
        public string $docNumber,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "{$this->docType} {$this->docNumber} — {$this->gym['name']}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.invoice',
            with: [
                'payment'   => $this->payment,
                'gym'       => $this->gym,
                'docType'   => $this->docType,
                'docNumber' => $this->docNumber,
            ],
        );
    }
}
