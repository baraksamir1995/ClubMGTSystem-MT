import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:clby/l10n/l10n.dart';

import '../models/service_model.dart';
import 'service_icon.dart';

// ─────────────────────────────────────────────────────────────────────────────
// ServicesSection
// Rendered as a section inside the Explore tab scroll view.
// ─────────────────────────────────────────────────────────────────────────────

class ServicesSection extends StatelessWidget {
  /// Whether to show the loading skeleton instead of real cards.
  final bool loading;

  /// Map of `trainer_type` → number of service packages for that type.
  /// When provided, services with zero packages are hidden, and the whole
  /// section disappears if no service has any.
  final Map<String, int>? packageCounts;

  const ServicesSection({
    super.key,
    this.loading = false,
    this.packageCounts,
  });

  List<ServiceModel> get _visibleServices {
    final counts = packageCounts;
    if (counts == null) return kServices;
    return kServices
        .where((s) => (counts[s.trainerType] ?? 0) > 0)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final visible = _visibleServices;
    if (!loading && visible.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeader(count: visible.length),
          const SizedBox(height: 12),
          loading ? _buildSkeleton() : _buildCards(context, visible),
        ],
      ),
    );
  }

  Widget _buildCards(BuildContext context, List<ServiceModel> services) {
    final count = services.length;

    if (count == 1) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: _ServiceCard(
          service: services[0],
          width: double.infinity,
        ),
      );
    }

    if (count == 2) {
      return Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Row(
          children: [
            Expanded(
              child: _ServiceCard(
                service: services[0],
                width: double.infinity,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _ServiceCard(
                service: services[1],
                width: double.infinity,
              ),
            ),
          ],
        ),
      );
    }

    // 3+ → horizontal scroll, 148px cards, last bleeds ~20px
    return SizedBox(
      height: 120,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: services.length,
        itemBuilder: (_, i) => Padding(
          padding: EdgeInsetsDirectional.only(end: i < services.length - 1 ? 12 : 0),
          child: _ServiceCard(
            service: services[i],
            width: 148,
          ),
        ),
      ),
    );
  }

  Widget _buildSkeleton() {
    return SizedBox(
      height: 120,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: 3,
        itemBuilder: (context, i) {
          final base = Theme.of(context).colorScheme.surfaceContainerHighest;
          return Padding(
            padding: EdgeInsetsDirectional.only(end: i < 2 ? 12 : 0),
            child: _SkeletonCard(baseColor: base),
          );
        },
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final int count;
  const _SectionHeader({required this.count});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            context.l10n.servicesTitle,
            style: theme.textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          if (count >= 4)
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () {},
              child: Text(
                context.l10n.commonSeeAll,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF534AB7),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Service card
// ─────────────────────────────────────────────────────────────────────────────

class _ServiceCard extends StatefulWidget {
  final ServiceModel service;
  final double width;

  const _ServiceCard({
    required this.service,
    required this.width,
  });

  @override
  State<_ServiceCard> createState() => _ServiceCardState();
}

class _ServiceCardState extends State<_ServiceCard> {
  double _scale = 1.0;

  @override
  Widget build(BuildContext context) {
    final svc = widget.service;

    return GestureDetector(
      onTapDown: (_) => setState(() => _scale = 0.97),
      onTapUp: (_) {
        setState(() => _scale = 1.0);
        context.push('/service-packages/${svc.id}', extra: svc);
      },
      onTapCancel: () => setState(() => _scale = 1.0),
      child: AnimatedScale(
        scale: _scale,
        duration: const Duration(milliseconds: 100),
        child: Container(
          width: widget.width,
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: const Color(0xFFE8E6E0), width: 0.5),
            borderRadius: BorderRadius.circular(14),
          ),
          padding: const EdgeInsets.all(14),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: svc.accentLight,
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Center(
                  child: ServiceIcon(
                    iconType: svc.iconType,
                    color: svc.accent,
                    size: 20,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                svc.name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: Color(0xFF1D1D1B),
                  height: 1.3,
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
// Skeleton card
// ─────────────────────────────────────────────────────────────────────────────

class _SkeletonCard extends StatefulWidget {
  final Color baseColor;
  const _SkeletonCard({required this.baseColor});

  @override
  State<_SkeletonCard> createState() => _SkeletonCardState();
}

class _SkeletonCardState extends State<_SkeletonCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
    _anim = Tween<double>(begin: 0.5, end: 1.0)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = widget.baseColor;
    return AnimatedBuilder(
      animation: _anim,
      builder: (_, __) => Opacity(
        opacity: _anim.value,
        child: Container(
          width: 148,
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: const Color(0xFFE8E6E0), width: 0.5),
            borderRadius: BorderRadius.circular(14),
          ),
          padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: base,
                  borderRadius: BorderRadius.circular(11),
                ),
              ),
              const SizedBox(height: 8),
              Container(
                height: 12,
                width: 80,
                decoration: BoxDecoration(
                  color: base,
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
