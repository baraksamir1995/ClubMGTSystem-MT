import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import '../models/session_model.dart';
import '../models/trainer_profile_model.dart';
import '../providers/auth_provider.dart';
import '../screens/trainer_detail_screen.dart';
import '../services/api_service.dart';
import '../utils/theme.dart';
import '../widgets/rating_sheet.dart';
import '../widgets/session_detail_skeleton.dart';
import '../utils/error_utils.dart';
class SessionDetailScreen extends StatefulWidget {
  final Session session;
  final Future<void> Function()? onBook;
  final Future<void> Function()? onCancel;
  /// Other sessions on the same day (for "Other classes today")
  final List<Session> otherSessions;

  const SessionDetailScreen({
    super.key,
    required this.session,
    this.onBook,
    this.onCancel,
    this.otherSessions = const [],
  });

  @override
  State<SessionDetailScreen> createState() => _SessionDetailScreenState();
}

class _SessionDetailScreenState extends State<SessionDetailScreen> {
  bool _isLoading = false;
  bool _isInitializing = true;
  late bool _hasRated;

  @override
  void initState() {
    super.initState();
    _hasRated = widget.session.hasRated;
    Future.delayed(const Duration(milliseconds: 600), () {
      if (mounted) setState(() => _isInitializing = false);
    });
  }

  // [origin] is the share button's screen Rect — required by iOS to anchor
  // the share popover. Passed up from _Hero via the onShare callback.
  void _shareSession(Rect origin) {
    final session = widget.session;
    final gym = context.read<AuthProvider>().gym;

    final className = session.className ?? 'a class';
    final timeStr = DateFormat('h:mm a').format(session.scheduledAt);
    final dateStr = DateFormat('EEE, MMM d').format(session.scheduledAt);
    final coachPart =
        session.instructor != null ? ' with ${session.instructor}' : '';
    final location =
        session.location?.isNotEmpty == true ? session.location! : gym?.name;

    // Use an https URL so WhatsApp / iMessage auto-link it. The marketing
    // site can later 302/meta-refresh into gymapp://session/<id> for users
    // who have the app installed and offer an App Store fallback for those
    // who don't.
    final shareLink = 'https://www.clbyapp.com/session/${session.id}';

    final buffer = StringBuffer();
    buffer.write('Join me for $className$coachPart at $timeStr on $dateStr 💪');
    if (location != null) buffer.write('\n📍 $location');
    buffer.write('\nBook here: $shareLink');

    Share.share(
      buffer.toString(),
      subject: 'Join me for $className on $dateStr',
      sharePositionOrigin: origin,
    );
  }

  Future<void> _openRatingSheet() async {
    final rated = await showRatingSheet(context, widget.session);
    if (mounted && rated == true) {
      setState(() => _hasRated = true);
    }
  }

  Future<void> _handleBook() async {
    final endTime = widget.session.endTime;
    final spotsLeft = widget.session.capacity != null
        ? widget.session.capacity! - (widget.session.bookedCount ?? 0)
        : null;
    final accentColor = _accentColor();

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _BookingConfirmSheet(
        session: widget.session,
        accentColor: accentColor,
        endTime: endTime,
        spotsLeft: spotsLeft,
      ),
    );

    if (confirmed != true || !mounted) return;

    setState(() => _isLoading = true);
    try {
      await widget.onBook?.call();
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_friendlyError(friendlyError(e))),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _friendlyError(String raw) {
    if (raw.contains('23505') || raw.contains('duplicate key')) {
      return 'You\'ve already booked this session.';
    }
    if (raw.contains('spots') || raw.contains('capacity')) {
      return 'Sorry, this class is now full.';
    }
    return 'Failed to book. Please try again.';
  }

