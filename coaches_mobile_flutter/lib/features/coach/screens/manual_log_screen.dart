import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_text.dart';
import '../../../services/api_service.dart';
import '../../../widgets/avatar.dart';
import '../../../widgets/c_button.dart';
import '../../../widgets/clby_app_bar.dart';
import '../coach_app_state.dart';
import '../models.dart';

/// Manual session-log fallback. List of the coach's active assignments;
/// disabled rows for ones the server's 30-min guard will reject (we use
/// `lastSessionAt` from the roster as a hint — the server is still the
/// source of truth on Confirm).
class ManualLogScreen extends StatefulWidget {
  const ManualLogScreen({super.key});

  @override
  State<ManualLogScreen> createState() => _ManualLogScreenState();
}

class _ManualLogScreenState extends State<ManualLogScreen> {
  String? _pickedId;
  bool _saving = false;
  CoachAssignment? _confirmed; // non-null = show success view

  bool _isHintLocked(CoachAssignment a) {
    final last = a.lastSessionAt;
    if (last == null) return false;
    return DateTime.now().difference(last).inMinutes < 30;
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<CoachAppState>();

    if (_confirmed != null) {
      return _SuccessView(
        assignment: _confirmed!,
        onBack: () => context.pop(),
      );
    }

    final eligible = state.assignments
        .where((a) => a.state != AssignmentState.inactive)
        .toList();

    final picked = _pickedId == null ? null : state.assignmentById(_pickedId!);

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Column(
        children: [
          ClbyAppBar(title: 'Manual log', onBack: () => context.pop()),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 8),
            child: Text(
              'Pick a member to log a session manually. Same 30-minute guard applies.',
              style: AppText.body(
                size: 13,
                color: AppColors.textSec,
                letterSpacing: -0.1,
                height: 1.4,
              ),
            ),
          ),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(14, 4, 14, 24),
              itemCount: eligible.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final a = eligible[i];
                final blocked = _isHintLocked(a);
                final isPicked = _pickedId == a.assignmentId;
                return _AssignmentRow(
                  a: a,
                  blocked: blocked,
                  picked: isPicked,
                  onTap: blocked ? null : () => setState(() => _pickedId = a.assignmentId),
                );
              },
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
            decoration: const BoxDecoration(
              color: AppColors.bg,
              border: Border(top: BorderSide(color: AppColors.border, width: 0.5)),
            ),
            child: CButton(
              label: 'Confirm session',
              icon: Icons.check_rounded,
              variant: CButtonVariant.primary,
              size: CButtonSize.lg,
              full: true,
              disabled: picked == null || _saving,
              isLoading: _saving,
              onTap: picked == null
                  ? null
                  : () async {
                      // Capture the BuildContext-derived bits before the
                      // async gap so the analyzer (and our future self)
                      // can't get confused about which mounted check
                      // applies; lint use_build_context_synchronously is
                      // satisfied without the noise.
                      final state = context.read<CoachAppState>();
                      final messenger = ScaffoldMessenger.of(context);
                      setState(() => _saving = true);
                      try {
                        await state.confirmSession(
                          assignmentId: picked.assignmentId,
                        );
                        if (!mounted) return;
                        final after =
                            state.assignmentById(picked.assignmentId)
                                ?? picked.withDecrement();
                        setState(() => _confirmed = after);
                      } on RecentlyLoggedException catch (e) {
                        if (!mounted) return;
                        messenger.showSnackBar(SnackBar(
                          backgroundColor: AppColors.warn,
                          behavior: SnackBarBehavior.floating,
                          content: Text(
                            'Already logged in the last 30 minutes — try again in ${e.minutesLeft} min.',
                            style: AppText.body(size: 13, color: AppColors.limeText),
                          ),
                        ));
                      } on ApiException catch (e) {
                        if (!mounted) return;
                        messenger.showSnackBar(SnackBar(
                          backgroundColor: AppColors.danger,
                          behavior: SnackBarBehavior.floating,
                          content: Text(
                            e.message,
                            style: AppText.body(size: 13, color: AppColors.white),
                          ),
                        ));
                      } finally {
                        if (mounted) setState(() => _saving = false);
                      }
                    },
            ),
          ),
        ],
      ),
    );
  }
}

class _AssignmentRow extends StatelessWidget {
  final CoachAssignment a;
  final bool blocked;
  final bool picked;
  final VoidCallback? onTap;

  const _AssignmentRow({
    required this.a,
    required this.blocked,
    required this.picked,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return AnimatedOpacity(
      opacity: blocked ? 0.4 : 1,
      duration: const Duration(milliseconds: 120),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: picked ? AppColors.surface2 : AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: picked ? AppColors.lime : AppColors.border,
            ),
          ),
          child: Row(
            children: [
              Avatar(name: a.member.name, size: 40),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      a.member.name,
                      style: AppText.body(
                        size: 14,
                        weight: FontWeight.w600,
                        color: AppColors.text,
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${a.sessionsTotal}-SESSION · ${a.sessionsRemaining} LEFT'
                      '${blocked ? ' · LOCKED 30M' : ''}',
                      style: AppText.mono(
                        size: 11,
                        letterSpacing: 0.5,
                        color: AppColors.textSec,
                      ),
                    ),
                  ],
                ),
              ),
              if (picked)
                Icon(Icons.check_rounded, size: 18, color: AppColors.lime),
            ],
          ),
        ),
      ),
    );
  }
}

class _SuccessView extends StatelessWidget {
  final CoachAssignment assignment;
  final VoidCallback onBack;
  const _SuccessView({required this.assignment, required this.onBack});

  @override
  Widget build(BuildContext context) {
    final remaining = assignment.sessionsRemaining;
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Column(
        children: [
          ClbyAppBar(title: 'Manual log', onBack: onBack),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0.4, end: 1.0),
                    duration: const Duration(milliseconds: 400),
                    curve: const Cubic(0.2, 0.7, 0.3, 1),
                    builder: (_, t, _) => Transform.scale(
                      scale: t,
                      child: Container(
                        width: 80,
                        height: 80,
                        decoration: const BoxDecoration(
                          color: AppColors.lime,
                          shape: BoxShape.circle,
                        ),
                        alignment: Alignment.center,
                        child: const Icon(
                          Icons.check_rounded,
                          size: 40,
                          color: AppColors.limeText,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'SESSION LOGGED',
                    style: AppText.disp(
                      size: 30,
                      letterSpacing: 1,
                      color: AppColors.text,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '${assignment.member.name} · ${remaining < 0 ? 0 : remaining} sessions left',
                    style: AppText.body(
                      size: 14,
                      color: AppColors.textSec,
                      letterSpacing: -0.1,
                    ),
                  ),
                  const SizedBox(height: 32),
                  CButton(
                    label: 'Back to QR',
                    variant: CButtonVariant.primary,
                    size: CButtonSize.lg,
                    onTap: onBack,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
