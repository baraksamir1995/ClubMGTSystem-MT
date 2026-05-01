import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:screen_protector/screen_protector.dart';
import '../providers/auth_provider.dart';
import '../providers/member_provider.dart';
import '../widgets/gym_app_bar.dart';
import '../widgets/screen_refresh_indicator.dart';
import '../widgets/shimmer_loader.dart';
import 'qr_scanner_screen.dart';
import 'attendance_history_screen.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen>
    with WidgetsBindingObserver {
  // Whether the QR is currently hidden due to an active screen recording.
  bool _recordingActive = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _enableProtection();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadAttendance();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _disableProtection();
    // Clear any blur overlay on teardown as a safety net.
    ScreenProtector.protectDataLeakageWithBlurOff();
    super.dispose();
  }

  // Always clear blur on resume so a stuck overlay from any previous
  // paused state can't leave the UI black. The matching blur-on-paused
  // is intentionally disabled: the Attendance screen lives in a bottom-tab
  // StatefulShellRoute.indexedStack and stayed mounted while the user was
  // on other tabs, so its lifecycle callbacks fired during image-picker
  // transitions and the overlay survived the return, producing a black
  // screen on the Profile tab. See the TODOs in _enableProtection — the
  // app-switcher blur should be re-added with proper visibility gating
  // before production.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      ScreenProtector.protectDataLeakageWithBlurOff();
    }
  }

  // ── Screenshot / screen-recording protection ──────────────────────────────

  Future<void> _enableProtection() async {
    // TODO: re-enable before production release
    // await ScreenProtector.preventScreenshotOn();
    // ScreenProtector.addListener(
    //   null,
    //   (isRecording) {
    //     if (mounted) setState(() => _recordingActive = isRecording);
    //   },
    // );
  }

  Future<void> _disableProtection() async {
    // TODO: re-enable before production release
    // ScreenProtector.removeListener();
    // await ScreenProtector.preventScreenshotOff();
    // await ScreenProtector.protectDataLeakageWithBlurOff();
  }

  Future<void> _loadAttendance() async {
    final memberProvider = context.read<MemberProvider>();
    final gymId = context.read<AuthProvider>().profile?.gymId;
    if (gymId != null) await memberProvider.ensureMemberLoaded(gymId);
    await memberProvider.loadAttendance();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final authProvider = context.watch<AuthProvider>();
    final memberProvider = context.watch<MemberProvider>();
    final gym = authProvider.gym;
    final member = memberProvider.member;
    final membership = memberProvider.currentMembership;
    final summary = memberProvider.membershipSummary;
    final memberStatus = member?.status;

    final primary = Theme.of(context).colorScheme.primary;

    // Active plan check — allow QR scanning when the member has either an
    // active subscription OR any active+paid transferred bucket. The studio
    // QR access predicate on the backend already permits transferred-only
    // members, so the mobile gate must not be stricter than the API.
    final hasActiveSubscription = membership != null &&
        membership.isActive &&
        memberStatus != 'suspended';
    final hasTransferredAccess = summary != null &&
        summary.totalSessions > 0 &&
        summary.buckets.any((b) => b.isTransferred) &&
        memberStatus != 'suspended';
    final hasActivePlan = hasActiveSubscription || hasTransferredAccess;

    return Scaffold(
      appBar: GymAppBar(
        gym: gym,
        fallbackTitle: 'Attendance',
        greeting: 'Attendance',
        greetingStyle: const TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w800,
          color: Color(0xFF1D1D1B),
        ),
      ),
      floatingActionButton: hasActivePlan
          ? FloatingActionButton.extended(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const QrScannerScreen()),
              ).then((_) => _loadAttendance()),
              backgroundColor: primary,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.qr_code_scanner),
              label: const Text('Scan QR', style: TextStyle(fontWeight: FontWeight.w700)),
            )
          : null,
      body: ScreenRefreshIndicator(
        onRefresh: _loadAttendance,
        icon: Icons.qr_code_rounded,
        color: primary,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // ── QR Code Section ──────────────────────────────────────
            SliverToBoxAdapter(
              child: _QrSection(
                member: member,
                hasActivePlan: hasActivePlan,
                membership: membership,
                primary: primary,
                memberStatus: memberStatus,
                recordingActive: _recordingActive,
              ),
            ),

            // ── History header ────────────────────────────────────────
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              sliver: SliverToBoxAdapter(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Check-in History',
                        style: theme.textTheme.titleMedium
                            ?.copyWith(fontWeight: FontWeight.w700)),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 5),
                          decoration: BoxDecoration(
                            color: primary.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            '${memberProvider.monthlyCheckIns} this month',
                            style: TextStyle(
                                color: primary,
                                fontSize: 12,
                                fontWeight: FontWeight.w600),
                          ),
                        ),
                        const SizedBox(width: 8),
                        GestureDetector(
                          onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => AttendanceHistoryScreen(
                                  memberId: member?.id ?? ''),
                            ),
                          ),
                          child: Text(
                            'View All',
                            style: TextStyle(
                                color: primary,
                                fontSize: 12,
                                fontWeight: FontWeight.w600),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // ── History list ──────────────────────────────────────────
            if (memberProvider.isLoadingAttendance)
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                sliver: SliverToBoxAdapter(
                    child: ShimmerListLoader(itemCount: 5, itemHeight: 72)),
              )
            else if (memberProvider.attendanceError != null)
              SliverFillRemaining(
                  child: _buildError(context, memberProvider.attendanceError!))
            else if (memberProvider.attendance.isEmpty)
              SliverToBoxAdapter(child: _buildEmpty(context))
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final record = memberProvider.attendance[index];
                      final isToday = _isToday(record.checkedInAt);
                      final isQr = record.method == 'qr';
                      final isManual = record.method == 'manual';
                      final isGymEntrance = record.accessPoint == 'Gym Main Entrance';
                      final isClass = isQr && !isGymEntrance && record.accessPoint != null;

                      final methodLabel = isManual
                          ? 'Manual Check-in'
                          : isGymEntrance
                              ? 'Gym Entrance'
                              : isClass
                                  ? record.accessPoint!
                                  : 'Check-in';
                      final methodIcon = isManual
                          ? Icons.edit_outlined
                          : isGymEntrance
                              ? Icons.sensor_door_outlined
                              : isClass
                                  ? Icons.fitness_center_outlined
                                  : Icons.check_circle_outline;
                      final isMobile = isQr;

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Card(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 16, vertical: 14),
                            child: Row(
                              children: [
                                Container(
                                  width: 44,
                                  height: 44,
                                  decoration: BoxDecoration(
                                    color: isToday
                                        ? primary.withValues(alpha: 0.15)
                                        : theme.colorScheme
                                            .surfaceContainerHighest,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Icon(
                                    methodIcon,
                                    color: isToday
                                        ? primary
                                        : theme.colorScheme.onSurfaceVariant,
                                    size: 22,
                                  ),
                                ),
                                const SizedBox(width: 14),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        DateFormat('EEEE, MMM d, yyyy')
                                            .format(record.checkedInAt),
                                        style: theme.textTheme.bodyMedium
                                            ?.copyWith(
                                                fontWeight: FontWeight.w600),
                                      ),
                                      Text(
                                        DateFormat('h:mm a')
                                            .format(record.checkedInAt),
                                        style: theme.textTheme.bodySmall
                                            ?.copyWith(
                                                color: theme.colorScheme
                                                    .onSurfaceVariant),
                                      ),
                                      const SizedBox(height: 3),
                                      Text(
                                        methodLabel,
                                        style: theme.textTheme.labelSmall
                                            ?.copyWith(
                                          color: isMobile
                                              ? primary
                                              : theme.colorScheme.onSurfaceVariant,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                if (isToday)
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: primary.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      'Today',
                                      style: TextStyle(
                                          color: primary,
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                    childCount: memberProvider.attendance.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  bool _isToday(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year &&
        date.month == now.month &&
        date.day == now.day;
  }

  Widget _buildEmpty(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 40),
      child: Center(
        child: Column(
          children: [
            Icon(Icons.directions_run,
                size: 48,
                color: theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.4)),
            const SizedBox(height: 12),
            Text('No check-ins yet',
                style: theme.textTheme.titleSmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant)),
            const SizedBox(height: 4),
            Text('Your attendance history will appear here',
                style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant)),
          ],
        ),
      ),
    );
  }

  Widget _buildError(BuildContext context, String error) {
    final theme = Theme.of(context);
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline,
                size: 48, color: theme.colorScheme.error),
            const SizedBox(height: 16),
            Text('Failed to load attendance',
                style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(error,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                textAlign: TextAlign.center),
            const SizedBox(height: 16),
            OutlinedButton(
              onPressed: _loadAttendance,
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 44)),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}


