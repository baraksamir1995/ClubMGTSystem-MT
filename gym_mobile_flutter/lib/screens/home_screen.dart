import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../core/widgets/banner_carousel.dart';
import '../features/banners/banner_provider.dart';
import '../features/popups/popup_provider.dart';
import '../models/gym_model.dart';
import '../models/membership_model.dart';
import '../models/session_model.dart';
import '../widgets/membership_card_unified.dart';
import '../providers/auth_provider.dart';
import '../providers/member_provider.dart';
import '../screens/session_detail_screen.dart';
import '../services/notification_service.dart';
import 'package:url_launcher/url_launcher.dart';
import '../features/branches/branch_provider.dart';
import '../models/branch_model.dart';
import 'locations_screen.dart';
import '../widgets/screen_refresh_indicator.dart';
import '../widgets/gym_app_bar.dart';
import '../widgets/shimmer_loader.dart';
import '../models/capacity_model.dart';
import '../features/rating/rating_reminder_provider.dart';
import '../services/api_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  String? _loadingSessionId;
  Timer? _capacityTimer;
  // Skip the very first AppLifecycleState.resumed event — bootstrap +
  // initState already loaded all critical home data, so refreshing again
  // here just doubles network on cold start. Subsequent resumes
  // (background → foreground) still refresh.
  bool _hasHandledFirstResume = false;

  Future<void> _book(String sessionId) async {
    final memberProvider = context.read<MemberProvider>();
    final session =
        memberProvider.sessions.where((s) => s.id == sessionId).firstOrNull;
    setState(() => _loadingSessionId = sessionId);
    try {
      await memberProvider.bookSession(sessionId);
      if (session != null) {
        NotificationService().showBookingConfirmedNotification(
          session.className ?? 'Class',
          session.scheduledAt,
        );
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Session booked successfully!'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Failed to book. Please try again.'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loadingSessionId = null);
    }
  }

  Future<void> _cancel(String bookingId) async {
    final gymId = context.read<AuthProvider>().profile?.gymId ?? '';
    final memberProvider = context.read<MemberProvider>();
    setState(() => _loadingSessionId = bookingId);
    try {
      await memberProvider.cancelBooking(bookingId, gymId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Booking cancelled.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Failed to cancel. Please try again.'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _loadingSessionId = null);
    }
  }

  void _openDetail(Session session, List<Session> daySessions) {
    final others = daySessions.where((s) => s.id != session.id).toList();
    final now = DateTime.now();
    final hasEnded = session.endTime != null && session.endTime!.isBefore(now);
    final isAttended = session.bookingStatus == 'attended';
    final canBook = !session.isBooked && !hasEnded && !isAttended;

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => SessionDetailScreen(
          session: session,
          onBook: canBook ? () => _book(session.id) : null,
          onCancel: session.bookingId != null && !isAttended
              ? () => _cancel(session.bookingId!)
              : null,
          otherSessions: others,
        ),
      ),
    );
  }

  // True once the gymId has shown up and we've kicked off the home loads.
  // Prevents a re-fire if AuthProvider notifies again later.
  bool _initialLoadFired = false;

  Future<void> _kickOffInitialLoad() async {
    if (_initialLoadFired || !mounted) return;
    final gymId = context.read<AuthProvider>().profile?.gymId;
    if (gymId == null) return; // wait for auth to populate profile.gymId
    _initialLoadFired = true;

    await _loadData();
    if (!mounted) return;

    _startCapacityTimer();

    // Promotional popup first (awaited so rating reminder never overlaps)
    await context.read<PopupProvider>().maybeShowPopup(context);

    // Rating reminder — only if no popup was shown (or after it's dismissed)
    if (!mounted) return;
    final memberId = context.read<MemberProvider>().member?.id;
    if (memberId != null) {
      final reminderProvider = context.read<RatingReminderProvider>();
      await reminderProvider.checkPendingRating(ApiService(), memberId);
      if (mounted) await reminderProvider.maybeShowReminder(context);
    }
  }

  void _onAuthChanged() => _kickOffInitialLoad();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    // After login the router pushes /home as soon as AuthProvider sets
    // _userId — but _profile (and therefore profile.gymId) may still be
    // null while _loadProfileAndGym() finishes in the background. Retry
    // until gymId is available.
    final auth = context.read<AuthProvider>();
    auth.addListener(_onAuthChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _kickOffInitialLoad();
    });
  }

  void _startCapacityTimer() {
    _capacityTimer?.cancel();
    _capacityTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      if (!mounted) return;
      final gymId = context.read<AuthProvider>().profile?.gymId;
      if (gymId != null) {
        context.read<MemberProvider>().loadCapacity(gymId);
      }
    });
  }

  @override
  void dispose() {
    _capacityTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    // Best-effort cleanup of the auth listener; if AuthProvider was already
    // disposed (app shutdown) the call is a no-op.
    try {
      context.read<AuthProvider>().removeListener(_onAuthChanged);
    } catch (_) {}
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) return;

    // Refresh greeting immediately in case the time-of-day slot changed
    // while the app was in the background (e.g. morning → afternoon).
    if (mounted) setState(() {});

    // The first resume fires right after splash → home navigation; bootstrap
    // already loaded everything. Skip to avoid the double cold-start fetch.
    if (!_hasHandledFirstResume) {
      _hasHandledFirstResume = true;
      return;
    }

    final gymId = context.read<AuthProvider>().profile?.gymId;
    final memberProvider = context.read<MemberProvider>();
    final bannerProvider = context.read<BannerProvider>();
    if (gymId != null) {
      memberProvider.loadNotifications(gymId);
      memberProvider.refreshMembership();
      memberProvider.loadCapacity(gymId);
      bannerProvider.loadBanners(gymId, force: true);
    }
  }

  Future<void> _loadData() async {
    final memberProvider = context.read<MemberProvider>();
    final authProvider = context.read<AuthProvider>();
    final gymId = authProvider.profile?.gymId;

    if (memberProvider.isBootstrapped) {
      // AppBootstrap already loaded all critical data during splash.
      // Silently refresh membership in the background so admin-assigned plans
      // are picked up without a full reload or shimmer flash.
      if (gymId != null) {
        memberProvider.refreshMembership();
      }
      return;
    }

    // Fallback path — bootstrap didn't run (most commonly: the user just
    // signed in, so splash bootstrap returned early on no-auth and never
    // marked bootstrapped). Mirror _refreshData so the post-login load
    // behaves the same as a manual pull-to-refresh: force-reload member
    // data (don't trust ensureMemberLoaded short-circuiting) and force the
    // banner/branch caches so a stale gymId doesn't suppress the fetch.
    if (gymId != null) {
      final bannerProvider = context.read<BannerProvider>();
      final branchProvider = context.read<BranchProvider>();
      await Future.wait([
        memberProvider.loadMemberData(gymId),
        bannerProvider.loadBanners(gymId, force: true),
        branchProvider.loadBranches(gymId, force: true),
      ]);
      await memberProvider.loadSessions(gymId);
    }
  }

  Future<void> _refreshData() async {
    final authProvider = context.read<AuthProvider>();
    final memberProvider = context.read<MemberProvider>();
    final bannerProvider = context.read<BannerProvider>();
    final gymId = authProvider.profile?.gymId;
    if (gymId != null) {
      final branchProvider = context.read<BranchProvider>();
      await Future.wait([
        memberProvider.loadMemberData(gymId),
        bannerProvider.loadBanners(gymId, force: true),
        branchProvider.loadBranches(gymId, force: true),
      ]);
      await memberProvider.loadSessions(gymId);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = context.watch<AuthProvider>();
    final memberProvider = context.watch<MemberProvider>();
    // BannerProvider + BranchProvider are NOT watched here — their changes
    // would otherwise rebuild the entire 1500-line tree. Their consumers
    // are wrapped in scoped Consumer/Selector widgets below so only the
    // banner carousel and the locations strip rebuild.
    final gym = authProvider.gym;
    final profile = authProvider.profile;

    final primary = Theme.of(context).colorScheme.primary;

    final rawName = profile?.fullName?.trim() ?? '';
    final firstName =
        rawName.isNotEmpty ? rawName.split(' ').first : null;
    final greeting = _timeGreeting(firstName);

    return Scaffold(
      appBar: GymAppBar(
        gym: gym,
        greeting: greeting.text,
        greetingEmoji: greeting.emoji,
      ),
      body: ScreenRefreshIndicator(
        onRefresh: _refreshData,
        icon: Icons.sync_rounded,
        color: primary,
        indicatorWidget: _RefreshLogoMark(gym: gym),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Banner carousel ──────────────────────────────────────
              Consumer<BannerProvider>(
                builder: (_, bp, _) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    BannerCarousel(banners: bp.banners, isLoading: bp.isLoading),
                    if (bp.hasBanners || bp.isLoading) const SizedBox(height: 24),
                  ],
                ),
              ),

              // ── Your membership ──────────────────────────────────────
              _SectionHeader(
                title: 'Your membership',
                actionLabel: 'View plan',
                onAction: () => context.push('/membership'),
                actionColor: primary,
              ),
              const SizedBox(height: 12),
              if (memberProvider.isLoadingMember)
                BrandedSkeletonCard.fromContext(context, height: 170)
              else if (memberProvider.membershipSummary != null
                  && memberProvider.membershipSummary!.buckets.isNotEmpty)
                MembershipCardUnified(
                  summary: memberProvider.membershipSummary!,
                  subscription: memberProvider.currentMembership,
                  primary: primary,
                  secondary: Theme.of(context).colorScheme.secondary,
                )
              else
                _NoMembershipCard(primary: primary),
              const SizedBox(height: 24),

              // ── Today's classes ──────────────────────────────────────
              _SectionHeader(
                title: "Today's classes",
                actionLabel: 'See all',
                onAction: () => context.go('/schedule'),
                actionColor: primary,
              ),
              const SizedBox(height: 12),
              _TodaysClassesRow(
                sessions: memberProvider.sessions,
                isLoading: memberProvider.isLoadingSessions,
                primary: primary,
                onTap: _openDetail,
              ),
              const SizedBox(height: 24),

              // ── Your activity ────────────────────────────────────────
              const _SectionHeader(title: 'Your activity'),
              const SizedBox(height: 12),
              _ProgressGrid(
                memberProvider: memberProvider,
                primary: primary,
              ),
              const SizedBox(height: 24),

              // ── Quick access ─────────────────────────────────────────
              const _SectionHeader(
                title: 'Quick access',
                subtitle: 'Jump straight where you need',
              ),
              const SizedBox(height: 12),
              const _QuickAccessGrid(),
              const SizedBox(height: 24),

              // ── Our locations ────────────────────────────────────────
              Selector<BranchProvider, List<BranchModel>>(
                selector: (_, bp) => bp.branches,
                builder: (_, branches, _) {
                  if (branches.length < 2) return const SizedBox.shrink();
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _SectionHeader(
                        title: 'Our locations',
                        actionLabel: 'See all',
                        onAction: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const LocationsScreen()),
                        ),
                        actionColor: primary,
                      ),
                      const SizedBox(height: 12),
                      _LocationsCarousel(branches: branches),
                      const SizedBox(height: 24),
                    ],
                  );
                },
              ),

            ],
          ),
        ),
      ),
    );
  }
}

