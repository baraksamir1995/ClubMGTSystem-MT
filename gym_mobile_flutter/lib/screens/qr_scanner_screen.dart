import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:clby/l10n/l10n.dart';
import '../providers/auth_provider.dart';
import '../providers/member_provider.dart';
import '../services/api_service.dart';
import '../models/service_model.dart';
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
            title: context.l10n.qrWrongGymTitle,
            subtitle: context.l10n.qrWrongGymSubtitle,
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
              title: context.l10n.qrStudioOnlyTitle,
              subtitle: context.l10n.qrStudioOnlySubtitle,
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
              title: context.l10n.qrBranchNotIncludedTitle,
              subtitle: context.l10n.qrBranchNotIncludedSubtitle,
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
          _showResult(_CheckInResult.gymSuccess(context: context, checkInTime: DateTime.now()));
          return;
        }

        // ── Studio QR (new static format) ───────────────────────────────────
        if (type == 'studio') {
          final studioId = jsonPayload['studio_id'] as String?;
          if (studioId == null) {
            _showResult(_CheckInResult.error(
              title: context.l10n.qrInvalidTitle,
              subtitle: context.l10n.qrMissingStudioInfo,
            ));
            return;
          }

          // Fast in-memory freeze check before hitting the network.
          // Studio/class eligibility (duration vs sessions, including
          // transferred sessions) is decided by the backend — the single
          // "current membership" can't see a separate transferred-sessions
          // bucket, so we must not gate the scan on it here.
          final membership = memberProvider.currentMembership;
          if (membership?.isFrozen == true) {
            _showFrozenSheet(memberProvider);
            return;
          }

          final gymMember = memberProvider.member;
          if (gymMember == null) {
            _showResult(_CheckInResult.error(
              title: context.l10n.qrNotRegisteredTitle,
              subtitle: context.l10n.qrNotRegisteredSubtitle,
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
              context: context,
              checkInTime: DateTime.now(),
              className:   result['class_name']   as String? ?? context.l10n.bookingsClassFallback,
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

        // ── Specialist session QR (static, encodes the specialist id) ───────
        if (type == 'specialist_session') {
          final trainerId = jsonPayload['trainer_id'] as String?;
          if (trainerId == null) {
            _showResult(_CheckInResult.error(
              title: context.l10n.qrInvalidTitle,
              subtitle: context.l10n.qrMissingSpecialistInfo,
            ));
            return;
          }

          final result = await ApiService().scanSpecialist(trainerId);
          if (!mounted) return;

          if (result['ok'] == true) {
            final remaining = (result['sessions_remaining'] as num?)?.toInt() ?? 0;
            _showResult(_CheckInResult.serviceSuccess(
              context: context,
              checkInTime: DateTime.now(),
              specialistName: result['trainer_name'] as String? ?? context.l10n.qrSpecialistFallback,
              serviceLabel: _serviceLabel(result['service_type'] as String? ?? result['trainer_type'] as String?),
              sessionsRemaining: remaining,
              completed: result['completed'] == true,
            ));
          } else {
            _showSpecialistDeny(result);
          }
          return;
        }

        _showResult(_CheckInResult.error(
          title: context.l10n.qrInvalidTitle,
          subtitle: context.l10n.qrNotRecognized,
        ));
        return;
      }

      // ── Legacy string format ────────────────────────────────────────────────
      if (code.startsWith('gym:')) {
        final gymId = code.substring(4);
        if (gymId != userGymId) {
          _showResult(_CheckInResult.error(
            title: context.l10n.qrWrongGymTitle,
            subtitle: context.l10n.qrWrongGymSubtitle,
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
          context: context,
          checkInTime: DateTime.now(),
        ));
      } else {
        _showResult(_CheckInResult.error(
          title: context.l10n.qrInvalidTitle,
          subtitle: context.l10n.qrNotRecognized,
        ));
      }
    } catch (e) {
      if (!mounted) return;
      if (e.toString().contains('wrong_branch')) {
        _showResult(_CheckInResult.error(
          title: context.l10n.qrWrongBranchTitle,
          subtitle: context.l10n.qrWrongBranchSubtitle,
          icon: Icons.location_off_outlined,
        ));
      } else if (e.toString().contains('no_session_today')) {
        _showResult(_CheckInResult.error(
          title: context.l10n.qrNoSessionTodayTitle,
          subtitle: context.l10n.qrNoSessionTodaySubtitle,
          icon: Icons.event_busy_outlined,
        ));
      } else if (e.toString().contains('already_attended')) {
        _showResult(_CheckInResult.error(
          title: context.l10n.qrAlreadyCheckedInTitle,
          subtitle: context.l10n.qrAlreadyCheckedInSubtitle,
          icon: Icons.check_circle_outline,
        ));
      } else if (e.toString().contains('no_booking')) {
        _showResult(
          _CheckInResult.error(
            title: context.l10n.qrNotBookedTitle,
            subtitle: context.l10n.qrNotBookedSubtitle,
            icon: Icons.event_busy_outlined,
          ),
          actionLabel: context.l10n.qrBookASession,
          onAction: () {
            Navigator.pop(context);
            context.go('/schedule');
          },
        );
      } else if (e.toString().contains('sessions_exhausted')) {
        _showResult(_CheckInResult.error(
          title: context.l10n.qrNoSessionsLeftTitle,
          subtitle: context.l10n.qrSessionsExhaustedSubtitle,
          icon: Icons.block_outlined,
        ));
      } else if (e.toString().contains('too_early')) {
        // Extract start time from exception message "too_early:HH:mm"
        final parts = e.toString().split('too_early:');
        final startTime = parts.length > 1 ? parts[1].trim() : '';
        _showResult(_CheckInResult.error(
          title: context.l10n.qrTooEarlyTitle,
          subtitle: startTime.isNotEmpty
              ? context.l10n.qrTooEarlySubtitleAt(startTime)
              : context.l10n.qrTooEarlySubtitle,
          icon: Icons.schedule_outlined,
        ));
      } else if (e.toString().contains('session_ended')) {
        _showResult(_CheckInResult.error(
          title: context.l10n.qrSessionEndedTitle,
          subtitle: context.l10n.qrSessionEndedSubtitle,
          icon: Icons.event_busy_outlined,
        ));
      } else {
        _showResult(_CheckInResult.error(
          title: context.l10n.qrSomethingWentWrong,
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
          title: context.l10n.qrInvalidTitle,
          subtitle: context.l10n.qrStudioNotFound,
        ));
      case 'no_active_membership':
        _showResult(_CheckInResult.error(
          title: context.l10n.qrNoActiveMembershipTitle,
          subtitle: context.l10n.qrNoActiveMembershipSubtitle,
          icon: Icons.card_membership_outlined,
        ));
      case 'membership_frozen':
        _showResult(_CheckInResult.error(
          title: context.l10n.qrMembershipFrozenTitle,
          subtitle: context.l10n.qrMembershipFrozenSubtitle,
          icon: Icons.ac_unit,
        ));
      case 'studio_access_not_included':
        _showResult(_CheckInResult.error(
          title: context.l10n.qrStudioAccessNotIncludedTitle,
          subtitle: context.l10n.qrStudioAccessNotIncludedSubtitle,
          icon: Icons.fitness_center_outlined,
        ));
      case 'branch_not_included':
        _showResult(_CheckInResult.error(
          title: context.l10n.qrBranchNotIncludedTitle,
          subtitle: context.l10n.qrBranchNotIncludedSubtitle,
          icon: Icons.location_off_outlined,
        ));
      case 'no_active_session':
        _showResult(_CheckInResult.error(
          title: context.l10n.qrNoActiveSessionTitle,
          subtitle: context.l10n.qrNoActiveSessionSubtitle,
          icon: Icons.event_busy_outlined,
        ));
      case 'sessions_exhausted':
        _showResult(_CheckInResult.error(
          title: context.l10n.qrNoSessionsLeftTitle,
          subtitle: context.l10n.qrSessionsExhaustedShort,
          icon: Icons.block_outlined,
        ));
      case 'no_booking':
        _showResult(
          _CheckInResult.error(
            title: context.l10n.qrNotBookedTitle,
            subtitle: context.l10n.qrNotBookedStudioSubtitle,
            icon: Icons.event_busy_outlined,
          ),
          actionLabel: context.l10n.qrBookASession,
          onAction: () {
            Navigator.pop(context);
            context.go('/schedule');
          },
        );
      case 'already_attended':
        _showResult(_CheckInResult.error(
          title: context.l10n.qrAlreadyCheckedInTitle,
          subtitle: context.l10n.qrAttendanceRecorded,
          icon: Icons.check_circle_outline,
        ));
      default:
        _showResult(_CheckInResult.error(
          title: context.l10n.qrCheckinDeniedTitle,
          subtitle: reason,
        ));
    }
  }

  /// Human label for a service / trainer type code.
  String _serviceLabel(String? type) {
    switch (type) {
      case 'personal_trainer': return context.l10n.qrServicePersonalTraining;
      case 'physiotherapist':  return context.l10n.qrServicePhysiotherapy;
      case 'nutritionist':     return context.l10n.qrServiceNutrition;
      default:                 return context.l10n.commonSessions;
    }
  }

  /// Maps a specialist-scan denial to the right sheet. The "no usable
  /// package" codes (no_package / package_expired / package_exhausted) get
  /// an "offer to buy" action that deep-links to that specialist's packages.
  void _showSpecialistDeny(Map<String, dynamic> result) {
    final code = result['code'] as String? ?? 'error';
    final message = result['error'] as String?;
    final trainerType = result['trainer_type'] as String?;

    // Navigate to the matching service's packages list (by trainer_type).
    void goToPackages() {
      Navigator.pop(context); // close the result sheet
      Navigator.pop(context); // close the scanner
      final service = kServices.firstWhere(
        (s) => s.trainerType == trainerType,
        orElse: () => kServices.first,
      );
      context.push('/service-packages/${service.id}', extra: service);
    }

    switch (code) {
      case 'no_package':
      case 'package_expired':
      case 'package_exhausted':
        _showResult(
          _CheckInResult.error(
            title: code == 'no_package'
                ? context.l10n.qrNoPackageTitle
                : (code == 'package_expired'
                    ? context.l10n.qrPackageExpiredTitle
                    : context.l10n.qrNoSessionsLeftTitle),
            subtitle: message ?? context.l10n.qrNoPackageSubtitle,
            icon: Icons.card_membership_outlined,
          ),
          actionLabel: context.l10n.qrViewPackages,
          onAction: goToPackages,
        );
      case 'recently_logged':
        final mins = (result['minutes_left'] as num?)?.toInt();
        _showResult(_CheckInResult.error(
          title: context.l10n.qrAlreadyLoggedTitle,
          subtitle: mins != null
              ? context.l10n.qrTryAgainInMinutes(mins)
              : (message ?? context.l10n.qrJustLogged),
          icon: Icons.check_circle_outline,
        ));
      case 'specialist_not_found':
        _showResult(_CheckInResult.error(
          title: context.l10n.qrInvalidTitle,
          subtitle: context.l10n.qrSpecialistCodeInvalid,
          icon: Icons.qr_code_outlined,
        ));
      case 'no_member':
        _showResult(_CheckInResult.error(
          title: context.l10n.qrNotRegisteredTitle,
          subtitle: context.l10n.qrNotRegisteredSubtitle,
          icon: Icons.person_off_outlined,
        ));
      default:
        _showResult(_CheckInResult.error(
          title: context.l10n.qrCouldNotLogTitle,
          subtitle: message ?? context.l10n.commonError,
        ));
    }
  }

  /// Maps a checkin_gym_entrance denial reason code to the correct UI message.
  void _showGymDenyResult(String reason) {
    switch (reason) {
      case 'not_a_member':
        _showResult(_CheckInResult.error(
          title: context.l10n.qrNotRegisteredTitle,
          subtitle: context.l10n.qrNotRegisteredSubtitle,
          icon: Icons.person_off_outlined,
        ));
      case 'no_active_membership':
        _showResult(_CheckInResult.error(
          title: context.l10n.qrNoActiveMembershipTitle,
          subtitle: context.l10n.qrNoActiveMembershipSubtitle,
          icon: Icons.card_membership_outlined,
        ));
      case 'membership_frozen':
        _showResult(_CheckInResult.error(
          title: context.l10n.qrMembershipFrozenTitle,
          subtitle: context.l10n.qrMembershipFrozenSubtitle,
          icon: Icons.ac_unit,
        ));
      case 'gym_access_not_included':
        _showResult(_CheckInResult.error(
          title: context.l10n.qrGymAccessNotIncludedTitle,
          subtitle: context.l10n.qrGymAccessNotIncludedSubtitle,
          icon: Icons.fitness_center_outlined,
        ));
      case 'branch_not_included':
        _showResult(_CheckInResult.error(
          title: context.l10n.qrBranchNotIncludedTitle,
          subtitle: context.l10n.qrBranchNotIncludedSubtitle,
          icon: Icons.location_off_outlined,
        ));
      case 'already_checked_in':
        _showResult(_CheckInResult.error(
          title: context.l10n.qrAlreadyCheckedInTitle,
          subtitle: context.l10n.qrAlreadyCheckedInRecently,
          icon: Icons.check_circle_outline,
        ));
      case 'invalid_qr_token':
        _showResult(_CheckInResult.error(
          title: context.l10n.qrInvalidTitle,
          subtitle: context.l10n.qrCodeReplaced,
          icon: Icons.qr_code_outlined,
        ));
      default:
        _showResult(_CheckInResult.error(
          title: context.l10n.qrCheckinFailedTitle,
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
          // Just pop the sheet + unfreeze. The sheet's .then below restarts
          // the controller — no need to also do it here, which would
          // double-start (race with the .then callback that fires the
          // moment Navigator.pop dismisses the route).
          Navigator.pop(ctx);
          await memberProvider.unfreezePlan();
        },
        onDismiss: () {
          Navigator.pop(ctx);
          Navigator.pop(context);
        },
      ),
    ).then((_) {
      // Reached either when the user taps outside (isDismissible) or after
      // any of the buttons pop the sheet. mounted check covers the
      // onDismiss path that also pops the scanner screen.
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
          tooltip: context.l10n.commonBack,
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: Text(context.l10n.qrScanTitle,
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
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
                    context.l10n.qrPointInstruction,
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

enum _CheckInType { gymSuccess, classSuccess, serviceSuccess, error }

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
  // Specialist-session-specific
  final int? sessionsRemaining;

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
    this.sessionsRemaining,
  });

  factory _CheckInResult.gymSuccess({
    required BuildContext context,
    required DateTime checkInTime,
  }) =>
      _CheckInResult._(
        type: _CheckInType.gymSuccess,
        title: context.l10n.qrCheckedInTitle,
        subtitle: context.l10n.qrWelcomeBack,
        icon: Icons.sensor_door_outlined,
        checkInTime: checkInTime,
      );

  factory _CheckInResult.classSuccess({
    required BuildContext context,
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
        title: context.l10n.qrAttendanceMarkedTitle,
        icon: Icons.fitness_center_outlined,
        checkInTime: checkInTime,
        className: className,
        sessionDate: sessionDate,
        startTime: startTime,
        endTime: endTime,
        location: location,
        instructor: instructor,
      );

  factory _CheckInResult.serviceSuccess({
    required BuildContext context,
    required DateTime checkInTime,
    required String specialistName,
    required String serviceLabel,
    required int sessionsRemaining,
    required bool completed,
  }) =>
      _CheckInResult._(
        type: _CheckInType.serviceSuccess,
        title: context.l10n.qrSessionLoggedTitle,
        subtitle: completed
            ? context.l10n.qrLastSessionWith(specialistName)
            : context.l10n.qrOneSessionUsedWith(specialistName),
        icon: Icons.check_circle_outline,
        checkInTime: checkInTime,
        className: specialistName,  // reuse for the specialist's name
        location: serviceLabel,
        sessionsRemaining: sessionsRemaining,
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
      type == _CheckInType.gymSuccess ||
      type == _CheckInType.classSuccess ||
      type == _CheckInType.serviceSuccess;
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
                    label: context.l10n.qrCheckInTime,
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
                      label: context.l10n.scheduleLocation,
                      value: context.l10n.qrGymMainEntrance,
                      accentColor: accentColor,
                    ),
                  ],

                  if (r.type == _CheckInType.classSuccess) ...[
                    const SizedBox(height: 12),
                    _detailRow(
                      theme,
                      icon: Icons.fitness_center_outlined,
                      label: context.l10n.bookingsClassFallback,
                      value: r.className ?? '—',
                      accentColor: accentColor,
                    ),
                    if (r.sessionDate != null || r.startTime != null) ...[
                      const SizedBox(height: 12),
                      _detailRow(
                        theme,
                        icon: Icons.calendar_today_outlined,
                        label: context.l10n.qrSessionLabel,
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
                        label: context.l10n.scheduleLocation,
                        value: r.location!,
                        accentColor: accentColor,
                      ),
                    ],
                    if (r.instructor != null) ...[
                      const SizedBox(height: 12),
                      _detailRow(
                        theme,
                        icon: Icons.person_outline,
                        label: context.l10n.sessionInstructor,
                        value: r.instructor!,
                        accentColor: accentColor,
                      ),
                    ],
                  ],

                  if (r.type == _CheckInType.serviceSuccess) ...[
                    const SizedBox(height: 12),
                    _detailRow(
                      theme,
                      icon: Icons.person_outline,
                      label: context.l10n.qrSpecialistFallback,
                      value: r.className ?? '—',
                      accentColor: accentColor,
                    ),
                    if (r.location != null) ...[
                      const SizedBox(height: 12),
                      _detailRow(
                        theme,
                        icon: Icons.fitness_center_outlined,
                        label: context.l10n.qrServiceLabel,
                        value: r.location!,
                        accentColor: accentColor,
                      ),
                    ],
                    const SizedBox(height: 12),
                    _detailRow(
                      theme,
                      icon: Icons.confirmation_number_outlined,
                      label: context.l10n.qrSessionsLeftLabel,
                      value: '${r.sessionsRemaining ?? 0}',
                      accentColor: accentColor,
                    ),
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
            Text(context.l10n.qrClosingIn(_autoDismissSecs),
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
                  child: Text(context.l10n.qrScanAgain),
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
                  child: Text(context.l10n.commonDone,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
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
            context.l10n.qrGymAccessNotIncludedTitle,
            style: theme.textTheme.headlineSmall
                ?.copyWith(fontWeight: FontWeight.w800),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            context.l10n.qrNoGymAccessBody,
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
              label: Text(
                context.l10n.qrViewMemberships,
                style: const TextStyle(fontWeight: FontWeight.w700),
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
              child: Text(context.l10n.commonClose),
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
            context.l10n.qrMembershipFrozenTitle,
            style: theme.textTheme.headlineSmall
                ?.copyWith(fontWeight: FontWeight.w800),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            resumeDate != null
                ? context.l10n.qrFrozenUntilBody(
                    DateFormat('MMM d, yyyy').format(resumeDate))
                : context.l10n.qrFrozenBody,
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
                  child: Text(context.l10n.commonClose),
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
                                  content: Text(context.l10n.qrUnfreezeFailed(e.toString())),
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
                  label: Text(_loading ? context.l10n.qrResuming : context.l10n.qrResumeNow),
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
