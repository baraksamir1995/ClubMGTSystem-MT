import 'package:clby/l10n/l10n.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:shimmer/shimmer.dart';
import 'billing_provider.dart';
import 'models/invoice_model.dart';
import 'widgets/status_badge.dart';

class InvoiceDetailsScreen extends StatefulWidget {
  final String invoiceId;
  final String memberId;

  const InvoiceDetailsScreen({
    super.key,
    required this.invoiceId,
    required this.memberId,
  });

  @override
  State<InvoiceDetailsScreen> createState() => _InvoiceDetailsScreenState();
}

class _InvoiceDetailsScreenState extends State<InvoiceDetailsScreen> {
  late final BillingProvider _billingProvider;

  @override
  void initState() {
    super.initState();
    _billingProvider = context.read<BillingProvider>();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _billingProvider.loadInvoiceDetails(
            widget.invoiceId,
            widget.memberId,
          );
    });
  }

  @override
  void dispose() {
    _billingProvider.clearDetails();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final billing = context.watch<BillingProvider>();

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.invoiceDetailsTitle),
        centerTitle: false,
      ),
      body: billing.isLoadingDetail
          ? _buildShimmer()
          : billing.detailError != null
              ? _buildError(billing.detailError!)
              : billing.selectedDetails == null
                  ? const SizedBox.shrink()
                  : _buildContent(billing.selectedDetails!),
    );
  }

  // ─── Main content ──────────────────────────────────────────────────────────

  Widget _buildContent(InvoiceDetails details) {
    final invoice = details.invoice;
    final theme = Theme.of(context);
    final isUnpaid = invoice.status != InvoiceStatus.paid;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header card
          _buildHeaderCard(invoice, theme),
          const SizedBox(height: 16),

          // Billing period
          if (details.billingPeriod != null) ...[
            _buildSection(
              theme,
              title: context.l10n.invoiceBillingPeriod,
              child: _buildInfoRow(
                theme,
                label: context.l10n.invoicePeriod,
                value: details.billingPeriod!,
                icon: Icons.date_range_outlined,
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Line items
          _buildSection(
            theme,
            title: context.l10n.invoiceItems,
            child: Column(
              children: [
                ...details.items.asMap().entries.map((entry) {
                  final isLast = entry.key == details.items.length - 1;
                  return Column(
                    children: [
                      _buildLineItem(theme, entry.value),
                      if (!isLast) const Divider(height: 20),
                    ],
                  );
                }),
                const Divider(height: 20),
                _buildTotalRow(theme, invoice),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Payment info
          _buildSection(
            theme,
            title: context.l10n.invoicePaymentInfo,
            child: Column(
              children: [
                _buildInfoRow(
                  theme,
                  label: context.l10n.invoiceStatus,
                  value: invoice.status.label,
                  icon: Icons.info_outline,
                  valueWidget: StatusBadge(status: invoice.status),
                ),
                const Divider(height: 20),
                _buildInfoRow(
                  theme,
                  label: context.l10n.invoiceDueDate,
                  value: DateFormat('MMM d, yyyy').format(invoice.dueDate),
                  icon: Icons.calendar_today_outlined,
                ),
                if (invoice.paidAt != null) ...[
                  const Divider(height: 20),
                  _buildInfoRow(
                    theme,
                    label: context.l10n.invoicePaidOn,
                    value: DateFormat('MMM d, yyyy').format(invoice.paidAt!),
                    icon: Icons.check_circle_outline,
                  ),
                ],
                if (details.paymentMethod != null) ...[
                  const Divider(height: 20),
                  _buildInfoRow(
                    theme,
                    label: context.l10n.invoicePaymentMethod,
                    value: details.paymentMethod!,
                    icon: Icons.credit_card_outlined,
                  ),
                ],
              ],
            ),
          ),

          // Notes
          if (details.notes != null && details.notes!.isNotEmpty) ...[
            const SizedBox(height: 16),
            _buildSection(
              theme,
              title: context.l10n.invoiceNotes,
              child: Text(
                details.notes!,
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                  height: 1.5,
                ),
              ),
            ),
          ],

          // Pay Now button
          if (isUnpaid) ...[
            const SizedBox(height: 24),
            _buildPayNowButton(invoice, theme),
          ],

          const SizedBox(height: 24),
        ],
      ),
    );
  }

  // ─── Header card ───────────────────────────────────────────────────────────

  Widget _buildHeaderCard(InvoiceModel invoice, ThemeData theme) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      invoice.invoiceNumber,
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      context.l10n.invoiceCreatedOn(
                          DateFormat('MMM d, yyyy').format(invoice.createdAt)),
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
                StatusBadge(status: invoice.status, large: true),
              ],
            ),
            const SizedBox(height: 20),
            const Divider(height: 1),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  context.l10n.invoiceTotalAmount,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                Text(
                  invoice.formattedAmount,
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w900,
                    color: theme.colorScheme.onSurface,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ─── Section wrapper ───────────────────────────────────────────────────────

  Widget _buildSection(ThemeData theme,
      {required String title, required Widget child}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: theme.textTheme.labelLarge?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 8),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: child,
          ),
        ),
      ],
    );
  }

  // ─── Info row ──────────────────────────────────────────────────────────────

  Widget _buildInfoRow(
    ThemeData theme, {
    required String label,
    required String value,
    required IconData icon,
    Widget? valueWidget,
  }) {
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: theme.colorScheme.primary.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 17, color: theme.colorScheme.primary),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              if (valueWidget != null)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: valueWidget,
                )
              else
                Text(
                  value,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }

  // ─── Line item row ─────────────────────────────────────────────────────────

  Widget _buildLineItem(ThemeData theme, InvoiceLineItem item) {
    final isDiscount = item.isDiscount;
    final isStrike   = item.isStrikethrough;
    final nameStyle  = isDiscount
        ? theme.textTheme.bodyMedium?.copyWith(color: const Color(0xFF16A34A))
        : isStrike
            ? theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                decoration: TextDecoration.lineThrough,
              )
            : theme.textTheme.bodyMedium;
    final amtStyle = isDiscount
        ? theme.textTheme.bodyMedium?.copyWith(
            fontWeight: FontWeight.w600, color: const Color(0xFF16A34A))
        : isStrike
            ? theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                decoration: TextDecoration.lineThrough,
              )
            : theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600);

    return Row(
      children: [
        if (isDiscount) ...[
          const Icon(Icons.local_offer_rounded, size: 14, color: Color(0xFF16A34A)),
          const SizedBox(width: 6),
        ],
        Expanded(child: Text(item.name, style: nameStyle)),
        Text(item.formattedAmount, style: amtStyle),
      ],
    );
  }

  Widget _buildTotalRow(ThemeData theme, InvoiceModel invoice) {
    return Row(
      children: [
        Expanded(
          child: Text(
            context.l10n.invoiceTotalPaid,
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        Text(
          invoice.formattedAmount,
          style: theme.textTheme.titleSmall?.copyWith(
            fontWeight: FontWeight.w800,
            color: theme.colorScheme.primary,
          ),
        ),
      ],
    );
  }

  // ─── Pay Now button ────────────────────────────────────────────────────────

  Widget _buildPayNowButton(InvoiceModel invoice, ThemeData theme) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: () => _handlePayNow(invoice),
        icon: const Icon(Icons.payment_outlined),
        label: Text(context.l10n.invoicePayAmount(invoice.formattedAmount)),
        style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 16),
          textStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  void _handlePayNow(InvoiceModel invoice) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => _PayNowSheet(invoice: invoice),
    );
  }

  // ─── Loading / error ───────────────────────────────────────────────────────

  Widget _buildShimmer() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: List.generate(
          3,
          (i) => Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: Shimmer.fromColors(
              baseColor: Colors.grey.shade300,
              highlightColor: Colors.grey.shade100,
              child: Container(
                height: i == 0 ? 140 : 100,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildError(String error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off_outlined, size: 48, color: Colors.grey.shade400),
            const SizedBox(height: 16),
            Text(
              context.l10n.invoiceLoadFailed,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              error,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: () => context.read<BillingProvider>().loadInvoiceDetails(
                    widget.invoiceId,
                    widget.memberId,
                  ),
              icon: const Icon(Icons.refresh, size: 18),
              label: Text(context.l10n.commonRetry),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Pay Now bottom sheet ──────────────────────────────────────────────────────

class _PayNowSheet extends StatefulWidget {
  final InvoiceModel invoice;
  const _PayNowSheet({required this.invoice});

  @override
  State<_PayNowSheet> createState() => _PayNowSheetState();
}

class _PayNowSheetState extends State<_PayNowSheet> {
  bool _processing = false;

  Future<void> _mockPay() async {
    setState(() => _processing = true);
    await Future.delayed(const Duration(seconds: 2));
    if (!mounted) return;
    setState(() => _processing = false);
    Navigator.of(context).pop();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
            context.l10n.invoicePaymentSubmitted(widget.invoice.formattedAmount)),
        backgroundColor: Colors.green.shade700,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(context.l10n.invoicePayInvoice,
                    style: theme.textTheme.titleLarge
                        ?.copyWith(fontWeight: FontWeight.w800)),
                const Spacer(),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              widget.invoice.invoiceNumber,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: theme.colorScheme.primary.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(context.l10n.invoiceAmountDue,
                      style: theme.textTheme.bodyLarge
                          ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
                  Text(
                    widget.invoice.formattedAmount,
                    style: theme.textTheme.titleLarge
                        ?.copyWith(fontWeight: FontWeight.w900),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _processing ? null : _mockPay,
                icon: _processing
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.payment_outlined),
                label: Text(_processing
                    ? context.l10n.invoiceProcessing
                    : context.l10n.invoiceConfirmPayment),
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  textStyle: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
