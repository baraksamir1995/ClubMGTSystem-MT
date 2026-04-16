import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/checkout_item.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../utils/theme.dart';
import '../widgets/shimmer_loader.dart';

class OfferDetailScreen extends StatefulWidget {
  final String offerId;

  const OfferDetailScreen({super.key, required this.offerId});

  @override
  State<OfferDetailScreen> createState() => _OfferDetailScreenState();
}

class _OfferDetailScreenState extends State<OfferDetailScreen> {
  Map<String, dynamic>? _offer;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final offer = await ApiService().getOfferById(widget.offerId);
    if (mounted) setState(() { _offer = offer; _loading = false; });
  }

  Color _resolvePrimary() => Theme.of(context).colorScheme.primary;

  String _formatExpiry(String? raw) {
    if (raw == null) return '';
    try {
      return 'Expires ${DateFormat('MMM d, yyyy').format(DateTime.parse(raw))}';
    } catch (_) { return ''; }
  }

  Color _tagColor(String? hex) {
    if (hex != null && hex.isNotEmpty) {
      try { return AppTheme.colorFromHex(hex); } catch (_) {}
    }
    return const Color(0xFFD97706);
  }

  // Extract a numeric stat from the tag label e.g. "20% off" → ("20%", "Discount")
  ({String value, String label})? _discountStat(String tagLabel) {
    final pct = RegExp(r'(\d+)\s*%').firstMatch(tagLabel);
    if (pct != null) return (value: '${pct.group(1)}%', label: 'Discount');
    if (tagLabel.toLowerCase() == 'free') return (value: 'Free', label: 'Access');
    if (tagLabel.isNotEmpty) return (value: tagLabel, label: 'Offer');
    return null;
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return _buildSkeleton();
    if (_offer == null) return _buildNotFound();
    return _buildContent();
  }

  // ── Skeleton ─────────────────────────────────────────────────────────────

  Widget _buildSkeleton() {
    return Scaffold(
      body: Column(
        children: [
          ShimmerLoader(height: 280, borderRadius: 0),
          const SizedBox(height: 20),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                ShimmerLoader(height: 80),
                SizedBox(height: 20),
                ShimmerLoader(height: 14, width: 140),
                SizedBox(height: 12),
                ShimmerLoader(height: 100),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────

  Widget _buildNotFound() {
    return Scaffold(
      appBar: AppBar(),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.local_offer_outlined, size: 48,
                color: Theme.of(context).colorScheme.onSurfaceVariant),
            const SizedBox(height: 12),
            Text('Offer not found',
                style: Theme.of(context).textTheme.titleMedium),
          ],
        ),
      ),
    );
  }

  // ── Content ──────────────────────────────────────────────────────────────

  Widget _buildContent() {
    final theme = Theme.of(context);
    final offer = _offer!;

    final title = (offer['title'] as String?) ?? '';
    final fullDesc = ((offer['full_description'] as String?)?.isNotEmpty == true
            ? offer['full_description']
            : offer['short_description']) as String? ??
        '';
    final heroUrl = offer['hero_image_url'] as String?;
    final tagLabel = (offer['tag_label'] as String?) ?? '';
    final tagColor = _tagColor(offer['tag_color'] as String?);
    final expiry = _formatExpiry(offer['expires_at'] as String?);
    final ctaLabel = (offer['cta_label'] as String?)?.isNotEmpty == true
        ? offer['cta_label'] as String
        : 'Claim this offer';
    final terms = (offer['terms'] as List?)
            ?.map((e) => e.toString())
            .where((s) => s.isNotEmpty)
            .toList() ??
        [];
    final sessionCount    = offer['session_count'] as int?;
    final offerPrice      = (offer['offer_price'] as num?)?.toDouble();
    final originalPrice   = (offer['original_price'] as num?)?.toDouble();
    final linkedPlanId    = offer['linked_plan_id'] as String?;
    final linkedPackageId = offer['linked_package_id'] as String?;
    final savings = (offerPrice != null && originalPrice != null)
        ? originalPrice - offerPrice
        : null;
    final discountStat = _discountStat(tagLabel);

    final paymentsEnabled = context.watch<AuthProvider>().gym?.mobilePaymentsEnabled ?? true;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: theme.scaffoldBackgroundColor,
        bottomNavigationBar: paymentsEnabled ? _OfferBottomBar(
          offerPrice: offerPrice,
          originalPrice: originalPrice,
          tagLabel: tagLabel,
          tagColor: tagColor,
          ctaLabel: ctaLabel,
          onClaim: offerPrice != null
              ? () {
                  final subtitle = [
                    if (sessionCount != null) '$sessionCount sessions',
                    if (expiry.isNotEmpty) expiry,
                  ].join(' · ');
                  context.push('/payment-summary', extra: CheckoutItem(
                    type: 'offer',
                    id: widget.offerId,
                    title: title,
                    subtitle: subtitle,
                    price: offerPrice!,
                    originalPrice: originalPrice,
                    badges: [
                      if (tagLabel.isNotEmpty) tagLabel,
                    ],
                    applyMemberDiscount: false,
                    linkedPlanId: linkedPlanId,
                    linkedPackageId: linkedPackageId,
                  ));
                }
              : () {},
        ) : null,
        body: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Hero ────────────────────────────────────────────────────
              _HeroSection(
                heroUrl: heroUrl,
                tagLabel: tagLabel,
                tagColor: tagColor,
                title: title,
                expiry: expiry,
              ),

              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Pricing card ──────────────────────────────────────
                    if (offerPrice != null) ...[
                      _OfferPricingCard(
                        offerPrice: offerPrice,
                        originalPrice: originalPrice,
                        savings: savings,
                      ),
                      const SizedBox(height: 16),
                    ],

                    // ── Stat boxes ────────────────────────────────────────
                    if (discountStat != null || sessionCount != null) ...[
                      Row(
                        children: [
                          if (discountStat != null)
                            Expanded(
                              child: _StatBox(
                                value: discountStat.value,
                                label: discountStat.label,
                                valueColor: tagColor,
                              ),
                            ),
                          if (discountStat != null && sessionCount != null)
                            const SizedBox(width: 12),
                          if (sessionCount != null)
                            Expanded(
                              child: _StatBox(
                                value: '$sessionCount',
                                label: 'PT sessions',
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 24),
                    ],

                    // ── About this offer ──────────────────────────────────
                    if (fullDesc.isNotEmpty) ...[
                      Text(
                        'ABOUT THIS OFFER',
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: theme.colorScheme.outline
                                .withValues(alpha: 0.15),
                          ),
                        ),
                        child: Text(
                          fullDesc,
                          style: theme.textTheme.bodyMedium
                              ?.copyWith(height: 1.6),
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],

                    // ── Terms & conditions ────────────────────────────────
                    if (terms.isNotEmpty) ...[
                      Text(
                        'TERMS & CONDITIONS',
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 10),
                      ...terms.map((term) => _TermRow(term: term)),
                      const SizedBox(height: 24),
                    ],

                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Offer pricing card
// ─────────────────────────────────────────────────────────────────────────────

class _OfferPricingCard extends StatelessWidget {
  final double offerPrice;
  final double? originalPrice;
  final double? savings;

  const _OfferPricingCard({
    required this.offerPrice,
    required this.originalPrice,
    required this.savings,
  });

  String _fmt(double v) => v.toStringAsFixed(0).replaceAllMapped(
        RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
        (m) => '${m[1]},',
      );

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: theme.colorScheme.outline.withValues(alpha: 0.15)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Offer price',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 4),
                RichText(
                  text: TextSpan(
                    children: [
                      TextSpan(
                        text: _fmt(offerPrice),
                        style: TextStyle(
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                          color: theme.colorScheme.onSurface,
                        ),
                      ),
                      TextSpan(
                        text: '  EGP',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                if (originalPrice != null)
                  Text(
                    '${_fmt(originalPrice!)} EGP',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                      decoration: TextDecoration.lineThrough,
                    ),
                  ),
              ],
            ),
          ),
          if (savings != null && savings! > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
              decoration: BoxDecoration(
                color: const Color(0xFFFFF7ED),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                'Save ${_fmt(savings!)} EGP',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFFD97706),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sticky offer bottom bar
// ─────────────────────────────────────────────────────────────────────────────

class _OfferBottomBar extends StatelessWidget {
  final double? offerPrice;
  final double? originalPrice;
  final String tagLabel;
  final Color tagColor;
  final String ctaLabel;
  final VoidCallback onClaim;

  const _OfferBottomBar({
    required this.offerPrice,
    required this.originalPrice,
    required this.tagLabel,
    required this.tagColor,
    required this.ctaLabel,
    required this.onClaim,
  });

  String _fmt(double v) => v.toStringAsFixed(0).replaceAllMapped(
        RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
        (m) => '${m[1]},',
      );

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Container(
      padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + bottomPad),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        border: Border(
          top: BorderSide(
            color: theme.colorScheme.outline.withValues(alpha: 0.12),
          ),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (offerPrice != null) ...[
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Total price',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                          fontSize: 11,
                        ),
                      ),
                      const SizedBox(height: 1),
                      Row(
                        children: [
                          Text(
                            '${_fmt(offerPrice!)} EGP',
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 16,
                            ),
                          ),
                          if (originalPrice != null) ...[
                            const SizedBox(width: 8),
                            Text(
                              _fmt(originalPrice!),
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant,
                                decoration: TextDecoration.lineThrough,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                if (tagLabel.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: tagColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      tagLabel,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: tagColor,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 10),
          ],
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: tagColor,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              onPressed: onClaim,
              icon: const Icon(Icons.check_rounded,
                  size: 18, color: Colors.white),
              label: Text(
                ctaLabel,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero section — full-bleed image with gradient + back button + title overlay
// ─────────────────────────────────────────────────────────────────────────────

class _HeroSection extends StatelessWidget {
  final String? heroUrl;
  final String tagLabel;
  final Color tagColor;
  final String title;
  final String expiry;

  const _HeroSection({
    required this.heroUrl,
    required this.tagLabel,
    required this.tagColor,
    required this.title,
    required this.expiry,
  });

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;

    return SizedBox(
      height: 280 + topPadding,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Image
          heroUrl != null && heroUrl!.isNotEmpty
              ? CachedNetworkImage(
                  imageUrl: heroUrl!,
                  fit: BoxFit.cover,
                  placeholder: (_, __) =>
                      const ColoredBox(color: Color(0xFFD1D5DB)),
                  errorWidget: (_, __, ___) =>
                      const ColoredBox(color: Color(0xFFD1D5DB)),
                )
              : const ColoredBox(color: Color(0xFFD1D5DB)),

          // Dark gradient overlay (stronger at bottom)
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: [0.35, 1.0],
                colors: [Colors.transparent, Color(0xCC000000)],
              ),
            ),
          ),

          // Back button
          Positioned(
            top: topPadding + 8,
            left: 12,
            child: GestureDetector(
              onTap: () => Navigator.of(context).pop(),
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.35),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.arrow_back_rounded,
                    color: Colors.white, size: 20),
              ),
            ),
          ),

          // Tag + title + expiry
          Positioned(
            left: 20,
            right: 20,
            bottom: 20,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (tagLabel.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: tagColor,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      tagLabel,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    height: 1.2,
                  ),
                ),
                if (expiry.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.access_time_rounded,
                          size: 13, color: Colors.white70),
                      const SizedBox(width: 4),
                      Text(
                        expiry,
                        style: const TextStyle(
                          color: Colors.white70,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat box
// ─────────────────────────────────────────────────────────────────────────────

class _StatBox extends StatelessWidget {
  final String value;
  final String label;
  final Color? valueColor;

  const _StatBox({required this.value, required this.label, this.valueColor});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: theme.colorScheme.outline.withValues(alpha: 0.15)),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: valueColor ?? theme.colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Term row
// ─────────────────────────────────────────────────────────────────────────────

class _TermRow extends StatelessWidget {
  final String term;

  const _TermRow({required this.term});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
              color: theme.colorScheme.outline.withValues(alpha: 0.15)),
        ),
        child: Row(
          children: [
            Icon(Icons.check_rounded,
                size: 16, color: const Color(0xFF10B981)),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                term,
                style: theme.textTheme.bodyMedium,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