// ─── Section header ───────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;
  final String? subtitle;
  final String? actionLabel;
  final VoidCallback? onAction;
  final Color? actionColor;

  const _SectionHeader({
    required this.title,
    this.subtitle,
    this.actionLabel,
    this.onAction,
    this.actionColor,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              title,
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700, letterSpacing: -0.3),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 2),
              Text(
                subtitle!,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                  fontSize: 12,
                ),
              ),
            ],
          ],
        ),
        if (actionLabel != null && onAction != null)
          GestureDetector(
            onTap: onAction,
            child: Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                actionLabel!,
                style: TextStyle(
                  color: actionColor ?? theme.colorScheme.primary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _NoMembershipCard extends StatelessWidget {
  final Color primary;
  const _NoMembershipCard({required this.primary});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DashedBorderContainer(
      borderRadius: 16,
      color: theme.colorScheme.outline.withValues(alpha: 0.35),
      strokeWidth: 1.4,
      dashLength: 6,
      gapLength: 4,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
        child: Column(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.info_outline_rounded,
                color: Theme.of(context).colorScheme.primary,
                size: 26,
              ),
            ),
            const SizedBox(height: 14),
            Text(
              'No active membership',
              style: theme.textTheme.titleSmall
                  ?.copyWith(fontWeight: FontWeight.w700, fontSize: 15),
            ),
            const SizedBox(height: 6),
            Text(
              "You don't have a plan yet. Choose a membership to unlock full access.",
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => context.push('/membership'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF4F46E5),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  'Browse membership plans',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Dashed border container ──────────────────────────────────────────────────

class DashedBorderContainer extends StatelessWidget {
  final Widget child;
  final double borderRadius;
  final Color color;
  final double strokeWidth;
  final double dashLength;
  final double gapLength;

  const DashedBorderContainer({
    super.key,
    required this.child,
    this.borderRadius = 12,
    this.color = const Color(0xFFCCCCCC),
    this.strokeWidth = 1.5,
    this.dashLength = 6,
    this.gapLength = 4,
  });

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _DashedBorderPainter(
        borderRadius: borderRadius,
        color: color,
        strokeWidth: strokeWidth,
        dashLength: dashLength,
        gapLength: gapLength,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: child,
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  final double borderRadius;
  final Color color;
  final double strokeWidth;
  final double dashLength;
  final double gapLength;

  _DashedBorderPainter({
    required this.borderRadius,
    required this.color,
    required this.strokeWidth,
    required this.dashLength,
    required this.gapLength,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    final rRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(
          strokeWidth / 2, strokeWidth / 2,
          size.width - strokeWidth, size.height - strokeWidth),
      Radius.circular(borderRadius),
    );

    final path = Path()..addRRect(rRect);
    final metrics = path.computeMetrics().first;
    double distance = 0;
    while (distance < metrics.length) {
      final end = (distance + dashLength).clamp(0.0, metrics.length);
      canvas.drawPath(metrics.extractPath(distance, end), paint);
      distance += dashLength + gapLength;
    }
  }

  @override
  bool shouldRepaint(_DashedBorderPainter old) =>
      old.color != color || old.strokeWidth != strokeWidth;
}

// ─── Today's classes horizontal scroll ───────────────────────────────────────

class _TodaysClassesRow extends StatelessWidget {
  final List<Session> sessions;
  final bool isLoading;
  final Color primary;
  final void Function(Session, List<Session>)? onTap;

  const _TodaysClassesRow({
    required this.sessions,
    required this.isLoading,
    required this.primary,
    this.onTap,
  });

  List<Session> _todaysSessions() {
    final now = DateTime.now();
    return sessions.where((s) {
      final d = s.scheduledAt;
      return d.year == now.year &&
          d.month == now.month &&
          d.day == now.day;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return SizedBox(
        height: 170,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: 3,
          separatorBuilder: (_, __) => const SizedBox(width: 12),
          itemBuilder: (_, __) => const ShimmerLoader(
            width: 130,
            height: 170,
          ),
        ),
      );
    }

    final today = _todaysSessions();
    if (today.isEmpty) {
      return _NoClassesToday();
    }

    return SizedBox(
      height: 170,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        itemCount: today.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (context, i) => _ClassCard(
              session: today[i],
              primary: primary,
              onTap: onTap != null ? () => onTap!(today[i], today) : null,
            ),
      ),
    );
  }
}

class _ClassCard extends StatelessWidget {
  final Session session;
  final Color primary;
  final VoidCallback? onTap;

  const _ClassCard({
    required this.session,
    required this.primary,
    this.onTap,
  });

  Color _cardColor() {
    if (session.classColor != null && session.classColor!.isNotEmpty) {
      try {
        final clean = session.classColor!.replaceFirst('#', '');
        return Color(int.parse('FF$clean', radix: 16));
      } catch (_) {}
    }
    return const Color(0xFF1B4332); // default dark green
  }

  @override
  Widget build(BuildContext context) {
    final cardColor = _cardColor();
    final available = session.capacity != null && session.bookedCount != null
        ? session.capacity! - session.bookedCount!
        : null;
    final time = DateFormat('h:mm a').format(session.scheduledAt);
    final duration = session.durationMinutes != null
        ? '${session.durationMinutes} min'
        : null;

    final hasImage = session.imageUrl != null && session.imageUrl!.isNotEmpty;

    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
      width: 130,
      height: 170,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Background: image or solid color
            Container(
              decoration: BoxDecoration(
                color: cardColor,
                image: hasImage
                    ? DecorationImage(
                        image: NetworkImage(session.imageUrl!),
                        fit: BoxFit.cover,
                      )
                    : null,
              ),
            ),

            // Bottom gradient for text legibility
            if (hasImage)
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    stops: const [0.0, 0.4, 1.0],
                    colors: [
                      Colors.black.withValues(alpha: 0.55),
                      Colors.transparent,
                      Colors.black.withValues(alpha: 0.82),
                    ],
                  ),
                ),
              ),

            // Content
            Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _SpotsBadge(available: available),
                  const Spacer(),
                  Text(
                    session.className ?? 'Class',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      height: 1.2,
                      shadows: [
                        Shadow(color: Colors.black54, blurRadius: 4),
                      ],
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    duration != null ? '$time · $duration' : time,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  if (session.instructor != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      'Coach ${session.instructor}',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.85),
                        fontSize: 11,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
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

class _SpotsBadge extends StatelessWidget {
  final int? available;
  const _SpotsBadge({this.available});

  @override
  Widget build(BuildContext context) {
    if (available == null) {
      return _badge('Open', Colors.black.withValues(alpha: 0.55), Colors.white);
    }
    if (available! <= 0) {
      return _badge('Full', const Color(0xFFB91C1C), Colors.white);
    }
    if (available! <= 3) {
      return _badge('$available spots left', const Color(0xFFC2410C), Colors.white);
    }
    return _badge('$available spots left', const Color(0xFF15803D), Colors.white);
  }

  Widget _badge(String text, Color bg, Color fg) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.white.withValues(alpha: 0.2), width: 0.5),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: fg,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
          shadows: const [Shadow(color: Colors.black38, blurRadius: 2)],
        ),
      ),
    );
  }
}