  Future<void> _handleCancel() async {
    setState(() => _isLoading = true);
    try {
      await widget.onCancel?.call();
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to cancel: ${friendlyError(e)}'),
            behavior: SnackBarBehavior.floating,
            backgroundColor: Theme.of(context).colorScheme.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Color _accentColor() {
    if (widget.session.classColor != null &&
        widget.session.classColor!.isNotEmpty) {
      try {
        return AppTheme.colorFromHex(widget.session.classColor!);
      } catch (_) {}
    }
    return AppTheme.defaultPrimary;
  }

  @override
  Widget build(BuildContext context) {
    if (_isInitializing) return const SessionDetailSkeleton();

    final session = widget.session;
    final accentColor = _accentColor();
    final endTime = session.endTime;
    final capacity = session.capacity;
    final booked = session.bookedCount ?? 0;
    final spotsLeft = capacity != null ? capacity - booked : null;
    final isFull = spotsLeft != null && spotsLeft <= 0;
    final isCancelled = session.status == 'cancelled';
    final isAttended = session.bookingStatus == 'attended';
    final isBooked = session.isBooked;
    final now = DateTime.now();
    final isOngoing = session.scheduledAt.isBefore(now) &&
        (endTime == null || endTime.isAfter(now));
    final isFinished = endTime != null && endTime.isBefore(now) && !isAttended;

    // Other classes today (exclude current session)
    final others = widget.otherSessions
        .where((s) => s.id != session.id)
        .toList();

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFFF5F5F0),
        body: Stack(
          children: [
            CustomScrollView(
              slivers: [
                // ── Hero ──────────────────────────────────────
                SliverToBoxAdapter(
                  child: _Hero(
                    session: session,
                    accentColor: accentColor,
                    endTime: endTime,
                    isFull: isFull,
                    isBooked: isBooked,
                    isAttended: isAttended,
                    isOngoing: isOngoing,
                    isFinished: isFinished,
                    isCancelled: isCancelled,
                    onShare: (rect) => _shareSession(rect),
                  ),
                ),

                // ── Body ──────────────────────────────────────
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // 2×2 Info grid
                        _InfoGrid(
                            session: session, endTime: endTime),
                        const SizedBox(height: 12),

                        // Coach card
                        if (session.instructor != null)
                          _CoachCard(
                            instructor: session.instructor!,
                            accentColor: accentColor,
                          ),
                        if (session.instructor != null)
                          const SizedBox(height: 12),

                        // Capacity card
                        if (capacity != null)
                          _CapacityCard(
                            capacity: capacity,
                            booked: booked,
                            spotsLeft: spotsLeft,
                          ),
                        if (capacity != null) const SizedBox(height: 20),

                        // About this class
                        if (session.description != null &&
                            session.description!.isNotEmpty) ...[
                          _SectionHeader('ABOUT THIS CLASS'),
                          const SizedBox(height: 10),
                          _AboutCard(description: session.description!),
                          const SizedBox(height: 20),
                        ],

                        // What to expect (class type as single tag)
                        if (session.classType != null) ...[
                          _SectionHeader('WHAT TO EXPECT'),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: _expectTags(session.classType!)
                                .map((tag) => _ExpectChip(label: tag))
                                .toList(),
                          ),
                          const SizedBox(height: 20),
                        ],

                        // Other classes today
                        if (others.isNotEmpty) ...[
                          _SectionHeader('OTHER CLASSES TODAY'),
                          const SizedBox(height: 10),
                          _OtherClassesStrip(sessions: others),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),

            // ── Sticky bottom bar ────────────────────────────
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: _BottomBar(
                session: session,
                isLoading: _isLoading,
                isFull: isFull,
                isAttended: isAttended,
                isBooked: isBooked,
                isOngoing: isOngoing,
                isFinished: isFinished,
                isCancelled: isCancelled,
                hasRated: _hasRated,
                accentColor: accentColor,
                onBook: _handleBook,
                onCancel: _handleCancel,
                onRate: _openRatingSheet,
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<String> _expectTags(String classType) {
    final map = {
      'hiit': [
        'Cardio bursts',
        'Bodyweight moves',
        'Core work',
        'High intensity',
        'No equipment'
      ],
      'yoga': ['Flexibility', 'Breathing', 'Balance', 'Mindfulness'],
      'cycling': ['Cardio', 'Low impact', 'Endurance', 'Music-driven'],
      'boxing': ['Cardio', 'Strength', 'Footwork', 'Bag work'],
      'pilates': ['Core strength', 'Posture', 'Flexibility', 'Low impact'],
    };
    return map[classType.toLowerCase()] ??
        [_capitalize(classType), 'Fitness', 'Fun'];
  }

  String _capitalize(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

class _Hero extends StatelessWidget {
  final Session session;
  final Color accentColor;
  final DateTime? endTime;
  final bool isFull;
  final bool isBooked;
  final bool isAttended;
  final bool isOngoing;
  final bool isFinished;
  final bool isCancelled;
  final void Function(Rect shareOrigin)? onShare;

  const _Hero({
    required this.session,
    required this.accentColor,
    required this.endTime,
    required this.isFull,
    required this.isBooked,
    required this.isAttended,
    required this.isOngoing,
    required this.isFinished,
    required this.isCancelled,
    this.onShare,
  });

  @override
  Widget build(BuildContext context) {
    final timeStr = _formatTime(session.scheduledAt, endTime);

    // Status label + dot color
    String statusLabel;
    Color statusDot;
    if (isCancelled) {
      statusLabel = 'Cancelled';
      statusDot = const Color(0xFFF87171);
    } else if (isAttended) {
      statusLabel = 'Attended';
      statusDot = const Color(0xFF4ADE80);
    } else if (isFinished) {
      statusLabel = 'Finished';
      statusDot = Colors.white54;
    } else if (isOngoing) {
      statusLabel = 'Ongoing';
      statusDot = const Color(0xFFFB923C);
    } else if (isBooked) {
      statusLabel = 'Booked';
      statusDot = const Color(0xFF4ADE80);
    } else if (isFull) {
      statusLabel = 'Full';
      statusDot = const Color(0xFFF87171);
    } else {
      statusLabel = 'Open';
      statusDot = const Color(0xFF4ADE80);
    }

    // Hero gradient per state
    final List<Color> gradientColors;
    if (isCancelled) {
      gradientColors = [const Color(0xFF1A0000), const Color(0xFF2D0808)];
    } else if (isFinished) {
      gradientColors = [const Color(0xFF0A0A0A), const Color(0xFF1A1A1A)];
    } else if (isOngoing) {
      gradientColors = [const Color(0xFF1A0E00), const Color(0xFF3D2200)];
    } else if (isFull && !isBooked) {
      gradientColors = [const Color(0xFF1A0000), const Color(0xFF3D0000)];
    } else {
      // open / booked / attended — dark green
      gradientColors = [const Color(0xFF0D2B1F), const Color(0xFF1A4A2E)];
    }

    return SizedBox(
      height: 260,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // ── Background: image if available, else gradient ──
          if (session.imageUrl != null && session.imageUrl!.isNotEmpty)
            CachedNetworkImage(
              imageUrl: session.imageUrl!,
              fit: BoxFit.cover,
              width: double.infinity,
              height: double.infinity,
              errorWidget: (context, url, error) => Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: gradientColors,
                  ),
                ),
              ),
              placeholder: (context, url) => Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: gradientColors,
                  ),
                ),
              ),
            )
          else
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: gradientColors,
                ),
              ),
            ),

          // ── Dark overlay so text stays readable ──
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withValues(alpha: 0.35),
                  Colors.black.withValues(alpha: 0.70),
                ],
              ),
            ),
          ),

          // ── Content ──
          SafeArea(
            bottom: false,
            child: Stack(
              children: [
                // Back + share buttons
                Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _CircleButton(
                    icon: Icons.arrow_back_ios_new_rounded,
                    onTap: () => Navigator.of(context).pop(),
                  ),
                  Builder(
                    builder: (btnCtx) => _CircleButton(
                      icon: Icons.ios_share_outlined,
                      onTap: () {
                        final box = btnCtx.findRenderObject() as RenderBox?;
                        final offset =
                            box?.localToGlobal(Offset.zero) ?? Offset.zero;
                        final size = box?.size ?? const Size(44, 44);
                        onShare?.call(
                          Rect.fromLTWH(
                              offset.dx, offset.dy, size.width, size.height),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),

            // Bottom content
            Positioned(
              left: 20,
              right: 20,
              bottom: 24,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Class type badge
                  if (session.classType != null)
                    Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: accentColor.withValues(alpha: 0.85),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.arrow_upward_rounded,
                              size: 11, color: Colors.white),
                          const SizedBox(width: 4),
                          Text(
                            session.classType!.toUpperCase(),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),

                  // Class name
                  Text(
                    session.className ?? 'Class',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      height: 1.1,
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Status + time
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: statusDot,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 5),
                            Text(
                              statusLabel,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      Text(
                        timeStr,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.85),
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),    // SafeArea
        ],
      ),    // outer Stack
    );
  }

  String _formatTime(DateTime start, DateTime? end) {
    final s = DateFormat('h:mm a').format(start);
    if (end == null) return s;
    return '$s – ${DateFormat('h:mm a').format(end)}';
  }
}

class _CircleButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _CircleButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.18),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, size: 17, color: Colors.white),
      ),
    );
  }
}

