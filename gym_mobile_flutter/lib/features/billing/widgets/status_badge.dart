import 'package:flutter/material.dart';
import '../models/invoice_model.dart';

class StatusBadge extends StatelessWidget {
  final InvoiceStatus status;
  final bool large;

  const StatusBadge({super.key, required this.status, this.large = false});

  Color _bgColor() {
    switch (status) {
      case InvoiceStatus.paid:    return const Color(0xFF16A34A);
      case InvoiceStatus.pending: return const Color(0xFFD97706);
      case InvoiceStatus.overdue: return const Color(0xFFDC2626);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bg = _bgColor();
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: large ? 14 : 10,
        vertical: large ? 6 : 3,
      ),
      decoration: BoxDecoration(
        color: bg.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(large ? 10 : 6),
        border: Border.all(color: bg.withValues(alpha: 0.3)),
      ),
      child: Text(
        status.label,
        style: TextStyle(
          color: bg,
          fontSize: large ? 13 : 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.2,
        ),
      ),
    );
  }
}
