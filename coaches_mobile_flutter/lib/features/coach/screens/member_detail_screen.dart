import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../core/constants/app_colors.dart';
import '../../../core/constants/app_text.dart';
import '../../../services/api_service.dart';
import '../../../utils/date_format.dart';
import '../../../widgets/avatar.dart';
import '../../../widgets/c_button.dart';
import '../../../widgets/clby_app_bar.dart';
import '../../../widgets/sessions_bar.dart';
import '../coach_app_state.dart';
import '../models.dart';

/// Assignment detail — the "Member detail" screen in the design,
/// scoped to a single session-pack assignment. Loads its history from
/// `/api/coach/assignments/{id}/history` on first build, groups it by
/// month, and supports per-session note editing via PATCH.
class MemberDetailScreen extends StatefulWidget {
  /// The route param. Despite the screen name (which mirrors the
  /// design's "Member detail"), this is an *assignment* id — a member
  /// may have multiple packages, each its own card and detail.
  final String assignmentId;

  const MemberDetailScreen({super.key, required this.assignmentId});

  @override
  State<MemberDetailScreen> createState() => _MemberDetailScreenState();
}

class _MemberDetailScreenState extends State<MemberDetailScreen> {
  late Future<List<AssignmentHistoryItem>> _historyFuture;

  /// Optimistic note overrides keyed by log id. Reset on a successful
  /// PATCH so the FutureBuilder's data wins; live updates also flow in
  /// after the next history refresh.
  final Map<String, String?> _noteOverrides = {};
  String? _editingLogId;

  @override
  void initState() {
    super.initState();
    _historyFuture = context.read<CoachAppState>().assignmentHistory(widget.assignmentId);
  }