// ─── 2×2 Info grid ────────────────────────────────────────────────────────────

class _InfoGrid extends StatelessWidget {
  final Session session;
  final DateTime? endTime;

  const _InfoGrid({required this.session, required this.endTime});

  @override
  Widget build(BuildContext context) {
    final timeStr = _formatTime(session.scheduledAt, endTime);
    final dateStr = DateFormat('EEE, MMM d').format(session.scheduledAt);
    final duration = session.durationMinutes != null
        ? '${session.durationMinutes} minutes'
        : endTime != null
            ? '${endTime!.difference(session.scheduledAt).inMinutes} minutes'
            : null;

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _InfoCard(
                iconBg: Theme.of(context).colorScheme.primary.withValues(alpha: 0.12),
                iconColor: Theme.of(context).colorScheme.primary,
                icon: Icons.access_time_rounded,
                label: 'Time',
                value: timeStr,
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _InfoCard(
                iconBg: const Color(0xFFCCFBF1),
                iconColor: const Color(0xFF0D9488),
                icon: Icons.calendar_today_outlined,
                label: 'Date',
                value: dateStr,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: _InfoCard(
                iconBg: const Color(0xFFFFEDD5),
                iconColor: const Color(0xFFEA580C),
                icon: Icons.timer_outlined,
                label: 'Duration',
                value: duration ?? '–',
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _InfoCard(
                iconBg: const Color(0xFFFFE4E6),
                iconColor: const Color(0xFFE11D48),
                icon: Icons.location_on_outlined,
                label: 'Location',
                value: session.location ?? '–',
              ),
            ),
          ],
        ),
      ],
    );
  }

  String _formatTime(DateTime start, DateTime? end) {
    final s = DateFormat('h:mm a').format(start);
    if (end == null) return s;
    return '$s – ${DateFormat('h:mm a').format(end)}';
  }
}

