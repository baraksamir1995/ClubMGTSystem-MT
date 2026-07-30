import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_text.dart';
import '../../../services/api_service.dart';
import '../../../utils/date_format.dart';
import '../../../widgets/avatar.dart';
import '../coach_app_state.dart';
import '../models.dart';

/// Attendance Log tab. Wired to `/api/coach/today` (today view) and
/// `/api/coach/assignments/{id}/history` (per-member view).
class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

enum _Mode { today, history }

class _AttendanceScreenState extends State<AttendanceScreen> {
  _Mode _mode = _Mode.today;
  String? _pickedAssignmentId;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<CoachAppState>();

    return Column(
      children: [
        _Header(
          mode: _mode,
          onModeChanged: (m) {
            setState(() {
              _mode = m;
              if (m == _Mode.today) _pickedAssignmentId = null;
            });
          },
        ),
        Expanded(
          child: RefreshIndicator(
            color: AppColors.lime,
            backgroundColor: AppColors.surface,
            onRefresh: () => _mode == _Mode.today
                ? context.read<CoachAppState>().refreshToday()
                : context.read<CoachAppState>().refreshRoster(),
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(18, 16, 18, 100),
              child: _body(state),
            ),
          ),
        ),
      ],
    );
  }

  Widget _body(CoachAppState state) {
    if (_mode == _Mode.today) {
      return _TodayLog(
        entries: state.todayLog,
        onTapEntry: (assignmentId) => context.push('/assignment/$assignmentId'),
      );
    }
    if (_pickedAssignmentId == null) {
      return _AssignmentPicker(
        assignments: state.assignments,
        onPick: (id) => setState(() => _pickedAssignmentId = id),
      );
    }
    final picked = state.assignmentById(_pickedAssignmentId!);
    if (picked == null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Center(
          child: Text(
            'That assignment is gone.',
            style: AppText.body(size: 13, color: AppColors.textSec),
          ),
        ),
      );
    }
    return _PerAssignmentHistory(
      assignment: picked,
      onBack: () => setState(() => _pickedAssignmentId = null),
      onOpenDetail: () => context.push('/assignment/${picked.assignmentId}'),
    );
  }
}

class _Header extends StatelessWidget {
  final _Mode mode;
  final ValueChanged<_Mode> onModeChanged;
  const _Header({required this.mode, required this.onModeChanged});
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
          Text('LOG',
              style: AppText.mono(size: 10, letterSpacing: 2, color: AppColors.lime)),
          const SizedBox(height: 4),
          Text(
            'ATTENDANCE',
            style: AppText.disp(
              size: 30,
              letterSpacing: 1.5,
              color: AppColors.text,
              height: 1,
            ),
          ),
          const SizedBox(height: 14),
          _SegmentedToggle(mode: mode, onChanged: onModeChanged),
        ],
      ),
    );
  }
}

class _SegmentedToggle extends StatelessWidget {
  final _Mode mode;
  final ValueChanged<_Mode> onChanged;
  const _SegmentedToggle({required this.mode, required this.onChanged});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          _SegBtn(label: 'Today', active: mode == _Mode.today, onTap: () => onChanged(_Mode.today)),
          _SegBtn(label: 'By member', active: mode == _Mode.history, onTap: () => onChanged(_Mode.history)),
        ],
      ),
    );
  }
}

class _SegBtn extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _SegBtn({required this.label, required this.active, required this.onTap});
  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(vertical: 9),
          decoration: BoxDecoration(
            color: active ? AppColors.surface2 : Colors.transparent,
            borderRadius: BorderRadius.circular(9),
            border: active
                ? Border(bottom: BorderSide(color: AppColors.borderStrong, width: 1))
                : null,
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: AppText.body(
              size: 13,
              weight: FontWeight.w600,
              color: active ? AppColors.text : AppColors.textSec,
              letterSpacing: -0.1,
            ),
          ),
        ),
      ),
    );
  }
}

