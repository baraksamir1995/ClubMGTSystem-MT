import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../providers/member_provider.dart';
import '../services/api_service.dart';
import '../utils/error_utils.dart';

class QrScannerScreen extends StatefulWidget {
  const QrScannerScreen({super.key});

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
  final MobileScannerController _controller = MobileScannerController();
  bool _processing = false;

  @override
  void initState() {
    super.initState();
    // mobile_scanner 7.x removed `autoStart` — controllers must be started
    // explicitly. Fire-and-forget; errors surface via the controller's
    // event stream and the on-screen camera-permission UI.
    _controller.start();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_processing) return;
    final code = capture.barcodes.firstOrNull?.rawValue;
    if (code == null) return;

    setState(() => _processing = true);
    await _controller.stop();

    await _handleCode(code);
  }

  Future<void> _handleCode(String code) async {
    final memberProvider = context.read<MemberProvider>();
    final userGymId = context.read<AuthProvider>().profile?.gymId;

    try {
      // ── Try JSON payload first (new format) ─────────────────────────────────
      Map<String, dynamic>? jsonPayload;
      try {
        jsonPayload = jsonDecode(code) as Map<String, dynamic>?;
      } catch (_) {
        // Not JSON — fall through to legacy string format
      }

      if (jsonPayload != null) {
        final type     = jsonPayload['type'] as String?;
        final qrGymId  = jsonPayload['gym_id'] as String?;
        final branchId = jsonPayload['branch_id'] as String?;
        final qrToken  = jsonPayload['token'] as String?;

        // Gym mismatch
        if (qrGymId != null && qrGymId != userGymId) {
          _showResult(_CheckInResult.error(
            title: 'Wrong Gym',
            subtitle: 'This QR code belongs to a different gym.',
          ));
          return;
        }

        if (type == 'gym_access') {
          final membership = memberProvider.currentMembership;
          final summary = memberProvider.membershipSummary;

          if (membership?.isFrozen == true) {
            _showFrozenSheet(memberProvider);
            return;
          }
          // Transferred-only members (no active subscription) cannot enter
          // the gym floor — gifted sessions are studio-only by design. Catch
          // it locally so the user sees a clear message instead of a generic
          // backend denial.
          if (membership == null
              && summary != null
              && summary.buckets.any((b) => b.isTransferred)) {
            _showResult(_CheckInResult.error(
              title: 'Studio access only',
              subtitle: 'Transferred sessions can only be used at studio classes — gym-floor entry needs your own active membership.',
              icon: Icons.fitness_center_outlined,
            ));
            return;
          }
          if (membership != null && !membership.hasGymAccess) {
            _showNoGymAccessSheet();
            return;
          }
          // O(1) branch access check — no extra network call
          if (branchId != null && membership != null && !membership.canAccessBranch(branchId)) {
            _showResult(_CheckInResult.error(
              title: 'Branch Not Included',
              subtitle: 'Your plan does not include access to this branch.',
              icon: Icons.location_off_outlined,
            ));
            return;
          }

          // Both token-based and legacy paths now go through server-validated
          // RPC (checkin_gym_entrance) which handles membership validation,
          // plan-type checks, branch access, and duplicate prevention atomically.
          Map<String, dynamic> result;
          if (qrToken != null) {
            result = await memberProvider.scanGymQrByToken(
              qrGymId ?? userGymId!,
              qrToken,
              branchId: branchId,
            );
          } else {
            result = await memberProvider.scanGymQr(
              qrGymId ?? userGymId!,
              branchId: branchId,
            );
          }
          if (!mounted) return;

          if (result['status'] == 'denied') {
            final reason = result['reason'] as String? ?? 'unknown';
            _showGymDenyResult(reason);
            return;
          }
          _showResult(_CheckInResult.gymSuccess(checkInTime: DateTime.now()));
          return;
        }

        // ── Studio QR (new static format) ───────────────────────────────────
        if (type == 'studio') {
          final studioId = jsonPayload['studio_id'] as String?;
          if (studioId == null) {
            _showResult(_CheckInResult.error(
              title: 'Invalid QR Code',
              subtitle: 'Missing studio information.',
            ));
            return;
          }

          // Fast in-memory checks before hitting the network
          final membership = memberProvider.currentMembership;
          if (membership?.isFrozen == true) {
            _showFrozenSheet(memberProvider);
            return;
          }
          // Duration-only plans cannot scan studio QRs
          if (membership != null && !membership.hasStudioAccess) {
            _showResult(_CheckInResult.error(
              title: 'Studio Access Not Included',
              subtitle: 'Your current plan only includes gym floor access. Upgrade to a sessions plan to attend classes.',
              icon: Icons.fitness_center_outlined,
            ));
            return;
          }

          final gymMember = memberProvider.member;
          if (gymMember == null) {
            _showResult(_CheckInResult.error(
              title: 'Not Registered',
              subtitle: 'You are not registered as a member of this gym.',
            ));
            return;
          }

          // Single RPC call: validate + mark attended + log attendance.
          // Send userId (profile UUID / auth.uid) — backend resolves to gym_member_id.
          final apiService = ApiService();
          final result = await apiService.validateStudioAccess(
            studioId,
            gymMember.userId,
          );
          if (!mounted) return;

          if (result['status'] == 'allowed') {
            final startRaw = result['start_time'] as String? ?? '';
            final endRaw   = result['end_time']   as String? ?? '';
            _showResult(_CheckInResult.classSuccess(
              checkInTime: DateTime.now(),
              className:   result['class_name']   as String? ?? 'Class',
              sessionDate: DateTime.tryParse(result['session_date'] as String? ?? ''),
              startTime:   startRaw.isNotEmpty ? startRaw.substring(0, 5) : '',
              endTime:     endRaw.isNotEmpty   ? endRaw.substring(0, 5)   : '',
              location:    result['studio_name'] as String?,
              instructor:  result['instructor']  as String?,
            ));
          } else {
            _showStudioDenyResult(result['reason'] as String? ?? 'unknown');
          }
          return;
        }

        _showResult(_CheckInResult.error(
          title: 'Invalid QR Code',
          subtitle: 'This QR code is not recognized by the gym app.',
        ));
        return;
      }

      // ── Legacy string format ────────────────────────────────────────────────
      if (code.startsWith('gym:')) {
        final gymId = code.substring(4);
        if (gymId != userGymId) {
          _showResult(_CheckInResult.error(
            title: 'Wrong Gym',
            subtitle: 'This QR code belongs to a different gym.',
          ));
          return;
        }

        // Server-side RPC handles all validation (membership, frozen,
        // plan type, duplicate prevention). Client-side pre-checks kept
        // only for instant UX feedback on obvious denials.
        final membership = memberProvider.currentMembership;
        if (membership?.isFrozen == true) {
          _showFrozenSheet(memberProvider);
          return;
        }
        if (membership != null && !membership.hasGymAccess) {
          _showNoGymAccessSheet();
          return;
        }

        final result = await memberProvider.scanGymQr(gymId);
        if (!mounted) return;

        if (result['status'] == 'denied') {
          _showGymDenyResult(result['reason'] as String? ?? 'unknown');
          return;
        }

        _showResult(_CheckInResult.gymSuccess(
          checkInTime: DateTime.now(),
        ));
      } else {
        _showResult(_CheckInResult.error(
          title: 'Invalid QR Code',
          subtitle: 'This QR code is not recognized by the gym app.',
        ));
      }
    } catch (e) {
      if (!mounted) return;
      if (e.toString().contains('wrong_branch')) {
        _showResult(_CheckInResult.error(
          title: 'Wrong Branch',
          subtitle: 'Your membership is not valid for this branch.',
          icon: Icons.location_off_outlined,
        ));
      } else if (e.toString().contains('no_session_today')) {
        _showResult(_CheckInResult.error(
          title: 'No Session Today',
          subtitle: 'There is no active session for this class today.',
          icon: Icons.event_busy_outlined,
        ));
      } else if (e.toString().contains('already_attended')) {
        _showResult(_CheckInResult.error(
          title: 'Already Checked In',
          subtitle: 'You have already checked in to this session.',
          icon: Icons.check_circle_outline,
        ));
      } else if (e.toString().contains('no_booking')) {
        _showResult(
          _CheckInResult.error(
            title: 'Not Booked',
            subtitle: 'You don\'t have a booking for today\'s session.',
            icon: Icons.event_busy_outlined,
          ),
          actionLabel: 'Book a Session',
          onAction: () {
            Navigator.pop(context);
            context.go('/schedule');
          },
        );
      } else if (e.toString().contains('sessions_exhausted')) {
        _showResult(_CheckInResult.error(
          title: 'No Sessions Left',
          subtitle: 'You\'ve used all the sessions in your package. Please renew or upgrade your plan.',
          icon: Icons.block_outlined,
        ));
      } else if (e.toString().contains('too_early')) {
        // Extract start time from exception message "too_early:HH:mm"
        final parts = e.toString().split('too_early:');
        final startTime = parts.length > 1 ? parts[1].trim() : '';
        _showResult(_CheckInResult.error(
          title: 'Too Early',
          subtitle: 'Check-in opens 15 minutes before the session starts${startTime.isNotEmpty ? ' at $startTime' : ''}.',
          icon: Icons.schedule_outlined,
        ));
      } else if (e.toString().contains('session_ended')) {
        _showResult(_CheckInResult.error(
          title: 'Session Ended',
          subtitle: 'Check-in is no longer available. The session has already ended.',
          icon: Icons.event_busy_outlined,
        ));
      } else {
        _showResult(_CheckInResult.error(
          title: 'Something went wrong',
          subtitle: friendlyError(e),
        ));
      }
    }
  }

  /// Maps a validate_studio_access denial reason code to the correct UI sheet.
  void _showStudioDenyResult(String reason) {
    switch (reason) {
      case 'studio_not_found':
        _showResult(_CheckInResult.error(
          title: 'Invalid QR Code',
          subtitle: 'This studio was not found. Please contact staff.',
        ));
      case 'no_active_membership':
        _showResult(_CheckInResult.error(
          title: 'No Active Membership',
          subtitle: 'You don\'t have an active membership. Please speak to reception.',
          icon: Icons.card_membership_outlined,
        ));
      case 'membership_frozen':
        _showResult(_CheckInResult.error(
          title: 'Membership Frozen',
          subtitle: 'Your membership is currently paused. Unfreeze it to check in.',
          icon: Icons.ac_unit,
        ));
      case 'studio_access_not_included':
        _showResult(_CheckInResult.error(
          title: 'Studio Access Not Included',
          subtitle: 'Your current plan only includes gym floor access. Upgrade to a sessions plan to attend classes.',
          icon: Icons.fitness_center_outlined,
        ));
      case 'branch_not_included':
        _showResult(_CheckInResult.error(
          title: 'Branch Not Included',
          subtitle: 'Your plan does not include access to this branch.',
          icon: Icons.location_off_outlined,
        ));
      case 'no_active_session':
        _showResult(_CheckInResult.error(
          title: 'No Active Session',
          subtitle: 'There is no class running in this studio right now.',
          icon: Icons.event_busy_outlined,
        ));
      case 'sessions_exhausted':
        _showResult(_CheckInResult.error(
          title: 'No Sessions Left',
          subtitle: 'You\'ve used all the sessions in your package. Please renew or upgrade.',
          icon: Icons.block_outlined,
        ));
      case 'no_booking':
        _showResult(
          _CheckInResult.error(
            title: 'Not Booked',
            subtitle: 'You don\'t have a booking for today\'s session in this studio.',
            icon: Icons.event_busy_outlined,
          ),
          actionLabel: 'Book a Session',
          onAction: () {
            Navigator.pop(context);
            context.go('/schedule');
          },
        );
      case 'already_attended':
        _showResult(_CheckInResult.error(
          title: 'Already Checked In',
          subtitle: 'Your attendance for this session has already been recorded.',
          icon: Icons.check_circle_outline,
        ));
      default:
        _showResult(_CheckInResult.error(
          title: 'Check-in Denied',
          subtitle: reason,
        ));
    }
  }

  /// Maps a checkin_gym_entrance denial reason code to the correct UI message.
  void _showGymDenyResult(String reason) {
    switch (reason) {
      case 'not_a_member':
        _showResult(_CheckInResult.error(
          title: 'Not Registered',
          subtitle: 'You are not registered as a member of this gym.',
          icon: Icons.person_off_outlined,
        ));
      case 'no_active_membership':
        _showResult(_CheckInResult.error(
          title: 'No Active Membership',
          subtitle: 'You don\'t have an active membership. Please speak to reception.',
          icon: Icons.card_membership_outlined,
        ));
      case 'membership_frozen':
        _showResult(_CheckInResult.error(
          title: 'Membership Frozen',
          subtitle: 'Your membership is currently paused. Unfreeze it to check in.',
          icon: Icons.ac_unit,
        ));
      case 'gym_access_not_included':
        _showResult(_CheckInResult.error(
          title: 'Gym Access Not Included',
          subtitle: 'Your current plan only includes class sessions. Upgrade to access the gym floor.',
          icon: Icons.fitness_center_outlined,
        ));
      case 'branch_not_included':
        _showResult(_CheckInResult.error(
          title: 'Branch Not Included',
          subtitle: 'Your plan does not include access to this branch.',
          icon: Icons.location_off_outlined,
        ));
      case 'already_checked_in':
        _showResult(_CheckInResult.error(
          title: 'Already Checked In',
          subtitle: 'You\'ve already checked in recently. Please wait a moment before scanning again.',
          icon: Icons.check_circle_outline,
        ));
      case 'invalid_qr_token':
        _showResult(_CheckInResult.error(
          title: 'Invalid QR Code',
          subtitle: 'This QR code has been replaced. Please scan the updated QR code.',
          icon: Icons.qr_code_outlined,
        ));
      default:
        _showResult(_CheckInResult.error(
          title: 'Check-in Failed',
          subtitle: reason,
        ));
    }
  }

  void _showFrozenSheet(MemberProvider memberProvider) {
    showModalBottomSheet(
      context: context,
      isDismissible: true,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (ctx) => _FrozenSheet(
        frozenUntil: memberProvider.currentMembership?.frozenUntil,
        onUnfreeze: () async {
          Navigator.pop(ctx);
          await memberProvider.unfreezePlan();
          if (mounted) {
            setState(() => _processing = false);
            _controller.start();
          }
        },
        onDismiss: () {
          Navigator.pop(ctx);
          Navigator.pop(context);
        },
      ),
    ).then((_) {
      if (mounted) {
        setState(() => _processing = false);
        _controller.start();
      }
    });
  }

  void _showNoGymAccessSheet() {
    showModalBottomSheet(
      context: context,
      isDismissible: true,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (ctx) => _NoGymAccessSheet(
        onViewMemberships: () {
          Navigator.pop(ctx);
          Navigator.pop(context);
          context.push('/explore/memberships');
        },
        onDismiss: () {
          Navigator.pop(ctx);
          Navigator.pop(context);
        },
      ),
    ).then((_) {
      if (mounted) {
        setState(() => _processing = false);
        _controller.start();
      }
    });
  }

  void _showResult(_CheckInResult result, {VoidCallback? onAction, String? actionLabel}) {
    showModalBottomSheet(
      context: context,
      isDismissible: false,
      enableDrag: false,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (_) => _ResultSheet(
        result: result,
        onDone: () {
          Navigator.pop(context);
          Navigator.pop(context);
        },
        onScanAgain: () {
          Navigator.pop(context);
          setState(() => _processing = false);
          _controller.start();
        },
        onAction: onAction,
        actionLabel: actionLabel,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          tooltip: 'Back',
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: const Text('Scan QR Code',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on_outlined, color: Colors.white),
            onPressed: () => _controller.toggleTorch(),
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
          ),
          // Overlay with scanning frame
          CustomPaint(
            painter: _ScanOverlayPainter(),
            child: const SizedBox.expand(),
          ),
          // Instructions
          Positioned(
            bottom: 60,
            left: 0,
            right: 0,
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.black54,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    'Point at the entrance or studio QR code',
                    style: theme.textTheme.bodyMedium?.copyWith(color: Colors.white),
                    textAlign: TextAlign.center,
                  ),
                ),
                if (_processing) ...[
                  const SizedBox(height: 16),
                  const CircularProgressIndicator(color: Colors.white),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Data model for check-in result ──────────────────────────────────────────

enum _CheckInType { gymSuccess, classSuccess, error }

class _CheckInResult {
  final _CheckInType type;
  final String title;
  final String? subtitle;
  final IconData icon;
  final DateTime? checkInTime;
  // Class-specific
  final String? className;
  final DateTime? sessionDate;
  final String? startTime;
  final String? endTime;
  final String? location;
  final String? instructor;

  const _CheckInResult._({
    required this.type,
    required this.title,
    this.subtitle,
    required this.icon,
    this.checkInTime,
    this.className,
    this.sessionDate,
    this.startTime,
    this.endTime,
    this.location,
    this.instructor,
  });

  factory _CheckInResult.gymSuccess({required DateTime checkInTime}) =>
      _CheckInResult._(
        type: _CheckInType.gymSuccess,
        title: 'Checked In!',
        subtitle: 'Welcome back! Your visit has been recorded.',
        icon: Icons.sensor_door_outlined,
        checkInTime: checkInTime,
      );

  factory _CheckInResult.classSuccess({
    required DateTime checkInTime,
    required String className,
    DateTime? sessionDate,
    String? startTime,
    String? endTime,
    String? location,
    String? instructor,
  }) =>
      _CheckInResult._(
        type: _CheckInType.classSuccess,
        title: 'Attendance Marked!',
        icon: Icons.fitness_center_outlined,
        checkInTime: checkInTime,
        className: className,
        sessionDate: sessionDate,
        startTime: startTime,
        endTime: endTime,
        location: location,
        instructor: instructor,
      );

  factory _CheckInResult.error({
    required String title,
    String? subtitle,
    IconData? icon,
  }) =>
      _CheckInResult._(
        type: _CheckInType.error,
        title: title,
        subtitle: subtitle,
        icon: icon ?? Icons.error_outline,
      );

  bool get isSuccess =>
      type == _CheckInType.gymSuccess || type == _CheckInType.classSuccess;
}

// ── Rich result bottom sheet ─────────────────────────────────────────────────

class _ResultSheet extends StatefulWidget {
  final _CheckInResult result;
  final VoidCallback onDone;
  final VoidCallback onScanAgain;
  final VoidCallback? onAction;
  final String? actionLabel;

  const _ResultSheet({
    required this.result,
    required this.onDone,
    required this.onScanAgain,
    this.onAction,
    this.actionLabel,
  });

  @override
  State<_ResultSheet> createState() => _ResultSheetState();
}

class _ResultSheetState extends State<_ResultSheet>
    with SingleTickerProviderStateMixin {
  late AnimationController _progressController;
  static const _autoDismissSecs = 6;

  @override
  void initState() {
    super.initState();
    if (widget.result.isSuccess) {
      _progressController = AnimationController(
        vsync: this,
        duration: const Duration(seconds: _autoDismissSecs),
      )..forward().whenComplete(() {
          if (mounted) widget.onDone();
        });
    } else {
      _progressController = AnimationController(vsync: this);
    }
  }

  @override
  void dispose() {
    _progressController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final r = widget.result;
    final accentColor = r.isSuccess ? Colors.green : theme.colorScheme.error;

    return Padding(
      padding: EdgeInsets.fromLTRB(
          24, 12, 24, MediaQuery.of(context).padding.bottom + 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Container(
            width: 40, height: 4,
            margin: const EdgeInsets.only(bottom: 20),
            decoration: BoxDecoration(
              color: theme.colorScheme.outline.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Icon circle
          Container(
            width: 80, height: 80,
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(r.icon, size: 38, color: accentColor),
          ),
          const SizedBox(height: 16),

          // Title
          Text(r.title,
              style: theme.textTheme.headlineSmall
                  ?.copyWith(fontWeight: FontWeight.w800),
              textAlign: TextAlign.center),

          if (r.subtitle != null) ...[
            const SizedBox(height: 6),
            Text(r.subtitle!,
                style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant),
                textAlign: TextAlign.center),
          ],

          const SizedBox(height: 20),

          // ── Detail card (success only) ────────────────────────────
          if (r.isSuccess)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                children: [
                  // Check-in time
                  _detailRow(
                    theme,
                    icon: Icons.access_time_outlined,
                    label: 'Check-in Time',
                    value: r.checkInTime != null
                        ? DateFormat('h:mm a  •  EEE, MMM d').format(r.checkInTime!)
                        : '—',
                    accentColor: accentColor,
                  ),

                  if (r.type == _CheckInType.gymSuccess) ...[
                    const SizedBox(height: 12),
                    _detailRow(
                      theme,
                      icon: Icons.sensor_door_outlined,
                      label: 'Location',
                      value: 'Gym Main Entrance',
                      accentColor: accentColor,
                    ),
                  ],

                  if (r.type == _CheckInType.classSuccess) ...[
                    const SizedBox(height: 12),
                    _detailRow(
                      theme,
                      icon: Icons.fitness_center_outlined,
                      label: 'Class',
                      value: r.className ?? '—',
                      accentColor: accentColor,
                    ),
                    if (r.sessionDate != null || r.startTime != null) ...[
                      const SizedBox(height: 12),
                      _detailRow(
                        theme,
                        icon: Icons.calendar_today_outlined,
                        label: 'Session',
                        value: [
                          if (r.sessionDate != null)
                            DateFormat('EEE, MMM d').format(r.sessionDate!),
                          if (r.startTime != null && r.startTime!.isNotEmpty)
                            r.endTime != null && r.endTime!.isNotEmpty
                                ? '${r.startTime} – ${r.endTime}'
                                : r.startTime!,
                        ].join('  •  '),
                        accentColor: accentColor,
                      ),
                    ],
                    if (r.location != null) ...[
                      const SizedBox(height: 12),
                      _detailRow(
                        theme,
                        icon: Icons.location_on_outlined,
                        label: 'Location',
                        value: r.location!,
                        accentColor: accentColor,
                      ),
                    ],
                    if (r.instructor != null) ...[
                      const SizedBox(height: 12),
                      _detailRow(
                        theme,
                        icon: Icons.person_outline,
                        label: 'Instructor',
                        value: r.instructor!,
                        accentColor: accentColor,
                      ),
                    ],
                  ],
                ],
              ),
            ),

          // ── Auto-dismiss progress bar ─────────────────────────────
          if (r.isSuccess) ...[
            const SizedBox(height: 16),
            AnimatedBuilder(
              animation: _progressController,
              builder: (context2, child) => ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: 1 - _progressController.value,
                  backgroundColor:
                      theme.colorScheme.outline.withValues(alpha: 0.15),
                  valueColor: AlwaysStoppedAnimation(accentColor),
                  minHeight: 4,
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text('Closing in $_autoDismissSecs seconds…',
                style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant)),
          ],

          const SizedBox(height: 20),

          // ── Optional action button (e.g. "Book a Session") ────────
          if (widget.onAction != null && widget.actionLabel != null) ...[
            SizedBox(
              width: double.infinity,
              height: 50,
              child: ElevatedButton.icon(
                onPressed: widget.onAction,
                icon: const Icon(Icons.calendar_month_outlined, size: 18),
                label: Text(
                  widget.actionLabel!,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: accentColor,
                  foregroundColor: Colors.white,
                ),
              ),
            ),
            const SizedBox(height: 10),
          ],

          // ── Actions ───────────────────────────────────────────────
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: widget.onScanAgain,
                  style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 50)),
                  child: const Text('Scan Again'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: widget.onDone,
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size(0, 50),
                    backgroundColor: accentColor,
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Done',
                      style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _detailRow(ThemeData theme,
      {required IconData icon,
      required String label,
      required String value,
      required Color accentColor}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 16, color: accentColor),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style: theme.textTheme.labelSmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant)),
              const SizedBox(height: 1),
              Text(value,
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ],
    );
  }
}

