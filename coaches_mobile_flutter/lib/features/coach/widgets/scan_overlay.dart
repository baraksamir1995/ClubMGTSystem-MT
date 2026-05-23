import 'dart:ui';
import 'package:flutter/material.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_text.dart';
import '../../../widgets/avatar.dart';
import '../../../widgets/c_button.dart';
import '../models.dart';

enum ScanFlow { idle, scanning, confirm, blocked, success }

/// Bottom-sheet overlay covering the four post-idle scan states.
/// Backdrop blur dismisses on tap except while we're "reading" the code.
///
/// `assignment` is the row being decremented; the sheet projects its
/// remaining count for both Confirm (current remaining) and Success
/// (remaining-after-this-scan).
class ScanOverlay extends StatelessWidget {
  final ScanFlow flow;
  final CoachAssignment? assignment;
  final int blockedMinutesLeft;
  final VoidCallback onConfirm;
  final VoidCallback onClose;

  const ScanOverlay({
    super.key,
    required this.flow,
    required this.assignment,
    required this.onConfirm,
    required this.onClose,
    this.blockedMinutesLeft = 0,
  });

  @override
  Widget build(BuildContext context) {
    final dismissible = flow != ScanFlow.scanning;
    return Positioned.fill(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: dismissible ? onClose : null,
        child: ClipRect(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
            child: Container(
              color: AppColors.bg.withValues(alpha: 0.85),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  GestureDetector(
                    onTap: () {},
                    child: _Sheet(
                      flow: flow,
                      assignment: assignment,
                      blockedMinutesLeft: blockedMinutesLeft,
                      onConfirm: onConfirm,
                      onClose: onClose,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Sheet extends StatelessWidget {
  final ScanFlow flow;
  final CoachAssignment? assignment;
  final int blockedMinutesLeft;
  final VoidCallback onConfirm;
  final VoidCallback onClose;
  const _Sheet({
    required this.flow,
    required this.assignment,
    required this.blockedMinutesLeft,
    required this.onConfirm,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: const Duration(milliseconds: 300),
      curve: const Cubic(0.2, 0.7, 0.3, 1.0),
      builder: (_, t, child) => Transform.translate(
        offset: Offset(0, (1 - t) * 40),
        child: Opacity(opacity: t, child: child),
      ),
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          color: AppColors.bgElev,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          border: Border.all(color: AppColors.border),
        ),
        padding: const EdgeInsets.fromLTRB(22, 20, 22, 36),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 22),
                decoration: BoxDecoration(
                  color: const Color(0x1FFFFFFF),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            _content(),
          ],
        ),
      ),
    );
  }

  Widget _content() {
    switch (flow) {
      case ScanFlow.scanning:
        return const _ScanningBody();
      case ScanFlow.confirm:
        if (assignment == null) return const SizedBox.shrink();
        return _ConfirmBody(
          assignment: assignment!,
          onConfirm: onConfirm,
          onClose: onClose,
        );
      case ScanFlow.blocked:
        if (assignment == null) return const SizedBox.shrink();
        return _BlockedBody(
          assignment: assignment!,
          minutesLeft: blockedMinutesLeft,
          onClose: onClose,
        );
      case ScanFlow.success:
        if (assignment == null) return const SizedBox.shrink();
        return _SuccessBody(assignment: assignment!, onClose: onClose);
      case ScanFlow.idle:
        return const SizedBox.shrink();
    }
  }
}

class _ScanningBody extends StatefulWidget {
  const _ScanningBody();
  @override
  State<_ScanningBody> createState() => _ScanningBodyState();
}

class _ScanningBodyState extends State<_ScanningBody>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Column(
        children: [
          SizedBox(
            width: 92,
            height: 92,
            child: Stack(
              alignment: Alignment.center,
              children: [
                AnimatedBuilder(
                  animation: _pulse,
                  builder: (_, _) {
                    final t = _pulse.value;
                    return Transform.scale(
                      scale: 1 + 0.5 * t,
                      child: Opacity(
                        opacity: 0.4 * (1 - t),
                        child: Container(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: AppColors.lime, width: 2),
                          ),
                        ),
                      ),
                    );
                  },
                ),
                Container(
                  width: 80,
                  height: 80,
                  decoration: const BoxDecoration(
                    color: AppColors.surface,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.qr_code_scanner_rounded,
                    size: 40,
                    color: AppColors.lime,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          Text(
            'READING CODE…',
            style: AppText.disp(size: 24, letterSpacing: 1, color: AppColors.text),
          ),
          const SizedBox(height: 6),
          Text(
            'Verifying member',
            style: AppText.body(size: 13, color: AppColors.textSec),
          ),
        ],
      ),
    );
  }
}

class _ConfirmBody extends StatelessWidget {
  final CoachAssignment assignment;
  final VoidCallback onConfirm;
  final VoidCallback onClose;
  const _ConfirmBody({
    required this.assignment,
    required this.onConfirm,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('SCAN DETECTED',
            style: AppText.mono(size: 10, letterSpacing: 2, color: AppColors.lime)),
        const SizedBox(height: 10),
        Text(
          'CONFIRM SESSION',
          style: AppText.disp(
            size: 30,
            letterSpacing: 1,
            color: AppColors.text,
            height: 1,
          ),
        ),
        const SizedBox(height: 18),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              Avatar(name: assignment.member.name, size: 48),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      assignment.member.name,
                      style: AppText.body(
                        size: 15,
                        weight: FontWeight.w600,
                        color: AppColors.text,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${assignment.sessionsTotal}-SESSION · ${assignment.sessionsRemaining} LEFT',
                      style: AppText.mono(
                        size: 11,
                        letterSpacing: 0.5,
                        color: AppColors.textSec,
                      ),
                    ),
                  ],
                ),
              ),
              Text('−1',
                  style: AppText.disp(
                      size: 24, letterSpacing: 0.5, color: AppColors.lime)),
            ],
          ),
        ),
        const SizedBox(height: 20),
        CButton(
          label: 'Confirm session',
          icon: Icons.check_rounded,
          variant: CButtonVariant.primary,
          size: CButtonSize.lg,
          full: true,
          onTap: onConfirm,
        ),
        const SizedBox(height: 4),
        TextButton(
          onPressed: onClose,
          style: TextButton.styleFrom(foregroundColor: AppColors.textSec),
          child: Text(
            'Cancel',
            style: AppText.body(
              size: 13,
              weight: FontWeight.w500,
              color: AppColors.textSec,
            ),
          ),
        ),
      ],
    );
  }
}