class _NoClassesToday extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest
            .withValues(alpha: 0.4),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(Icons.event_available_outlined,
              color:
                  theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.5)),
          const SizedBox(width: 12),
          Text(
            'No classes scheduled today',
            style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

// ─── Your activity row ───────────────────────────────────────────────────────

class _ProgressGrid extends StatelessWidget {
  final MemberProvider memberProvider;
  final Color primary;

  const _ProgressGrid(
      {required this.memberProvider, required this.primary});

  @override
  Widget build(BuildContext context) {
    final capacity = memberProvider.capacity;
    final showCapacity = capacity?.isEnabled == true;

    final visitsCard = _ProgressCard(
      value: '${memberProvider.monthlyCheckIns}',
      label: 'This month',
      headerLabel: 'MONTHLY VISITS',
      headerIcon: Icons.directions_walk_rounded,
      subtitle: 'This month',
    );

    if (!showCapacity) return visitsCard;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: visitsCard),
          const SizedBox(width: 12),
          Expanded(
            child: _GymCapacityCard(
              capacity: capacity!,
              isLoading: memberProvider.isLoadingCapacity,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProgressCard extends StatelessWidget {
  final String value;
  final String label;
  final String headerLabel;
  final IconData headerIcon;
  final String? subtitle;

  const _ProgressCard({
    required this.value,
    required this.label,
    this.headerLabel = '',
    this.headerIcon = Icons.bar_chart_rounded,
    this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: theme.colorScheme.outline.withValues(alpha: 0.15)),
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
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header row
          Row(
            children: [
              Icon(headerIcon,
                  size: 12, color: theme.colorScheme.onSurfaceVariant),
              const SizedBox(width: 4),
              Text(
                headerLabel.isNotEmpty ? headerLabel : label.toUpperCase(),
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.8,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          // Number + "this month" on the same row
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                value,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: theme.colorScheme.onSurface,
                ),
              ),
              const SizedBox(width: 5),
              Text(
                subtitle ?? label,
                style: TextStyle(
                  fontSize: 11,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Gym Capacity Card ────────────────────────────────────────────────────────

class _GymCapacityCard extends StatelessWidget {
  final GymCapacity capacity;
  final bool isLoading;

  const _GymCapacityCard({required this.capacity, required this.isLoading});

  Color get _dotColor {
    switch (capacity.status) {
      case 'not_busy':
        return const Color(0xFF16A34A);
      case 'moderate':
        return const Color(0xFFF59E0B);
      default:
        return const Color(0xFFDC2626);
    }
  }

  String get _statusLabel {
    switch (capacity.status) {
      case 'not_busy':
        return 'Not crowded';
      case 'moderate':
        return 'Moderately busy';
      default:
        return 'Very busy';
    }
  }


  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: theme.colorScheme.outline.withValues(alpha: 0.15)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: isLoading ? _buildSkeleton(theme) : _buildContent(theme),
    );
  }

  Widget _buildSkeleton(ThemeData theme) {
    final base = theme.colorScheme.onSurface.withValues(alpha: 0.08);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(height: 10, width: 80, decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(5))),
        const SizedBox(height: 10),
        Container(height: 14, width: double.infinity, decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(5))),
        const SizedBox(height: 6),
        Container(height: 10, width: 70, decoration: BoxDecoration(color: base, borderRadius: BorderRadius.circular(5))),
      ],
    );
  }

  Widget _buildContent(ThemeData theme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Icon(Icons.people_outline,
                size: 12, color: theme.colorScheme.onSurfaceVariant),
            const SizedBox(width: 4),
            Text(
              'GYM CAPACITY',
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: _dotColor,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 5),
            Expanded(
              child: Text(
                _statusLabel,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: theme.colorScheme.onSurface,
                ),
                maxLines: 2,
              ),
            ),
            const SizedBox(width: 4),
            Text(
              '${capacity.percentage}%',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: _dotColor,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

// ─── Quick access 2×3 grid ────────────────────────────────────────────────────

/// Horizontal Quick-Access carousel matching the warm design system.
///
/// Six tiles arranged in a horizontal scroll; each tile is a small white
/// card with a tinted 44×44 icon container and a label. Tints rotate
/// peach → orange → ink → green so consecutive tiles feel distinct
/// without going rainbow.
class _QuickAccessGrid extends StatelessWidget {
  const _QuickAccessGrid();

  @override
  Widget build(BuildContext context) {
    final items = <_QuickItem>[
      _QuickItem(
        icon: Icons.calendar_month_outlined,
        label: 'Classes',
        tint: _QATint.peach,
        onTap: () => context.push('/schedule'),
      ),
      _QuickItem(
        icon: Icons.person_outline_rounded,
        label: 'Trainers',
        tint: _QATint.orange,
        onTap: () => context.push('/explore/trainers'),
      ),
      _QuickItem(
        icon: Icons.bookmark_border_rounded,
        label: 'Bookings',
        tint: _QATint.ink,
        onTap: () => context.push('/my-bookings'),
      ),
      _QuickItem(
        icon: Icons.receipt_long_outlined,
        label: 'Payments',
        tint: _QATint.green,
        onTap: () => context.push('/billing'),
      ),
      _QuickItem(
        icon: Icons.qr_code_scanner_rounded,
        label: 'Attendance',
        tint: _QATint.peach,
        onTap: () => context.push('/checkin'),
      ),
      _QuickItem(
        icon: Icons.local_offer_outlined,
        label: 'Offers',
        tint: _QATint.orange,
        onTap: () => context.push('/explore/offers'),
      ),
    ];

    return SizedBox(
      height: 96,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        itemCount: items.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (_, i) => _QuickAccessTile(item: items[i]),
      ),
    );
  }
}

enum _QATint { peach, orange, ink, green }

class _QuickItem {
  final IconData icon;
  final String label;
  final _QATint tint;
  final VoidCallback onTap;

  _QuickItem({
    required this.icon,
    required this.label,
    required this.tint,
    required this.onTap,
  });
}

class _QuickAccessTile extends StatelessWidget {
  final _QuickItem item;
  const _QuickAccessTile({required this.item});

  static const _kInk     = Color(0xFF1F1A14);
  static const _kPeach   = Color(0xFFF4DCC1);
  static const _kPrimary = Color(0xFFE07A3B);
  static const _kSuccess = Color(0xFF3F8B5C);

  ({Color bg, Color fg}) _tintColors() {
    switch (item.tint) {
      case _QATint.peach:  return (bg: _kPeach,                                       fg: _kInk);
      case _QATint.orange: return (bg: _kPrimary.withValues(alpha: 0.14),             fg: _kPrimary);
      case _QATint.ink:    return (bg: _kInk.withValues(alpha: 0.08),                 fg: _kInk);
      case _QATint.green:  return (bg: _kSuccess.withValues(alpha: 0.14),             fg: _kSuccess);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = _tintColors();
    return GestureDetector(
      onTap: item.onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 86,
        padding: const EdgeInsets.fromLTRB(8, 12, 8, 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0A1F1A14),
              blurRadius: 4,
              offset: Offset(0, 1),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(
                color: t.bg,
                borderRadius: BorderRadius.circular(14),
              ),
              alignment: Alignment.center,
              child: Icon(item.icon, color: t.fg, size: 22),
            ),
            Text(
              item.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: _kInk,
                letterSpacing: -0.1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Locations carousel ───────────────────────────────────────────────────────

class _LocationsCarousel extends StatelessWidget {
  final List<BranchModel> branches;

  const _LocationsCarousel({required this.branches});

  // Fallback gradients when no image is set.
  static const _gradients = [
    [Color(0xFF1B2A4A), Color(0xFF0D1B2E)],
    [Color(0xFF1B3A2A), Color(0xFF0D2018)],
    [Color(0xFF3A1B2A), Color(0xFF200D18)],
    [Color(0xFF2A1B3A), Color(0xFF180D20)],
    [Color(0xFF3A2A1B), Color(0xFF20180D)],
  ];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 200,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        itemCount: branches.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (context, i) => _LocationCard(
          branch: branches[i],
          fallbackGradient: _gradients[i % _gradients.length],
        ),
      ),
    );
  }
}

class _LocationCard extends StatelessWidget {
  final BranchModel branch;
  final List<Color> fallbackGradient;

  const _LocationCard({
    required this.branch,
    required this.fallbackGradient,
  });

  Future<void> _openMaps() async {
    final url = branch.mapsUrl;
    if (url == null || url.isEmpty) return;
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasImage = branch.imageUrl != null && branch.imageUrl!.isNotEmpty;
    final hasMaps = branch.mapsUrl != null && branch.mapsUrl!.isNotEmpty;

    return GestureDetector(
      onTap: hasMaps ? _openMaps : null,
      child: SizedBox(
        width: 240,
        height: 200,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Stack(
            fit: StackFit.expand,
            children: [
              // Background: image or gradient
              if (hasImage)
                CachedNetworkImage(
                  imageUrl: branch.imageUrl!,
                  fit: BoxFit.cover,
                  placeholder: (_, __) => _gradientBox(fallbackGradient),
                  errorWidget: (_, __, ___) => _gradientBox(fallbackGradient),
                )
              else
                _gradientBox(fallbackGradient),

              // Bottom gradient overlay for text legibility
              Align(
                alignment: Alignment.bottomCenter,
                child: Container(
                  height: 130,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.transparent,
                        Colors.black.withValues(alpha: 0.75),
                      ],
                    ),
                  ),
                ),
              ),

              // Content
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Maps icon (top-right) when maps URL is set
                    if (hasMaps)
                      Align(
                        alignment: Alignment.topRight,
                        child: Container(
                          width: 30,
                          height: 30,
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.35),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.map_outlined,
                            color: Colors.white,
                            size: 15,
                          ),
                        ),
                      ),

                    const Spacer(),

                    // Branch name
                    Text(
                      branch.name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        height: 1.2,
                        shadows: [
                          Shadow(color: Colors.black54, blurRadius: 6),
                        ],
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),

                    if (branch.address != null &&
                        branch.address!.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              branch.address!,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.75),
                                fontSize: 12,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            width: 26,
                            height: 26,
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.15),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.arrow_forward_ios_rounded,
                              color: Colors.white,
                              size: 11,
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
        ),
      ),
    );
  }

  Widget _gradientBox(List<Color> colors) {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: colors,
        ),
      ),
    );
  }
}

