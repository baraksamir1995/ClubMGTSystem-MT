import 'package:clby/l10n/l10n.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/invoice_model.dart';
import 'status_badge.dart';

class InvoiceCard extends StatelessWidget {
  final InvoiceModel invoice;
  final VoidCallback onTap;

  const InvoiceCard({super.key, required this.invoice, required this.onTap});

  IconData get _icon {
    switch (invoice.status) {
      case InvoiceStatus.paid:    return Icons.check_circle_outline;
      case InvoiceStatus.overdue: return Icons.error_outline;
      case InvoiceStatus.pending: return Icons.schedule_outlined;
    }
  }

  Color _iconColor(Color primary) {
    switch (invoice.status) {
      case InvoiceStatus.paid:    return const Color(0xFF16A34A);
      case InvoiceStatus.overdue: return const Color(0xFFDC2626);
      case InvoiceStatus.pending: return const Color(0xFFD97706);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final iconColor = _iconColor(theme.colorScheme.primary);

    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              // Icon
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(13),
                ),
                child: Icon(_icon, color: iconColor, size: 22),
              ),
              const SizedBox(width: 14),

              // Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      invoice.invoiceNumber,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    if (invoice.serviceName != null) ...[
                      Text(
                        invoice.serviceName!,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurface,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 1),
                    ],
                    Row(
                      children: [
                        Text(
                          invoice.status == InvoiceStatus.paid
                              ? context.l10n.invoicePaidOnDate(DateFormat('MMM d, yyyy').format(invoice.paidAt ?? invoice.createdAt))
                              : context.l10n.invoiceDueOnDate(DateFormat('MMM d, yyyy').format(invoice.dueDate)),
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                        if (invoice.hasDiscount) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                            decoration: BoxDecoration(
                              color: const Color(0xFFDCFCE7),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              context.l10n.invoiceOfferBadge,
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: const Color(0xFF16A34A),
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),

              // Amount + status
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    invoice.formattedAmount,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  StatusBadge(status: invoice.status),
                ],
              ),

              const SizedBox(width: 6),
              Icon(
                Icons.chevron_right,
                size: 18,
                color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