  Future<void> _refreshHistory() async {
    final f = context.read<CoachAppState>().assignmentHistory(widget.assignmentId);
    setState(() => _historyFuture = f);
    await f;
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<CoachAppState>();
    final assignment = state.assignmentById(widget.assignmentId);
    if (assignment == null) {
      return Scaffold(
        backgroundColor: AppColors.bg,
        body: Column(
          children: [
            ClbyAppBar(title: 'Member', onBack: () => context.pop()),
            Expanded(
              child: Center(
                child: Text(
                  'Member not found',
                  style: AppText.body(size: 14, color: AppColors.textSec),
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Column(
        children: [
          ClbyAppBar(title: 'Member', onBack: () => context.pop()),
          Expanded(
            child: RefreshIndicator(
              color: AppColors.lime,
              backgroundColor: AppColors.surface,
              onRefresh: _refreshHistory,
              child: FutureBuilder<List<AssignmentHistoryItem>>(
                future: _historyFuture,
                builder: (context, snapshot) {
                  final history = snapshot.data ?? const <AssignmentHistoryItem>[];
                  final loading = snapshot.connectionState == ConnectionState.waiting;
                  final error = snapshot.error;

                  return ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(20, 4, 20, 32),
                    children: [
                      _Hero(assignment: assignment),
                      _PackageCard(assignment: assignment),
                      const SizedBox(height: 16),
                      _AttendanceHeader(total: history.length, loading: loading),
                      if (error != null)
                        _ErrorRow(
                          message: error is ApiException
                              ? error.message
                              : "Couldn't load history.",
                          onRetry: _refreshHistory,
                        )
                      else
                        ..._monthGroups(history),
                      if (!loading && history.isEmpty && error == null)
                        const _EmptyHistory(),
                    ],
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _monthGroups(List<AssignmentHistoryItem> history) {
    final byMonth = <String, List<AssignmentHistoryItem>>{};
    for (final h in history) {
      final key = '${h.deliveredAt.year.toString().padLeft(4, '0')}-'
          '${h.deliveredAt.month.toString().padLeft(2, '0')}';
      byMonth.putIfAbsent(key, () => []).add(h);
    }
    final keys = byMonth.keys.toList()..sort((a, b) => b.compareTo(a));
    return [
      for (final m in keys)
        _MonthGroup(
          monthKey: m,
          items: byMonth[m]!,
          editingLogId: _editingLogId,
          noteOverrides: _noteOverrides,
          onEdit: (id) => setState(() => _editingLogId = id),
          onSave: (id, note) async {
            final state = context.read<CoachAppState>();
            try {
              await state.updateSessionNote(logId: id, note: note);
              if (!mounted) return;
              setState(() {
                _noteOverrides[id] = note;
                _editingLogId = null;
              });
            } on ApiException catch (e) {
              if (!mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                backgroundColor: AppColors.danger,
                content: Text("Couldn't save: ${e.message}",
                    style: AppText.body(size: 13, color: AppColors.white)),
              ));
            }
          },
          onCancel: () => setState(() => _editingLogId = null),
        ),
    ];
  }
}

class _Hero extends StatelessWidget {
  final CoachAssignment assignment;
  const _Hero({required this.assignment});
  @override
  Widget build(BuildContext context) {
    final joined = assignment.member.joinedAt;
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, 14, 0, 22),
      child: Row(
        children: [
          Avatar(name: assignment.member.name, size: 72),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  assignment.member.name.toUpperCase(),
                  style: AppText.disp(
                    size: 28,
                    letterSpacing: 0.8,
                    color: AppColors.text,
                    height: 1,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  joined != null ? 'JOINED ${fmtMonthYear(joined)}' : 'COACH ROSTER',
                  style: AppText.mono(
                    size: 11,
                    letterSpacing: 0.5,
                    color: AppColors.textSec,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PackageCard extends StatelessWidget {
  final CoachAssignment assignment;
  const _PackageCard({required this.assignment});

  @override
  Widget build(BuildContext context) {
    final isLow = assignment.state == AssignmentState.low;
    final isInactive = assignment.state == AssignmentState.inactive;
    final bigColor = isLow
        ? AppColors.warn
        : (isInactive ? AppColors.textSec : AppColors.text);

    final decoration = BoxDecoration(
      color: isLow ? AppColors.warn.withValues(alpha: 0.10) : AppColors.surface,
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: isLow ? AppColors.warn : AppColors.border),
      gradient: isLow
          ? LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.warn.withValues(alpha: 0.20),
                AppColors.warn.withValues(alpha: 0.05),
              ],
            )
          : null,
    );

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: decoration,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  '${assignment.sessionsTotal}-SESSION ${_typeLabel(assignment.serviceType).toUpperCase()}',
                  style: AppText.mono(
                    size: 10,
                    letterSpacing: 2,
                    color: isLow ? AppColors.warn : AppColors.textSec,
                  ),
                ),
              ),
              if (isInactive)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0x0FFFFFFF),
                    borderRadius: BorderRadius.circular(99),
                  ),
                  child: Text(
                    assignment.reason == 'expired' ? 'EXPIRED' : 'COMPLETED',
                    style: AppText.mono(
                      size: 10,
                      letterSpacing: 1,
                      color: AppColors.textSec,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                '${assignment.sessionsRemaining}',
                style: AppText.disp(
                  size: 64,
                  letterSpacing: 1,
                  color: bigColor,
                  height: 0.9,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '/ ${assignment.sessionsTotal} sessions left',
                style: AppText.mono(
                  size: 13,
                  letterSpacing: 0.5,
                  color: AppColors.textTer,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SessionsBar(
            used: assignment.sessionsUsed,
            total: assignment.sessionsTotal,
            low: isLow,
            height: 8,
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.only(top: 14),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: AppColors.border, width: 0.5)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: _MetaCell(
                    label: 'ASSIGNED',
                    value: assignment.assignedAt != null
                        ? fmtDate(assignment.assignedAt!)
                        : '—',
                  ),
                ),
                _MetaCell(
                  label: 'EXPIRES',
                  value: assignment.expiresAt != null
                      ? fmtDate(assignment.expiresAt!)
                      : 'No expiry',
                  rightAlign: true,
                  valueColor: isLow ? AppColors.warn : AppColors.text,
                ),
              ],
            ),
          ),
          if (isLow && !isInactive) ...[
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0x40000000),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppColors.warn),
              ),
              child: Row(
                children: [
                  Icon(Icons.warning_amber_rounded, size: 14, color: AppColors.warn),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Suggest a renewal at the next session',
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
            ),
          ],
        ],
      ),
    );
  }

  String _typeLabel(String t) {
    switch (t) {
      case 'personal_trainer':
        return 'PT';
      case 'physiotherapist':
        return 'Physio';
      case 'nutritionist':
        return 'Nutrition';
      default:
        return 'Package';
    }
  }
}

class _MetaCell extends StatelessWidget {
  final String label;
  final String value;
  final bool rightAlign;
  final Color? valueColor;
  const _MetaCell({
    required this.label,
    required this.value,
    this.rightAlign = false,
    this.valueColor,
  });
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: rightAlign ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        Text(label,
            style: AppText.mono(size: 9, letterSpacing: 1, color: AppColors.textTer)),
        const SizedBox(height: 4),
        Text(value,
            style: AppText.body(
              size: 13,
              weight: FontWeight.w500,
              color: valueColor ?? AppColors.text,
            )),
      ],
    );
  }
}

class _AttendanceHeader extends StatelessWidget {
  final int total;
  final bool loading;
  const _AttendanceHeader({required this.total, required this.loading});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 8, 4, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Expanded(
            child: Text(
              'ATTENDANCE · LAST SESSIONS',
              style: AppText.mono(
                size: 10,
                letterSpacing: 2,
                color: AppColors.textSec,
              ),
            ),
          ),
          if (loading)
            SizedBox(
              width: 12,
              height: 12,
              child: CircularProgressIndicator(
                strokeWidth: 1.5,
                valueColor: AlwaysStoppedAnimation(AppColors.textSec),
              ),
            )
          else
            Text(
              '$total total',
              style: AppText.mono(
                size: 11,
                letterSpacing: 0,
                color: AppColors.textTer,
              ),
            ),
        ],
      ),
    );
  }
}