// ─── Refresh indicator logo mark ─────────────────────────────────────────────
// Shown inside the pull-to-refresh circle instead of the generic sync icon.

class _RefreshLogoMark extends StatelessWidget {
  final Gym? gym;
  const _RefreshLogoMark({required this.gym});

  static const _bg = Color(0xFF1D1D1B);
  static const _size = 24.0;

  String get _initial {
    final name = gym?.name ?? '';
    return name.isNotEmpty ? name[0].toUpperCase() : '?';
  }

  @override
  Widget build(BuildContext context) {
    final logoUrl = gym?.logoUrl;
    final hasLogo = logoUrl != null && logoUrl.isNotEmpty;

    return Container(
      width: _size,
      height: _size,
      decoration: BoxDecoration(
        color: hasLogo ? Colors.transparent : _bg,
        borderRadius: BorderRadius.circular(6),
      ),
      clipBehavior: Clip.antiAlias,
      child: hasLogo
          ? CachedNetworkImage(
              imageUrl: logoUrl,
              width: _size,
              height: _size,
              fit: BoxFit.contain,
              placeholder: (_, __) => _buildInitial(),
              errorWidget: (_, __, ___) => _buildInitial(),
            )
          : _buildInitial(),
    );
  }

  Widget _buildInitial() {
    return Center(
      child: Text(
        _initial,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.w700,
          height: 1,
        ),
      ),
    );
  }
}

// ─── Time-based greeting helper ───────────────────────────────────────────────

/// Returns a contextual greeting + matching time-of-day emoji as separate
/// strings, so the app bar can render them in distinct Text widgets and
/// avoid the iOS emoji-cascade tofu issue.
///
/// Slots:
///   Morning   05:00 – 11:59 → "Good morning, <name>" + ☀️
///   Afternoon 12:00 – 16:59 → "Good afternoon, <name>" + 🌤️
///   Evening   17:00 – 04:59 → "Good evening, <name>" + 🌙
({String text, String emoji}) _timeGreeting(String? firstName) {
  final hour = DateTime.now().hour;

  final String salutation;
  final String emoji;

  if (hour >= 5 && hour < 12) {
    salutation = 'Good morning';
    emoji = '☀️';
  } else if (hour >= 12 && hour < 17) {
    salutation = 'Good afternoon';
    emoji = '🌤️';
  } else {
    salutation = 'Good evening';
    emoji = '🌙';
  }

  final text = (firstName != null && firstName.isNotEmpty)
      ? '$salutation, $firstName'
      : salutation;
  return (text: text, emoji: emoji);
}