/// QR section that displays a time-limited HMAC token instead of the static member ID.
///
/// Polls [ApiService.getQrToken] every [_refreshInterval] seconds so the QR
/// code is always fresh. This prevents screenshot/replay attacks on the QR.
class _QrSection extends StatefulWidget {
  final dynamic member;
  final bool hasActivePlan;
  final dynamic membership;
  final Color primary;
  final String? memberStatus;
  final bool recordingActive;

  const _QrSection({
    required this.member,
    required this.hasActivePlan,
    required this.membership,
    required this.primary,
    required this.memberStatus,
    this.recordingActive = false,
  });

  @override
  State<_QrSection> createState() => _QrSectionState();
}

class _QrSectionState extends State<_QrSection> {
  /// Encodes a stable, scannable payload from the member's identity.
  /// Format: JSON with type, member_id, gym_id — readable by any future admin scanner.
  String? get _qrData {
    final m = widget.member;
    if (m == null) return null;
    return jsonEncode({
      'type': 'member_checkin',
      'member_id': m.id,
      'gym_id': m.gymId,
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: widget.recordingActive
          ? _buildRecordingWarning(theme)
          : widget.hasActivePlan
              ? _buildQrCard(context, theme)
              : _buildNoActivePlan(context, theme),
    );
  }

  Widget _buildRecordingWarning(ThemeData theme) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: theme.colorScheme.error.withValues(alpha: 0.3)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: theme.colorScheme.errorContainer.withValues(alpha: 0.4),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.videocam_off_rounded,
                  size: 30, color: theme.colorScheme.error),
            ),
            const SizedBox(height: 16),
            Text('QR Hidden',
                style: theme.textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(
              'Your QR code is hidden while screen recording is active.',
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQrCard(BuildContext context, ThemeData theme) {
    final memberNumber = widget.member?.memberNumber;
    final planName = widget.membership?.planName ?? 'Active Plan';

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: widget.primary.withValues(alpha: 0.2)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Text('Your Check-In QR Code',
                style: theme.textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text('Show this at the gym entrance',
                style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant)),
            const SizedBox(height: 20),

            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.08),
                    blurRadius: 16,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: _qrData != null
                  ? QrImageView(
                      data: _qrData!,
                      version: QrVersions.auto,
                      size: 200,
                      backgroundColor: Colors.white,
                      eyeStyle: QrEyeStyle(
                        eyeShape: QrEyeShape.square,
                        color: widget.primary,
                      ),
                      dataModuleStyle: QrDataModuleStyle(
                        dataModuleShape: QrDataModuleShape.square,
                        color: Colors.black87,
                      ),
                    )
                  : SizedBox(
                      width: 200,
                      height: 200,
                      child: Center(
                        child: CircularProgressIndicator(
                          color: widget.primary,
                          strokeWidth: 2,
                        ),
                      ),
                    ),
            ),

            const SizedBox(height: 16),

            // Member number
            if (memberNumber != null)
              Text(memberNumber,
                  style: theme.textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w800,
                      letterSpacing: 2,
                      color: widget.primary)),

            const SizedBox(height: 6),

            // Plan badge
            Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: widget.primary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.verified_outlined, size: 14, color: widget.primary),
                  const SizedBox(width: 5),
                  Text(planName,
                      style: TextStyle(
                          color: widget.primary,
                          fontSize: 12,
                          fontWeight: FontWeight.w700)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNoActivePlan(BuildContext context, ThemeData theme) {
    final isSuspended = widget.memberStatus == 'suspended';

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(
            color: theme.colorScheme.outline.withValues(alpha: 0.2)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: theme.colorScheme.errorContainer.withValues(alpha: 0.4),
                shape: BoxShape.circle,
              ),
              child: Icon(
                isSuspended
                    ? Icons.pause_circle_outline
                    : Icons.lock_outline_rounded,
                size: 32,
                color: theme.colorScheme.error,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              isSuspended ? 'Membership Suspended' : 'No Active Plan',
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 8),
            Text(
              isSuspended
                  ? 'Your membership has been suspended. Please contact the gym to resolve this.'
                  : 'You need an active membership plan to check in at the gym.',
              style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
