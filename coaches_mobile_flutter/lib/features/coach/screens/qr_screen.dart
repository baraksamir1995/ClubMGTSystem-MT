import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_text.dart';
import '../../../services/api_service.dart';
import '../../../widgets/avatar.dart';
import '../../../widgets/clby_app_bar.dart';
import '../../../widgets/qr_pattern.dart';
import '../coach_app_state.dart';
import '../models.dart';
import '../widgets/scan_overlay.dart';

/// Coach QR / Scan — the home tab, now wired to `/api/coach/*`.
///
/// `Your code` + the coach name come from `state.identity` (loaded by
/// HomeScreen on first build). The "DEMO · SIMULATE SCAN" panel shows
/// the first 4 active assignments and triggers a real decrement on the
/// server when the coach taps Confirm.
class QrScreen extends StatefulWidget {
  const QrScreen({super.key});

  @override
  State<QrScreen> createState() => _QrScreenState();
}

class _QrScreenState extends State<QrScreen> {
  ScanFlow _flow = ScanFlow.idle;
  CoachAssignment? _pendingAssignment;
  int _blockedMinutesLeft = 0;

  /// Local "scan delay" so the overlay shows READING CODE… briefly
  /// before the confirm sheet, matching the prototype's 900ms.
  Future<void> _simulateScan(CoachAssignment a) async {
    setState(() {
      _flow = ScanFlow.scanning;
      _pendingAssignment = a;
    });
    await Future.delayed(const Duration(milliseconds: 900));
    if (!mounted) return;
    setState(() => _flow = ScanFlow.confirm);
  }

  Future<void> _confirm() async {
    final a = _pendingAssignment;
    if (a == null) return;
    final state = context.read<CoachAppState>();
    try {
      await state.confirmSession(assignmentId: a.assignmentId);
      if (!mounted) return;
      // Re-read the updated assignment so the success sheet shows the
      // post-decrement remaining count.
      final after = state.assignmentById(a.assignmentId) ?? a.withDecrement();
      setState(() {
        _pendingAssignment = after;
        _flow = ScanFlow.success;
      });
    } on RecentlyLoggedException catch (e) {
      if (!mounted) return;
      setState(() {
        _blockedMinutesLeft = e.minutesLeft;
        _flow = ScanFlow.blocked;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        backgroundColor: AppColors.danger,
        behavior: SnackBarBehavior.floating,
        content: Text(e.message,
            style: AppText.body(size: 13, color: AppColors.white)),
      ));
      _reset();
    }
  }

