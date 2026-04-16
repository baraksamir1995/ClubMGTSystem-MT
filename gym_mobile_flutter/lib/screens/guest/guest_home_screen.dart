import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../services/api_service.dart';
import '../../core/config/app_config.dart';
import '../../core/widgets/banner_carousel.dart';
import '../../features/banners/banner_provider.dart';
import '../../models/session_model.dart' as session_model;
import '../../providers/auth_provider.dart';
import '../../utils/theme.dart';
import '../../widgets/guest_register_prompt.dart';
import '../../widgets/shimmer_loader.dart';
import 'package:intl/intl.dart';

class GuestHomeScreen extends StatefulWidget {
  const GuestHomeScreen({super.key});

  @override
  State<GuestHomeScreen> createState() => _GuestHomeScreenState();
}

class _GuestHomeScreenState extends State<GuestHomeScreen> {
  List<session_model.Session> _todaysSessions = [];
  bool _sessionsLoading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadData());
  }

  Future<void> _loadData() async {
    final bannerProvider = context.read<BannerProvider>();
    if (!bannerProvider.hasBanners && !bannerProvider.isLoading) {
      bannerProvider.loadBanners(AppConfig.gymId);
    }

    try {
      final sessions = await ApiService().getUpcomingSessions(AppConfig.gymId);
      final today = DateTime.now();
      final todaySessions = sessions.where((s) =>
          s.scheduledAt.year == today.year &&
          s.scheduledAt.month == today.month &&
          s.scheduledAt.day == today.day).take(3).toList();

      if (mounted) {
        setState(() {
          _todaysSessions = todaySessions;
          _sessionsLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _sessionsLoading = false);
    }
  }

  Future<void> _refresh() async {
    setState(() => _sessionsLoading = true);
    await _loadData();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final gym = context.watch<AuthProvider>().gym;
    final bannerProvider = context.watch<BannerProvider>();

    final primary = Theme.of(context).colorScheme.primary;

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _refresh,
        color: primary,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Banner carousel
              BannerCarousel(
                banners: bannerProvider.banners,
                isLoading: bannerProvider.isLoading,
              ),
              if (bannerProvider.hasBanners || bannerProvider.isLoading)
                const SizedBox(height: 24),

              // Membership plans section
              _SectionHeader(
                title: 'Membership plans',
                onAction: null,
              ),
              const SizedBox(height: 12),
              _MembershipPlansCard(
                gymName: gym?.name ?? 'the gym',
                primaryColor: primary,
                onJoin: () => showGuestRegisterPrompt(context),
              ),
              const SizedBox(height: 20),

              // Check-in locked card
              _CheckInLockedCard(
                onTap: () => showGuestRegisterPrompt(context),
              ),
              const SizedBox(height: 20),

              // Today's classes section
              _SectionHeader(
                title: "Today's classes",
                actionLabel: 'See all',
                onAction: () => context.go('/guest/classes'),
              ),
              const SizedBox(height: 12),
              if (_sessionsLoading)
                ShimmerListLoader(itemCount: 2, itemHeight: 72)
              else if (_todaysSessions.isEmpty)
                _NoClassesToday(theme: theme)
              else
                ..._todaysSessions.map(
                  (s) => _GuestSessionRow(
                    session: s,
                    primaryColor: primary,
                    onTap: () => showGuestRegisterPrompt(context),
                  ),
                ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Section header ──────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  const _SectionHeader({
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: theme.textTheme.titleMedium?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
        if (actionLabel != null && onAction != null)
          GestureDetector(
            onTap: onAction,
            child: Text(
              actionLabel!,
              style: TextStyle(
                color: theme.colorScheme.primary,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
      ],
    );
  }
}

// ─── Membership plans invite card ─────────────────────────────────────────────

class _MembershipPlansCard extends StatelessWidget {
  final String gymName;
  final Color primaryColor;
  final VoidCallback onJoin;

  const _MembershipPlansCard({
    required this.gymName,
    required this.primaryColor,
    required this.onJoin,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: onJoin,
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: theme.colorScheme.outline.withValues(alpha: 0.35),
            width: 1.5,
            strokeAlign: BorderSide.strokeAlignInside,
          ),
        ),
        child: DashedBorderPainter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
            child: Column(
              children: [
                // Plus icon
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: primaryColor.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.add, color: primaryColor, size: 24),
                ),
                const SizedBox(height: 12),
                Text(
                  'Join $gymName today',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 6),
                Text(
                  'Choose from sessions or duration memberships.\nFlexible plans for every goal.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                    height: 1.5,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),

                // Blurred plan preview rows
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: ImageFiltered(
                    imageFilter: ImageFilter.blur(sigmaX: 4, sigmaY: 4),
                    child: Column(
                      children: [
                        _PlanPreviewTile(primaryColor: primaryColor),
                        const SizedBox(height: 8),
                        _PlanPreviewTile(primaryColor: primaryColor),
                        const SizedBox(height: 8),
                        _PlanPreviewTile(primaryColor: primaryColor),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PlanPreviewTile extends StatelessWidget {
  final Color primaryColor;
  const _PlanPreviewTile({required this.primaryColor});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: primaryColor.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                    height: 8,
                    width: 100,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.onSurface.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(4),
                    )),
                const SizedBox(height: 5),
                Container(
                    height: 6,
                    width: 60,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.onSurface.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(4),
                    )),
              ],
            ),
          ),
          Container(
              height: 8,
              width: 40,
              decoration: BoxDecoration(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(4),
              )),
        ],
      ),
    );
  }
}