class _TodayLog extends StatelessWidget {
  final List<TodayLogEntry> entries;
  final ValueChanged<String> onTapEntry;
  const _TodayLog({required this.entries, required this.onTapEntry});

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 60, horizontal: 20),
        child: Column(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: AppColors.surface,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.border),
              ),
              alignment: Alignment.center,
              child: Icon(Icons.calendar_today_outlined,
                  size: 26, color: AppColors.textSec),
            ),
            const SizedBox(height: 18),
            Text(
              'NO SESSIONS YET',
              style: AppText.disp(size: 22, letterSpacing: 1, color: AppColors.text),
            ),
            const SizedBox(height: 6),
            Text(
              'Log your first session via QR or the manual fallback.',
              textAlign: TextAlign.center,
              style: AppText.body(
                size: 13,
                color: AppColors.textSec,
                letterSpacing: -0.1,
              ),
            ),
          ],
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 4, 4, 14),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${entries.length}',
                style: AppText.disp(
                  size: 56,
                  letterSpacing: 1,
                  color: AppColors.text,
                  height: 1,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'SESSIONS TODAY',
                        style: AppText.mono(
                          size: 10,
                          letterSpacing: 1.5,
                          color: AppColors.textSec,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        fmtWeekdayDate(DateTime.now()),
                        style: AppText.body(
                          size: 13,
                          color: AppColors.text,
                          letterSpacing: -0.1,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Column(
              children: [
                for (int i = 0; i < entries.length; i++)
                  _TodayRow(
                    e: entries[i],
                    isLast: i == entries.length - 1,
                    onTap: () => onTapEntry(entries[i].assignmentId),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _TodayRow extends StatelessWidget {
  final TodayLogEntry e;
  final bool isLast;
  final VoidCallback onTap;
  const _TodayRow({required this.e, required this.isLast, required this.onTap});
  @override
  Widget build(BuildContext context) {
    final time = '${e.deliveredAt.hour.toString().padLeft(2, '0')}:'
        '${e.deliveredAt.minute.toString().padLeft(2, '0')}';
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(
          border: Border(
            bottom: isLast
                ? BorderSide.none
                : BorderSide(color: AppColors.border, width: 0.5),
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              padding: const EdgeInsets.symmetric(vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.surface2,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.border),
              ),
              alignment: Alignment.center,
              child: Text(
                time,
                style: AppText.mono(
                  size: 13,
                  letterSpacing: 0.5,
                  weight: FontWeight.w500,
                  color: AppColors.lime,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Avatar(name: e.member.name, size: 36),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    e.member.name,
                    style: AppText.body(
                      size: 14,
                      weight: FontWeight.w600,
                      color: AppColors.text,
                      letterSpacing: -0.2,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${e.sessionsTotal}-SESSION · ${e.sessionsRemaining} LEFT',
                    style: AppText.mono(
                      size: 10,
                      letterSpacing: 0.5,
                      color: AppColors.textSec,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, size: 16, color: AppColors.textTer),
          ],
        ),
      ),
    );
  }
}

class _AssignmentPicker extends StatelessWidget {
  final List<CoachAssignment> assignments;
  final ValueChanged<String> onPick;
  const _AssignmentPicker({required this.assignments, required this.onPick});
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 4, 4, 12),
          child: Text(
            'PICK A MEMBER TO VIEW HISTORY',
            style: AppText.mono(size: 10, letterSpacing: 2, color: AppColors.textSec),
          ),
        ),
        if (assignments.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 20),
            child: Center(
              child: Text(
                'No members assigned yet.',
                style: AppText.body(size: 13, color: AppColors.textSec),
              ),
            ),
          ),
        for (final a in assignments)
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => onPick(a.assignmentId),
            child: Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Avatar(name: a.member.name, size: 38),
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
                          '${a.sessionsUsed} SESSIONS LOGGED · ${a.packageName}',
                          style: AppText.mono(
                            size: 10,
                            letterSpacing: 0.5,
                            color: AppColors.textSec,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Icon(Icons.chevron_right_rounded,
                      size: 16, color: AppColors.textTer),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _PerAssignmentHistory extends StatelessWidget {
  final CoachAssignment assignment;
  final VoidCallback onBack;
  final VoidCallback onOpenDetail;
  const _PerAssignmentHistory({
    required this.assignment,
    required this.onBack,
    required this.onOpenDetail,
  });

  @override
  Widget build(BuildContext context) {
    final future = context.read<CoachAppState>().assignmentHistory(assignment.assignmentId);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: GestureDetector(
            onTap: onBack,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.transparent,
                borderRadius: BorderRadius.circular(99),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.arrow_back_ios_new_rounded,
                      size: 12, color: AppColors.textSec),
                  const SizedBox(width: 6),
                  Text(
                    'BACK',
                    style: AppText.mono(
                      size: 10,
                      letterSpacing: 1,
                      color: AppColors.textSec,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 14),
        FutureBuilder<List<AssignmentHistoryItem>>(
          future: future,
          builder: (context, snap) {
            final history = snap.data ?? const <AssignmentHistoryItem>[];
            final loading = snap.connectionState == ConnectionState.waiting;
            final error = snap.error;
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(
                    children: [
                      Avatar(name: assignment.member.name, size: 56),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              assignment.member.name.toUpperCase(),
                              style: AppText.disp(
                                size: 22,
                                letterSpacing: 0.8,
                                color: AppColors.text,
                                height: 1,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${history.length} SESSIONS · ${assignment.packageName.toUpperCase()}',
                              style: AppText.mono(
                                size: 11,
                                letterSpacing: 0.5,
                                color: AppColors.textSec,
                              ),
                            ),
                          ],
                        ),
                      ),
                      GestureDetector(
                        onTap: onOpenDetail,
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.transparent,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: AppColors.border),
                          ),
                          child: Icon(Icons.chevron_right_rounded,
                              size: 18, color: AppColors.text),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                if (loading)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 40),
                    child: Center(
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 1.6,
                          valueColor: AlwaysStoppedAnimation(AppColors.lime),
                        ),
                      ),
                    ),
                  )
                else if (error != null)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 24),
                    child: Center(
                      child: Text(
                        error is ApiException ? error.message : "Couldn't load history.",
                        style: AppText.body(size: 13, color: AppColors.textSec),
                      ),
                    ),
                  )
                else if (history.isEmpty)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 20),
                    child: Center(
                      child: Text(
                        'No sessions logged yet for this package.',
                        style: AppText.body(size: 13, color: AppColors.textSec),
                      ),
                    ),
                  )
                else
                  Container(
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: Column(
                        children: [
                          for (int i = 0; i < history.take(12).length; i++)
                            _HistoryRow(
                              h: history[i],
                              isLast: i == history.take(12).length - 1,
                            ),
                        ],
                      ),
                    ),
                  ),
              ],
            );
          },
        ),
      ],
    );
  }
}