class _InfoCard extends StatelessWidget {
  final Color iconBg;
  final Color iconColor;
  final IconData icon;
  final String label;
  final String value;

  const _InfoCard({
    required this.iconBg,
    required this.iconColor,
    required this.icon,
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: theme.colorScheme.outline.withValues(alpha: 0.1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: iconBg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: iconColor),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: theme.textTheme.labelSmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w700,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

// ─── Coach card ───────────────────────────────────────────────────────────────

class _CoachCard extends StatefulWidget {
  final String instructor;
  final Color accentColor;

  const _CoachCard({required this.instructor, required this.accentColor});

  @override
  State<_CoachCard> createState() => _CoachCardState();
}

class _CoachCardState extends State<_CoachCard> {
  Map<String, dynamic>? _trainerData;

  @override
  void initState() {
    super.initState();
    _loadTrainerData();
  }

  Future<void> _loadTrainerData() async {
    final gymId =
        context.read<AuthProvider>().profile?.gymId;
    if (gymId == null) return;
    final data = await ApiService()
        .getTrainerProfile(widget.instructor, gymId);
    if (mounted) setState(() => _trainerData = data);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final instructor = widget.instructor;
    final accentColor = widget.accentColor;

    final initials = instructor
        .trim()
        .split(' ')
        .take(2)
        .map((w) => w.isNotEmpty ? w[0].toUpperCase() : '')
        .join();

    final photoUrl = _trainerData?['photo_url'] as String?;
    final specialisations = _trainerData?['specialisations'];
    final String specialty = (specialisations is List && specialisations.isNotEmpty)
        ? specialisations.first.toString()
        : 'Fitness Specialist';
    final double? avgRating = (_trainerData?['avg_rating'] as num?)?.toDouble();

    void navigateToTrainer() {
      if (_trainerData == null) return;
      final trainer = TrainerProfile.fromJson({
        'id': _trainerData!['id'] ?? '',
        'name': instructor,
        'photo_url': _trainerData!['photo_url'],
        'trainer_type': _trainerData!['trainer_type'],
        'specialisations': _trainerData!['specialisations'] ?? [],
        'avg_rating': _trainerData!['avg_rating'],
        'is_active': true,
      });
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => TrainerDetailScreen(trainer: trainer),
        ),
      );
    }

    return GestureDetector(
      onTap: _trainerData != null ? navigateToTrainer : null,
      child: Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: theme.colorScheme.outline.withValues(alpha: 0.1),
        ),
      ),
      child: Row(
        children: [
          // Avatar — photo or initials
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            clipBehavior: Clip.antiAlias,
            child: photoUrl != null
                ? Image.network(
                    photoUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Center(
                      child: Text(
                        initials,
                        style: TextStyle(
                          color: accentColor,
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                        ),
                      ),
                    ),
                  )
                : Center(
                    child: Text(
                      initials,
                      style: TextStyle(
                        color: accentColor,
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                  ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Coach $instructor',
                  style: theme.textTheme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  specialty,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                if (avgRating != null) ...[
                  const SizedBox(height: 6),
                  _RatingRow(avgRating: avgRating, accentColor: accentColor),
                ],
              ],
            ),
          ),
          Icon(
            Icons.chevron_right_rounded,
            color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.5),
          ),
        ],
      ),
    ),   // Container
    );   // GestureDetector
  }
}