// ─── Check-in locked card ─────────────────────────────────────────────────────

class _CheckInLockedCard extends StatelessWidget {
  final VoidCallback onTap;
  const _CheckInLockedCard({required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: theme.colorScheme.outline.withValues(alpha: 0.15),
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: theme.colorScheme.onSurface.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                Icons.grid_view_rounded,
                size: 20,
                color: theme.colorScheme.onSurface.withValues(alpha: 0.3),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Check in locked',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: theme.colorScheme.onSurface.withValues(alpha: 0.5),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Members only — sign in to access',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurface.withValues(alpha: 0.4),
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.lock_outline_rounded,
              size: 18,
              color: theme.colorScheme.onSurface.withValues(alpha: 0.3),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Today's classes row ─────────────────────────────────────────────────────

class _GuestSessionRow extends StatelessWidget {
  final session_model.Session session;
  final Color primaryColor;
  final VoidCallback onTap;

  const _GuestSessionRow({
    required this.session,
    required this.primaryColor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    Color accent = primaryColor;
    if (session.classColor != null && session.classColor!.isNotEmpty) {
      try {
        accent = AppTheme.colorFromHex(session.classColor!);
      } catch (_) {}
    }

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: theme.colorScheme.outline.withValues(alpha: 0.12),
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: accent.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(Icons.fitness_center, color: accent, size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    session.className ?? 'Class',
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (session.instructor != null)
                    Text(
                      session.instructor!,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                ],
              ),
            ),
            Text(
              DateFormat('h:mm a').format(session.scheduledAt),
              style: theme.textTheme.bodySmall?.copyWith(
                color: accent,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _NoClassesToday extends StatelessWidget {
  final ThemeData theme;
  const _NoClassesToday({required this.theme});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(
            Icons.event_available_outlined,
            color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
          ),
          const SizedBox(width: 12),
          Text(
            'No classes scheduled today',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Dashed border painter ────────────────────────────────────────────────────

class DashedBorderPainter extends StatelessWidget {
  final Widget child;
  const DashedBorderPainter({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _DashedPainter(
        color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.35),
      ),
      child: child,
    );
  }
}

class _DashedPainter extends CustomPainter {
  final Color color;
  _DashedPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1.5
      ..style = PaintingStyle.stroke;

    const dashWidth = 6.0;
    const dashSpace = 4.0;
    const radius = Radius.circular(16);
    final path = Path()
      ..addRRect(RRect.fromRectAndRadius(
        Rect.fromLTWH(0, 0, size.width, size.height),
        radius,
      ));

    final metrics = path.computeMetrics().first;
    double distance = 0;
    while (distance < metrics.length) {
      canvas.drawPath(
        metrics.extractPath(distance, distance + dashWidth),
        paint,
      );
      distance += dashWidth + dashSpace;
    }
  }

  @override
  bool shouldRepaint(_DashedPainter old) => old.color != color;
}
