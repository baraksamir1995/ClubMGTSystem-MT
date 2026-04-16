import 'package:intl/intl.dart' show NumberFormat;

enum InvoiceStatus { paid, pending, overdue }

extension InvoiceStatusX on InvoiceStatus {
  String get label {
    switch (this) {
      case InvoiceStatus.paid:    return 'Paid';
      case InvoiceStatus.pending: return 'Pending';
      case InvoiceStatus.overdue: return 'Overdue';
    }
  }
}

class InvoiceModel {
  final String id;
  final String invoiceNumber;
  final double amount;
  final String currency;
  final DateTime dueDate;
  final InvoiceStatus status;
  final DateTime createdAt;
  final DateTime? paidAt;
  final String? membershipId;
  final String? serviceName;
  final String? serviceType;
  final String? specialistName;
  final double? originalAmount;
  final double? discountAmount;

  const InvoiceModel({
    required this.id,
    required this.invoiceNumber,
    required this.amount,
    required this.currency,
    required this.dueDate,
    required this.status,
    required this.createdAt,
    this.paidAt,
    this.membershipId,
    this.serviceName,
    this.serviceType,
    this.specialistName,
    this.originalAmount,
    this.discountAmount,
  });

  bool get hasDiscount => discountAmount != null && discountAmount! > 0;

  factory InvoiceModel.fromJson(Map<String, dynamic> json) {
    final id = json['id'] as String;
    final createdAt = DateTime.parse(json['created_at'] as String);
    final dueDate = json['due_date'] != null
        ? DateTime.parse(json['due_date'] as String)
        : createdAt.add(const Duration(days: 30));
    double _toDouble(dynamic v) => v is num ? v.toDouble() : double.tryParse(v?.toString() ?? '') ?? 0.0;
    double? _toDoubleNullable(dynamic v) => v == null ? null : _toDouble(v);

    final rawDiscount = _toDouble(json['discount_amount']);

    return InvoiceModel(
      id: id,
      invoiceNumber: 'INV-${id.substring(0, 8).toUpperCase()}',
      amount: _toDouble(json['amount']),
      currency: json['currency'] as String? ?? 'USD',
      dueDate: dueDate,
      status: _resolveStatus(json['status'] as String?, dueDate),
      createdAt: createdAt,
      paidAt: json['paid_at'] != null
          ? DateTime.parse(json['paid_at'] as String)
          : null,
      membershipId: json['membership_id'] as String?,
      serviceName: json['service_name'] as String?,
      serviceType: json['service_type'] as String?,
      specialistName: json['specialist_name'] as String?,
      originalAmount: _toDoubleNullable(json['original_amount']),
      discountAmount: rawDiscount > 0 ? rawDiscount : null,
    );
  }

  static InvoiceStatus _resolveStatus(String? raw, DateTime dueDate) {
    switch (raw?.toLowerCase()) {
      case 'paid':
      case 'completed':
        return InvoiceStatus.paid;
      case 'overdue':
        return InvoiceStatus.overdue;
      default:
        if (DateTime.now().isAfter(dueDate)) return InvoiceStatus.overdue;
        return InvoiceStatus.pending;
    }
  }

  String get formattedAmount {
    final fmt = NumberFormat.currency(symbol: '$currency ', decimalDigits: 2);
    return fmt.format(amount);
  }
}

// ─── Line item ────────────────────────────────────────────────────────────────

class InvoiceLineItem {
  final String name;
  final double amount;
  final String currency;
  final bool isStrikethrough;
  final bool isDiscount;

  const InvoiceLineItem({
    required this.name,
    required this.amount,
    required this.currency,
    this.isStrikethrough = false,
    this.isDiscount = false,
  });

  String get formattedAmount {
    final fmt = NumberFormat.currency(symbol: '$currency ', decimalDigits: 2);
    final abs = amount.abs();
    final str = fmt.format(abs);
    return isDiscount ? '− $str' : str;
  }
}

// ─── Full details ─────────────────────────────────────────────────────────────

class InvoiceDetails {
  final InvoiceModel invoice;
  final String? billingPeriod;
  final List<InvoiceLineItem> items;
  final String? paymentMethod;
  final String? notes;

  const InvoiceDetails({
    required this.invoice,
    this.billingPeriod,
    required this.items,
    this.paymentMethod,
    this.notes,
  });

  factory InvoiceDetails.fromJson(Map<String, dynamic> json) {
    final invoice = InvoiceModel.fromJson(json);
    final itemName = invoice.serviceName ??
        (invoice.serviceType?.replaceAll('_', ' ').split(' ')
                .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
                .join(' ') ??
            'Payment');

    final items = <InvoiceLineItem>[];

    if (invoice.hasDiscount) {
      // Show original price, then discount, then final price
      items.add(InvoiceLineItem(
        name: itemName,
        amount: invoice.originalAmount!,
        currency: invoice.currency,
        isStrikethrough: true,
      ));
      items.add(InvoiceLineItem(
        name: 'Offer discount',
        amount: -invoice.discountAmount!,
        currency: invoice.currency,
        isDiscount: true,
      ));
      items.add(InvoiceLineItem(
        name: 'Offer price',
        amount: invoice.amount,
        currency: invoice.currency,
      ));
    } else {
      items.add(InvoiceLineItem(
        name: itemName,
        amount: invoice.amount,
        currency: invoice.currency,
      ));
    }

    return InvoiceDetails(
      invoice: invoice,
      billingPeriod: null,
      items: items,
      paymentMethod: json['payment_method'] as String?,
      notes: json['notes'] as String?,
    );
  }
}