class _RatingRow extends StatelessWidget {
  final double avgRating;
  final Color accentColor;

  const _RatingRow({required this.avgRating, required this.accentColor});

  @override
  Widget build(BuildContext context) {
    final filled = avgRating.round().clamp(0, 5);
    return Row(
      children: [
        ...List.generate(
          5,
          (i) => Icon(
            i < filled ? Icons.star_rounded : Icons.star_outline_rounded,
            size: 13,
            color: i < filled ? const Color(0xFFFBBF24) : Colors.grey.shade400,
          ),
        ),
        const SizedBox(width: 4),
        Text(
          avgRating.toStringAsFixed(1),
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w600,
              ),
        ),
      ],
    );
  }
}

// ─── Capacity card ────────────────────────────────────────────────────────────

class _CapacityCard extends StatelessWidget {
  final int capacity;
  final int booked;
  final int? spotsLeft;

  const _CapacityCard({
    required this.capacity,
    required this.booked,
    required this.spotsLeft,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final fraction =
        capacity > 0 ? (booked / capacity).clamp(0.0, 1.0) : 0.0;
    final pct = (fraction * 100).round();
    final isFull = spotsLeft != null && spotsLeft! <= 0;
    final barColor = isFull
        ? Colors.red
        : fraction >= 0.8
            ? Colors.orange
            : const Color(0xFF16A34A);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: theme.colorScheme.outline.withValues(alpha: 0.1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Session capacity',
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                '$booked / $capacity',
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: fraction,
              minHeight: 8,
              backgroundColor: barColor.withValues(alpha: 0.12),
              valueColor: AlwaysStoppedAnimation<Color>(barColor),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '$pct% booked',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              if (spotsLeft != null && spotsLeft! > 0)
                Text(
                  '$spotsLeft spots left',
                  style: const TextStyle(
                    color: Color(0xFF16A34A),
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                )
              else
                const Text(
                  'Class is full',
                  style: TextStyle(
                    color: Colors.red,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

// ─── Section header ───────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String text;
  const _SectionHeader(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context).textTheme.labelSmall?.copyWith(
            color: Theme.of(context).colorScheme.onSurfaceVariant,
            fontWeight: FontWeight.w700,
            letterSpacing: 1.0,
          ),
    );
  }
}

// ─── About card ───────────────────────────────────────────────────────────────

class _AboutCard extends StatelessWidget {
  final String description;
  const _AboutCard({required this.description});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: theme.colorScheme.outline.withValues(alpha: 0.15),
        ),
      ),
      child: Text(
        description,
        style: theme.textTheme.bodyMedium?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
          height: 1.6,
        ),
      ),
    );
  }
}

// ─── Expect chip ──────────────────────────────────────────────────────────────

class _ExpectChip extends StatelessWidget {
  final String label;
  const _ExpectChip({required this.label});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: theme.colorScheme.outline.withValues(alpha: 0.25),
        ),
      ),
      child: Text(
        label,
        style: theme.textTheme.bodySmall?.copyWith(
          fontWeight: FontWeight.w500,
          color: theme.colorScheme.onSurface,
        ),
      ),
    );
  }
}