class _EmptyHistory extends StatelessWidget {
  const _EmptyHistory();
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 20),
      child: Center(
        child: Text(
          'No sessions logged yet for this package.',
          style: AppText.body(size: 13, color: AppColors.textSec),
        ),
      ),
    );
  }
}

class _ErrorRow extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;
  const _ErrorRow({required this.message, required this.onRetry});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Column(
        children: [
          Text(message,
              textAlign: TextAlign.center,
              style: AppText.body(size: 13, color: AppColors.textSec)),
          const SizedBox(height: 10),
          CButton(
            label: 'Retry',
            icon: Icons.refresh_rounded,
            variant: CButtonVariant.secondary,
            size: CButtonSize.sm,
            onTap: onRetry,
          ),
        ],
      ),
    );
  }
}

class _MonthGroup extends StatelessWidget {
  final String monthKey;
  final List<AssignmentHistoryItem> items;
  final String? editingLogId;
  final Map<String, String?> noteOverrides;
  final ValueChanged<String> onEdit;
  final Future<void> Function(String logId, String? note) onSave;
  final VoidCallback onCancel;

  const _MonthGroup({
    required this.monthKey,
    required this.items,
    required this.editingLogId,
    required this.noteOverrides,
    required this.onEdit,
    required this.onSave,
    required this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    final monthDate = DateTime.parse('$monthKey-01');
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(4, 8, 4, 8),
            child: Text(
              '${fmtMonthYear(monthDate)}  ·  ${items.length}',
              style: AppText.mono(
                size: 10,
                letterSpacing: 1,
                color: AppColors.textTer,
              ),
            ),
          ),
          Container(
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: Column(
                children: [
                  for (int i = 0; i < items.length; i++)
                    _SessionRow(
                      item: items[i],
                      isLast: i == items.length - 1,
                      noteOverride: noteOverrides[items[i].logId],
                      editing: editingLogId == items[i].logId,
                      onEdit: () => onEdit(items[i].logId),
                      onSave: (note) => onSave(items[i].logId, note),
                      onCancel: onCancel,
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

class _SessionRow extends StatefulWidget {
  final AssignmentHistoryItem item;
  final bool isLast;
  final String? noteOverride;
  final bool editing;
  final VoidCallback onEdit;
  final Future<void> Function(String? note) onSave;
  final VoidCallback onCancel;

  const _SessionRow({
    required this.item,
    required this.isLast,
    required this.noteOverride,
    required this.editing,
    required this.onEdit,
    required this.onSave,
    required this.onCancel,
  });

  @override
  State<_SessionRow> createState() => _SessionRowState();
}

class _SessionRowState extends State<_SessionRow> {
  late final TextEditingController _draft;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _draft = TextEditingController(text: _currentNote);
  }

  String _displayNote() => widget.noteOverride ?? widget.item.note ?? '';
  String get _currentNote => _displayNote();

  @override
  void didUpdateWidget(covariant _SessionRow old) {
    super.didUpdateWidget(old);
    if (widget.editing && !old.editing) _draft.text = _currentNote;
  }

  @override
  void dispose() {
    _draft.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.item.deliveredAt;
    final hasNote = _displayNote().isNotEmpty;
    final showBottomGap = widget.editing || hasNote;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        border: Border(
          bottom: widget.isLast
              ? BorderSide.none
              : BorderSide(color: AppColors.border, width: 0.5),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: AppColors.surface2,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      '${d.day}',
                      style: AppText.disp(
                        size: 16,
                        letterSpacing: 0.5,
                        color: AppColors.text,
                        height: 1,
                      ),
                    ),
                    Text(
                      fmtShort(d).split(' ').last.toUpperCase(), // "MAY"
                      style: AppText.mono(
                        size: 8,
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
                      _timeOnly(d),
                      style: AppText.body(
                        size: 14,
                        weight: FontWeight.w500,
                        color: AppColors.text,
                        letterSpacing: -0.1,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      fmtDate(d),
                      style: AppText.mono(
                        size: 11,
                        letterSpacing: 0.3,
                        color: AppColors.textSec,
                      ),
                    ),
                  ],
                ),
              ),
              if (!widget.editing)
                GestureDetector(
                  onTap: widget.onEdit,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                    decoration: BoxDecoration(
                      color: Colors.transparent,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.edit_outlined,
                            size: 12, color: AppColors.textSec),
                        const SizedBox(width: 4),
                        Text(
                          hasNote ? 'EDIT' : 'NOTE',
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
            ],
          ),
          if (showBottomGap) const SizedBox(height: 8),
          if (widget.editing)
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.surface2,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.lime),
                  ),
                  child: TextField(
                    controller: _draft,
                    maxLines: 2,
                    minLines: 2,
                    cursorColor: AppColors.lime,
                    style: AppText.body(
                      size: 13,
                      color: AppColors.text,
                      letterSpacing: -0.1,
                    ),
                    decoration: InputDecoration(
                      isCollapsed: true,
                      contentPadding: EdgeInsets.zero,
                      border: InputBorder.none,
                      hintText: 'Session notes (form, weights, pain levels…)',
                      hintStyle: AppText.body(
                        size: 13,
                        color: AppColors.textTer,
                        letterSpacing: -0.1,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    CButton(
                      label: 'Cancel',
                      variant: CButtonVariant.ghost,
                      size: CButtonSize.sm,
                      onTap: _saving ? null : widget.onCancel,
                    ),
                    const SizedBox(width: 6),
                    CButton(
                      label: _saving ? 'Saving…' : 'Save note',
                      variant: CButtonVariant.primary,
                      size: CButtonSize.sm,
                      disabled: _saving,
                      isLoading: _saving,
                      onTap: () async {
                        setState(() => _saving = true);
                        try {
                          await widget.onSave(_draft.text.trim().isEmpty
                              ? null
                              : _draft.text.trim());
                        } finally {
                          if (mounted) setState(() => _saving = false);
                        }
                      },
                    ),
                  ],
                ),
              ],
            )
          else if (hasNote)
            Padding(
              padding: const EdgeInsets.only(left: 52),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0x0AFFFFFF),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _displayNote(),
                  style: AppText.body(
                    size: 12,
                    color: AppColors.textSec,
                    letterSpacing: -0.1,
                    height: 1.4,
                  ).copyWith(fontStyle: FontStyle.italic),
                ),
              ),
            ),
        ],
      ),
    );
  }

  String _timeOnly(DateTime d) =>
      '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
}
