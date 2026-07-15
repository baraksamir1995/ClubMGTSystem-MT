import 'package:clby/l10n/l10n.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/checkout_item.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/shimmer_loader.dart';

class ExploreMembershipsScreen extends StatefulWidget {
  const ExploreMembershipsScreen({super.key});

  @override
  State<ExploreMembershipsScreen> createState() =>
      _ExploreMembershipsScreenState();
}

class _ExploreMembershipsScreenState extends State<ExploreMembershipsScreen> {
  List<Map<String, dynamic>> _plans = [];
  bool _loading = true;
  int _expandedIndex = 0;
  final _service = ApiService();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final gymId = context.read<AuthProvider>().profile?.gymId;
    if (gymId == null) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    final plans = await _service.getMembershipPlansListing(gymId);
    if (mounted) setState(() { _plans = plans; _loading = false; });
  }

  static const _headerColors = [
    Color(0xFF1A1A2E),
    Color(0xFFB45309),
    Color(0xFF4F46E5),
  ];

  static const _headerGradients = [
    // Silver — dark charcoal
    LinearGradient(
      begin: AlignmentDirectional.topStart,
      end: AlignmentDirectional.bottomEnd,
      colors: [Color(0xFF3D3D52), Color(0xFF1A1A2E)],
    ),
    // Gold — amber
    LinearGradient(
      begin: AlignmentDirectional.topStart,
      end: AlignmentDirectional.bottomEnd,
      colors: [Color(0xFFD97706), Color(0xFF92400E)],
    ),
    // Platinum — indigo → purple
    LinearGradient(
      begin: AlignmentDirectional.topStart,
      end: AlignmentDirectional.bottomEnd,
      colors: [Color(0xFF6366F1), Color(0xFF4338CA)],
    ),
  ];

  String _formatPrice(Map<String, dynamic> plan) {
    final price = (plan['price'] as num?)?.toDouble() ?? 0;
    final currency = (plan['currency'] as String?) ?? 'EGP';
    final isWhole = price == price.floorToDouble();
    final fmt = isWhole
        ? NumberFormat('#,###', 'en_US').format(price.toInt())
        : NumberFormat('#,##0.##', 'en_US').format(price);
    return currency == 'USD' ? '\$$fmt' : '$fmt $currency';
  }

  String _formatCycle(String? cycle) {
    switch (cycle) {
      case 'monthly':   return context.l10n.explorePerMonth;
      case 'yearly':    return context.l10n.explorePerYear;
      case 'quarterly': return context.l10n.explorePerQuarter;
      case 'one_time':  return context.l10n.exploreOneTime;
      default:          return '';
    }
  }

  List<String> _features(Map<String, dynamic> plan) {
    final all = <String>[];
    for (final key in ['facilities', 'add_ons']) {
      final v = plan[key];
      if (v is List) all.addAll(v.map((e) => e.toString()));
    }
    return all;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(title: Text(context.l10n.exploreMembershipPlansTitle)),
      body: _loading
          ? _buildSkeleton()
          : _plans.isEmpty
              ? Center(child: Text(context.l10n.exploreNoPlans))
              : ListView(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                  children: [
                    ...List.generate(_plans.length, (i) => _buildCard(theme, i)),
                  ],
                ),
    );
  }

  Widget _buildCard(ThemeData theme, int index) {
    final plan = _plans[index];
    final isExpanded = _expandedIndex == index;
    final name = (plan['name'] as String?) ?? '';
    final price = _formatPrice(plan);
    final cycle = _formatCycle(plan['billing_cycle'] as String?);
    final headerColor = _headerColors[index % _headerColors.length];
    final headerGradient = _headerGradients[index % _headerGradients.length];
    final features = _features(plan);

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header ──────────────────────────────────────────────────────
            GestureDetector(
              onTap: () => setState(
                  () => _expandedIndex = isExpanded ? -1 : index),
              behavior: HitTestBehavior.opaque,
              child: Container(
                decoration: BoxDecoration(gradient: headerGradient),
                padding: const EdgeInsetsDirectional.fromSTEB(18, 16, 16, 16),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              height: 1.25,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              Text(
                                price,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 26,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              if (cycle.isNotEmpty) ...[
                                const SizedBox(width: 5),
                                Text(
                                  cycle,
                                  style: const TextStyle(
                                    color: Colors.white70,
                                    fontSize: 14,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                    Icon(
                      isExpanded
                          ? Icons.expand_less_rounded
                          : Icons.chevron_right_rounded,
                      color: Colors.white54,
                      size: 22,
                    ),
                  ],
                ),
              ),
            ),

            // ── Expanded body ────────────────────────────────────────────────
            if (isExpanded)
              Container(
                color: theme.colorScheme.surface,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (features.isNotEmpty)
                      ...features.asMap().entries.map((e) => _FeatureRow(
                            label: e.value,
                            accentColor: headerColor,
                            showDivider: e.key < features.length - 1,
                          )),
                    Divider(
                        height: 1,
                        thickness: 0.5,
                        color: theme.colorScheme.outline
                            .withValues(alpha: 0.15)),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              '$price${cycle.isNotEmpty ? ' $cycle' : ''}',
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ),
                          if (context.watch<AuthProvider>().gym?.mobilePaymentsEnabled ?? true) ...[
                            const SizedBox(width: 12),
                            FilledButton(
                              style: FilledButton.styleFrom(
                                backgroundColor: headerColor,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 20, vertical: 12),
                              ),
                              onPressed: () {
                                final planPrice = (plan['price'] as num?)?.toDouble() ?? 0.0;
                                final currency = (plan['currency'] as String?) ?? 'EGP';
                                final billingCycle = plan['billing_cycle'] as String?;
                                context.push('/payment-summary', extra: CheckoutItem(
                                  type: 'membership',
                                  id: (plan['id'] as String?) ?? '',
                                  title: name,
                                  subtitle: context.l10n.exploreCycleMembership(
                                      _formatCycle(billingCycle)),
                                  price: planPrice,
                                  badges: [],
                                  applyMemberDiscount: false,
                                ));
                              },
                              child: Text(
                                context.l10n.exploreGetThisPlan,
                                style: const TextStyle(fontWeight: FontWeight.w700),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildSkeleton() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const ShimmerLoader(height: 36, width: double.infinity),
        const SizedBox(height: 20),
        ...List.generate(
          3,
          (_) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: ShimmerLoader(height: 76, borderRadius: 16),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _FeatureRow extends StatelessWidget {
  final String label;
  final Color accentColor;
  final bool showDivider;

  const _FeatureRow({
    required this.label,
    required this.accentColor,
    required this.showDivider,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: accentColor.withValues(alpha: 0.4),
                  ),
                ),
                child: Icon(
                  Icons.check_rounded,
                  size: 13,
                  color: accentColor,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(fontWeight: FontWeight.w500),
                ),
              ),
            ],
          ),
        ),
        if (showDivider)
          Divider(
            height: 1,
            thickness: 0.5,
            indent: 50,
            color: theme.colorScheme.outline.withValues(alpha: 0.12),
          ),
      ],
    );
  }
}
