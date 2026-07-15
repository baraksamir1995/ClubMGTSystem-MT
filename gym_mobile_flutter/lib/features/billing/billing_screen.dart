import 'package:clby/l10n/l10n.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:shimmer/shimmer.dart';
import '../../providers/auth_provider.dart';
import '../../providers/member_provider.dart';
import 'billing_provider.dart';
import 'models/invoice_model.dart';
import 'widgets/invoice_card.dart';

class BillingScreen extends StatefulWidget {
  const BillingScreen({super.key});

  @override
  State<BillingScreen> createState() => _BillingScreenState();
}

class _BillingScreenState extends State<BillingScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load({bool force = false}) async {
    final auth = context.read<AuthProvider>();
    final member = context.read<MemberProvider>();
    final billing = context.read<BillingProvider>();

    final gymId = auth.profile?.gymId;
    if (gymId != null && member.member == null) {
      await member.loadMemberData(gymId);
    }

    final memberId = member.member?.id;
    if (memberId != null) {
      await billing.loadInvoices(memberId, force: force);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final auth = context.watch<AuthProvider>();
    final billing = context.watch<BillingProvider>();

    final primaryColor = Theme.of(context).colorScheme.primary;

    return Scaffold(
      appBar: AppBar(
        title: Text(context.l10n.billingInvoicesTitle),
        centerTitle: false,
      ),
      body: RefreshIndicator(
        color: primaryColor,
        onRefresh: () => _load(force: true),
        child: billing.isLoadingList
            ? _buildShimmer()
            : billing.listError != null
                ? _buildError(billing.listError!)
                : billing.invoices.isEmpty
                    ? _buildEmpty(theme)
                    : _buildList(billing.invoices, context),
      ),
    );
  }

  Widget _buildList(List<InvoiceModel> invoices, BuildContext context) {
    final memberId = context.read<MemberProvider>().member?.id ?? '';

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: invoices.length,
      separatorBuilder: (context, i) => const SizedBox(height: 10),
      itemBuilder: (context, i) => InvoiceCard(
        invoice: invoices[i],
        onTap: () {
          context.push('/billing/${invoices[i].id}', extra: memberId);
        },
      ),
    );
  }

  Widget _buildShimmer() {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: 5,
      separatorBuilder: (context, i) => const SizedBox(height: 10),
      itemBuilder: (context, i) => Shimmer.fromColors(
        baseColor: Colors.grey.shade300,
        highlightColor: Colors.grey.shade100,
        child: Container(
          height: 80,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }

  Widget _buildEmpty(ThemeData theme) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: theme.colorScheme.primary.withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.receipt_long_outlined,
                size: 38,
                color: theme.colorScheme.primary,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              context.l10n.billingNoInvoicesYet,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              context.l10n.billingEmptySubtitle,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
          ],
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
            Icon(Icons.cloud_off_outlined,
                size: 48, color: Colors.grey.shade400),
            const SizedBox(height: 16),
            Text(
              context.l10n.billingLoadFailed,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: 8),
            Text(
              error,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: () => _load(force: true),
              icon: const Icon(Icons.refresh, size: 18),
              label: Text(context.l10n.commonRetry),
            ),
          ],
        ),
      ),
    );
  }
}