class _HistoryRow extends StatelessWidget {
  final AssignmentHistoryItem h;
  final bool isLast;
  const _HistoryRow({required this.h, required this.isLast});

  @override
  Widget build(BuildContext context) {
    final hasNote = (h.note != null && h.note!.isNotEmpty);
    final time = '${h.deliveredAt.hour.toString().padLeft(2, '0')}:'
        '${h.deliveredAt.minute.toString().padLeft(2, '0')}';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: isLast
              ? BorderSide.none
              : BorderSide(color: AppColors.border, width: 0.5),
        ),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 38,
            child: Column(
              children: [
                Text(
                  '${h.deliveredAt.day}',
                  style: AppText.disp(
                    size: 16,
                    letterSpacing: 0,
                    color: AppColors.text,
                    height: 1,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  fmtShort(h.deliveredAt).split(' ').last.toUpperCase(),
                  style: AppText.mono(
                    size: 9,
                    letterSpacing: 1,
                    color: AppColors.textSec,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  time,
                  style: AppText.body(
                    size: 13,
                    weight: FontWeight.w500,
                    color: AppColors.text,
                    letterSpacing: -0.1,
                  ),
                ),
                if (hasNote) ...[
                  const SizedBox(height: 2),
                  Text(
                    h.note!,
                    style: AppText.body(
                      size: 11,
                      color: AppColors.textSec,
                      letterSpacing: -0.1,
                    ).copyWith(fontStyle: FontStyle.italic),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