// ── No gym access bottom sheet ────────────────────────────────────────────────

class _NoGymAccessSheet extends StatelessWidget {
  final VoidCallback onViewMemberships;
  final VoidCallback onDismiss;

  const _NoGymAccessSheet({
    required this.onViewMemberships,
    required this.onDismiss,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: EdgeInsets.fromLTRB(
          24, 12, 24, MediaQuery.of(context).padding.bottom + 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40, height: 4,
            margin: const EdgeInsets.only(bottom: 20),
            decoration: BoxDecoration(
              color: theme.colorScheme.outline.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          Container(
            width: 72, height: 72,
            decoration: BoxDecoration(
              color: Colors.orange.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.lock_outline, size: 34, color: Colors.orange),
          ),
          const SizedBox(height: 16),

          Text(
            'Gym Access Not Included',
            style: theme.textTheme.headlineSmall
                ?.copyWith(fontWeight: FontWeight.w800),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Your current subscription does not include gym access.\nUpgrade your plan to enter the gym.',
            style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant),
            textAlign: TextAlign.center,
          ),

          const SizedBox(height: 24),

          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton.icon(
              onPressed: onViewMemberships,
              icon: const Icon(Icons.card_membership_outlined, size: 18),
              label: const Text(
                'View Memberships',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.orange,
                foregroundColor: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: OutlinedButton(
              onPressed: onDismiss,
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 50)),
              child: const Text('Close'),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Frozen membership bottom sheet ───────────────────────────────────────────

class _FrozenSheet extends StatefulWidget {
  final DateTime? frozenUntil;
  final VoidCallback onDismiss;
  final Future<void> Function() onUnfreeze;

  const _FrozenSheet({
    required this.frozenUntil,
    required this.onDismiss,
    required this.onUnfreeze,
  });

  @override
  State<_FrozenSheet> createState() => _FrozenSheetState();
}

class _FrozenSheetState extends State<_FrozenSheet> {
  bool _loading = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final resumeDate = widget.frozenUntil;

    return Padding(
      padding: EdgeInsets.fromLTRB(
          24, 12, 24, MediaQuery.of(context).padding.bottom + 28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40, height: 4,
            margin: const EdgeInsets.only(bottom: 20),
            decoration: BoxDecoration(
              color: theme.colorScheme.outline.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          Container(
            width: 72, height: 72,
            decoration: BoxDecoration(
              color: Colors.blue.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.ac_unit, size: 34, color: Colors.blue),
          ),
          const SizedBox(height: 16),

          Text(
            'Membership Frozen',
            style: theme.textTheme.headlineSmall
                ?.copyWith(fontWeight: FontWeight.w800),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            resumeDate != null
                ? 'Your membership is paused until ${DateFormat('MMM d, yyyy').format(resumeDate)}.\nYou cannot check in while frozen.'
                : 'Your membership is currently frozen.\nYou cannot check in while frozen.',
            style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant),
            textAlign: TextAlign.center,
          ),

          const SizedBox(height: 24),

          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: widget.onDismiss,
                  style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 50)),
                  child: const Text('Close'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _loading
                      ? null
                      : () async {
                          setState(() => _loading = true);
                          try {
                            await widget.onUnfreeze();
                          } catch (e) {
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('Failed to unfreeze: $e'),
                                  backgroundColor: Colors.red,
                                ),
                              );
                            }
                          } finally {
                            if (mounted) setState(() => _loading = false);
                          }
                        },
                  icon: _loading
                      ? const SizedBox(
                          width: 14, height: 14,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.play_circle_outline, size: 18),
                  label: Text(_loading ? 'Resuming…' : 'Resume Now'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(0, 50),
                    textStyle: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Draws a dark overlay with a transparent square cut-out in the centre.
class _ScanOverlayPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    const boxSize = 240.0;
    final cx = size.width / 2;
    final cy = size.height / 2 - 40;
    final rect = Rect.fromCenter(
        center: Offset(cx, cy), width: boxSize, height: boxSize);

    final paint = Paint()..color = Colors.black54;
    // Draw overlay around the box
    canvas.drawPath(
      Path.combine(
        PathOperation.difference,
        Path()..addRect(Rect.fromLTWH(0, 0, size.width, size.height)),
        Path()..addRRect(RRect.fromRectAndRadius(rect, const Radius.circular(16))),
      ),
      paint,
    );

    // Draw corner brackets
    final borderPaint = Paint()
      ..color = Colors.white
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke;
    const cornerLen = 24.0;
    const r = 16.0;

    // Top-left
    canvas.drawPath(
        Path()
          ..moveTo(rect.left, rect.top + r + cornerLen)
          ..lineTo(rect.left, rect.top + r)
          ..arcToPoint(Offset(rect.left + r, rect.top),
              radius: const Radius.circular(r))
          ..lineTo(rect.left + r + cornerLen, rect.top),
        borderPaint);
    // Top-right
    canvas.drawPath(
        Path()
          ..moveTo(rect.right - r - cornerLen, rect.top)
          ..lineTo(rect.right - r, rect.top)
          ..arcToPoint(Offset(rect.right, rect.top + r),
              radius: const Radius.circular(r))
          ..lineTo(rect.right, rect.top + r + cornerLen),
        borderPaint);
    // Bottom-left
    canvas.drawPath(
        Path()
          ..moveTo(rect.left, rect.bottom - r - cornerLen)
          ..lineTo(rect.left, rect.bottom - r)
          ..arcToPoint(Offset(rect.left + r, rect.bottom),
              radius: const Radius.circular(r), clockwise: false)
          ..lineTo(rect.left + r + cornerLen, rect.bottom),
        borderPaint);
    // Bottom-right
    canvas.drawPath(
        Path()
          ..moveTo(rect.right - r - cornerLen, rect.bottom)
          ..lineTo(rect.right - r, rect.bottom)
          ..arcToPoint(Offset(rect.right, rect.bottom - r),
              radius: const Radius.circular(r), clockwise: false)
          ..lineTo(rect.right, rect.bottom - r - cornerLen),
        borderPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