// ─── Other classes strip ──────────────────────────────────────────────────────

class _OtherClassesStrip extends StatelessWidget {
  final List<Session> sessions;
  const _OtherClassesStrip({required this.sessions});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 96,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: sessions.length,
        separatorBuilder: (context, index) => const SizedBox(width: 10),
        itemBuilder: (context, index) {
          final s = sessions[index];
          Color bg = const Color(0xFF1A4A2E);
          if (s.classColor != null && s.classColor!.isNotEmpty) {
            try {
              bg = AppTheme.colorFromHex(s.classColor!);
            } catch (_) {}
          }
          final hasImage =
              s.imageUrl != null && s.imageUrl!.isNotEmpty;
          return ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              width: 104,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  // Background: image or solid color
                  if (hasImage)
                    Image.network(
                      s.imageUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stack) =>
                          ColoredBox(color: bg),
                    )
                  else
                    ColoredBox(color: bg),

                  // Dark gradient overlay
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.black.withValues(alpha: 0.15),
                          Colors.black.withValues(alpha: 0.65),
                        ],
                      ),
                    ),
                  ),

                  // Text content
                  Padding(
                    padding: const EdgeInsets.all(10),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Text(
                          s.className ?? 'Class',
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 3),
                        Text(
                          DateFormat('h:mm a').format(s.scheduledAt),
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.85),
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}

// ─── Sticky bottom bar ────────────────────────────────────────────────────────

class _BottomBar extends StatelessWidget {
  final Session session;
  final bool isLoading;
  final bool isFull;
  final bool isAttended;
  final bool isBooked;
  final bool isOngoing;
  final bool isFinished;
  final bool isCancelled;
  final bool hasRated;
  final Color accentColor;
  final VoidCallback onBook;
  final VoidCallback onCancel;
  final VoidCallback onRate;

  const _BottomBar({
    required this.session,
    required this.isLoading,
    required this.isFull,
    required this.isAttended,
    required this.isBooked,
    required this.isOngoing,
    required this.isFinished,
    required this.isCancelled,
    required this.hasRated,
    required this.accentColor,
    required this.onBook,
    required this.onCancel,
    required this.onRate,
  });

