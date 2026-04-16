import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../models/checkout_item.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/shimmer_loader.dart';

class ExploreSessionPackagesScreen extends StatefulWidget {
  const ExploreSessionPackagesScreen({super.key});

  @override
  State<ExploreSessionPackagesScreen> createState() =>
      _ExploreSessionPackagesScreenState();
}

class _ExploreSessionPackagesScreenState
    extends State<ExploreSessionPackagesScreen> {
  List<Map<String, dynamic>> _packages = [];
  bool _loading = true;
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
    final pkgs = await _service.getSessionPackagesListing(gymId);
    if (mounted) setState(() { _packages = pkgs; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(title: const Text('Session packages')),
      body: _loading
          ? _buildSkeleton()
          : _packages.isEmpty
              ? const Center(child: Text('No session packages available'))
              : ListView(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                  children: [
                    Text(
                      'Buy sessions to use with any class or trainer. Sessions never expire.',
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 20),
                    ...List.generate(
                      _packages.length,
                      (i) {
                        final pkg = _packages[i];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _PackageCard(
                            pkg: pkg,
                            index: i,
                            isMostPopular: i == 1 && _packages.length >= 2,
                            onBuy: (context.watch<AuthProvider>().gym?.mobilePaymentsEnabled ?? true) ? () {
                              final sessions = (pkg['session_count'] as int?) ?? 0;
                              final price = (pkg['price'] as num?)?.toDouble() ?? 0.0;
                              final name = (pkg['name'] as String?) ?? '$sessions sessions';
                              context.push('/payment-summary', extra: CheckoutItem(
                                type: 'session_package',
                                id: (pkg['id'] as String?) ?? '',
                                title: name,
                                subtitle: '$sessions sessions package',
                                price: price,
                                badges: [],
                                applyMemberDiscount: true,
                              ));
                            } : null,
                          ),
                        );
                      },
                    ),
                  ],
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
            child: ShimmerLoader(height: 170, borderRadius: 16),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _PackageCard extends StatelessWidget {
  final Map<String, dynamic> pkg;
  final int index;
  final bool isMostPopular;
  final VoidCallback? onBuy;

  const _PackageCard({
    required this.pkg,
    required this.index,
    required this.isMostPopular,
    required this.onBuy,
  });

  // Per-index accent colors
  static const _accentColors = [
    Color(0xFF6B7280), // gray
    Color(0xFFD97706), // amber
    Color(0xFF6366F1), // indigo
  ];

  static const _borderColors = [
    Color(0xFFE5E7EB),
    Color(0xFFFBBF24),
    Color(0xFFA5B4FC),
  ];

  static const _buttonColors = [
    Color(0xFF111827),
    Color(0xFFD97706),
    Color(0xFF6366F1),
  ];

  String _fmt(double price, String currency) {
    final s = price == price.floorToDouble()
        ? price.toInt().toString()
        : price.toStringAsFixed(0);
    // Format with comma for thousands
    final n = int.tryParse(s) ?? 0;
    final formatted = n >= 1000
        ? '${(n / 1000).floor()},${(n % 1000).toString().padLeft(3, '0')}'
        : s;
    return currency == 'USD' ? '\$$formatted' : '$formatted $currency';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final sessions = (pkg['session_count'] as int?) ?? 0;
    final price = (pkg['price'] as num?)?.toDouble() ?? 0;
    final currency = (pkg['currency'] as String?) ?? 'EGP';
    final description = (pkg['description'] as String?) ?? '';
    final perSession = sessions > 0 ? price / sessions : 0.0;

    final accent = _accentColors[index % _accentColors.length];
    final borderColor = _borderColors[index % _borderColors.length];
    final buttonColor = _buttonColors[index % _buttonColors.length];

    return Stack(
      children: [
        Container(
          padding: EdgeInsets.fromLTRB(18, isMostPopular ? 42 : 18, 18, 18),
          decoration: BoxDecoration(
            color: theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
                color: borderColor, width: isMostPopular ? 1.5 : 1),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Session count + price row
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$sessions',
                        style: TextStyle(
                          fontSize: 48,
                          fontWeight: FontWeight.w800,
                          color: accent,
                          height: 1,
                        ),
                      ),
                      Text(
                        'sessions',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: accent,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                  const Spacer(),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        _fmt(price, currency),
                        style: theme.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                          fontSize: 22,
                        ),
                      ),
                      if (sessions > 0)
                        Text(
                          '${_fmt(perSession, currency)} / session',
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                    ],
                  ),
                ],
              ),
              // Description
              if (description.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(
                  description,
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
              const SizedBox(height: 16),
              // CTA button
              if (onBuy != null)
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: buttonColor,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    onPressed: onBuy,
                    child: Text(
                      'Buy $sessions sessions',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 15,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
        // "Most popular" badge
        if (isMostPopular)
          Positioned(
            top: 0,
            right: 16,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: const BoxDecoration(
                color: Color(0xFFD97706),
                borderRadius: BorderRadius.vertical(
                    bottom: Radius.circular(8)),
              ),
              child: const Text(
                'Most popular',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