  void _reset() {
    setState(() {
      _flow = ScanFlow.idle;
      _pendingAssignment = null;
      _blockedMinutesLeft = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<CoachAppState>();
    final id = state.identity;
    final activeChips = state.assignments
        .where((a) => a.state != AssignmentState.inactive)
        .take(4)
        .toList();

    return Stack(
      children: [
        Column(
          children: [
            const ClbyAppBar(title: 'Coach QR'),
            Expanded(
              child: RefreshIndicator(
                color: AppColors.lime,
                backgroundColor: AppColors.surface,
                onRefresh: () =>
                    context.read<CoachAppState>().refreshRoster(),
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(24, 24, 24, 100),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Center(
                        child: Text(
                          'YOUR CODE',
                          style: AppText.mono(
                            size: 11,
                            letterSpacing: 1.5,
                            color: AppColors.textSec,
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Center(
                        child: Text(
                          (id?.name ?? '—').toUpperCase(),
                          style: AppText.disp(
                            size: 32,
                            letterSpacing: 1,
                            color: AppColors.text,
                            height: 1,
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      Center(child: _QrCard(seed: id?.qrSeed ?? 'clby-coach')),
                      const SizedBox(height: 16),
                      Center(
                        child: SizedBox(
                          width: 240,
                          child: Text(
                            "Member scans this to log a session. You'll confirm before it counts.",
                            textAlign: TextAlign.center,
                            style: AppText.body(
                              size: 13,
                              color: AppColors.textSec,
                              letterSpacing: -0.1,
                              height: 1.4,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 28),
                      if (activeChips.isEmpty)
                        _EmptySimulator(hasAnyRoster: state.assignments.isNotEmpty)
                      else
                        _Simulator(
                          chips: activeChips,
                          onPick: _simulateScan,
                        ),
                      const SizedBox(height: 14),
                      _ManualLogRow(onTap: () => context.push('/manual-log')),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
        if (_flow != ScanFlow.idle)
          ScanOverlay(
            flow: _flow,
            assignment: _pendingAssignment,
            blockedMinutesLeft: _blockedMinutesLeft,
            onConfirm: _confirm,
            onClose: _reset,
          ),
      ],
    );
  }
}

class _QrCard extends StatelessWidget {
  final String seed;
  const _QrCard({required this.seed});
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 260,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: AppColors.lime.withValues(alpha: 0.12),
            blurRadius: 80,
            offset: const Offset(0, 30),
          ),
        ],
      ),
      child: Stack(
        children: [
          QrPattern(seed: seed, size: 220),
          const _CornerMark(top: 8, left: 8, corner: _Corner.tl),
          const _CornerMark(top: 8, right: 8, corner: _Corner.tr),
          const _CornerMark(bottom: 8, left: 8, corner: _Corner.bl),
          const _CornerMark(bottom: 8, right: 8, corner: _Corner.br),
        ],
      ),
    );
  }
}

enum _Corner { tl, tr, bl, br }

class _CornerMark extends StatelessWidget {
  final double? top, left, right, bottom;
  final _Corner corner;
  const _CornerMark({this.top, this.left, this.right, this.bottom, required this.corner});
  @override
  Widget build(BuildContext context) {
    Border b;
    switch (corner) {
      case _Corner.tl:
        b = const Border(
          top: BorderSide(color: AppColors.lime, width: 2),
          left: BorderSide(color: AppColors.lime, width: 2),
        );
        break;
      case _Corner.tr:
        b = const Border(
          top: BorderSide(color: AppColors.lime, width: 2),
          right: BorderSide(color: AppColors.lime, width: 2),
        );
        break;
      case _Corner.bl:
        b = const Border(
          bottom: BorderSide(color: AppColors.lime, width: 2),
          left: BorderSide(color: AppColors.lime, width: 2),
        );
        break;
      case _Corner.br:
        b = const Border(
          bottom: BorderSide(color: AppColors.lime, width: 2),
          right: BorderSide(color: AppColors.lime, width: 2),
        );
        break;
    }
    return Positioned(
      top: top,
      left: left,
      right: right,
      bottom: bottom,
      width: 14,
      height: 14,
      child: DecoratedBox(decoration: BoxDecoration(border: b)),
    );
  }
}

class _Simulator extends StatelessWidget {
  final List<CoachAssignment> chips;
  final ValueChanged<CoachAssignment> onPick;
  const _Simulator({required this.chips, required this.onPick});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.bolt_rounded, size: 14, color: AppColors.lime),
              const SizedBox(width: 6),
              Text(
                'DEMO · SIMULATE SCAN',
                style: AppText.mono(
                  size: 10,
                  letterSpacing: 1.5,
                  color: AppColors.textSec,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (final a in chips) _AssignmentChip(a: a, onTap: () => onPick(a)),
            ],
          ),
        ],
      ),
    );
  }
}

class _AssignmentChip extends StatelessWidget {
  final CoachAssignment a;
  final VoidCallback onTap;
  const _AssignmentChip({required this.a, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final first = a.member.name.split(' ').first;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.fromLTRB(6, 6, 10, 6),
        decoration: BoxDecoration(
          color: AppColors.surface2,
          borderRadius: BorderRadius.circular(99),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Avatar(name: a.member.name, size: 22),
            const SizedBox(width: 6),
            Text(
              first,
              style: AppText.body(
                size: 12,
                weight: FontWeight.w500,
                color: AppColors.text,
                letterSpacing: -0.1,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptySimulator extends StatelessWidget {
  final bool hasAnyRoster;
  const _EmptySimulator({required this.hasAnyRoster});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.bolt_rounded, size: 14, color: AppColors.textSec),
              const SizedBox(width: 6),
              Text(
                'DEMO · SIMULATE SCAN',
                style: AppText.mono(
                  size: 10,
                  letterSpacing: 1.5,
                  color: AppColors.textSec,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            hasAnyRoster
                ? 'No active members. Open the Members tab to see inactive accounts.'
                : 'No members assigned yet. Ask your gym admin to attach a session pack to one of your clients.',
            style: AppText.body(
              size: 12,
              color: AppColors.textTer,
              letterSpacing: -0.1,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}

class _ManualLogRow extends StatelessWidget {
  final VoidCallback onTap;
  const _ManualLogRow({required this.onTap});
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        decoration: BoxDecoration(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.borderStrong),
        ),
        child: Row(
          children: [
            Icon(Icons.edit_outlined, size: 16, color: AppColors.text),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Manual session log',
                style: AppText.body(
                  size: 14,
                  weight: FontWeight.w500,
                  color: AppColors.text,
                  letterSpacing: -0.1,
                ),
              ),
            ),
            Icon(Icons.chevron_right_rounded, size: 18, color: AppColors.textSec),
          ],
        ),
      ),
    );
  }
}