  static const _green = Color(0xFF16A34A);
  static const _orange = Color(0xFFF97316);
  static const _grey = Color(0xFF9CA3AF);
  static final _outlineStyle = RoundedRectangleBorder(
    borderRadius: BorderRadius.circular(14),
  );

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final startTimeStr =
        DateFormat('h:mm a').format(session.scheduledAt);

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF5F5F0),
        border: Border(
          top: BorderSide(
            color: theme.colorScheme.outline.withValues(alpha: 0.12),
          ),
        ),
      ),
      padding: EdgeInsets.fromLTRB(
          16, 10, 16, MediaQuery.of(context).padding.bottom + 12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── Info row ──────────────────────────────────────────
          _buildInfoRow(theme, startTimeStr),
          const SizedBox(height: 10),

          // ── Action button ─────────────────────────────────────
          _buildButton(theme),

          // ── Sub-link (booked+not attended → cancel, attended+not rated → rate)
          if (!isCancelled && ((isBooked && !isAttended) || (isAttended && !hasRated))) ...[
            const SizedBox(height: 8),
            _buildSubLink(context, theme),
          ],
        ],
      ),
    );
  }

  Widget _buildInfoRow(ThemeData theme, String startTimeStr) {
    final dimStyle = theme.textTheme.bodySmall
        ?.copyWith(color: theme.colorScheme.onSurfaceVariant);

    if (isCancelled) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text('This session has been cancelled', style: dimStyle),
          Row(children: [
            const Icon(Icons.cancel_outlined, size: 14, color: Color(0xFFF87171)),
            const SizedBox(width: 4),
            Text('Cancelled',
                style: dimStyle?.copyWith(
                    color: const Color(0xFFF87171),
                    fontWeight: FontWeight.w700)),
          ]),
        ],
      );
    }
    if (isAttended) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text('Great work — you showed up!', style: dimStyle),
          Row(children: [
            const Icon(Icons.check_circle, size: 14, color: _green),
            const SizedBox(width: 4),
            Text('Session logged',
                style: dimStyle?.copyWith(
                    color: _green, fontWeight: FontWeight.w700)),
          ]),
        ],
      );
    }
    if (isFinished) {
      return Text('This class has ended · not attended', style: dimStyle);
    }
    if (isOngoing) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text('Class started at $startTimeStr', style: dimStyle),
          Row(children: [
            Container(
              width: 8,
              height: 8,
              decoration: const BoxDecoration(
                color: _orange,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 5),
            Text('In progress',
                style: dimStyle?.copyWith(
                    color: _orange, fontWeight: FontWeight.w700)),
          ]),
        ],
      );
    }
    if (isBooked) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text("You're confirmed for this class", style: dimStyle),
          Row(children: [
            const Icon(Icons.check_circle, size: 14, color: _green),
            const SizedBox(width: 4),
            Text('Confirmed',
                style: dimStyle?.copyWith(
                    color: _green, fontWeight: FontWeight.w700)),
          ]),
        ],
      );
    }
    if (isFull) {
      return Text('This class has reached full capacity', style: dimStyle);
    }
    // Open
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text('Uses 1 session from your plan', style: dimStyle),
        Text('Free with plan',
            style: dimStyle?.copyWith(
                color: _green, fontWeight: FontWeight.w700)),
      ],
    );
  }

  Widget _buildButton(ThemeData theme) {
    final baseShape = OutlinedButton.styleFrom(shape: _outlineStyle);

    // CANCELLED — red-tinted outlined, disabled
    if (isCancelled) {
      return SizedBox(
        width: double.infinity,
        height: 52,
        child: OutlinedButton.icon(
          style: baseShape.copyWith(
            side: const WidgetStatePropertyAll(
                BorderSide(color: Color(0xFFF87171))),
            foregroundColor:
                const WidgetStatePropertyAll(Color(0xFFF87171)),
            backgroundColor:
                const WidgetStatePropertyAll(Color(0xFFFFF1F1)),
          ),
          onPressed: null,
          icon: const Icon(Icons.cancel_outlined, size: 18),
          label: const Text('Session cancelled',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        ),
      );
    }

    // ATTENDED — solid dark button
    if (isAttended) {
      return SizedBox(
        width: double.infinity,
        height: 52,
        child: ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF1A1A1A),
            foregroundColor: Colors.white,
            shape: _outlineStyle,
            textStyle: const TextStyle(
                fontSize: 16, fontWeight: FontWeight.w600),
          ),
          onPressed: null,
          child: const Text('Attended'),
        ),
      );
    }

    // FINISHED — grey outlined
    if (isFinished) {
      return SizedBox(
        width: double.infinity,
        height: 52,
        child: OutlinedButton(
          style: baseShape.copyWith(
            side: WidgetStatePropertyAll(
                BorderSide(color: _grey.withValues(alpha: 0.5))),
            foregroundColor: WidgetStatePropertyAll(_grey),
          ),
          onPressed: null,
          child: const Text('Class ended'),
        ),
      );
    }

    // ONGOING — orange outlined
    if (isOngoing) {
      return SizedBox(
        width: double.infinity,
        height: 52,
        child: OutlinedButton.icon(
          style: baseShape.copyWith(
            side: WidgetStatePropertyAll(
                BorderSide(color: _orange.withValues(alpha: 0.5))),
            foregroundColor: WidgetStatePropertyAll(_orange),
          ),
          onPressed: null,
          icon: Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
                color: _orange, shape: BoxShape.circle),
          ),
          label: const Text('Class is ongoing',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        ),
      );
    }

    // BOOKED — outlined, "✓ Booking confirmed"
    if (isBooked) {
      return SizedBox(
        width: double.infinity,
        height: 52,
        child: OutlinedButton.icon(
          style: baseShape.copyWith(
            side: WidgetStatePropertyAll(BorderSide(
                color: theme.colorScheme.outline.withValues(alpha: 0.35))),
            foregroundColor:
                WidgetStatePropertyAll(theme.colorScheme.onSurface),
            backgroundColor: const WidgetStatePropertyAll(Colors.white),
          ),
          onPressed: null,
          icon: const Icon(Icons.check, size: 18, color: _green),
          label: const Text('Booking confirmed',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        ),
      );
    }

    // FULL — grey outlined with X
    if (isFull) {
      return SizedBox(
        width: double.infinity,
        height: 52,
        child: OutlinedButton.icon(
          style: baseShape.copyWith(
            side: WidgetStatePropertyAll(
                BorderSide(color: _grey.withValues(alpha: 0.5))),
            foregroundColor: WidgetStatePropertyAll(_grey),
          ),
          onPressed: null,
          icon: const Icon(Icons.close, size: 16),
          label: const Text('Class is full',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        ),
      );
    }

    // OPEN — book button
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: OutlinedButton(
        style: baseShape.copyWith(
          side: WidgetStatePropertyAll(BorderSide(
              color: theme.colorScheme.outline.withValues(alpha: 0.35))),
          foregroundColor:
              WidgetStatePropertyAll(theme.colorScheme.onSurface),
          backgroundColor: const WidgetStatePropertyAll(Colors.white),
        ),
        onPressed: isLoading ? null : onBook,
        child: isLoading
            ? SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: theme.colorScheme.onSurface),
              )
            : const Text('Book this class',
                style: TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w600)),
      ),
    );
  }

  Widget _buildSubLink(BuildContext context, ThemeData theme) {
    if (isAttended) {
      return GestureDetector(
        onTap: onRate,
        child: Center(
          child: Text('Rate this class',
              style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurface,
                  fontWeight: FontWeight.w500)),
        ),
      );
    }
    if (isBooked) {
      return GestureDetector(
        onTap: isLoading ? null : onCancel,
        child: Center(
          child: isLoading
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.red),
                )
              : Text('Cancel booking',
                  style: theme.textTheme.bodySmall?.copyWith(
                      color: Colors.red, fontWeight: FontWeight.w500)),
        ),
      );
    }
    return const SizedBox.shrink();
  }
}

