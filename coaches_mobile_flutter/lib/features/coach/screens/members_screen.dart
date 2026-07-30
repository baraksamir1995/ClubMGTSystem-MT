import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_text.dart';
import '../../../utils/date_format.dart';
import '../../../widgets/avatar.dart';
import '../../../widgets/sessions_bar.dart';
import '../coach_app_state.dart';
import '../models.dart';

/// Members tab — coach roster from `/api/coach/roster`. One card per
/// assignment (members may have multiple session packs). Active section
/// sorted low-balance first then by ascending remaining. Inactive
/// section collapsible.
class MembersScreen extends StatefulWidget {
  const MembersScreen({super.key});

  @override
  State<MembersScreen> createState() => _MembersScreenState();
}

class _MembersScreenState extends State<MembersScreen> {
  final _searchCtrl = TextEditingController();
  bool _showInactive = false;

  @override
  void initState() {
    super.initState();
    _searchCtrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<CoachAppState>();
    final q = _searchCtrl.text.trim().toLowerCase();

    bool match(CoachAssignment a) =>
        q.isEmpty || a.member.name.toLowerCase().contains(q);

    final active = state.assignments
        .where((a) => a.state != AssignmentState.inactive)
        .where(match)
        .toList()
      ..sort((a, b) {
        if (a.state == AssignmentState.low && b.state != AssignmentState.low) return -1;
        if (b.state == AssignmentState.low && a.state != AssignmentState.low) return 1;
        return a.sessionsRemaining.compareTo(b.sessionsRemaining);
      });

    final inactive = state.assignments
        .where((a) => a.state == AssignmentState.inactive)
        .where(match)
        .toList();

    return Column(
      children: [
        _Header(activeCount: active.length, searchCtrl: _searchCtrl),
        Expanded(
          child: RefreshIndicator(
            color: AppColors.lime,
            backgroundColor: AppColors.surface,
            onRefresh: () => context.read<CoachAppState>().refreshRoster(),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 100),
              children: [
                _SectionHeader(label: 'Active', count: active.length),
                if (active.isEmpty)
                  const _EmptyHint(text: 'No active members match your search.')
                else
                  for (final a in active)
                    _AssignmentCard(
                      a: a,
                      onTap: () => context.push('/assignment/${a.assignmentId}'),
                    ),
                if (inactive.isNotEmpty) ...[
                  const SizedBox(height: 14),
                  _SectionHeader(
                    label: 'Inactive',
                    count: inactive.length,
                    collapsible: true,
                    expanded: _showInactive,
                    onToggle: () => setState(() => _showInactive = !_showInactive),
                  ),
                  if (_showInactive)
                    for (final a in inactive)
                      _AssignmentCard(
                        a: a,
                        onTap: () => context.push('/assignment/${a.assignmentId}'),
                      ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _Header extends StatelessWidget {
  final int activeCount;
  final TextEditingController searchCtrl;
  const _Header({required this.activeCount, required this.searchCtrl});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 60, 18, 14),
      decoration: BoxDecoration(
        color: AppColors.bg,
        border: Border(bottom: BorderSide(color: AppColors.border, width: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'ROSTER',
                      style: AppText.mono(
                        size: 10,
                        letterSpacing: 2,
                        color: AppColors.lime,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'YOUR MEMBERS',
                      style: AppText.disp(
                        size: 30,
                        letterSpacing: 1.5,
                        color: AppColors.text,
                        height: 1,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                '$activeCount',
                style: AppText.disp(
                  size: 32,
                  letterSpacing: 1,
                  color: AppColors.text,
                  height: 1,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Container(
            height: 40,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.border),
            ),
            child: Row(
              children: [
                Icon(Icons.search_rounded, size: 16, color: AppColors.textSec),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: searchCtrl,
                    style: AppText.body(
                      size: 14,
                      color: AppColors.text,
                      letterSpacing: -0.1,
                    ),
                    cursorColor: AppColors.lime,
                    decoration: InputDecoration(
                      isCollapsed: true,
                      border: InputBorder.none,
                      hintText: 'Search members',
                      hintStyle: AppText.body(
                        size: 14,
                        color: AppColors.textTer,
                        letterSpacing: -0.1,
                      ),
                    ),
                  ),
                ),
                if (searchCtrl.text.isNotEmpty)
                  GestureDetector(
                    onTap: () => searchCtrl.clear(),
                    child: Icon(Icons.close_rounded, size: 14, color: AppColors.textSec),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String label;
  final int count;
  final bool collapsible;
  final bool expanded;
  final VoidCallback? onToggle;
  const _SectionHeader({
    required this.label,
    required this.count,
    this.collapsible = false,
    this.expanded = false,
    this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final row = Row(
      children: [
        Text(
          label.toUpperCase(),
          style: AppText.mono(
            size: 10,
            letterSpacing: 2,
            color: AppColors.textSec,
          ),
        ),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(
            '$count',
            style: AppText.mono(
              size: 10,
              letterSpacing: 0.5,
              color: AppColors.textTer,
            ),
          ),
        ),
        const SizedBox(width: 4),
        Expanded(child: Container(height: 0.5, color: AppColors.border)),
        if (collapsible) ...[
          const SizedBox(width: 8),
          Text(
            expanded ? 'HIDE' : 'SHOW',
            style: AppText.mono(
              size: 10,
              letterSpacing: 1,
              color: AppColors.textSec,
            ),
          ),
          const SizedBox(width: 4),
          AnimatedRotation(
            turns: expanded ? 0.25 : 0,
            duration: const Duration(milliseconds: 150),
            child: Icon(Icons.chevron_right_rounded,
                size: 14, color: AppColors.textSec),
          ),
        ],
      ],
    );
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 10, 4, 8),
      child: collapsible
          ? GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: onToggle,
              child: row,
            )
          : row,
    );
  }
}

class _EmptyHint extends StatelessWidget {
  final String text;
  const _EmptyHint({required this.text});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
      child: Center(
        child: Text(
          text,
          style: AppText.body(
            size: 13,
            color: AppColors.textSec,
            letterSpacing: -0.1,
          ),
        ),
      ),
    );
  }
}

class _AssignmentCard extends StatefulWidget {
  final CoachAssignment a;
  final VoidCallback onTap;
  const _AssignmentCard({required this.a, required this.onTap});

  @override
  State<_AssignmentCard> createState() => _AssignmentCardState();
}

class _AssignmentCardState extends State<_AssignmentCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final a = widget.a;
    final isLow = a.state == AssignmentState.low;
    final isInactive = a.state == AssignmentState.inactive;
    final bigNumberColor = isLow
        ? AppColors.warn
        : (isInactive ? AppColors.textSec : AppColors.text);

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: widget.onTap,
      child: AnimatedScale(
        scale: _pressed ? 0.99 : 1.0,
        duration: const Duration(milliseconds: 120),
        child: AnimatedOpacity(
          opacity: isInactive ? 0.55 : 1.0,
          duration: const Duration(milliseconds: 150),
          child: Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isLow
                  ? AppColors.warn.withValues(alpha: 0.10)
                  : AppColors.surface,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isLow ? AppColors.warn : AppColors.border,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Avatar(name: a.member.name, size: 44),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Flexible(
                                child: Text(
                                  a.member.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppText.body(
                                    size: 15,
                                    weight: FontWeight.w600,
                                    color: AppColors.text,
                                    letterSpacing: -0.2,
                                  ),
                                ),
                              ),
                              if (isInactive) ...[
                                const SizedBox(width: 8),
                                _ReasonChip(
                                  label: a.reason == 'expired'
                                      ? 'EXPIRED'
                                      : 'COMPLETED',
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _subtitle(a),
                            style: AppText.mono(
                              size: 11,
                              letterSpacing: 0.3,
                              color: AppColors.textSec,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Text(
                          '${a.sessionsRemaining}',
                          style: AppText.disp(
                            size: 28,
                            letterSpacing: 1,
                            color: bigNumberColor,
                            height: 1,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          '/${a.sessionsTotal}',
                          style: AppText.mono(
                            size: 9,
                            letterSpacing: 1,
                            color: AppColors.textTer,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                if (!isInactive) ...[
                  const SizedBox(height: 12),
                  SessionsBar(
                    used: a.sessionsUsed,
                    total: a.sessionsTotal,
                    low: isLow,
                  ),
                ],
                if (isLow) ...[
                  const SizedBox(height: 12),
                  _LowBalanceAlert(remaining: a.sessionsRemaining),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _subtitle(CoachAssignment a) {
    final prefix = '${a.sessionsTotal}-SESSION';
    final exp = a.expiresAt;
    return exp == null ? prefix : '$prefix · EXP ${fmtShort(exp)}';
  }
}

class _ReasonChip extends StatelessWidget {
  final String label;
  const _ReasonChip({required this.label});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: const Color(0x0FFFFFFF),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: AppText.mono(
          size: 9,
          letterSpacing: 1,
          weight: FontWeight.w500,
          color: AppColors.textSec,
        ),
      ),
    );
  }
}

class _LowBalanceAlert extends StatelessWidget {
  final int remaining;
  const _LowBalanceAlert({required this.remaining});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0x2E000000),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.warn),
      ),
      child: Row(
        children: [
          Icon(Icons.warning_amber_rounded, size: 14, color: AppColors.warn),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Only $remaining session${remaining == 1 ? '' : 's'} left — renew soon',
              style: AppText.body(
                size: 12,
                weight: FontWeight.w500,
                color: AppColors.warn,
                letterSpacing: -0.1,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