class _BlockedBody extends StatelessWidget {
  final CoachAssignment assignment;
  final int minutesLeft;
  final VoidCallback onClose;
  const _BlockedBody({
    required this.assignment,
    required this.minutesLeft,
    required this.onClose,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('BLOCKED · DOUBLE-SCAN GUARD',
            style: AppText.mono(size: 10, letterSpacing: 2, color: AppColors.warn)),
        const SizedBox(height: 10),
        Text(
          'HOLD ON…',
          style: AppText.disp(
              size: 30, letterSpacing: 1, color: AppColors.text, height: 1),
        ),
        const SizedBox(height: 14),
        Text.rich(
          TextSpan(
            style: AppText.body(
              size: 14,
              color: AppColors.textSec,
              letterSpacing: -0.1,
              height: 1.45,
            ),
            children: [
              TextSpan(
                text: assignment.member.name,
                style: AppText.body(
                  size: 14,
                  color: AppColors.text,
                  weight: FontWeight.w600,
                  letterSpacing: -0.1,
                ),
              ),
              const TextSpan(
                  text: ' was already logged in the last 30 minutes. '
                      'The session can be logged again in about '),
              TextSpan(
                text: '$minutesLeft min',
                style: AppText.body(
                  size: 14,
                  color: AppColors.warn,
                  weight: FontWeight.w600,
                  letterSpacing: -0.1,
                ),
              ),
              const TextSpan(text: '.'),
            ],
          ),
        ),
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: AppColors.warnSoft,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.warn),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.warning_amber_rounded, size: 16, color: AppColors.warn),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Prevents accidental decrement of the same session twice.',
                  style: AppText.body(
                    size: 12,
                    color: AppColors.warn,
                    letterSpacing: -0.1,
                    height: 1.4,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        CButton(
          label: 'OK, got it',
          variant: CButtonVariant.secondary,
          size: CButtonSize.lg,
          full: true,
          onTap: onClose,
        ),
      ],
    );
  }
}

class _SuccessBody extends StatelessWidget {
  final CoachAssignment assignment;
  final VoidCallback onClose;
  const _SuccessBody({required this.assignment, required this.onClose});

  @override
  Widget build(BuildContext context) {
    // After the optimistic confirm, `assignment.sessionsRemaining` is
    // already the post-decrement value (the state's `withDecrement()`
    // projection), so we can render it directly.
    final remaining = assignment.sessionsRemaining;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: 0.4, end: 1.0),
              duration: const Duration(milliseconds: 400),
              curve: const Cubic(0.2, 0.7, 0.3, 1),
              builder: (_, t, _) => Transform.scale(
                scale: t,
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: const BoxDecoration(
                    color: AppColors.lime,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.check_rounded,
                    size: 36,
                    color: AppColors.limeText,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
          Center(
            child: Text(
              'SESSION LOGGED',
              style: AppText.disp(
                  size: 28, letterSpacing: 1, color: AppColors.text, height: 1),
            ),
          ),
          const SizedBox(height: 6),
          Center(
            child: Text(
              '${assignment.member.name} · ${remaining < 0 ? 0 : remaining} sessions left',
              style: AppText.body(
                size: 14,
                color: AppColors.textSec,
                letterSpacing: -0.1,
              ),
            ),
          ),
          const SizedBox(height: 24),
          CButton(
            label: 'Done',
            variant: CButtonVariant.secondary,
            size: CButtonSize.md,
            full: true,
            onTap: onClose,
          ),
        ],
      ),
    );
  }
}