// ─── Booking confirmation sheet ───────────────────────────────────────────────

class _BookingConfirmSheet extends StatelessWidget {
  final Session session;
  final Color accentColor;
  final DateTime? endTime;
  final int? spotsLeft;

  const _BookingConfirmSheet({
    required this.session,
    required this.accentColor,
    required this.endTime,
    required this.spotsLeft,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final timeStr = _formatTime(session.scheduledAt, endTime);
    final dateStr =
        DateFormat('EEEE, MMMM d, yyyy').format(session.scheduledAt);

    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(
          24, 0, 24, MediaQuery.of(context).padding.bottom + 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 12, bottom: 20),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: theme.colorScheme.outlineVariant,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  const Color(0xFF0D2B1F),
                  const Color(0xFF1A4A2E),
                ],
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Confirm Booking',
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: Colors.white.withValues(alpha: 0.7),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  session.className ?? 'Class',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _SheetRow(
              icon: Icons.calendar_today_outlined,
              label: 'Date',
              value: dateStr,
              accentColor: accentColor),
          const SizedBox(height: 12),
          _SheetRow(
              icon: Icons.access_time_outlined,
              label: 'Time',
              value: timeStr,
              accentColor: accentColor),
          const SizedBox(height: 12),
          _SheetRow(
              icon: Icons.person_outline,
              label: 'Instructor',
              value: session.instructor ?? 'TBD',
              accentColor: accentColor),
          const SizedBox(height: 12),
          _SheetRow(
              icon: Icons.location_on_outlined,
              label: 'Location',
              value: session.location ?? 'TBD',
              accentColor: accentColor),
          if (spotsLeft != null) ...[
            const SizedBox(height: 12),
            _SheetRow(
              icon: Icons.people_outline,
              label: 'Availability',
              value: spotsLeft! <= 0
                  ? 'Full'
                  : '$spotsLeft spot${spotsLeft == 1 ? '' : 's'} left',
              accentColor: spotsLeft! <= 3 ? Colors.red : accentColor,
            ),
          ],
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0D2B1F),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                textStyle: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text('Confirm Booking'),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 44,
            child: TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: Text(
                'Cancel',
                style: TextStyle(
                  color: theme.colorScheme.onSurfaceVariant,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime start, DateTime? end) {
    final s = DateFormat('h:mm a').format(start);
    if (end == null) return s;
    return '$s – ${DateFormat('h:mm a').format(end)}';
  }
}

class _SheetRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color accentColor;

  const _SheetRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.accentColor,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: accentColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 18, color: accentColor),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                  fontWeight: FontWeight.w500,
                ),
              ),
              Text(
                value,
                style: theme.textTheme.bodyMedium
                    ?.copyWith(fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
